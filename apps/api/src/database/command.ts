import type { Kysely } from 'kysely'
import { loadDatabase } from './database'
import type { Database } from './database.types'

export const runDatabaseCommand = async (
  command: (database: Kysely<Database>) => Promise<void>
): Promise<void> => {
  const database = loadDatabase()

  try {
    await command(database)
  } finally {
    await database.destroy()
  }
}

export const reportDatabaseCommandFailure = (commandName: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : 'Unknown database error.'
  console.error(`${commandName} failed: ${message}`)
  process.exitCode = 1
}
