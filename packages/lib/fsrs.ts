import * as t from './types'

export function nextIntervalFSRS(stability: number, retention: number) {
  return (stability / (19 / 81)) * (Math.pow(retention, 1 / -0.5) - 1)
}

function retrFSRS(stability: number, daysElapsed: number) {
  return Math.pow(1 + (19 / 81) * (daysElapsed / stability), -0.5)
}

function d0(grade: number, w: number[]) {
  return w[4] - Math.exp(w[5] * (grade - 1)) + 1
}

type FsrsCache = {
  ew8: number
  d0Map: { [grade: number]: number }
  e1718: number
}

let lastw: number[] | null = null,
  lastCache: FsrsCache | null = null
function getFSRSCache(w: number[]) {
  if (w === lastw && lastCache) return lastCache
  else {
    lastw = w
    lastCache = {
      ew8: Math.exp(w[8]),
      d0Map: {},
      e1718: Math.exp(w[17] * w[18]),
    }
    for (let i = 1; i < 5; i++) lastCache.d0Map[i] = d0(i, w)
    return lastCache
  }
}

export function nextStateFSRS(
  memoryState: t.MemoryState | undefined,
  daysElapsed: number,
  grade: number,
  w: number[]
): t.MemoryState {
  const cache = getFSRSCache(w)
  if (!memoryState) {
    return { stability: w[grade - 1], difficulty: cache.d0Map[grade] }
  } else {
    if (grade === 0) return memoryState
    const difficulty = Math.fround(memoryState.difficulty),
      stability = Math.fround(memoryState.stability)

    const deltaD = -w[6] * (grade - 3),
      dp = memoryState.difficulty + (deltaD / 9) * (10 - difficulty),
      dd = w[7] * (d0(4, w) - dp) + dp,
      nextD = Math.min(Math.max(dd, 1), 10)

    if (daysElapsed < 1) {
      return {
        stability: stability * Math.exp(w[17] * (grade - 3 + w[18])),
        difficulty: nextD,
      }
    } else {
      const retr = retrFSRS(stability, daysElapsed)
      if (grade === 1) {
        return {
          stability: Math.min(
            w[11] *
              Math.pow(difficulty, -w[12]) *
              (Math.pow(stability + 1, w[13]) - 1) *
              Math.exp(w[14] * (1 - retr)),
            stability / cache.e1718
          ),
          difficulty: nextD,
        }
      } else {
        let sinci =
          cache.ew8 *
          (11 - difficulty) *
          Math.pow(stability, -w[9]) *
          (Math.exp(w[10] * (1 - retr)) - 1)

        if (grade === 2) sinci *= w[15]
        else if (grade === 4) sinci *= w[16]

        return { stability: stability * (sinci + 1), difficulty: nextD }
      }
    }
  }
}
