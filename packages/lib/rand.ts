let mockRandom: (() => number) | null = null

/* see https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function setRandomSeed(seed: number | null) {
  if (typeof process === 'undefined' || !process.env.VITEST)
    throw 'setRandomSeed can only be used in tests'
  mockRandom = seed === null ? null : mulberry32(seed)
}

export function random() {
  return mockRandom ? mockRandom() : Math.random()
}

export function shuffle<T>(arr: T[]): T[] {
  const res = [...arr]
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[res[i], res[j]] = [res[j], res[i]]
  }
  return res
}
