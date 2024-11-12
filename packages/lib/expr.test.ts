import { describe, it, expect } from 'vitest'
import { isValid, run, topoSort } from './expr'

describe('valud', () => {
  it('should check valid', async () => {
    console.log(
      run(`'what '|replace('a', 'pogo')+a+(c||'')+' mnaks'`, { a: 13, c: 'am' })
    )
    const valid = isValid('ax')
    expect(valid).toBeTruthy()
  })
})

describe('toposort', () => {
  it('should do toposort', async () => {
    console.log(
      topoSort({
        subject: [],
        'actor-verb': ['actor', 'verb'],
        'verb-subject': ['verb', 'subject'],
      })
    )
    expect(1).toBeTruthy()
  })
})
