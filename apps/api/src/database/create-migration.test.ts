import { describe, expect, it } from 'vitest'
import { createMigrationFilename, formatMigrationTimestamp } from './create-migration'

describe('migration file naming', () => {
  const timestamp = new Date('2026-07-28T14:05:09.123Z')

  it('formats timestamps using the documented UTC convention', () => {
    expect(formatMigrationTimestamp(timestamp)).toBe('2026-07-28T140509')
  })

  it('creates a sortable migration filename', () => {
    expect(createMigrationFilename('create_farms', timestamp)).toBe(
      '2026-07-28T140509_create_farms.ts'
    )
  })

  it.each(['Create_farms', 'create-farms', 'create farms', '../create_farms', ''])(
    'rejects an invalid migration name: %s',
    (name) => {
      expect(() => createMigrationFilename(name, timestamp)).toThrow(
        'Migration name must use lowercase snake_case characters.'
      )
    }
  )
})
