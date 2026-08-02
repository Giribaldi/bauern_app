import { Type } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import { ProblemSchema, problem } from '../../http/problem'
import { productCategories, type FarmsRepository, type ProductCategory } from './farms.types'

const NullableString = Type.Union([Type.String(), Type.Null()])
const FarmIdParams = Type.Object({ farmId: Type.String({ format: 'uuid' }) })
const ProductCategorySchema = Type.Union(
  productCategories.map((category) => Type.Literal(category))
)

const NearbyFarmSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  slug: Type.String(),
  description: NullableString,
  city: Type.String(),
  postalCode: Type.String(),
  distanceKm: Type.Number({ minimum: 0 }),
})

const NearbyResponseSchema = Type.Object({
  farms: Type.Array(NearbyFarmSchema),
  nextCursor: NullableString,
})

const PublicFarmSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  slug: Type.String(),
  description: NullableString,
  publicEmail: NullableString,
  publicPhone: NullableString,
  location: Type.Object({
    addressLine1: Type.String(),
    addressLine2: NullableString,
    postalCode: Type.String(),
    city: Type.String(),
    countryCode: Type.String(),
    latitude: Type.Number(),
    longitude: Type.Number(),
    pickupInstructions: NullableString,
  }),
})

const ListingSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String(),
  description: NullableString,
  variety: NullableString,
  unit: Type.Union(
    ['piece', 'kilogram', 'gram', 'bunch', 'box', 'basket'].map((unit) => Type.Literal(unit))
  ),
  unitQuantity: Type.String(),
  priceCents: Type.Integer({ minimum: 0 }),
  currency: Type.String(),
  vatRate: Type.String(),
  availableQuantity: Type.String(),
  product: Type.Object({
    id: Type.String({ format: 'uuid' }),
    slug: Type.String(),
    name: Type.String(),
    category: ProductCategorySchema,
  }),
})

interface NearbyRequestQuery {
  latitude: number
  longitude: number
  radiusKm?: number
  category?: ProductCategory
  availableOnly?: boolean
  limit?: number
  cursor?: string
}

interface FarmRequestParams {
  farmId: string
}

export const registerFarmRoutes = (app: FastifyInstance, repository: FarmsRepository): void => {
  app.get<{ Querystring: NearbyRequestQuery }>(
    '/v1/farms/nearby',
    {
      schema: {
        operationId: 'findNearbyFarms',
        tags: ['farms'],
        querystring: Type.Object({
          latitude: Type.Number({ minimum: -90, maximum: 90 }),
          longitude: Type.Number({ minimum: -180, maximum: 180 }),
          radiusKm: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: 100, default: 20 })),
          category: Type.Optional(ProductCategorySchema),
          availableOnly: Type.Optional(Type.Boolean({ default: true })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
          cursor: Type.Optional(Type.String({ pattern: '^[0-9]+$', maxLength: 10 })),
        }),
        response: { 200: NearbyResponseSchema, 400: ProblemSchema, 500: ProblemSchema },
      },
    },
    async (request) => {
      return repository.findNearby({
        latitude: request.query.latitude,
        longitude: request.query.longitude,
        radiusKm: request.query.radiusKm ?? 20,
        category: request.query.category,
        availableOnly: request.query.availableOnly ?? true,
        limit: request.query.limit ?? 20,
        offset: Number(request.query.cursor ?? '0'),
      })
    }
  )

  app.get<{ Params: FarmRequestParams }>(
    '/v1/farms/:farmId',
    {
      schema: {
        operationId: 'getFarm',
        tags: ['farms'],
        params: FarmIdParams,
        response: { 200: PublicFarmSchema, 400: ProblemSchema, 404: ProblemSchema },
      },
    },
    async (request, reply) => {
      const farm = await repository.findPublicFarm(request.params.farmId)
      if (farm === undefined) {
        return reply
          .status(404)
          .send(
            problem(
              request.id,
              404,
              'FARM_NOT_FOUND',
              'Exploitation introuvable',
              "L'exploitation demandée n'existe pas."
            )
          )
      }
      return farm
    }
  )

  app.get<{ Params: FarmRequestParams }>(
    '/v1/farms/:farmId/listings',
    {
      schema: {
        operationId: 'getFarmListings',
        tags: ['farms', 'listings'],
        params: FarmIdParams,
        response: {
          200: Type.Object({ listings: Type.Array(ListingSchema) }),
          400: ProblemSchema,
          404: ProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const listings = await repository.findPublicListings(request.params.farmId)
      if (listings === undefined) {
        return reply
          .status(404)
          .send(
            problem(
              request.id,
              404,
              'FARM_NOT_FOUND',
              'Exploitation introuvable',
              "L'exploitation demandée n'existe pas."
            )
          )
      }
      return { listings }
    }
  )
}
