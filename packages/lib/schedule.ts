import { fsrs as init, Fsrs } from './fsrs'
import * as t from './types'

let fsrs: Fsrs | null = null,
  waiting: (() => void)[] = []
init().then((f) => {
  fsrs = f
  waiting.forEach((c) => c())
})

export async function ready() {
  if (fsrs) return
  else
    await new Promise<void>((res) => {
      waiting.push(() => res())
    })
}

const grades = ['again', 'hard', 'good', 'easy']

export function nextState(
  memoryState: t.MemoryState | undefined,
  daysElapsed: number,
  grade: number,
  probability: number
): t.MemoryState {
  if (!memoryState) {
    const [initStability, initDifficulty] = fsrs!.memoryState(
      new Uint32Array([grade]),
      new Uint32Array([0])
    )
    return {
      stability: initStability,
      difficulty: initDifficulty,
    }
  } else {
    const nextMemoryState = fsrs!.nextStates(
        memoryState.stability,
        memoryState.difficulty,
        0.9,
        daysElapsed
      )[grades[grade - 1]].memory,
      nextDifficulty = nextMemoryState.difficulty,
      nextStability = nextMemoryState.stability

    const l = (p) => (p * p) / (1 - p * p),
      linv = (p) => Math.sqrt(p / (p + 1)),
      lprev = l(memoryState.stability),
      lnext = l(nextStability),
      lint = (1 - probability) * lprev + probability * lnext,
      r = linv(lint)

    const intd = (1 - probability) * memoryState.difficulty + probability * nextDifficulty

    return {
      stability: r,
      difficulty: intd,
    }
  }
}
