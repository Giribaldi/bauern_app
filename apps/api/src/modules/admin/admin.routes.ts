import { Type } from '@sinclair/typebox'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { DomainError } from '../../http/domain-error'
import { readSessionToken } from '../auth/auth.service'
import { AdminService } from './admin.service'

const Id = Type.String({ format: 'uuid' })
const FarmParams = Type.Object({ farmId: Id })
const ListingParams = Type.Object({ farmId: Id, listingId: Id })
const token = (request: FastifyRequest): string => {
  const value = readSessionToken(request.headers.cookie)
  if (value === undefined)
    throw new DomainError(401, 'AUTHENTICATION_REQUIRED', 'La session est absente.')
  return value
}
const ListingInput = Type.Object({
  productCatalogId: Id,
  title: Type.String({ minLength: 1, maxLength: 160 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
  variety: Type.Optional(Type.Union([Type.String({ maxLength: 120 }), Type.Null()])),
  unit: Type.Union([
    Type.Literal('piece'),
    Type.Literal('kilogram'),
    Type.Literal('gram'),
    Type.Literal('bunch'),
    Type.Literal('box'),
    Type.Literal('basket'),
  ]),
  unitQuantity: Type.String({ pattern: '^\\d+(?:\\.\\d{1,3})?$' }),
  priceCents: Type.Integer({ minimum: 0 }),
  vatRate: Type.String({ pattern: '^\\d+(?:\\.\\d{1,2})?$' }),
  isActive: Type.Optional(Type.Boolean()),
})

export const registerAdminRoutes = (
  app: FastifyInstance,
  adminService: AdminService | undefined
): void => {
  const service = (): AdminService => {
    if (adminService === undefined) throw new Error('Admin service is unavailable.')
    return adminService
  }
  app.get(
    '/v1/admin/farms',
    { schema: { operationId: 'getAdminFarms', tags: ['admin'] } },
    (request) => service().farms(token(request))
  )
  app.get(
    '/v1/admin/farms/:farmId',
    { schema: { operationId: 'getAdminFarm', tags: ['admin'], params: FarmParams } },
    (request) => {
      const { farmId } = request.params as { farmId: string }
      return service().farm(token(request), farmId)
    }
  )
  app.patch(
    '/v1/admin/farms/:farmId',
    {
      schema: {
        operationId: 'updateAdminFarm',
        tags: ['admin'],
        params: FarmParams,
        body: Type.Partial(
          Type.Object({
            name: Type.String({ minLength: 1, maxLength: 160 }),
            description: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
            publicEmail: Type.Union([Type.String({ format: 'email' }), Type.Null()]),
            publicPhone: Type.Union([Type.String({ maxLength: 40 }), Type.Null()]),
            isActive: Type.Boolean(),
          }),
          { minProperties: 1 }
        ),
      },
    },
    (request) => {
      const { farmId } = request.params as { farmId: string }
      return service().updateFarm(token(request), farmId, request.body as never)
    }
  )
  app.get(
    '/v1/admin/farms/:farmId/listings',
    { schema: { operationId: 'getAdminListings', tags: ['admin'], params: FarmParams } },
    (request) => {
      const { farmId } = request.params as { farmId: string }
      return service().listings(token(request), farmId)
    }
  )
  app.post(
    '/v1/admin/farms/:farmId/listings',
    {
      schema: {
        operationId: 'createAdminListing',
        tags: ['admin'],
        params: FarmParams,
        body: ListingInput,
      },
    },
    (request, reply) => {
      const { farmId } = request.params as { farmId: string }
      reply.status(201)
      return service().createListing(token(request), farmId, request.body as never)
    }
  )
  app.get(
    '/v1/admin/farms/:farmId/listings/:listingId',
    { schema: { operationId: 'getAdminListing', tags: ['admin'], params: ListingParams } },
    (request) => {
      const { farmId, listingId } = request.params as { farmId: string; listingId: string }
      return service().listing(token(request), farmId, listingId)
    }
  )
  app.patch(
    '/v1/admin/farms/:farmId/listings/:listingId',
    {
      schema: {
        operationId: 'updateAdminListing',
        tags: ['admin'],
        params: ListingParams,
        body: Type.Partial(
          Type.Object({
            title: Type.String({ minLength: 1 }),
            description: Type.Union([Type.String(), Type.Null()]),
            variety: Type.Union([Type.String(), Type.Null()]),
            priceCents: Type.Integer({ minimum: 0 }),
            vatRate: Type.String(),
            isActive: Type.Boolean(),
          }),
          { minProperties: 1 }
        ),
      },
    },
    (request) => {
      const { farmId, listingId } = request.params as { farmId: string; listingId: string }
      return service().updateListing(token(request), farmId, listingId, request.body as never)
    }
  )
  app.get(
    '/v1/admin/farms/:farmId/inventory',
    { schema: { operationId: 'getAdminInventory', tags: ['admin'], params: FarmParams } },
    (request) => {
      const { farmId } = request.params as { farmId: string }
      return service().inventory(token(request), farmId)
    }
  )
  app.post(
    '/v1/admin/farms/:farmId/inventory/movements',
    {
      schema: {
        operationId: 'createStockMovement',
        tags: ['admin'],
        params: FarmParams,
        body: Type.Object({
          inventoryBatchId: Id,
          type: Type.Union([
            Type.Literal('stock_added'),
            Type.Literal('stock_corrected'),
            Type.Literal('stock_lost'),
            Type.Literal('stock_refunded'),
          ]),
          quantity: Type.String({ pattern: '^-?\\d+(?:\\.\\d{1,3})?$' }),
          reason: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
        }),
      },
    },
    (request, reply) => {
      const { farmId } = request.params as { farmId: string }
      reply.status(201)
      return service().moveStock(token(request), farmId, request.body as never)
    }
  )
  app.get(
    '/v1/admin/farms/:farmId/orders',
    { schema: { operationId: 'getAdminOrders', tags: ['admin'], params: FarmParams } },
    (request) => {
      const { farmId } = request.params as { farmId: string }
      return service().orders(token(request), farmId)
    }
  )
  app.patch(
    '/v1/admin/farms/:farmId/orders/:orderId',
    {
      schema: {
        operationId: 'updateAdminOrder',
        tags: ['admin'],
        params: Type.Object({ farmId: Id, orderId: Id }),
        body: Type.Object({
          status: Type.Union([
            Type.Literal('preparing'),
            Type.Literal('ready_for_pickup'),
            Type.Literal('completed'),
            Type.Literal('cancelled'),
            Type.Literal('refunded'),
          ]),
        }),
      },
    },
    (request) => {
      const { farmId, orderId } = request.params as { farmId: string; orderId: string }
      const { status } = request.body as {
        status: 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'refunded'
      }
      return service().updateOrder(token(request), farmId, orderId, status)
    }
  )
}
