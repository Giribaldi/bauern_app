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

export interface AppDependencies {
  readonly checkReadiness: () => Promise<void>
  readonly farmsRepository: FarmsRepository
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
  const app = Fastify({ logger: false })

  void app.register(cors, { origin: '*' })
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
      ],
    },
  })

  installErrorHandler(app)

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
  })
  return app
}
