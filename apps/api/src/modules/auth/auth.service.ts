import { createHash, randomBytes } from 'node:crypto'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Database } from '../../database/database.types'
import { verifyPassword } from './password'

const digest = (value: string): string => createHash('sha256').update(value).digest('hex')
const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export interface AuthSession {
  readonly userId: string
  readonly email: string
  readonly displayName: string
  readonly expiresAt: string
}
export interface LoginResult {
  readonly token: string
  readonly session: AuthSession
}

export interface AuthService {
  login(
    email: string,
    password: string,
    ip: string
  ): Promise<LoginResult | 'invalid' | 'rate_limited'>
  session(token: string): Promise<AuthSession | undefined>
  logout(token: string): Promise<void>
}

export const createAuthService = (
  database: Kysely<Database>,
  durationSeconds = 86_400
): AuthService => ({
  async login(rawEmail, password, ip) {
    const email = normalizeEmail(rawEmail)
    const emailHash = digest(email)
    const ipHash = digest(ip)
    const recent = await database
      .selectFrom('login_attempts')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('email_hash', '=', emailHash)
      .where('ip_hash', '=', ipHash)
      .where('succeeded', '=', false)
      .where('attempted_at', '>', new Date(Date.now() - 15 * 60_000))
      .executeTakeFirstOrThrow()
    if (Number(recent.count) >= 5) return 'rate_limited'
    const user = await database
      .selectFrom('users')
      .select(['id', 'email', 'display_name', 'password_hash'])
      .where(sql<boolean>`lower(email) = ${email}`)
      .executeTakeFirst()
    const valid = user !== undefined && (await verifyPassword(user.password_hash, password))
    await database
      .insertInto('login_attempts')
      .values({ email_hash: emailHash, ip_hash: ipHash, succeeded: valid })
      .execute()
    if (!valid || user === undefined) return 'invalid'
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + durationSeconds * 1000)
    await database
      .insertInto('sessions')
      .values({
        user_id: user.id,
        token_hash: digest(token),
        expires_at: expiresAt,
        revoked_at: null,
      })
      .execute()
    return {
      token,
      session: {
        userId: user.id,
        email: user.email,
        displayName: user.display_name,
        expiresAt: expiresAt.toISOString(),
      },
    }
  },
  async session(token) {
    const row = await database
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select([
        'users.id as userId',
        'users.email',
        'users.display_name as displayName',
        'sessions.expires_at as expiresAt',
      ])
      .where('sessions.token_hash', '=', digest(token))
      .where('sessions.revoked_at', 'is', null)
      .where('sessions.expires_at', '>', new Date())
      .executeTakeFirst()
    if (row === undefined) return undefined
    return { ...row, expiresAt: new Date(row.expiresAt).toISOString() }
  },
  async logout(token) {
    await database
      .updateTable('sessions')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', digest(token))
      .execute()
  },
})

export const readSessionToken = (cookie: string | undefined): string | undefined =>
  cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('lm_session='))
    ?.slice('lm_session='.length)
