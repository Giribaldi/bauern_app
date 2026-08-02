import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import { Type } from '@sinclair/typebox'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Database } from './database/database.types'
import { installErrorHandler, ProblemSchema, problem } from './http/problem'
import { registerFarmRoutes } from './modules/farms/farms.routes'
import type { FarmsRepository } from './modules/farms/farms.types'
import { registerAuthRoutes } from './modules/auth/auth.routes'
import type { AuthService } from './modules/auth/auth.service'
import { registerAdminRoutes } from './modules/admin/admin.routes'
import type { AdminService } from './modules/admin/admin.service'
import { registerCommerceRoutes } from './modules/commerce/commerce.routes'
import type { CommerceService } from './modules/commerce/commerce.service'

export interface AppDependencies {
  readonly checkReadiness: () => Promise<void>
  readonly farmsRepository: FarmsRepository
  readonly authService?: AuthService
  readonly adminService?: AdminService
  readonly commerceService?: CommerceService
  readonly secureCookies?: boolean
  readonly corsOrigins?: readonly string[]
}

const HealthSchema = Type.Object({ status: Type.Literal('ok') })
const ReadySchema = Type.Object({
  status: Type.Literal('ready'),
  database: Type.Literal('ok'),
  postgis: Type.Literal('ok'),
})

export const verifyReadiness = async (database: Kysely<Database>): Promise<void> => {
  await sql`select 1`.execute(database)
  await sql`select postgis_version()`.execute(database)
}

export const buildApp = (dependencies: AppDependencies): FastifyInstance => {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production',
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
  })

  void app.register(cors, {
    origin: [...(dependencies.corsOrigins ?? ['http://localhost:3001', 'http://localhost:3002'])],
    credentials: true,
  })
  void app.register(swagger, {
    openapi: {
      info: {
        title: 'Local Market API',
        description: 'API publique de découverte des exploitations et de leurs offres.',
        version: '1.0.0',
      },
      tags: [
        { name: 'health', description: 'État du service' },
        { name: 'farms', description: 'Exploitations publiques' },
        { name: 'listings', description: 'Offres publiques' },
        { name: 'auth', description: 'Authentification' },
        { name: 'admin', description: 'Back-office' },
        { name: 'carts', description: 'Paniers' },
        { name: 'checkout', description: 'Paiement' },
        { name: 'orders', description: 'Commandes' },
        { name: 'webhooks', description: 'Webhooks signés' },
      ],
    },
  })

  installErrorHandler(app)
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff')
    reply.header('x-frame-options', 'DENY')
    reply.header('referrer-policy', 'no-referrer')
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'")
    return payload
  })

  void app.register(async (routes) => {
    routes.get(
      '/health',
      {
        schema: {
          operationId: 'getHealth',
          tags: ['health'],
          response: { 200: HealthSchema },
        },
      },
      async () => ({ status: 'ok' as const })
    )

    routes.get(
      '/ready',
      {
        schema: {
          operationId: 'getReadiness',
          tags: ['health'],
          response: { 200: ReadySchema, 503: ProblemSchema },
        },
      },
      async (request, reply) => {
        try {
          await dependencies.checkReadiness()
          return { status: 'ready' as const, database: 'ok' as const, postgis: 'ok' as const }
        } catch (error) {
          request.log.warn({ err: error }, 'Readiness check failed')
          return reply
            .status(503)
            .send(
              problem(
                request.id,
                503,
                'DATABASE_UNAVAILABLE',
                'Service indisponible',
                "La base de données n'est pas disponible."
              )
            )
        }
      }
    )

    registerFarmRoutes(routes, dependencies.farmsRepository)
    registerAuthRoutes(routes, dependencies.authService, dependencies.secureCookies ?? true)
    registerAdminRoutes(routes, dependencies.adminService)
    registerCommerceRoutes(routes, dependencies.commerceService)
  })
  return app
}
