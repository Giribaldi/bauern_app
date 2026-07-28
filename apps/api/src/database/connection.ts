import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import type { Database } from './database.types'

const DEFAULT_MAX_CONNECTIONS = 10

export interface DatabaseConnectionOptions {
  readonly databaseUrl: string
  readonly maxConnections?: number
}

export const createDatabase = ({
  databaseUrl,
  maxConnections = DEFAULT_MAX_CONNECTIONS,
}: DatabaseConnectionOptions): Kysely<Database> => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: maxConnections,
  })

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })
}

export const verifyDatabaseConnection = async (database: Kysely<Database>): Promise<void> => {
  await sql`select 1`.execute(database)
}
