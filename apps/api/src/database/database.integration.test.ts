import { randomUUID } from 'node:crypto'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { parseDatabaseEnvironment } from '../config/env'
import { loadRootEnvironment } from '../config/load-root-environment'
import { createFarmsRepository } from '../modules/farms/farms.repository'
import { createDatabase, verifyDatabaseConnection } from './connection'
import type { Database } from './database.types'
import {
  createMigrator,
  getMigrationStatus,
  migrateToLatest,
  rollbackLastMigration,
} from './migrator'
import { seedDatabase } from './seed'

const runIntegrationTests = process.env.RUN_DATABASE_INTEGRATION === '1'
const describeDatabase = runIntegrationTests ? describe : describe.skip

describeDatabase('Phase 2 PostgreSQL/PostGIS integration', () => {
  const testDatabaseName = `local_market_test_${randomUUID().replaceAll('-', '')}`
  let administrationDatabase: Kysely<Database>
  let database: Kysely<Database>

  beforeAll(async () => {
    loadRootEnvironment()
    const { databaseUrl } = parseDatabaseEnvironment(process.env)
    const administrationUrl = new URL(databaseUrl)
    administrationUrl.pathname = '/postgres'

    administrationDatabase = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: administrationUrl.toString(), max: 1 }),
      }),
    })
    await sql.raw(`create database "${testDatabaseName}"`).execute(administrationDatabase)

    const testDatabaseUrl = new URL(databaseUrl)
    testDatabaseUrl.pathname = `/${testDatabaseName}`
    database = createDatabase({ databaseUrl: testDatabaseUrl.toString(), maxConnections: 2 })
  }, 30_000)

  afterAll(async () => {
    if (database !== undefined) await database.destroy()
    if (administrationDatabase !== undefined) {
      await sql`
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where datname = ${testDatabaseName} and pid <> pg_backend_pid()
      `.execute(administrationDatabase)
      await sql.raw(`drop database if exists "${testDatabaseName}"`).execute(administrationDatabase)
      await administrationDatabase.destroy()
    }
  }, 30_000)

  it('validates migrations, seed, spatial queries, HTTP routes, rollback and remigration', async () => {
    await verifyDatabaseConnection(database)
    const migrator = createMigrator(database)
    const migration = await migrateToLatest(migrator)
    expect(
      migration.results?.map(({ migrationName, status }) => ({ migrationName, status }))
    ).toEqual([
      {
        migrationName: '2026-07-28T000000_enable_postgresql_extensions',
        status: 'Success',
      },
      { migrationName: '2026-07-28T010000_create_users_and_farms', status: 'Success' },
      { migrationName: '2026-07-28T020000_create_catalog_and_inventory', status: 'Success' },
    ])

    const extensions = await sql<{ extname: string }>`
      select extname from pg_extension
      where extname in ('postgis', 'pgcrypto') order by extname
    `.execute(database)
    expect(extensions.rows.map(({ extname }) => extname)).toEqual(['pgcrypto', 'postgis'])

    const status = await getMigrationStatus(migrator)
    expect(status).toHaveLength(3)
    expect(status.every(({ executedAt }) => executedAt instanceof Date)).toBe(true)

    const spatialIndex = await sql<{ indexdef: string }>`
      select indexdef from pg_indexes
      where indexname = 'farm_locations_location_gist'
    `.execute(database)
    expect(spatialIndex.rows[0]?.indexdef.toLowerCase()).toContain('using gist')

    await seedDatabase(database)
    const countsAfterFirstSeed = await sql<{ farms: number; listings: number; batches: number }>`
      select
        (select count(*)::integer from farms) as farms,
        (select count(*)::integer from listings) as listings,
        (select count(*)::integer from inventory_batches) as batches
    `.execute(database)
    await seedDatabase(database)
    const countsAfterSecondSeed = await sql<{ farms: number; listings: number; batches: number }>`
      select
        (select count(*)::integer from farms) as farms,
        (select count(*)::integer from listings) as listings,
        (select count(*)::integer from inventory_batches) as batches
    `.execute(database)
    expect(countsAfterFirstSeed.rows[0]).toEqual({ farms: 2, listings: 5, batches: 3 })
    expect(countsAfterSecondSeed.rows[0]).toEqual(countsAfterFirstSeed.rows[0])

    const repository = createFarmsRepository(database)
    const closeToLyon = await repository.findNearby({
      latitude: 45.764,
      longitude: 4.8357,
      radiusKm: 20,
      availableOnly: true,
      limit: 20,
      offset: 0,
    })
    expect(closeToLyon.farms.map(({ slug }) => slug)).toEqual(['ferme-des-pres'])

    const allByDistance = await repository.findNearby({
      latitude: 45.764,
      longitude: 4.8357,
      radiusKm: 100,
      availableOnly: true,
      limit: 20,
      offset: 0,
    })
    expect(allByDistance.farms.map(({ slug }) => slug)).toEqual([
      'ferme-des-pres',
      'vergers-du-rhone',
    ])
    expect(allByDistance.farms[0]?.distanceKm).toBeLessThan(allByDistance.farms[1]?.distanceKm ?? 0)

    const fruitOnly = await repository.findNearby({
      latitude: 45.764,
      longitude: 4.8357,
      radiusKm: 100,
      category: 'fruit',
      availableOnly: true,
      limit: 20,
      offset: 0,
    })
    expect(fruitOnly.farms.map(({ slug }) => slug)).toEqual(['vergers-du-rhone'])

    await sql`update farms set is_active = false where slug = 'ferme-des-pres'`.execute(database)
    expect(
      (
        await repository.findNearby({
          latitude: 45.764,
          longitude: 4.8357,
          radiusKm: 20,
          availableOnly: true,
          limit: 20,
          offset: 0,
        })
      ).farms
    ).toEqual([])
    await sql`update farms set is_active = true where slug = 'ferme-des-pres'`.execute(database)

    await sql`
      update farm_locations set is_public = false
      where farm_id = '20000000-0000-4000-8000-000000000001'
    `.execute(database)
    expect(
      (
        await repository.findNearby({
          latitude: 45.764,
          longitude: 4.8357,
          radiusKm: 20,
          availableOnly: true,
          limit: 20,
          offset: 0,
        })
      ).farms
    ).toEqual([])
    await sql`
      update farm_locations set is_public = true
      where farm_id = '20000000-0000-4000-8000-000000000001'
    `.execute(database)

    const listings = await repository.findPublicListings('20000000-0000-4000-8000-000000000002')
    expect(listings?.map(({ title, availableQuantity }) => ({ title, availableQuantity }))).toEqual(
      [
        { title: 'Pommes Gala', availableQuantity: '75.000' },
        { title: 'Pommes sans stock', availableQuantity: '0' },
      ]
    )

    await sql`
      update inventory_batches
      set reserved_quantity = available_quantity
      where listing_id in (
        select id from listings where farm_id = '20000000-0000-4000-8000-000000000002'
      )
    `.execute(database)
    const unavailableFarm = await repository.findNearby({
      latitude: 45.463,
      longitude: 4.767,
      radiusKm: 5,
      availableOnly: true,
      limit: 20,
      offset: 0,
    })
    const farmWithoutAvailabilityFilter = await repository.findNearby({
      latitude: 45.463,
      longitude: 4.767,
      radiusKm: 5,
      availableOnly: false,
      limit: 20,
      offset: 0,
    })
    expect(unavailableFarm.farms).toEqual([])
    expect(farmWithoutAvailabilityFilter.farms.map(({ slug }) => slug)).toEqual([
      'vergers-du-rhone',
    ])
    await seedDatabase(database)

    const app = buildApp({
      checkReadiness: async () => {
        await sql`select 1, postgis_version()`.execute(database)
      },
      farmsRepository: repository,
    })
    const readyResponse = await app.inject({ method: 'GET', url: '/ready' })
    expect(readyResponse.statusCode).toBe(200)
    const farmsResponse = await app.inject({
      method: 'GET',
      url: '/v1/farms/nearby?latitude=45.764&longitude=4.8357&radiusKm=20',
    })
    expect(farmsResponse.statusCode).toBe(200)
    expect(farmsResponse.body).not.toContain('password_hash')
    await app.close()

    const plan = await sql<{ 'QUERY PLAN': unknown }>`
      explain (format json)
      select farm_id
      from farm_locations
      where ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(4.8357, 45.764), 4326)::geography,
        20000
      )
    `.execute(database)
    expect(JSON.stringify(plan.rows[0])).toContain('farm_locations_location_gist')

    const rollback = await rollbackLastMigration(migrator)
    expect(rollback.results?.[0]).toEqual(
      expect.objectContaining({
        migrationName: '2026-07-28T020000_create_catalog_and_inventory',
        direction: 'Down',
        status: 'Success',
      })
    )
    const pendingStatus = await getMigrationStatus(migrator)
    expect(pendingStatus.at(-1)?.executedAt).toBeUndefined()
    const remigration = await migrateToLatest(migrator)
    expect(remigration.results?.[0]?.status).toBe('Success')
    await seedDatabase(database)
  }, 60_000)
})
