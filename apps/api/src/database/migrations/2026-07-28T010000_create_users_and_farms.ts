import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table users (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      password_hash text not null,
      display_name text not null,
      email_verified_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint users_email_not_blank check (btrim(email) <> ''),
      constraint users_password_hash_argon2id check (password_hash like '$argon2id$%')
    )
  `.execute(database)
  await sql`create unique index users_email_unique on users (lower(email))`.execute(database)

  await sql`
    create table farms (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      slug text not null unique,
      description text,
      public_email text,
      public_phone text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint farms_name_not_blank check (btrim(name) <> ''),
      constraint farms_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
    )
  `.execute(database)

  await sql`
    create table farm_members (
      farm_id uuid not null references farms(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      role text not null,
      created_at timestamptz not null default now(),
      primary key (farm_id, user_id),
      constraint farm_members_role check (role in ('owner', 'manager', 'staff'))
    )
  `.execute(database)
  await sql`create index farm_members_user_id_idx on farm_members (user_id)`.execute(database)

  await sql`
    create table farm_locations (
      id uuid primary key default gen_random_uuid(),
      farm_id uuid not null unique references farms(id) on delete cascade,
      address_line1 text not null,
      address_line2 text,
      postal_code text not null,
      city text not null,
      country_code char(2) not null,
      location geography(point, 4326) not null,
      pickup_instructions text,
      is_public boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint farm_locations_country_code check (country_code ~ '^[A-Z]{2}$')
    )
  `.execute(database)
  await sql`create index farm_locations_location_gist on farm_locations using gist (location)`.execute(
    database
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists farm_locations`.execute(database)
  await sql`drop table if exists farm_members`.execute(database)
  await sql`drop table if exists farms`.execute(database)
  await sql`drop table if exists users`.execute(database)
}
