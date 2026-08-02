import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp, type AppDependencies } from './app'
import type { FarmsRepository } from './modules/farms/farms.types'

const farmId = '20000000-0000-4000-8000-000000000001'

const createRepository = (): FarmsRepository => ({
  findNearby: vi.fn(async () => ({
    farms: [
      {
        id: farmId,
        name: 'Ferme des Prés',
        slug: 'ferme-des-pres',
        description: 'Description publique',
        city: 'Lyon',
        postalCode: '69009',
        distanceKm: 1.25,
      },
    ],
    nextCursor: null,
  })),
  findPublicFarm: vi.fn(async (id) =>
    id === farmId
      ? {
          id: farmId,
          name: 'Ferme des Prés',
          slug: 'ferme-des-pres',
          description: null,
          publicEmail: 'public@farm.test',
          publicPhone: null,
          location: {
            addressLine1: '12 chemin des Prés',
            addressLine2: null,
            postalCode: '69009',
            city: 'Lyon',
            countryCode: 'FR',
            latitude: 45.764,
            longitude: 4.8357,
            pickupInstructions: null,
          },
        }
      : undefined
  ),
  findPublicListings: vi.fn(async (id) =>
    id === farmId
      ? [
          {
            id: '50000000-0000-4000-8000-000000000001',
            title: 'Tomates anciennes',
            description: null,
            variety: 'Anciennes',
            unit: 'kilogram' as const,
            unitQuantity: '1.000',
            priceCents: 450,
            currency: 'EUR',
            vatRate: '5.50',
            availableQuantity: '28.000',
            product: {
              id: '40000000-0000-4000-8000-000000000001',
              slug: 'tomate',
              name: 'Tomate',
              category: 'vegetable' as const,
            },
          },
        ]
      : undefined
  ),
})

const apps: ReturnType<typeof buildApp>[] = []

const createApp = (overrides: Partial<AppDependencies> = {}) => {
  const dependencies: AppDependencies = {
    checkReadiness: async () => undefined,
    farmsRepository: createRepository(),
    ...overrides,
  }
  const app = buildApp(dependencies)
  apps.push(app)
  return { app, dependencies }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

describe('health routes', () => {
  it('returns process health without checking the database', async () => {
    const checkReadiness = vi.fn(async () => undefined)
    const { app } = createApp({ checkReadiness })
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
    expect(checkReadiness).not.toHaveBeenCalled()
  })

  it('returns readiness when PostgreSQL and PostGIS are available', async () => {
    const { app } = createApp()
    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', database: 'ok', postgis: 'ok' })
  })

  it('returns a normalized 503 without leaking the database error', async () => {
    const { app } = createApp({
      checkReadiness: async () => {
        throw new Error('postgresql://secret@database/internal')
      },
    })
    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual(
      expect.objectContaining({ status: 503, code: 'DATABASE_UNAVAILABLE' })
    )
    expect(response.body).not.toContain('secret')
  })
})

describe('public farm routes', () => {
  it('applies nearby defaults and returns public farms', async () => {
    const { app, dependencies } = createApp()
    const response = await app.inject({
      method: 'GET',
      url: '/v1/farms/nearby?latitude=45.75&longitude=4.85',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({ farms: [expect.objectContaining({ id: farmId })] })
    )
    expect(dependencies.farmsRepository.findNearby).toHaveBeenCalledWith({
      latitude: 45.75,
      longitude: 4.85,
      radiusKm: 20,
      category: undefined,
      availableOnly: true,
      limit: 20,
      offset: 0,
    })
  })

  it.each([
    '/v1/farms/nearby?latitude=91&longitude=4',
    '/v1/farms/nearby?latitude=45&longitude=-181',
    '/v1/farms/nearby?latitude=45&longitude=4&radiusKm=101',
    '/v1/farms/nearby?latitude=45&longitude=4&limit=51',
    '/v1/farms/nearby?latitude=45&longitude=4&category=meat',
  ])('rejects invalid nearby parameters: %s', async (url) => {
    const { app } = createApp()
    const response = await app.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }))
  })

  it('returns only the declared public farm fields', async () => {
    const { app } = createApp()
    const response = await app.inject({ method: 'GET', url: `/v1/farms/${farmId}` })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({ id: farmId, publicEmail: 'public@farm.test' })
    )
    expect(response.body).not.toContain('password_hash')
    expect(response.body).not.toContain('farm_members')
  })

  it('returns active public listings with decimal quantities represented as strings', async () => {
    const { app } = createApp()
    const response = await app.inject({
      method: 'GET',
      url: `/v1/farms/${farmId}/listings`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      listings: [expect.objectContaining({ priceCents: 450, availableQuantity: '28.000' })],
    })
  })

  it.each([
    `/v1/farms/${farmId.replace(/1$/, '9')}`,
    `/v1/farms/${farmId.replace(/1$/, '9')}/listings`,
  ])('returns FARM_NOT_FOUND for %s', async (url) => {
    const { app } = createApp()
    const response = await app.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual(expect.objectContaining({ code: 'FARM_NOT_FOUND' }))
  })
})
