import { Type, type Static } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { DomainError } from './domain-error'

export const ProblemSchema = Type.Object({
  type: Type.String({ format: 'uri' }),
  title: Type.String(),
  status: Type.Integer(),
  code: Type.String(),
  detail: Type.String(),
  requestId: Type.String(),
  errors: Type.Array(Type.Unknown()),
})

export type Problem = Static<typeof ProblemSchema>

export const problem = (
  requestId: string,
  status: number,
  code: string,
  title: string,
  detail: string,
  errors: unknown[] = []
): Problem => ({
  type: `https://local-market.test/problems/${code.toLowerCase().replaceAll('_', '-')}`,
  title,
  status,
  code,
  detail,
  requestId,
  errors,
})

export const installErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(error.status)
        .send(problem(request.id, error.status, error.code, 'Opération refusée', error.message))
    }
    if (error.validation !== undefined) {
      return reply
        .status(400)
        .send(
          problem(
            request.id,
            400,
            'VALIDATION_ERROR',
            'Requête invalide',
            'Les paramètres fournis sont invalides.',
            error.validation
          )
        )
    }

    request.log.error({ err: error }, 'Request failed')
    return reply
      .status(500)
      .send(
        problem(
          request.id,
          500,
          'INTERNAL_ERROR',
          'Erreur interne',
          'Une erreur interne est survenue.'
        )
      )
  })
}
