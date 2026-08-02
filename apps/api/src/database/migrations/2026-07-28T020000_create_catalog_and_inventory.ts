import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table product_catalog (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      name text not null,
      category text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint product_catalog_category check (category in ('fruit', 'vegetable', 'herb', 'other')),
      constraint product_catalog_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
    )
  `.execute(database)

  await sql`
    create table listings (
      id uuid primary key default gen_random_uuid(),
      farm_id uuid not null references farms(id) on delete cascade,
      product_catalog_id uuid not null references product_catalog(id),
      title text not null,
      description text,
      variety text,
      unit text not null,
      unit_quantity numeric(12, 3) not null,
      price_cents integer not null,
      currency char(3) not null default 'EUR',
      vat_rate numeric(5, 2) not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint listings_unit check (unit in ('piece', 'kilogram', 'gram', 'bunch', 'box', 'basket')),
      constraint listings_unit_quantity_positive check (unit_quantity > 0),
      constraint listings_price_cents_nonnegative check (price_cents >= 0),
      constraint listings_currency_format check (currency ~ '^[A-Z]{3}$'),
      constraint listings_vat_rate_range check (vat_rate >= 0 and vat_rate <= 100)
    )
  `.execute(database)
  await sql`create index listings_farm_active_idx on listings (farm_id, is_active)`.execute(
    database
  )
  await sql`create index listings_catalog_idx on listings (product_catalog_id)`.execute(database)

  await sql`
    create table inventory_batches (
      id uuid primary key default gen_random_uuid(),
      listing_id uuid not null references listings(id) on delete cascade,
      available_quantity numeric(12, 3) not null,
      reserved_quantity numeric(12, 3) not null default 0,
      harvested_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint inventory_batches_available_nonnegative check (available_quantity >= 0),
      constraint inventory_batches_reserved_nonnegative check (reserved_quantity >= 0),
      constraint inventory_batches_reserved_not_above_available check (reserved_quantity <= available_quantity),
      constraint inventory_batches_expiry_after_harvest check (
        expires_at is null or harvested_at is null or expires_at >= harvested_at
      )
    )
  `.execute(database)
  await sql`create index inventory_batches_listing_idx on inventory_batches (listing_id)`.execute(
    database
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists inventory_batches`.execute(database)
  await sql`drop table if exists listings`.execute(database)
  await sql`drop table if exists product_catalog`.execute(database)
}
