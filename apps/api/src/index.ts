import { fileURLToPath } from 'node:url'
import { buildApp, verifyReadiness } from './app'
import { loadApiEnvironment } from './config/env'
import { loadRootEnvironment } from './config/load-root-environment'
import { createDatabase } from './database/connection'
import { createFarmsRepository } from './modules/farms/farms.repository'

export { buildApp } from './app'

export const startServer = async () => {
  loadRootEnvironment()
  const environment = loadApiEnvironment()
  const database = createDatabase({ databaseUrl: environment.databaseUrl })
  const app = buildApp({
    checkReadiness: () => verifyReadiness(database),
    farmsRepository: createFarmsRepository(database),
  })

  app.addHook('onClose', async () => {
    await database.destroy()
  })

  try {
    await app.listen({ port: environment.apiPort, host: '0.0.0.0' })
    console.log(`API listening on http://0.0.0.0:${environment.apiPort}`)
  } catch (err) {
    app.log.error(err)
    await app.close()
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void startServer()
}
