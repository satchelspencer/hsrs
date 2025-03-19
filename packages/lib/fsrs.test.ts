import { describe, it, expect } from 'vitest'
import { fsrs } from './fsrs'

describe('fsrs', () => {
  it('should initialize fsrs', async () => {
    const instance = await fsrs()
    console.log(instance.memoryState(new Uint32Array([4]), new Uint32Array([1])))
    expect(instance).toBeDefined()
  })
})
