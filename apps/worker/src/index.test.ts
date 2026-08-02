import { describe, expect, it } from 'vitest'
import { runWorkerCycle, startWorker } from './index'

describe('worker', () => {
  it('exports a bounded cycle for tests and supervision', () => {
    expect(runWorkerCycle).toBeTypeOf('function')
    expect(startWorker).toBeTypeOf('function')
  })
})
