import type { ColumnType, Generated } from 'kysely'

type Timestamp = Date
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

interface SessionTable {
  id: Generated<string>
  user_id: string
  token_hash: string
  expires_at: Timestamp
  revoked_at: Timestamp | null
  created_at: Generated<Timestamp>
  last_seen_at: Generated<Timestamp>
}
interface LoginAttemptTable {
  id: Generated<string>
  email_hash: string
  ip_hash: string
  succeeded: boolean
  attempted_at: Generated<Timestamp>
}
interface StockMovementTable {
  id: Generated<string>
  inventory_batch_id: string
  farm_id: string
  actor_user_id: string | null
  type:
    | 'stock_added'
    | 'stock_corrected'
    | 'stock_reserved'
    | 'reservation_released'
    | 'stock_sold'
    | 'stock_refunded'
    | 'stock_lost'
  quantity: Numeric
  reason: string | null
  created_at: Generated<Timestamp>
}
interface CartTable extends TimestampColumns {
  id: Generated<string>
  token_hash: string
  farm_id: string | null
  currency: Generated<string>
  expires_at: Timestamp
  checked_out_at: Timestamp | null
}
interface CartItemTable extends TimestampColumns {
  id: Generated<string>
  cart_id: string
  listing_id: string
  quantity: Numeric
}
interface OrderTable extends TimestampColumns {
  id: Generated<string>
  public_reference: string
  farm_id: string
  user_id: string | null
  guest_email: string
  status:
    | 'pending_payment'
    | 'paid'
    | 'preparing'
    | 'ready_for_pickup'
    | 'completed'
    | 'cancelled'
    | 'refunded'
  currency: string
  total_cents: number
  checkout_key: string
}
interface OrderItemTable {
  id: Generated<string>
  order_id: string
  listing_id: string | null
  product_name: string
  farm_name: string
  variety: string | null
  unit: string
  unit_quantity: Numeric
  price_cents: number
  vat_rate: Numeric
  quantity: Numeric
  total_cents: number
}
interface StockReservationTable {
  id: Generated<string>
  order_id: string
  inventory_batch_id: string
  quantity: Numeric
  status: 'active' | 'consumed' | 'released'
  expires_at: Timestamp
  created_at: Generated<Timestamp>
}
interface PaymentTable extends TimestampColumns {
  id: Generated<string>
  order_id: string
  provider: string
  provider_session_id: string
  status: string
  amount_cents: number
  currency: string
  checkout_url: string | null
}
interface PaymentEventTable {
  id: Generated<string>
  provider: string
  provider_event_id: string
  event_type: string
  payload: unknown
  processed_at: Generated<Timestamp>
}
interface GuestOrderAccessTable {
  order_id: string
  token_hash: string
  expires_at: Timestamp
  revoked_at: Timestamp | null
  created_at: Generated<Timestamp>
}
interface EmailJobTable {
  id: Generated<string>
  order_id: string | null
  template: string
  recipient: string
  payload: unknown
  attempts: Generated<number>
  available_at: Generated<Timestamp>
  processed_at: Timestamp | null
  last_error: string | null
  created_at: Generated<Timestamp>
}
interface AdminAuditLogTable {
  id: Generated<string>
  user_id: string
  farm_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: unknown
  created_at: Generated<Timestamp>
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
  sessions: SessionTable
  login_attempts: LoginAttemptTable
  stock_movements: StockMovementTable
  carts: CartTable
  cart_items: CartItemTable
  orders: OrderTable
  order_items: OrderItemTable
  stock_reservations: StockReservationTable
  payments: PaymentTable
  payment_events: PaymentEventTable
  guest_order_access: GuestOrderAccessTable
  email_jobs: EmailJobTable
  admin_audit_log: AdminAuditLogTable
}
