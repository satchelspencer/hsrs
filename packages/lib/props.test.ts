import { describe, it, expect } from 'vitest'
import { getElementAndParents, getElementProps } from './props'

describe('getElementAndParents', () => {
  it('should resolve deep parents with circular refz', async () => {
    expect(
      getElementAndParents('a', {
        a: { name: 'a', parents: ['b'], props: {} },
        b: { name: 'b', parents: ['c', 'd'], props: {} },
        c: { name: 'c', parents: [], props: {} },
        d: { name: 'd', parents: ['a'], props: {} },
        e: { name: 'e', parents: [], props: {} },
      })
    ).toEqual(['a', 'b', 'd', 'c'])
  })
})

describe('resolveProps', () => {
  it('should resolve deep props ', async () => {
    expect(
      getElementProps('a', {
        a: { name: 'a', parents: ['b'], props: { p1: ['1', '1b'] } },
        b: { name: 'b', parents: ['c', 'd'], props: { p1: ['2', '2b'] } },
        c: { name: 'c', parents: [], props: { p3: ['a', 'ab'], p4: ['b', 'bb'] } },
        d: { name: 'c', parents: ['a'], props: {} },
      })
    ).toEqual({ p1: ['1', '1b'], p3: ['a', 'ab'], p4: ['b', 'bb'] })
  })
})
