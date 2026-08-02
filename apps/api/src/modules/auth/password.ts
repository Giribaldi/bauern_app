import { argon2, randomBytes, timingSafeEqual } from 'node:crypto'

const parameters = { parallelism: 1, tagLength: 32, memory: 65_536, passes: 3 } as const

const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    argon2('argon2id', { ...parameters, message: password, nonce: salt }, (error, key) => {
      if (error !== null) reject(error)
      else resolve(key)
    })
  })

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const hash = await derive(password, salt)
  return `$argon2id$v=19$m=${parameters.memory},t=${parameters.passes},p=${parameters.parallelism}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export const verifyPassword = async (encoded: string, password: string): Promise<boolean> => {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(encoded)
  if (match === null) return false
  const [, memory, passes, parallelism, saltValue, hashValue] = match
  if (
    Number(memory) !== parameters.memory ||
    Number(passes) !== parameters.passes ||
    Number(parallelism) !== parameters.parallelism ||
    saltValue === undefined ||
    hashValue === undefined
  )
    return false
  const expected = Buffer.from(hashValue, 'base64')
  const actual = await derive(password, Buffer.from(saltValue, 'base64'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
