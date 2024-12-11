import { fsrs as init, Fsrs } from './fsrs'
import { card2Id, id2Card } from './session'
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

export const grades = ['again', 'hard', 'good', 'easy']

export function nextCardState(
  cardState: t.CardState | undefined,
  grade: number,
  probability: number,
  now: number
): t.CardState {
  const memoryState = nextState(
    cardState,
    cardState?.lastSeen ? now - cardState.lastSeen : 0,
    grade,
    probability
  )
  return {
    ...memoryState,
    lastSeen: now,
    due: now + Math.floor(fsrs!.nextInterval(memoryState.stability, 0.98, 3) * 24 * 3600),
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
      stability: Math.max(r, 0.25),
      difficulty: intd,
    }
  }
}

export function getRetr(state: t.MemoryState, secondsElapsed: number) {
  return Math.pow(
    1 + (19 / 81) * (secondsElapsed / (state.stability * (3600 * 24))),
    -0.5
  )
}

export function getTime() {
  return Math.floor(new Date().getTime() / 1000)
}

export function applyHistoryToCards(
  cards: t.CardStates,
  history: t.CardLearning[],
  shallow?: boolean
) {
  for (const learning of history) {
    const flearnings = shallow ? [learning] : flattenCard(learning),
      successProbs = flearnings.map((l) => {
        const state = cards[l.cardId]
        return state?.lastSeen ? getRetr(state, l.time - state.lastSeen) : 0.5
      }),
      totalSuccessProb = successProbs.reduce((memo, p) => memo * p, 1)

    for (const i in flearnings) {
      const flearning = flearnings[i],
        state = cards[flearning.cardId]

      if (!shallow && state?.lastSeen && flearning.time - state.lastSeen < 3600 * 12)
        continue

      const successProb = successProbs[i],
        probability =
          !shallow && flearning.score === 1 && state
            ? (1 - successProb) / (1 - totalSuccessProb)
            : 1

      cards[flearning.cardId] = nextCardState(
        state,
        flearning.score,
        probability,
        learning.time
      )
    }
  }
}

export function flattenCard(learning: t.CardLearning): t.CardLearning[] {
  const res = [learning],
    { property } = id2Card(learning.cardId)
  for (const paramName in learning.params) {
    const paramValue = learning.params[paramName]
    if (paramValue)
      res.push(
        ...flattenCard({
          ...learning,
          cardId: card2Id({ element: paramValue.element, property }),
          params: paramValue.params,
        })
      )
  }
  return _.uniqBy(res, (l) => l.cardId)
}
