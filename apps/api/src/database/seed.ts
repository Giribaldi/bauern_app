import { sql, type Kysely } from 'kysely'
import { fileURLToPath } from 'node:url'
import { reportDatabaseCommandFailure, runDatabaseCommand } from './command'
import type { Database } from './database.types'

const ids = {
  users: ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'],
  farms: ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'],
  locations: ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'],
  products: [
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
  ],
  listings: [
    '50000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000005',
  ],
  batches: [
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
  ],
} as const

// Seed accounts are deliberately not usable for authentication. The values keep
// the required Argon2id storage format without introducing a shared password.
const disabledArgon2idHash =
  '$argon2id$v=19$m=65536,t=3,p=1$c2VlZC1hY2NvdW50LWRpc2FibGVk$bm90LWEtdmFsaWQtc2hhcmVkLXBhc3N3b3Jk'

export const seedDatabase = async (database: Kysely<Database>): Promise<void> => {
  await database.transaction().execute(async (transaction) => {
    await sql`
      insert into users (id, email, password_hash, display_name, email_verified_at)
      values
        (${ids.users[0]}, 'alice.seed@local-market.test', ${disabledArgon2idHash}, 'Alice Martin', now()),
        (${ids.users[1]}, 'benoit.seed@local-market.test', ${disabledArgon2idHash}, 'Benoît Dubois', now())
      on conflict (id) do update set
        email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now()
    `.execute(transaction)

    await sql`
      insert into farms (id, name, slug, description, public_email, public_phone, is_active)
      values
        (${ids.farms[0]}, 'Ferme des Prés', 'ferme-des-pres', 'Maraîchage biologique près de Lyon.', 'contact@fermedespres.test', '+33400000001', true),
        (${ids.farms[1]}, 'Vergers du Rhône', 'vergers-du-rhone', 'Fruits de saison cultivés dans le Rhône.', 'bonjour@vergersdurhone.test', '+33400000002', true)
      on conflict (id) do update set
        name = excluded.name,
        description = excluded.description,
        public_email = excluded.public_email,
        public_phone = excluded.public_phone,
        is_active = excluded.is_active,
        updated_at = now()
    `.execute(transaction)

    await sql`
      insert into farm_members (farm_id, user_id, role)
      values (${ids.farms[0]}, ${ids.users[0]}, 'owner'), (${ids.farms[1]}, ${ids.users[1]}, 'owner')
      on conflict (farm_id, user_id) do update set role = excluded.role
    `.execute(transaction)

    await sql`
      insert into farm_locations (
        id, farm_id, address_line1, postal_code, city, country_code, location,
        pickup_instructions, is_public
      )
      values
        (${ids.locations[0]}, ${ids.farms[0]}, '12 chemin des Prés', '69009', 'Lyon', 'FR', ST_SetSRID(ST_MakePoint(4.8357, 45.7640), 4326)::geography, 'Retrait à la grange.', true),
        (${ids.locations[1]}, ${ids.farms[1]}, '8 route des Vergers', '69420', 'Condrieu', 'FR', ST_SetSRID(ST_MakePoint(4.7670, 45.4630), 4326)::geography, 'Sonner au portail vert.', true)
      on conflict (id) do update set
        location = excluded.location,
        pickup_instructions = excluded.pickup_instructions,
        is_public = excluded.is_public,
        updated_at = now()
    `.execute(transaction)

    await sql`
      insert into product_catalog (id, slug, name, category)
      values
        (${ids.products[0]}, 'tomate', 'Tomate', 'vegetable'),
        (${ids.products[1]}, 'pomme', 'Pomme', 'fruit'),
        (${ids.products[2]}, 'basilic', 'Basilic', 'herb')
      on conflict (id) do update set name = excluded.name, category = excluded.category, updated_at = now()
    `.execute(transaction)

    await sql`
      insert into listings (
        id, farm_id, product_catalog_id, title, description, variety, unit,
        unit_quantity, price_cents, currency, vat_rate, is_active
      )
      values
        (${ids.listings[0]}, ${ids.farms[0]}, ${ids.products[0]}, 'Tomates anciennes', 'Mélange coloré', 'Anciennes', 'kilogram', 1, 450, 'EUR', 5.5, true),
        (${ids.listings[1]}, ${ids.farms[0]}, ${ids.products[2]}, 'Bouquet de basilic', null, 'Grand vert', 'bunch', 1, 220, 'EUR', 5.5, true),
        (${ids.listings[2]}, ${ids.farms[1]}, ${ids.products[1]}, 'Pommes Gala', 'Récolte du verger', 'Gala', 'kilogram', 1, 320, 'EUR', 5.5, true),
        (${ids.listings[3]}, ${ids.farms[1]}, ${ids.products[1]}, 'Pommes sans stock', null, 'Golden', 'kilogram', 1, 290, 'EUR', 5.5, true),
        (${ids.listings[4]}, ${ids.farms[0]}, ${ids.products[0]}, 'Offre inactive', null, null, 'box', 1, 900, 'EUR', 5.5, false)
      on conflict (id) do update set
        title = excluded.title,
        price_cents = excluded.price_cents,
        is_active = excluded.is_active,
        updated_at = now()
    `.execute(transaction)

    await sql`
      insert into inventory_batches (
        id, listing_id, available_quantity, reserved_quantity, harvested_at, expires_at
      )
      values
        (${ids.batches[0]}, ${ids.listings[0]}, 30, 2, '2026-07-25T08:00:00Z', '2026-08-10T08:00:00Z'),
        (${ids.batches[1]}, ${ids.listings[1]}, 12, 0, '2026-07-27T08:00:00Z', '2026-08-05T08:00:00Z'),
        (${ids.batches[2]}, ${ids.listings[2]}, 80, 5, '2026-07-20T08:00:00Z', '2026-09-20T08:00:00Z')
      on conflict (id) do update set
        available_quantity = excluded.available_quantity,
        reserved_quantity = excluded.reserved_quantity,
        updated_at = now()
    `.execute(transaction)
  })
}

const main = async (): Promise<void> => {
  await runDatabaseCommand(seedDatabase)
  console.log('Development seed applied.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    reportDatabaseCommandFailure('Database seed', error)
  })
}
