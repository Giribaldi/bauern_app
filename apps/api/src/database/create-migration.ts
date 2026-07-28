import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATION_NAME_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const migrationFolder = fileURLToPath(new URL('./migrations', import.meta.url))

export const formatMigrationTimestamp = (date: Date): string => {
  return date.toISOString().slice(0, 19).replace(/:/g, '')
}

export const createMigrationFilename = (name: string, date = new Date()): string => {
  if (!MIGRATION_NAME_PATTERN.test(name)) {
    throw new Error('Migration name must use lowercase snake_case characters.')
  }

  return `${formatMigrationTimestamp(date)}_${name}.ts`
}

const migrationTemplate = `import { sql, type Kysely } from 'kysely'

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql\`\`.execute(database)
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql\`\`.execute(database)
}
`

const main = async (): Promise<void> => {
  const name = process.argv[2]

  if (name === undefined) {
    throw new Error('Usage: pnpm db:migration:create <snake_case_name>')
  }

  await fs.mkdir(migrationFolder, { recursive: true })
  const filename = createMigrationFilename(name)
  const target = path.join(migrationFolder, filename)
  await fs.writeFile(target, migrationTemplate, { encoding: 'utf8', flag: 'wx' })
  console.log(`Created migration ${filename}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown migration creation error.'
    console.error(`Migration creation failed: ${message}`)
    process.exitCode = 1
  })
}
