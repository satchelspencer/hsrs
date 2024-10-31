import { describe, it, expect } from 'vitest'
import { resolveTypes, resolveProps } from './props'

describe('resolveTypes', () => {
  it('should resolve deep types with circular refz', async () => {
    expect(
      resolveTypes(['a', 'e'], {
        a: { name: 'a', extends: ['b'], props: {} },
        b: { name: 'b', extends: ['c', 'd'], props: {} },
        c: { name: 'c', extends: [], props: {} },
        d: { name: 'd', extends: ['a'], props: {} },
        e: { name: 'e', extends: [], props: {} },
      })
    ).toEqual(['e', 'a', 'b', 'd', 'c'])
  })
})

describe('resolveProps', () => {
  it('should resolve deep props ', async () => {
    expect(
      resolveProps('a', {
        a: { name: 'a', extends: ['b'], props: { p1: '1' } },
        b: { name: 'b', extends: ['c', 'd'], props: { p1: '2' } },
        c: { name: 'c', extends: [], props: { p3: 'a', p4: 'b' } },
        d: { name: 'c', extends: ['a'], props: {} },
      })
    ).toEqual({ p1: '2', p3: 'a', p4: 'b' })
  })
})
