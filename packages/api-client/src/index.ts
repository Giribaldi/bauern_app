import createClient, { type HeadersOptions } from 'openapi-fetch'
import type { operations, paths } from './generated/schema'

export type { operations, paths } from './generated/schema'

export interface ApiClientOptions {
  readonly baseUrl: string
  readonly headers?: HeadersOptions
  readonly fetch?: typeof globalThis.fetch
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

const isProblem = (
  value: unknown
): value is { code: string; detail: string; requestId?: string } => {
  if (typeof value !== 'object' || value === null) return false
  return (
    'code' in value &&
    typeof value.code === 'string' &&
    'detail' in value &&
    typeof value.detail === 'string'
  )
}

export const normalizeApiError = (status: number, value: unknown): ApiClientError => {
  if (isProblem(value)) {
    return new ApiClientError(status, value.code, value.detail, value.requestId)
  }
  return new ApiClientError(
    status,
    'UNEXPECTED_RESPONSE',
    "L'API a retourné une réponse inattendue."
  )
}

const normalizeNetworkError = (error: unknown): ApiClientError => {
  const message = error instanceof Error ? error.message : "La connexion à l'API a échoué."
  return new ApiClientError(0, 'NETWORK_ERROR', message)
}

export const createApiClient = ({ baseUrl, headers, fetch }: ApiClientOptions) => {
  const client = createClient<paths>({ baseUrl, headers, fetch })

  return {
    raw: client,
    async findNearbyFarms(
      query: operations['findNearbyFarms']['parameters']['query']
    ): Promise<operations['findNearbyFarms']['responses'][200]['content']['application/json']> {
      try {
        const { data, error, response } = await client.GET('/v1/farms/nearby', {
          params: { query },
        })
        if (data !== undefined) return data
        throw normalizeApiError(response.status, error)
      } catch (error) {
        if (error instanceof ApiClientError) throw error
        throw normalizeNetworkError(error)
      }
    },
    async getFarm(
      farmId: string
    ): Promise<operations['getFarm']['responses'][200]['content']['application/json']> {
      try {
        const { data, error, response } = await client.GET('/v1/farms/{farmId}', {
          params: { path: { farmId } },
        })
        if (data !== undefined) return data
        throw normalizeApiError(response.status, error)
      } catch (error) {
        if (error instanceof ApiClientError) throw error
        throw normalizeNetworkError(error)
      }
    },
    async getFarmListings(
      farmId: string
    ): Promise<operations['getFarmListings']['responses'][200]['content']['application/json']> {
      try {
        const { data, error, response } = await client.GET('/v1/farms/{farmId}/listings', {
          params: { path: { farmId } },
        })
        if (data !== undefined) return data
        throw normalizeApiError(response.status, error)
      } catch (error) {
        if (error instanceof ApiClientError) throw error
        throw normalizeNetworkError(error)
      }
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
