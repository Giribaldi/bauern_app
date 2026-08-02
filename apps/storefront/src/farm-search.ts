import type { ApiClient, operations } from '@local-market/api-client'

export type NearbyFarmResponse =
  operations['findNearbyFarms']['responses'][200]['content']['application/json']

export interface FarmSearchInput {
  latitude: number
  longitude: number
  radiusKm: number
}

export interface NearbyFarmClient {
  findNearbyFarms: ApiClient['findNearbyFarms']
}

export interface FarmDetailsClient {
  getFarm: ApiClient['getFarm']
  getFarmListings: ApiClient['getFarmListings']
}

export interface FarmDetails {
  farm: operations['getFarm']['responses'][200]['content']['application/json']
  listings: operations['getFarmListings']['responses'][200]['content']['application/json']['listings']
}

export const searchNearbyFarms = async (
  client: NearbyFarmClient,
  input: FarmSearchInput
): Promise<NearbyFarmResponse> => {
  return client.findNearbyFarms({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    availableOnly: true,
  })
}

export const loadFarmDetails = async (
  client: FarmDetailsClient,
  farmId: string
): Promise<FarmDetails> => {
  const [farm, listingResponse] = await Promise.all([
    client.getFarm(farmId),
    client.getFarmListings(farmId),
  ])
  return { farm, listings: listingResponse.listings }
}
