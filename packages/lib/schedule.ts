import { fsrs as init, Fsrs } from './fsrs'
import * as t from './types'
import _ from 'lodash'

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

export function nextCardState(
  cardState: t.CardState | undefined,
  grade: number,
  probability: number
): t.CardState {
  const now = getTime(),
    memoryState = nextState(
      cardState,
      cardState?.lastSeen ? now - cardState.lastSeen : 0,
      grade,
      probability
    )
  return {
    ...memoryState,
    lastSeen: now,
    due: now + Math.floor(fsrs!.nextInterval(memoryState.stability, 0.9, 3) * 24 * 3600),
    views: (cardState?.views ?? 0) + 1,
  }
}

export function nextState(
  memoryState: t.MemoryState | undefined,
  secondsElapsed: number,
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
        secondsElapsed / (3600 * 24)
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

export function getTime() {
  return Math.floor(new Date().getTime() / 1000)
}

export function applyHistoryToCards(cards: t.Cards, history: t.CardLearning[]) {
  for (const learning of history) {
    cards.history.push(learning)
    //TODO handle sub cards
    cards.states[learning.cardId] = nextCardState(
      cards.states[learning.cardId],
      learning.score,
      1
    )
  }
}
