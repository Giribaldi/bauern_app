import { reportDatabaseCommandFailure, runDatabaseCommand } from './command'
import { createMigrator, getMigrationStatus } from './migrator'

const main = async (): Promise<void> => {
  await runDatabaseCommand(async (database) => {
    const migrations = await getMigrationStatus(createMigrator(database))

    if (migrations.length === 0) {
      console.log('No migrations found.')
      return
    }

    for (const migration of migrations) {
      const status = migration.executedAt === undefined ? 'Pending' : 'Executed'
      console.log(`${migration.name}: ${status}`)
    }
  })
}

main().catch((error: unknown) => {
  reportDatabaseCommandFailure('Database migration status', error)
})
