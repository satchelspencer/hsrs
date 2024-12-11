import { describe, it, expect } from 'vitest'
import { versionable } from './versionable'

describe('versionable', () => {
  const x = versionable<{ x: number }>('x'),
    y = versionable('y', x, (v) => ({ ...v, y: false })),
    z = versionable('z', y, (v) => ({ ...v, z: [] }))

  it('should create a version x object', () => {
    const created = x.create({ x: 12 })
    expect(created).toEqual({ x: 12, _v: 'x' })
  })

  it('should create a version y object', () => {
    const created = y.create({ x: 12, y: false })
    expect(created).toEqual({ x: 12, y: false, _v: 'y' })
  })

  it('should create a version z object', () => {
    const created = z.create({ x: 12, y: false, z: [] })
    expect(created).toEqual({ x: 12, y: false, z: [], _v: 'z' })
  })

  it('should migrate from version x to version y', () => {
    const vx = x.create({ x: 12 })
    const migrated = y.migrate(vx)
    expect(migrated).toEqual({ x: 12, y: false, _v: 'y' })
  })

  it('should migrate from version y to version z', () => {
    const vy = y.create({ x: 12, y: false })
    const migrated = z.migrate(vy)
    expect(migrated).toEqual({ x: 12, y: false, z: [], _v: 'z' })
  })

  it('should migrate from version x to version z through chain', () => {
    const vx = x.create({ x: 12 })
    const migrated = z.migrate(vx)
    expect(migrated).toEqual({ x: 12, y: false, z: [], _v: 'z' })
  })

  it('should pass through when migrating an already current version', () => {
    const current = z.create({ x: 12, y: false, z: [] })
    const migrated = z.migrate(current)
    expect(migrated).toEqual(current)
  })

  it('should handle complex object migrations', () => {
    const initial = x.create({ x: 42 })
    const migrated = z.migrate(initial)
    expect(migrated).toEqual({ x: 42, y: false, z: [], _v: 'z' })
  })

  it('should pass through when migrating a current version created from nullMig', () => {
    const createdFromNull = x.create({ x: 12 })
    const migrated = x.migrate(createdFromNull)
    expect(migrated).toEqual(createdFromNull)
  })
})
