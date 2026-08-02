import { describe, expect, it } from 'vitest'
import { ApiClientError, createApiClient } from './index'

describe('createApiClient', () => {
  it('sends typed nearby parameters and returns the inferred response', async () => {
    const requests: Request[] = []
    const client = createApiClient({
      baseUrl: 'https://api.local-market.test',
      headers: { 'x-test': 'client' },
      fetch: async (request, init) => {
        requests.push(request instanceof Request ? request : new Request(request, init))
        return Response.json({ farms: [], nextCursor: null })
      },
    })

    await expect(
      client.findNearbyFarms({ latitude: 45.75, longitude: 4.85, radiusKm: 10 })
    ).resolves.toEqual({ farms: [], nextCursor: null })
    expect(requests[0]?.url).toContain('latitude=45.75')
    expect(requests[0]?.headers.get('x-test')).toBe('client')
  })

  it('normalizes API problem responses', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.local-market.test',
      fetch: async () =>
        Response.json(
          {
            code: 'VALIDATION_ERROR',
            detail: 'Les paramètres fournis sont invalides.',
            requestId: 'request-1',
          },
          { status: 400 }
        ),
    })

    await expect(client.findNearbyFarms({ latitude: 91, longitude: 4 })).rejects.toEqual(
      new ApiClientError(
        400,
        'VALIDATION_ERROR',
        'Les paramètres fournis sont invalides.',
        'request-1'
      )
    )
  })

  it('normalizes network failures', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.local-market.test',
      fetch: async () => Promise.reject(new Error('connection refused')),
    })

    await expect(client.findNearbyFarms({ latitude: 45, longitude: 4 })).rejects.toEqual(
      new ApiClientError(0, 'NETWORK_ERROR', 'connection refused')
    )
  })
})
