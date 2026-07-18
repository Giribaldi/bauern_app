import { describe, expect, it, vi } from 'vitest'
import { startWorker } from './index'

describe('worker', () => {
  it('starts without creating an uncontrolled loop', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(startWorker).not.toThrow()
    expect(log).toHaveBeenCalledWith('Worker started')

    log.mockRestore()
  })
})
