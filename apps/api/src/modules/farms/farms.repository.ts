import { sql, type Kysely } from 'kysely'
import type { Database } from '../../database/database.types'
import type {
  FarmsRepository,
  NearbyFarm,
  NearbyFarmPage,
  NearbyFarmQuery,
  PublicFarm,
  PublicListing,
} from './farms.types'

interface NearbyFarmRow {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  postal_code: string
  distance_km: number
}

interface PublicFarmRow {
  id: string
  name: string
  slug: string
  description: string | null
  public_email: string | null
  public_phone: string | null
  address_line1: string
  address_line2: string | null
  postal_code: string
  city: string
  country_code: string
  latitude: number
  longitude: number
  pickup_instructions: string | null
}

interface PublicListingRow {
  id: string
  title: string
  description: string | null
  variety: string | null
  unit: PublicListing['unit']
  unit_quantity: string
  price_cents: number
  currency: string
  vat_rate: string
  available_quantity: string
  product_id: string
  product_slug: string
  product_name: string
  category: PublicListing['product']['category']
}

const mapNearbyFarm = (row: NearbyFarmRow): NearbyFarm => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  city: row.city,
  postalCode: row.postal_code,
  distanceKm: row.distance_km,
})

export const createFarmsRepository = (database: Kysely<Database>): FarmsRepository => ({
  async findNearby(query: NearbyFarmQuery): Promise<NearbyFarmPage> {
    const point = sql`ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography`
    const categoryCondition =
      query.category === undefined
        ? sql<boolean>`true`
        : sql<boolean>`filtered_product.category = ${query.category}`
    const availabilityCondition = query.availableOnly
      ? sql<boolean>`exists (
          select 1
          from inventory_batches available_batch
          where available_batch.listing_id = filtered_listing.id
            and available_batch.available_quantity - available_batch.reserved_quantity > 0
        )`
      : sql<boolean>`true`
    const listingFilter =
      query.category === undefined && !query.availableOnly
        ? sql<boolean>`true`
        : sql<boolean>`exists (
            select 1
            from listings filtered_listing
            inner join product_catalog filtered_product
              on filtered_product.id = filtered_listing.product_catalog_id
            where filtered_listing.farm_id = farms.id
              and filtered_listing.is_active = true
              and ${categoryCondition}
              and ${availabilityCondition}
          )`

    const result = await sql<NearbyFarmRow>`
      select
        farms.id,
        farms.name,
        farms.slug,
        farms.description,
        farm_locations.city,
        farm_locations.postal_code,
        (ST_Distance(farm_locations.location, ${point}) / 1000.0)::double precision as distance_km
      from farms
      inner join farm_locations on farm_locations.farm_id = farms.id
      where farms.is_active = true
        and farm_locations.is_public = true
        and ST_DWithin(farm_locations.location, ${point}, ${query.radiusKm * 1000})
        and ${listingFilter}
      order by ST_Distance(farm_locations.location, ${point}), farms.id
      limit ${query.limit + 1}
      offset ${query.offset}
    `.execute(database)

    const hasNextPage = result.rows.length > query.limit
    return {
      farms: result.rows.slice(0, query.limit).map(mapNearbyFarm),
      nextCursor: hasNextPage ? String(query.offset + query.limit) : null,
    }
  },

  async findPublicFarm(farmId: string): Promise<PublicFarm | undefined> {
    const result = await sql<PublicFarmRow>`
      select
        farms.id,
        farms.name,
        farms.slug,
        farms.description,
        farms.public_email,
        farms.public_phone,
        farm_locations.address_line1,
        farm_locations.address_line2,
        farm_locations.postal_code,
        farm_locations.city,
        farm_locations.country_code,
        ST_Y(farm_locations.location::geometry)::double precision as latitude,
        ST_X(farm_locations.location::geometry)::double precision as longitude,
        farm_locations.pickup_instructions
      from farms
      inner join farm_locations on farm_locations.farm_id = farms.id
      where farms.id = ${farmId}
        and farms.is_active = true
        and farm_locations.is_public = true
      limit 1
    `.execute(database)
    const row = result.rows[0]
    if (row === undefined) return undefined

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      publicEmail: row.public_email,
      publicPhone: row.public_phone,
      location: {
        addressLine1: row.address_line1,
        addressLine2: row.address_line2,
        postalCode: row.postal_code,
        city: row.city,
        countryCode: row.country_code,
        latitude: row.latitude,
        longitude: row.longitude,
        pickupInstructions: row.pickup_instructions,
      },
    }
  },

  async findPublicListings(farmId: string): Promise<PublicListing[] | undefined> {
    const farm = await sql<{ exists: boolean }>`
      select exists (
        select 1 from farms where id = ${farmId} and is_active = true
      ) as exists
    `.execute(database)
    if (farm.rows[0]?.exists !== true) return undefined

    const result = await sql<PublicListingRow>`
      select
        listings.id,
        listings.title,
        listings.description,
        listings.variety,
        listings.unit,
        listings.unit_quantity::text,
        listings.price_cents,
        listings.currency,
        listings.vat_rate::text,
        coalesce(sum(inventory_batches.available_quantity - inventory_batches.reserved_quantity), 0)::text
          as available_quantity,
        product_catalog.id as product_id,
        product_catalog.slug as product_slug,
        product_catalog.name as product_name,
        product_catalog.category
      from listings
      inner join product_catalog on product_catalog.id = listings.product_catalog_id
      left join inventory_batches on inventory_batches.listing_id = listings.id
      where listings.farm_id = ${farmId} and listings.is_active = true
      group by listings.id, product_catalog.id
      order by listings.title, listings.id
    `.execute(database)

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      variety: row.variety,
      unit: row.unit,
      unitQuantity: row.unit_quantity,
      priceCents: row.price_cents,
      currency: row.currency,
      vatRate: row.vat_rate,
      availableQuantity: row.available_quantity,
      product: {
        id: row.product_id,
        slug: row.product_slug,
        name: row.product_name,
        category: row.category,
      },
    }))
  },
})
