import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FileMigrationProvider,
  Migrator,
  NO_MIGRATIONS,
  type Kysely,
  type MigrationInfo,
  type MigrationResultSet,
} from 'kysely'
import type { Database } from './database.types'

const DEFAULT_MIGRATION_FOLDER = fileURLToPath(new URL('./migrations', import.meta.url))

export type MigrationOperation = 'migrate' | 'reset' | 'rollback'

export class MigrationExecutionError extends Error {
  constructor(operation: MigrationOperation, options: ErrorOptions) {
    super(`Database migration operation "${operation}" failed.`, options)
    this.name = 'MigrationExecutionError'
  }
}

export const createMigrator = (
  database: Kysely<Database>,
  migrationFolder = DEFAULT_MIGRATION_FOLDER
): Migrator => {
  return new Migrator({
    db: database,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  })
}

const assertMigrationSucceeded = (
  operation: MigrationOperation,
  result: MigrationResultSet
): MigrationResultSet => {
  if (result.error !== undefined) {
    throw new MigrationExecutionError(operation, { cause: result.error })
  }

  return result
}

export const migrateToLatest = async (migrator: Migrator): Promise<MigrationResultSet> => {
  return assertMigrationSucceeded('migrate', await migrator.migrateToLatest())
}

export const rollbackLastMigration = async (migrator: Migrator): Promise<MigrationResultSet> => {
  return assertMigrationSucceeded('rollback', await migrator.migrateDown())
}

export const resetMigrations = async (
  migrator: Migrator,
  nodeEnvironment: string | undefined
): Promise<MigrationResultSet> => {
  if (nodeEnvironment === 'production') {
    throw new Error('Database reset is disabled in production.')
  }

  assertMigrationSucceeded('reset', await migrator.migrateTo(NO_MIGRATIONS))

  return assertMigrationSucceeded('reset', await migrator.migrateToLatest())
}

export const getMigrationStatus = async (migrator: Migrator): Promise<readonly MigrationInfo[]> => {
  return migrator.getMigrations()
}
