import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from '../app'
import type { FarmsRepository } from '../modules/farms/farms.types'

const unavailableRepository: FarmsRepository = {
  findNearby: async () => ({ farms: [], nextCursor: null }),
  findPublicFarm: async () => undefined,
  findPublicListings: async () => undefined,
}

const outputFile = fileURLToPath(new URL('../../openapi/openapi.json', import.meta.url))

const main = async (): Promise<void> => {
  const app = buildApp({
    checkReadiness: async () => undefined,
    farmsRepository: unavailableRepository,
  })
  await app.ready()
  const document = app.swagger()
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  await app.close()
  console.log(`OpenAPI document written to ${outputFile}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown OpenAPI generation error.'
  console.error(`OpenAPI generation failed: ${message}`)
  process.exitCode = 1
})
