import { describe, it, expect } from 'vitest'
import { encodeStrokes, decodeStrokes } from './codec'

describe('codec', () => {
  it('roundtrips a single stroke with M and L', () => {
    const strokes = ['M10,20L30,40']
    const encoded = encodeStrokes(strokes)
    expect(decodeStrokes(encoded).strokes).toEqual(strokes)
  })

  it('roundtrips multiple strokes', () => {
    const strokes = ['M0,0L50,50', 'M10,10C20,30,40,50,60,70']
    const encoded = encodeStrokes(strokes)
    expect(decodeStrokes(encoded).strokes).toEqual(strokes)
  })

  it('roundtrips negative coordinates', () => {
    const strokes = ['M-5,-10l-20,30']
    const encoded = encodeStrokes(strokes)
    expect(decodeStrokes(encoded).strokes).toEqual(strokes)
  })

  it('roundtrips zero-arg commands like Z', () => {
    const strokes = ['M0,0L10,10Z']
    const encoded = encodeStrokes(strokes)
    expect(decodeStrokes(encoded).strokes).toEqual(strokes)
  })

  it('roundtrips single-arg commands H and V', () => {
    const strokes = ['M0,0H50V30']
    const encoded = encodeStrokes(strokes)
    expect(decodeStrokes(encoded).strokes).toEqual(strokes)
  })

  it('handles empty input', () => {
    expect(decodeStrokes('').strokes).toEqual([])
    expect(encodeStrokes([])).toBeTruthy()
    expect(decodeStrokes(encodeStrokes([])).strokes).toEqual([])
  })

  it('expands implicit repeats', () => {
    // "c1,2,3,4,5,6 7,8,9,10,11,12" is two implicit c commands
    const strokes = ['M0,0c1,2,3,4,5,6 7,8,9,10,11,12']
    const encoded = encodeStrokes(strokes)
    const decoded = decodeStrokes(encoded).strokes
    expect(decoded).toEqual(['M0,0c1,2,3,4,5,6c7,8,9,10,11,12'])
  })
})
