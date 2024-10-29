import { describe, it, expect } from 'vitest'
import { fsrs } from './fsrs'

describe('fsrs', () => {
  it('should initialize fsrs', async () => {
    const instance = await fsrs()
    expect(instance).toBeDefined()
  })
})
