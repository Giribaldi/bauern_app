import { fileURLToPath } from 'node:url'
import { buildApp, verifyReadiness } from './app'
import { loadApiEnvironment } from './config/env'
import { loadRootEnvironment } from './config/load-root-environment'
import { createDatabase } from './database/connection'
import { createFarmsRepository } from './modules/farms/farms.repository'
import { createAuthService } from './modules/auth/auth.service'
import { AdminService } from './modules/admin/admin.service'
import { CommerceService } from './modules/commerce/commerce.service'
import { FakePaymentProvider, StripePaymentProvider } from './modules/commerce/payment'

export { buildApp } from './app'

export const startServer = async () => {
  loadRootEnvironment()
  const environment = loadApiEnvironment()
  const database = createDatabase({ databaseUrl: environment.databaseUrl })
  const authService = createAuthService(
    database,
    Number(process.env.SESSION_DURATION_SECONDS ?? '86400')
  )
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.STRIPE_SECRET_KEY === undefined || process.env.STRIPE_WEBHOOK_SECRET === undefined)
  )
    throw new Error('Stripe configuration is required in production.')
  const paymentProvider =
    process.env.STRIPE_SECRET_KEY !== undefined && process.env.STRIPE_WEBHOOK_SECRET !== undefined
      ? new StripePaymentProvider(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET)
      : new FakePaymentProvider()
  const app = buildApp({
    checkReadiness: () => verifyReadiness(database),
    farmsRepository: createFarmsRepository(database),
    authService,
    adminService: new AdminService(database, authService),
    commerceService: new CommerceService(
      database,
      paymentProvider,
      process.env.PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000'
    ),
    secureCookies: process.env.NODE_ENV === 'production',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002')
      .split(',')
      .map((origin) => origin.trim()),
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
