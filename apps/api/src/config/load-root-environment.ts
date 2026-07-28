import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

const rootEnvironmentPath = fileURLToPath(new URL('../../../../.env', import.meta.url))

export const loadRootEnvironment = (): void => {
  config({ path: rootEnvironmentPath })
}
