import { describe, it, expect } from 'vitest'
import { resolveTypes, resolveProps } from './props'

describe('resolveTypes', () => {
  it('should resolve deep types with circular refz', async () => {
    expect(
      resolveTypes(['a', 'e'], {
        a: { name: 'a', types: ['b'], props: {} },
        b: { name: 'b', types: ['c', 'd'], props: {} },
        c: { name: 'c', types: [], props: {} },
        d: { name: 'd', types: ['a'], props: {} },
        e: { name: 'e', types: [], props: {} },
      })
    ).toEqual(['e', 'a', 'b', 'd', 'c'])
  })
})

describe('resolveProps', () => {
  it('should resolve deep props ', async () => {
    expect(
      resolveProps('a', {
        a: { name: 'a', types: ['b'], props: { p1: '1' } },
        b: { name: 'b', types: ['c', 'd'], props: { p1: '2' } },
        c: { name: 'c', types: [], props: { p3: 'a', p4: 'b' } },
        d: { name: 'c', types: ['a'], props: {} },
      })
    ).toEqual({ p1: '2', p3: 'a', p4: 'b' })
  })
})
