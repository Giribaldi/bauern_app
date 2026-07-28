import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`create extension if not exists postgis`.execute(database)
  await sql`create extension if not exists pgcrypto`.execute(database)
}

/**
 * Extensions can be shared by objects outside this application. Rolling this
 * migration back only removes its migration record and deliberately keeps the
 * extensions installed.
 */
export async function down(): Promise<void> {}
