import { describe, it, expect } from 'vitest'
import { ready, nextState } from './schedule'

describe('schedule', async () => {
  await ready()

  it('should run nextState with undefined', () => {
    const n = nextState(undefined, 0, 1, 1)
    console.log(n)
    expect({}).toBeDefined()
  })

  it('should run nextState with init', () => {
    const n = nextState({ stability: 1.1, difficulty: 5 }, 0, 4, 0.9)
    console.log(n)
    expect({}).toBeDefined()
  })
})
