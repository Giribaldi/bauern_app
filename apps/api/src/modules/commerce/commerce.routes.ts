import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { DomainError } from '../../http/domain-error'
import { CommerceService } from './commerce.service'

const CartParams = Type.Object({ cartId: Type.String({ minLength: 40, maxLength: 100 }) })
const Quantity = Type.String({ pattern: '^\\d+(?:\\.\\d{1,3})?$' })

export const registerCommerceRoutes = (
  app: FastifyInstance,
  commerceService: CommerceService | undefined
): void => {
  const service = (): CommerceService => {
    if (commerceService === undefined) throw new Error('Commerce service is unavailable.')
    return commerceService
  }
  app.post(
    '/v1/carts',
    { schema: { operationId: 'createCart', tags: ['carts'] } },
    (_request, reply) => {
      reply.status(201)
      return service().createCart()
    }
  )
  app.get(
    '/v1/carts/:cartId',
    { schema: { operationId: 'getCart', tags: ['carts'], params: CartParams } },
    (request) => service().getCart((request.params as { cartId: string }).cartId)
  )
  app.post(
    '/v1/carts/:cartId/items',
    {
      schema: {
        operationId: 'addCartItem',
        tags: ['carts'],
        params: CartParams,
        body: Type.Object({ listingId: Type.String({ format: 'uuid' }), quantity: Quantity }),
      },
    },
    (request, reply) => {
      const { cartId } = request.params as { cartId: string }
      const body = request.body as { listingId: string; quantity: string }
      reply.status(201)
      return service().addItem(cartId, body.listingId, body.quantity)
    }
  )
  app.patch(
    '/v1/carts/:cartId/items/:itemId',
    {
      schema: {
        operationId: 'updateCartItem',
        tags: ['carts'],
        params: Type.Object({ cartId: Type.String(), itemId: Type.String({ format: 'uuid' }) }),
        body: Type.Object({ quantity: Quantity }),
      },
    },
    (request) => {
      const { cartId, itemId } = request.params as { cartId: string; itemId: string }
      return service().updateItem(cartId, itemId, (request.body as { quantity: string }).quantity)
    }
  )
  app.delete(
    '/v1/carts/:cartId/items/:itemId',
    {
      schema: {
        operationId: 'deleteCartItem',
        tags: ['carts'],
        params: Type.Object({ cartId: Type.String(), itemId: Type.String({ format: 'uuid' }) }),
      },
    },
    (request) => {
      const { cartId, itemId } = request.params as { cartId: string; itemId: string }
      return service().deleteItem(cartId, itemId)
    }
  )
  app.post(
    '/v1/checkout',
    {
      schema: {
        operationId: 'checkout',
        tags: ['checkout'],
        headers: Type.Object({ 'idempotency-key': Type.String({ minLength: 8, maxLength: 128 }) }),
        body: Type.Object({ cartId: Type.String(), email: Type.String({ format: 'email' }) }),
      },
    },
    (request, reply) => {
      const { cartId, email } = request.body as { cartId: string; email: string }
      const key = request.headers['idempotency-key']
      if (typeof key !== 'string')
        throw new DomainError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Une clé idempotente est requise.')
      reply.status(201)
      return service().checkout(cartId, email, key)
    }
  )
  app.get(
    '/v1/guest-orders/:token',
    {
      schema: {
        operationId: 'getGuestOrder',
        tags: ['orders'],
        params: Type.Object({ token: Type.String({ minLength: 32, maxLength: 100 }) }),
      },
    },
    (request) => service().guestOrder((request.params as { token: string }).token)
  )
  app.post(
    '/v1/order-claims/request',
    {
      schema: {
        operationId: 'requestOrderClaim',
        tags: ['orders'],
        body: Type.Object({ email: Type.String({ format: 'email' }), reference: Type.String() }),
      },
    },
    () => ({ accepted: true })
  )
  app.post(
    '/v1/order-claims/confirm',
    {
      schema: {
        operationId: 'confirmOrderClaim',
        tags: ['orders'],
        body: Type.Object({ token: Type.String({ minLength: 32 }) }),
      },
    },
    () => {
      throw new DomainError(
        501,
        'ORDER_CLAIM_NOT_AVAILABLE',
        'Le rattachement sera activé avec les comptes clients.'
      )
    }
  )
  app.post(
    '/v1/webhooks/stripe',
    { schema: { operationId: 'stripeWebhook', tags: ['webhooks'] } },
    (request) => {
      const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      return service().webhook(payload, request.headers['stripe-signature'] as string | undefined)
    }
  )
}
