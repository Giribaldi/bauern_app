import { reportDatabaseCommandFailure, runDatabaseCommand } from './command'
import { createMigrator, resetMigrations } from './migrator'

const main = async (): Promise<void> => {
  await runDatabaseCommand(async (database) => {
    const result = await resetMigrations(createMigrator(database), process.env.NODE_ENV)

    for (const migration of result.results ?? []) {
      console.log(`${migration.direction}: ${migration.migrationName} (${migration.status})`)
    }
  })
}

main().catch((error: unknown) => {
  reportDatabaseCommandFailure('Database reset', error)
})
