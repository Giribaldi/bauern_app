import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { ProblemSchema, problem } from '../../http/problem'
import { readSessionToken, type AuthService } from './auth.service'

const SessionSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  displayName: Type.String(),
  expiresAt: Type.String({ format: 'date-time' }),
})

export const registerAuthRoutes = (
  app: FastifyInstance,
  authService: AuthService | undefined,
  secureCookie: boolean
): void => {
  const auth = (): AuthService => {
    if (authService === undefined) throw new Error('Auth service is unavailable.')
    return authService
  }
  app.post(
    '/v1/auth/login',
    {
      schema: {
        operationId: 'login',
        tags: ['auth'],
        body: Type.Object({
          email: Type.String({ format: 'email', maxLength: 254 }),
          password: Type.String({ minLength: 8, maxLength: 256 }),
        }),
        response: { 200: SessionSchema, 401: ProblemSchema, 429: ProblemSchema },
      },
    },
    async (request, reply) => {
      const body = request.body as { email: string; password: string }
      const result = await auth().login(body.email, body.password, request.ip)
      if (result === 'rate_limited')
        return reply
          .status(429)
          .send(
            problem(
              request.id,
              429,
              'LOGIN_RATE_LIMITED',
              'Trop de tentatives',
              'Réessayez plus tard.'
            )
          )
      if (result === 'invalid')
        return reply
          .status(401)
          .send(
            problem(
              request.id,
              401,
              'INVALID_CREDENTIALS',
              'Connexion refusée',
              'Adresse e-mail ou mot de passe incorrect.'
            )
          )
      reply.header(
        'set-cookie',
        `lm_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureCookie ? '; Secure' : ''}`
      )
      return result.session
    }
  )
  app.get(
    '/v1/auth/session',
    {
      schema: {
        operationId: 'getSession',
        tags: ['auth'],
        response: { 200: SessionSchema, 401: ProblemSchema },
      },
    },
    async (request, reply) => {
      const token = readSessionToken(request.headers.cookie)
      const session = token === undefined ? undefined : await auth().session(token)
      return (
        session ??
        reply
          .status(401)
          .send(
            problem(
              request.id,
              401,
              'AUTHENTICATION_REQUIRED',
              'Authentification requise',
              'La session est absente ou expirée.'
            )
          )
      )
    }
  )
  app.post(
    '/v1/auth/logout',
    { schema: { operationId: 'logout', tags: ['auth'], response: { 204: Type.Null() } } },
    async (request, reply) => {
      const token = readSessionToken(request.headers.cookie)
      if (token !== undefined) await auth().logout(token)
      reply
        .header(
          'set-cookie',
          `lm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? '; Secure' : ''}`
        )
        .status(204)
        .send()
    }
  )
}
