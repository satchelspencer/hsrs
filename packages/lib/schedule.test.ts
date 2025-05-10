import { describe, it, expect } from 'vitest'
import { nextState, defaultParams } from './schedule'
import { MemoryState } from './types'
import { nextStateFSRS } from './fsrs'

describe('schedule', async () => {
  it('should run nextState with undefined', () => {
    const n = nextState(undefined, 0, 1, 1, defaultParams)
    console.log(n)
    expect({}).toBeDefined()
  })

  it('should run nextState with init', () => {
    const n = nextState({ stability: 1.1, difficulty: 5 }, 0, 4, 0.9, defaultParams)
    console.log(n)
    expect({}).toBeDefined()
  })

  it.only('should not collapse', () => {
    let t = new Date().getTime()
    const ints = 1e5
    let state: MemoryState | undefined = {
      stability: 1.4344240427017212,
      difficulty: 6.79008202479381,
    }
    // let lastStates: (MemoryState & { grade: number; delay: number })[] = [state]
    for (let i = 0; i < ints; i++) {
      const delay = state ? Math.random() * state.stability + state.stability : 0,
        grade = Math.random() > 0.95 ? 1 : Math.floor(Math.random() * 3 + 2)
      state = nextStateFSRS(state, delay, grade, defaultParams)
      // if (state) lastStates.push({ ...state, grade, delay })
      // if (i > 100) lastStates.shift()
      if (!state.stability) break
    }
    expect(state.stability).not.toBeNaN()
  })
})
