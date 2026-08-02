import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('Argon2id passwords', () => {
  it('hashes with Argon2id and verifies only the correct password', async () => {
    const hash = await hashPassword('Mot-de-passe-solide-2026!')
    expect(hash).toMatch(/^\$argon2id\$v=19\$/)
    await expect(verifyPassword(hash, 'Mot-de-passe-solide-2026!')).resolves.toBe(true)
    await expect(verifyPassword(hash, 'incorrect')).resolves.toBe(false)
  })

  it('refuses malformed and obsolete parameter strings', async () => {
    await expect(verifyPassword('not-a-hash', 'value')).resolves.toBe(false)
    await expect(
      verifyPassword('$argon2id$v=19$m=8,t=1,p=1$c2FsdA==$aGFzaA==', 'value')
    ).resolves.toBe(false)
  })
})
