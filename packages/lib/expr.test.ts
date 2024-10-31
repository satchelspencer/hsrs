import { describe, it, expect } from 'vitest'
import { isValid, run } from './expr'

describe('valud', () => {
  it('should check valid', async () => {
    console.log(
      run(`'what '|replace('a', 'pogo')+a+(c||'')+' mnaks'`, { a: 13, c: 'am' })
    )
    const valid = isValid('ax')
    expect(valid).toBeTruthy()
  })
})
