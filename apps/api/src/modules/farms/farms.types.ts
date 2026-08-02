export const productCategories = ['fruit', 'vegetable', 'herb', 'other'] as const
export type ProductCategory = (typeof productCategories)[number]

export interface NearbyFarmQuery {
  latitude: number
  longitude: number
  radiusKm: number
  category?: ProductCategory
  availableOnly: boolean
  limit: number
  offset: number
}

export interface NearbyFarm {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  postalCode: string
  distanceKm: number
}

export interface NearbyFarmPage {
  farms: NearbyFarm[]
  nextCursor: string | null
}

export interface PublicFarm {
  id: string
  name: string
  slug: string
  description: string | null
  publicEmail: string | null
  publicPhone: string | null
  location: {
    addressLine1: string
    addressLine2: string | null
    postalCode: string
    city: string
    countryCode: string
    latitude: number
    longitude: number
    pickupInstructions: string | null
  }
}

export interface PublicListing {
  id: string
  title: string
  description: string | null
  variety: string | null
  unit: 'piece' | 'kilogram' | 'gram' | 'bunch' | 'box' | 'basket'
  unitQuantity: string
  priceCents: number
  currency: string
  vatRate: string
  availableQuantity: string
  product: {
    id: string
    slug: string
    name: string
    category: ProductCategory
  }
}

export interface FarmsRepository {
  findNearby(query: NearbyFarmQuery): Promise<NearbyFarmPage>
  findPublicFarm(farmId: string): Promise<PublicFarm | undefined>
  findPublicListings(farmId: string): Promise<PublicListing[] | undefined>
}
