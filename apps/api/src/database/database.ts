import type { Kysely } from 'kysely'
import { parseDatabaseEnvironment } from '../config/env'
import { loadRootEnvironment } from '../config/load-root-environment'
import { createDatabase } from './connection'
import type { Database } from './database.types'

export const loadDatabase = (): Kysely<Database> => {
  loadRootEnvironment()
  const { databaseUrl } = parseDatabaseEnvironment(process.env)

  return createDatabase({ databaseUrl })
}
