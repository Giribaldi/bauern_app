import { describe, expect, it, vi } from 'vitest'
import {
  loadFarmDetails,
  searchNearbyFarms,
  type FarmDetailsClient,
  type NearbyFarmClient,
} from './farm-search'

describe('searchNearbyFarms', () => {
  it('returns seeded farms from the client', async () => {
    const findNearbyFarms = vi.fn(async () => ({
      farms: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          name: 'Ferme des Prés',
          slug: 'ferme-des-pres',
          description: null,
          city: 'Lyon',
          postalCode: '69009',
          distanceKm: 1.25,
        },
      ],
      nextCursor: null,
    }))

    const result = await searchNearbyFarms({ findNearbyFarms } as NearbyFarmClient, {
      latitude: 45.764,
      longitude: 4.8357,
      radiusKm: 20,
    })

    expect(result.farms[0]?.name).toBe('Ferme des Prés')
    expect(findNearbyFarms).toHaveBeenCalledWith(
      expect.objectContaining({ availableOnly: true, radiusKm: 20 })
    )
  })

  it('supports an empty result', async () => {
    const client = {
      findNearbyFarms: vi.fn(async () => ({ farms: [], nextCursor: null })),
    } as NearbyFarmClient
    await expect(
      searchNearbyFarms(client, { latitude: 0, longitude: 0, radiusKm: 1 })
    ).resolves.toEqual({ farms: [], nextCursor: null })
  })

  it('propagates a normalized API error for the page to display', async () => {
    const error = new Error('API indisponible')
    const client = {
      findNearbyFarms: vi.fn(async () => Promise.reject(error)),
    } as NearbyFarmClient
    await expect(
      searchNearbyFarms(client, { latitude: 45, longitude: 4, radiusKm: 20 })
    ).rejects.toBe(error)
  })

  it('loads a public farm and its products together', async () => {
    const client = {
      getFarm: vi.fn(async () => ({ id: 'farm-1', name: 'Ferme test' })),
      getFarmListings: vi.fn(async () => ({ listings: [{ id: 'listing-1' }] })),
    } as unknown as FarmDetailsClient

    const result = await loadFarmDetails(client, 'farm-1')
    expect(result.farm.name).toBe('Ferme test')
    expect(result.listings).toHaveLength(1)
  })
})
