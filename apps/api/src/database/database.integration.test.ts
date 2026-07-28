import { randomUUID } from 'node:crypto'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseDatabaseEnvironment } from '../config/env'
import { loadRootEnvironment } from '../config/load-root-environment'
import { createDatabase, verifyDatabaseConnection } from './connection'
import type { Database } from './database.types'
import {
  createMigrator,
  getMigrationStatus,
  migrateToLatest,
  rollbackLastMigration,
} from './migrator'

const runIntegrationTests = process.env.RUN_DATABASE_INTEGRATION === '1'
const describeDatabase = runIntegrationTests ? describe : describe.skip

describeDatabase('PostgreSQL migration integration', () => {
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
    if (database !== undefined) {
      await database.destroy()
    }

    if (administrationDatabase !== undefined) {
      await sql`
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where datname = ${testDatabaseName}
          and pid <> pg_backend_pid()
      `.execute(administrationDatabase)
      await sql.raw(`drop database if exists "${testDatabaseName}"`).execute(administrationDatabase)
      await administrationDatabase.destroy()
    }
  }, 30_000)

  it('connects, migrates an empty database, rolls back and remigrates safely', async () => {
    await verifyDatabaseConnection(database)
    const migrator = createMigrator(database)

    const firstMigration = await migrateToLatest(migrator)
    expect(firstMigration.results).toEqual([
      expect.objectContaining({
        migrationName: '2026-07-28T000000_enable_postgresql_extensions',
        direction: 'Up',
        status: 'Success',
      }),
    ])

    const extensions = await sql<{ extname: string }>`
      select extname
      from pg_extension
      where extname in ('postgis', 'pgcrypto')
      order by extname
    `.execute(database)
    expect(extensions.rows.map(({ extname }) => extname)).toEqual(['pgcrypto', 'postgis'])

    const executedStatus = await getMigrationStatus(migrator)
    expect(executedStatus).toHaveLength(1)
    expect(executedStatus[0]?.executedAt).toBeInstanceOf(Date)

    const noOpMigration = await migrateToLatest(migrator)
    expect(noOpMigration.results).toEqual([])

    const rollback = await rollbackLastMigration(migrator)
    expect(rollback.results).toEqual([
      expect.objectContaining({
        migrationName: '2026-07-28T000000_enable_postgresql_extensions',
        direction: 'Down',
        status: 'Success',
      }),
    ])

    const pendingStatus = await getMigrationStatus(migrator)
    expect(pendingStatus[0]?.executedAt).toBeUndefined()

    const extensionsAfterRollback = await sql<{ extname: string }>`
      select extname
      from pg_extension
      where extname in ('postgis', 'pgcrypto')
      order by extname
    `.execute(database)
    expect(extensionsAfterRollback.rows.map(({ extname }) => extname)).toEqual([
      'pgcrypto',
      'postgis',
    ])

    const remigration = await migrateToLatest(migrator)
    expect(remigration.results?.[0]?.status).toBe('Success')
  }, 30_000)
})
