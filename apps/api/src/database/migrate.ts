import { reportDatabaseCommandFailure, runDatabaseCommand } from './command'
import { createMigrator, migrateToLatest } from './migrator'

const main = async (): Promise<void> => {
  await runDatabaseCommand(async (database) => {
    const result = await migrateToLatest(createMigrator(database))

    for (const migration of result.results ?? []) {
      console.log(`${migration.direction}: ${migration.migrationName} (${migration.status})`)
    }
  })
}

main().catch((error: unknown) => {
  reportDatabaseCommandFailure('Database migration', error)
})
