import { describe, expect, it } from 'vitest'
import { resetMigrations } from './migrator'

describe('resetMigrations', () => {
  it('rejects resets in production before accessing the database', async () => {
    await expect(resetMigrations({} as never, 'production')).rejects.toThrow(
      'Database reset is disabled in production.'
    )
  })
})
