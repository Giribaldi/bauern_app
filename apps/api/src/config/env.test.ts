import { describe, expect, it } from 'vitest'
import {
  EnvironmentValidationError,
  parseApiEnvironment,
  parseApiPort,
  parseDatabaseEnvironment,
} from './env'

describe('parseDatabaseEnvironment', () => {
  it('throws EnvironmentValidationError when DATABASE_URL is missing', () => {
    expect(() => parseDatabaseEnvironment({})).toThrow(EnvironmentValidationError)
    try {
      parseDatabaseEnvironment({})
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect(error).toHaveProperty('name', 'EnvironmentValidationError')
      expect((error as Error).message).toBe('DATABASE_URL variable is missing.')
    }
  })

  it('throws EnvironmentValidationError when DATABASE_URL is empty', () => {
    expect(() => parseDatabaseEnvironment({ DATABASE_URL: '' })).toThrow(EnvironmentValidationError)
    try {
      parseDatabaseEnvironment({ DATABASE_URL: '' })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('DATABASE_URL variable is empty.')
    }
  })

  it('throws EnvironmentValidationError when DATABASE_URL contains only spaces', () => {
    expect(() => parseDatabaseEnvironment({ DATABASE_URL: '   ' })).toThrow(
      EnvironmentValidationError
    )
    try {
      parseDatabaseEnvironment({ DATABASE_URL: '   ' })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('DATABASE_URL variable is empty.')
    }
  })

  it('throws EnvironmentValidationError when DATABASE_URL is syntactically invalid', () => {
    const invalidUrl = 'not-a-valid-url'
    expect(() => parseDatabaseEnvironment({ DATABASE_URL: invalidUrl })).toThrow(
      EnvironmentValidationError
    )
    try {
      parseDatabaseEnvironment({ DATABASE_URL: invalidUrl })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('DATABASE_URL is not a valid URL.')
      expect((error as Error).message).not.toContain(invalidUrl)
    }
  })

  it('throws EnvironmentValidationError when protocol is HTTP', () => {
    const httpUrl = 'http://localhost:5432/mydb'
    expect(() => parseDatabaseEnvironment({ DATABASE_URL: httpUrl })).toThrow(
      EnvironmentValidationError
    )
    try {
      parseDatabaseEnvironment({ DATABASE_URL: httpUrl })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe(
        'DATABASE_URL protocol must be postgres: or postgresql:.'
      )
      expect((error as Error).message).not.toContain(httpUrl)
    }
  })

  it('accepts postgres: protocol', () => {
    const validUrl = 'postgres://user:secretpass@localhost:5432/mydb'
    const result = parseDatabaseEnvironment({ DATABASE_URL: validUrl })
    expect(result).toEqual({ databaseUrl: validUrl })
  })

  it('accepts postgresql: protocol', () => {
    const validUrl = 'postgresql://user:secretpass@localhost:5432/mydb'
    const result = parseDatabaseEnvironment({ DATABASE_URL: validUrl })
    expect(result).toEqual({ databaseUrl: validUrl })
  })

  it('trims exterior spaces from DATABASE_URL', () => {
    const rawUrl = '  postgres://user:secretpass@localhost:5432/mydb  '
    const expectedUrl = 'postgres://user:secretpass@localhost:5432/mydb'
    const result = parseDatabaseEnvironment({ DATABASE_URL: rawUrl })
    expect(result).toEqual({ databaseUrl: expectedUrl })
  })

  it('ensures sensitive full URL is never included in error messages', () => {
    const sensitiveUrl = 'http://admin:supersecret123@db.example.com:5432/secret_db'
    try {
      parseDatabaseEnvironment({ DATABASE_URL: sensitiveUrl })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).not.toContain(sensitiveUrl)
      expect((error as Error).message).not.toContain('supersecret123')
      expect((error as Error).message).not.toContain('secret_db')
    }
  })
})

describe('parseApiPort', () => {
  it('throws EnvironmentValidationError when API_PORT is missing', () => {
    expect(() => parseApiPort({})).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({})
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect(error).toHaveProperty('name', 'EnvironmentValidationError')
      expect((error as Error).message).toBe('API_PORT variable is missing.')
    }
  })

  it('throws EnvironmentValidationError when API_PORT is empty', () => {
    expect(() => parseApiPort({ API_PORT: '' })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: '' })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT variable is empty.')
    }
  })

  it('throws EnvironmentValidationError when API_PORT contains only spaces', () => {
    expect(() => parseApiPort({ API_PORT: '   ' })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: '   ' })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT variable is empty.')
    }
  })

  it('throws EnvironmentValidationError when API_PORT is non-numeric', () => {
    const invalidVal = 'abc'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is partially numeric', () => {
    const invalidVal = '3000abc'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is a decimal number', () => {
    const invalidVal = '3000.5'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is in exponential notation', () => {
    const invalidVal = '3e3'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT has an explicit positive sign', () => {
    const invalidVal = '+3000'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT has an explicit negative sign', () => {
    const invalidVal = '-3000'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is zero', () => {
    const invalidVal = '0'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be between 1 and 65535.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is negative', () => {
    const invalidVal = '-10'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('throws EnvironmentValidationError when API_PORT is greater than 65535', () => {
    const invalidVal = '65536'
    expect(() => parseApiPort({ API_PORT: invalidVal })).toThrow(EnvironmentValidationError)
    try {
      parseApiPort({ API_PORT: invalidVal })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be between 1 and 65535.')
      expect((error as Error).message).not.toContain(invalidVal)
    }
  })

  it('accepts minimum boundary 1', () => {
    const result = parseApiPort({ API_PORT: '1' })
    expect(result).toEqual({ apiPort: 1 })
  })

  it('accepts standard port 3000', () => {
    const result = parseApiPort({ API_PORT: '3000' })
    expect(result).toEqual({ apiPort: 3000 })
  })

  it('accepts maximum boundary 65535', () => {
    const result = parseApiPort({ API_PORT: '65535' })
    expect(result).toEqual({ apiPort: 65535 })
  })

  it('trims exterior spaces before conversion', () => {
    const result = parseApiPort({ API_PORT: '  3000  ' })
    expect(result).toEqual({ apiPort: 3000 })
  })

  it('returns exact shape { apiPort: number }', () => {
    const result = parseApiPort({ API_PORT: '8080' })
    expect(result).toHaveProperty('apiPort', 8080)
    expect(Object.keys(result)).toEqual(['apiPort'])
    expect(typeof result.apiPort).toBe('number')
  })
})

describe('parseApiEnvironment', () => {
  it('parses a completely valid environment', () => {
    const validEnv = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    }
    const result = parseApiEnvironment(validEnv)
    expect(result).toEqual({
      databaseUrl: 'postgres://user:pass@localhost:5432/mydb',
      apiPort: 3000,
    })
  })

  it('returns exact shape containing only databaseUrl and apiPort', () => {
    const validEnv = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    }
    const result = parseApiEnvironment(validEnv)
    expect(Object.keys(result)).toEqual(['databaseUrl', 'apiPort'])
    expect(result).toHaveProperty('databaseUrl')
    expect(result).toHaveProperty('apiPort')
  })

  it('ensures databaseUrl is a string', () => {
    const validEnv = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    }
    const result = parseApiEnvironment(validEnv)
    expect(typeof result.databaseUrl).toBe('string')
  })

  it('ensures apiPort is a number', () => {
    const validEnv = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    }
    const result = parseApiEnvironment(validEnv)
    expect(typeof result.apiPort).toBe('number')
  })

  it('normalizes exterior spaces of both variables', () => {
    const rawEnv = {
      DATABASE_URL: '  postgres://user:pass@localhost:5432/mydb  ',
      API_PORT: '  8080  ',
    }
    const result = parseApiEnvironment(rawEnv)
    expect(result).toEqual({
      databaseUrl: 'postgres://user:pass@localhost:5432/mydb',
      apiPort: 8080,
    })
  })

  it('accepts postgres: protocol', () => {
    const result = parseApiEnvironment({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    })
    expect(result.databaseUrl).toBe('postgres://user:pass@localhost:5432/mydb')
  })

  it('accepts postgresql: protocol', () => {
    const result = parseApiEnvironment({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
      API_PORT: '3000',
    })
    expect(result.databaseUrl).toBe('postgresql://user:pass@localhost:5432/mydb')
  })

  it('propagates DATABASE_URL error when API_PORT is valid', () => {
    const envWithMissingDb = { API_PORT: '3000' }
    expect(() => parseApiEnvironment(envWithMissingDb)).toThrow(EnvironmentValidationError)
    try {
      parseApiEnvironment(envWithMissingDb)
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('DATABASE_URL variable is missing.')
    }
  })

  it('propagates API_PORT error when DATABASE_URL is valid', () => {
    const envWithInvalidPort = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
      API_PORT: 'invalid_port',
    }
    expect(() => parseApiEnvironment(envWithInvalidPort)).toThrow(EnvironmentValidationError)
    try {
      parseApiEnvironment(envWithInvalidPort)
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('API_PORT must be a valid integer format.')
    }
  })

  it('evaluates DATABASE_URL first when both variables are invalid', () => {
    const doubleInvalidEnv = {
      DATABASE_URL: 'not-a-valid-url',
      API_PORT: 'not-a-valid-port',
    }
    expect(() => parseApiEnvironment(doubleInvalidEnv)).toThrow(EnvironmentValidationError)
    try {
      parseApiEnvironment(doubleInvalidEnv)
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).toBe('DATABASE_URL is not a valid URL.')
    }
  })

  it('ensures no sensitive or raw values are leaked in error messages', () => {
    const sensitiveDbUrl = 'http://admin:secret123@db.example.com:5432/private_db'
    const rawInvalidPort = '999999'

    try {
      parseApiEnvironment({ DATABASE_URL: sensitiveDbUrl, API_PORT: '3000' })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).not.toContain(sensitiveDbUrl)
      expect((error as Error).message).not.toContain('secret123')
    }

    try {
      parseApiEnvironment({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
        API_PORT: rawInvalidPort,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      expect((error as Error).message).not.toContain(rawInvalidPort)
    }
  })

  it('does not mutate the provided environment object', () => {
    const inputEnv = Object.freeze({
      DATABASE_URL: '  postgres://user:pass@localhost:5432/mydb  ',
      API_PORT: '  3000  ',
    })
    const copy = { ...inputEnv }
    parseApiEnvironment(copy)
    expect(copy).toEqual(inputEnv)
  })

  it('has no dependency on real process.env', () => {
    const isolatedEnv = {
      DATABASE_URL: 'postgres://isolated:secret@127.0.0.1:5432/isolated_db',
      API_PORT: '8080',
    }
    const result = parseApiEnvironment(isolatedEnv)
    expect(result).toEqual({
      databaseUrl: 'postgres://isolated:secret@127.0.0.1:5432/isolated_db',
      apiPort: 8080,
    })
  })
})
