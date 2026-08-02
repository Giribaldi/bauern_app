import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table sessions (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
      token_hash char(64) not null unique, expires_at timestamptz not null, revoked_at timestamptz,
      created_at timestamptz not null default now(), last_seen_at timestamptz not null default now()
    );
    create index sessions_user_active_idx on sessions (user_id, expires_at) where revoked_at is null;

    create table login_attempts (
      id bigserial primary key, email_hash char(64) not null, ip_hash char(64) not null,
      succeeded boolean not null, attempted_at timestamptz not null default now()
    );
    create index login_attempts_rate_idx on login_attempts (email_hash, ip_hash, attempted_at desc);

    create table stock_movements (
      id uuid primary key default gen_random_uuid(), inventory_batch_id uuid not null references inventory_batches(id),
      farm_id uuid not null references farms(id), actor_user_id uuid references users(id),
      type text not null check (type in ('stock_added','stock_corrected','stock_reserved','reservation_released','stock_sold','stock_refunded','stock_lost')),
      quantity numeric(12,3) not null check (quantity <> 0), reason text,
      created_at timestamptz not null default now(),
      constraint stock_movements_correction_reason check (type <> 'stock_corrected' or btrim(coalesce(reason, '')) <> '')
    );
    create index stock_movements_farm_created_idx on stock_movements (farm_id, created_at desc);

    create table carts (
      id uuid primary key default gen_random_uuid(), token_hash char(64) not null unique,
      farm_id uuid references farms(id), currency char(3) not null default 'EUR',
      expires_at timestamptz not null, checked_out_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table cart_items (
      id uuid primary key default gen_random_uuid(), cart_id uuid not null references carts(id) on delete cascade,
      listing_id uuid not null references listings(id), quantity numeric(12,3) not null check (quantity > 0),
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique (cart_id, listing_id)
    );

    create table orders (
      id uuid primary key default gen_random_uuid(), public_reference text not null unique,
      farm_id uuid not null references farms(id), user_id uuid references users(id), guest_email text not null,
      status text not null check (status in ('pending_payment','paid','preparing','ready_for_pickup','completed','cancelled','refunded')),
      currency char(3) not null, total_cents integer not null check (total_cents >= 0),
      checkout_key text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create index orders_farm_created_idx on orders (farm_id, created_at desc);
    create table order_items (
      id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade,
      listing_id uuid references listings(id), product_name text not null, farm_name text not null, variety text,
      unit text not null, unit_quantity numeric(12,3) not null, price_cents integer not null,
      vat_rate numeric(5,2) not null, quantity numeric(12,3) not null, total_cents integer not null
    );
    create table stock_reservations (
      id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade,
      inventory_batch_id uuid not null references inventory_batches(id), quantity numeric(12,3) not null check (quantity > 0),
      status text not null check (status in ('active','consumed','released')),
      expires_at timestamptz not null, created_at timestamptz not null default now()
    );
    create index stock_reservations_expiry_idx on stock_reservations (expires_at) where status = 'active';
    create table payments (
      id uuid primary key default gen_random_uuid(), order_id uuid not null unique references orders(id) on delete cascade,
      provider text not null, provider_session_id text not null unique, status text not null,
      amount_cents integer not null, currency char(3) not null, checkout_url text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table payment_events (
      id uuid primary key default gen_random_uuid(), provider text not null, provider_event_id text not null,
      event_type text not null, payload jsonb not null, processed_at timestamptz not null default now(),
      unique (provider, provider_event_id)
    );
    create table guest_order_access (
      order_id uuid primary key references orders(id) on delete cascade, token_hash char(64) not null unique,
      expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
    );
    create table email_jobs (
      id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
      template text not null, recipient text not null, payload jsonb not null, attempts integer not null default 0,
      available_at timestamptz not null default now(), processed_at timestamptz, last_error text,
      created_at timestamptz not null default now()
    );
    create table admin_audit_log (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id), farm_id uuid references farms(id),
      action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    drop table if exists admin_audit_log, email_jobs, guest_order_access, payment_events, payments,
      stock_reservations, order_items, orders, cart_items, carts, stock_movements, login_attempts, sessions
  `.execute(database)
}
