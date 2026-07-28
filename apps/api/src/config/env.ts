export interface DatabaseEnvironment {
  readonly databaseUrl: string
}

export interface ApiPortEnvironment {
  readonly apiPort: number
}

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentValidationError'
  }
}

export const parseDatabaseEnvironment = (environment: NodeJS.ProcessEnv): DatabaseEnvironment => {
  const rawUrl = environment.DATABASE_URL

  if (rawUrl === undefined) {
    throw new EnvironmentValidationError('DATABASE_URL variable is missing.')
  }

  const trimmedUrl = rawUrl.trim()

  if (trimmedUrl.length === 0) {
    throw new EnvironmentValidationError('DATABASE_URL variable is empty.')
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmedUrl)
  } catch {
    throw new EnvironmentValidationError('DATABASE_URL is not a valid URL.')
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new EnvironmentValidationError('DATABASE_URL protocol must be postgres: or postgresql:.')
  }

  return {
    databaseUrl: trimmedUrl,
  }
}

export const parseApiPort = (environment: NodeJS.ProcessEnv): ApiPortEnvironment => {
  const rawPort = environment.API_PORT

  if (rawPort === undefined) {
    throw new EnvironmentValidationError('API_PORT variable is missing.')
  }

  const trimmedPort = rawPort.trim()

  if (trimmedPort.length === 0) {
    throw new EnvironmentValidationError('API_PORT variable is empty.')
  }

  if (!/^[0-9]+$/.test(trimmedPort)) {
    throw new EnvironmentValidationError('API_PORT must be a valid integer format.')
  }

  const portNumber = Number(trimmedPort)

  if (portNumber < 1 || portNumber > 65535) {
    throw new EnvironmentValidationError('API_PORT must be between 1 and 65535.')
  }

  return {
    apiPort: portNumber,
  }
}

export interface ApiEnvironment extends DatabaseEnvironment, ApiPortEnvironment {}

export const parseApiEnvironment = (environment: NodeJS.ProcessEnv): ApiEnvironment => {
  const databaseEnv = parseDatabaseEnvironment(environment)
  const apiPortEnv = parseApiPort(environment)

  return {
    databaseUrl: databaseEnv.databaseUrl,
    apiPort: apiPortEnv.apiPort,
  }
}

export const loadApiEnvironment = (): ApiEnvironment => {
  return parseApiEnvironment(process.env)
}
