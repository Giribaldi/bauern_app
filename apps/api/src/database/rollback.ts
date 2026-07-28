import { reportDatabaseCommandFailure, runDatabaseCommand } from './command'
import { createMigrator, rollbackLastMigration } from './migrator'

const main = async (): Promise<void> => {
  await runDatabaseCommand(async (database) => {
    const result = await rollbackLastMigration(createMigrator(database))

    for (const migration of result.results ?? []) {
      console.log(`${migration.direction}: ${migration.migrationName} (${migration.status})`)
    }
  })
}

main().catch((error: unknown) => {
  reportDatabaseCommandFailure('Database rollback', error)
})
