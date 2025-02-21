import { getCache } from './cache'
import { fsrs as init, Fsrs, defaultParams } from './fsrs'
import { getInheritedElement } from './props'
import { card2Id, id2Card } from './session'
import * as t from './types'
import _ from 'lodash'

let fsrs: Fsrs | null = null,
  waiting: (() => void)[] = []

init().then((f) => {
  fsrs = f
  waiting.forEach((c) => c())
})

export async function setParams(params = defaultParams) {
  await ready()
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

export const defaultretention = 0.965

export const grades = ['again', 'hard', 'good', 'easy']

export function nextCardState(
  cardState: t.CardState | undefined,
  grade: number,
  probability: number,
  now: number,
  retention = defaultretention,
  root?: boolean
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
    lastMiss: grade > 2 || !root ? cardState?.lastMiss : now,
    due: base + nextInterval(memoryState.stability, retention),
    firstSeen: cardState?.firstSeen ?? now,
  }
}

export function nextInterval(stability: number, retention: number) {
  return Math.floor(fsrs!.nextInterval(stability, retention, 3) * 24 * 3600)
}

function invertRetr(retention: number, secondsElapsed: number): number {
  if (retention >= 1) return 1e6
  if (retention <= 0) return 0.01
  return ((19 / 81) * secondsElapsed) / (3600 * 24 * (Math.pow(retention, -2) - 1))
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
      0.9, //this value is unused because we're ignoring the scheduling from this output
      secondsElapsed / (3600 * 24)
    )[grades[grade - 1]].memory

    const retr = getRetr(memoryState, secondsElapsed),
      nextRetr = getRetr(nextMemoryState, secondsElapsed),
      retrInterp = (1 - probability) * retr + probability * nextRetr,
      stabilityInterp = invertRetr(retrInterp, secondsElapsed),
      difficultyInterp =
        (1 - probability) * memoryState.difficulty +
        probability * nextMemoryState.difficulty

    const maxStability = 365,
      maxLinear = 365 / 2,
      asymStability =
        stabilityInterp < maxLinear
          ? stabilityInterp
          : maxLinear +
            (maxStability - maxLinear) *
              (1 -
                Math.exp(
                  -(1 / (maxStability - maxLinear)) * (stabilityInterp - maxLinear)
                ))
    return {
      stability: Math.max(asymStability, getLearnTargetStability() / 4),
      difficulty: difficultyInterp,
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
    cache = getCache(deck.elements),
    offsets = flearnings.map((flearning) =>
      getELRetrOffset(id2Card(flearning.cardId).element, deck.elements, cache)
    ),
    successProbs = flearnings.map((l, i) => {
      const state = cards[l.cardId],
        el = getInheritedElement(id2Card(l.cardId).element, deck.elements)
      return state?.lastSeen && Object.keys(el.props).length
        ? offsetRetention(getRetr(state, l.time - state.lastSeen), -offsets[i])
        : 1 //if new and in mixed then must be rel
    }),
    totalSuccessProb = successProbs.reduce((memo, p) => memo * p, 1),
    baseRet = deck.settings.retention ?? defaultretention

  // console.log('??', totalSuccessProb, successProbs)

  for (const i in flearnings) {
    const flearning = flearnings[i],
      state = cards[flearning.cardId]

    const successProb = successProbs[i],
      probability = state ? (1 - successProb) / (1 - totalSuccessProb) : 1,
      ret = offsetRetention(baseRet, offsets[i])

    //console.log(deck.elements[id2Card(flearning.cardId).element].name, probability)

    stateChanges[flearning.cardId] = nextCardState(
      state,
      flearning.score,
      probability,
      learning.time,
      ret,
      flearning.cardId === learning.cardId
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

export function logistic(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function logit(p: number) {
  if (p <= 0 || p >= 1) throw 'p outside range'
  return Math.log(p / (1 - p))
}

export function offsetRetention(baseRetention: number, offset?: number) {
  baseRetention = Math.min(Math.max(baseRetention, 0), 1)
  if (!_.isNumber(offset) || baseRetention === 1) return baseRetention
  return logistic(logit(baseRetention) + offset)
}

export function getELRetrOffset(
  element: string,
  elements: t.IdMap<t.Element>,
  cache?: t.DeckCache
) {
  cache ??= getCache(elements)
  const el = getInheritedElement(element, elements, cache),
    offset = Math.pow(cache.depths[element], 1 / 3) + parseFloat(el.retention ?? '0') || 0
  return offset
}
