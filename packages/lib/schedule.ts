import { fsrs as init, Fsrs, defaultParams } from './fsrs'
import { getInheritedElement } from './props'
import { card2Id, id2Card } from './session'
import * as t from './types'
import _ from 'lodash'

let fsrs: Fsrs | null = null,
  waiting: (() => void)[] = [],
  params = defaultParams

init().then((f) => {
  fsrs = f
  waiting.forEach((c) => c())
})

export async function setParams(params?: number[]) {
  fsrs = await init(params)
}

export function getLearnTargetStability() {
  return fsrs!.memoryState(new Uint32Array([3]), new Uint32Array([0]))[0] * 0.9
}

export function computeParams(
  cids: BigInt64Array,
  ratings: Uint8Array,
  ids: BigInt64Array,
  types: Uint8Array
) {
  return fsrs!.computeParametersAnki(-3 * 60, cids, ratings, ids, types, null, true)
}

export async function ready() {
  if (fsrs) return
  else
    await new Promise<void>((res) => {
      waiting.push(() => res())
    })
}

export const defaultretention = 0.985

export const grades = ['again', 'hard', 'good', 'easy']

export function nextCardState(
  cardState: t.CardState | undefined,
  grade: number,
  probability: number,
  now: number,
  retention = defaultretention
): t.CardState {
  const memoryState = nextState(
      cardState,
      cardState?.lastSeen ? now - cardState.lastSeen : 0,
      grade,
      probability
    ),
    base = (1 - probability) * (cardState?.lastBase ?? now) + probability * now
  return {
    ...memoryState,
    lastBase: base,
    lastSeen: now,
    lastScore: grade,
    lastMiss: grade > 2 ? cardState?.lastMiss : now,
    due: base + nextInterval(memoryState.stability, retention),
  }
}

export function nextInterval(stability: number, retention: number) {
  return Math.floor(fsrs!.nextInterval(stability, retention, 3) * 24 * 3600)
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

    const r = (1 - probability) * memoryState.stability + probability * nextStability,
      intd = (1 - probability) * memoryState.difficulty + probability * nextDifficulty

    return {
      stability: Math.max(r, getLearnTargetStability() / 4),
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
  deck: t.Deck
) {
  for (const learning of history) {
    const diff = getLearningCardDiff(cards, learning, deck)
    Object.assign(cards, diff)
  }
}

export function getLearningCardDiff(
  cards: t.CardStates,
  learning: t.CardLearning,
  deck: t.Deck
): t.CardStates {
  const stateChanges: t.CardStates = {},
    flearnings = flattenCard(learning),
    offsets = flearnings.map(
      (flearning) =>
        getInheritedElement(id2Card(flearning.cardId).element, deck.elements).retention
    ),
    rets = flearnings.map((flearning, i) =>
      getRetention(deck.settings.retention ?? 0.9, offsets[i])
    ),
    successProbs = flearnings.map((l, i) => {
      const state = cards[l.cardId]
      return state?.lastSeen
        ? getRetention(getRetr(state, l.time - state.lastSeen), offsets[i], -1)
        : 1 //if new and in mixed then must be rel
    }),
    totalSuccessProb = successProbs.reduce((memo, p) => memo * p, 1)

  // console.log('??', totalSuccessProb, successProbs)

  for (const i in flearnings) {
    const flearning = flearnings[i],
      state = cards[flearning.cardId]

    const successProb = successProbs[i],
      probability = state ? (1 - successProb) / (1 - totalSuccessProb) : 1

    // console.log(
    //   deck.elements[id2Card(flearning.cardId).element].name,
    //   recencyFactor,
    //   probability,
    //   // probability * recencyFactor,
    //   // state?.difficulty
    // )

    stateChanges[flearning.cardId] = nextCardState(
      state,
      flearning.score,
      probability,
      learning.time,
      rets[i]
    )
  }

  return stateChanges
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

function logistic(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function logit(p: number) {
  if (p <= 0 || p >= 1) throw 'p outside range'
  return Math.log(p / (1 - p))
}

export function getRetention(baseRetention: number, bonus?: string, fac = 1) {
  if (bonus === undefined || baseRetention === 1) return baseRetention
  const float = parseFloat(bonus)
  return logistic(logit(baseRetention) + (_.isNaN(float) ? 0 : float * fac))
}
