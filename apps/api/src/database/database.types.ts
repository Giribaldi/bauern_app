import type { ColumnType, Generated } from 'kysely'

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type Numeric = ColumnType<string, string, string>

interface TimestampColumns {
  created_at: Generated<Timestamp>
  updated_at: Generated<Timestamp>
}

export interface UserTable extends TimestampColumns {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  email_verified_at: Timestamp | null
}

export interface FarmTable extends TimestampColumns {
  id: Generated<string>
  name: string
  slug: string
  description: string | null
  public_email: string | null
  public_phone: string | null
  is_active: Generated<boolean>
}

export interface FarmMemberTable {
  farm_id: string
  user_id: string
  role: 'owner' | 'manager' | 'staff'
  created_at: Generated<Timestamp>
}

export interface FarmLocationTable extends TimestampColumns {
  id: Generated<string>
  farm_id: string
  address_line1: string
  address_line2: string | null
  postal_code: string
  city: string
  country_code: string
  location: unknown
  pickup_instructions: string | null
  is_public: Generated<boolean>
}

export interface ProductCatalogTable extends TimestampColumns {
  id: Generated<string>
  slug: string
  name: string
  category: 'fruit' | 'vegetable' | 'herb' | 'other'
}

export interface ListingTable extends TimestampColumns {
  id: Generated<string>
  farm_id: string
  product_catalog_id: string
  title: string
  description: string | null
  variety: string | null
  unit: 'piece' | 'kilogram' | 'gram' | 'bunch' | 'box' | 'basket'
  unit_quantity: Numeric
  price_cents: number
  currency: string
  vat_rate: Numeric
  is_active: Generated<boolean>
}

export interface InventoryBatchTable extends TimestampColumns {
  id: Generated<string>
  listing_id: string
  available_quantity: Numeric
  reserved_quantity: Numeric
  harvested_at: Timestamp | null
  expires_at: Timestamp | null
}

/** Kysely's internal shape. It must never be exposed through HTTP contracts. */
export interface Database {
  users: UserTable
  farms: FarmTable
  farm_members: FarmMemberTable
  farm_locations: FarmLocationTable
  product_catalog: ProductCatalogTable
  listings: ListingTable
  inventory_batches: InventoryBatchTable
}
