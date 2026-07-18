import Fastify from 'fastify'

export const buildApp = () => {
  const app = Fastify()

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}

export const startApp = async () => {
  const app = buildApp()
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
    console.log('API listening on http://0.0.0.0:3000')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startApp()
}
