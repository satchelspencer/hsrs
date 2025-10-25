import { getCache } from './cache'
import { nextIntervalFSRS, nextStateFSRS } from './fsrs'
import { getInheritedElement } from './props'
import { card2Id, id2Card } from './session'
import * as t from './types'
import _ from 'lodash'

export const defaultParams = [
  0.77, 3.467, 16.191, 64.764, 7.254, 0.381, 1.704, 0.0148, 1.365, 0.221, 0.867, 1.958,
  0.081, 0.304, 2.297, 0.116, 3.339, 0.362, 0.347,
]
export const defaultretention = 0.965
export const grades = ['again', 'hard', 'good', 'easy']

export function getLearnTargetStability(w: number[]) {
  return invertRetr(defaultretention, 1 * 3600 * 24) //now 1 day at 965, could pass in retention
}

function roundf(number: number) {
  return Math.round(number * 1e3) / 1e3
}

export function nextCardState(
  cardState: t.CardState | undefined,
  grade: number,
  probability: number,
  now: number,
  retention = defaultretention,
  w: number[],
  root?: boolean
): t.CardState {
  const memoryState = nextState(
      cardState,
      cardState?.lastSeen ? now - cardState.lastSeen : 0,
      grade,
      probability,
      w
    ),
    base = Math.floor(
      (1 - probability) * (cardState?.lastBase ?? now) + probability * now
    )
  return {
    ...memoryState,
    difficulty: root
      ? memoryState.difficulty
      : cardState?.difficulty ?? memoryState.difficulty,
    lastBase: base,
    lastSeen: now,
    lastScore: grade,
    lastMiss: grade > 2 || !root ? cardState?.lastMiss : now,
    firstSeen: cardState?.firstSeen ?? now,
    lastRoot: root ? now : cardState?.lastRoot,
  }
}

export function nextInterval(stability: number, retention: number) {
  return Math.floor(nextIntervalFSRS(stability, retention) * 24 * 3600)
}

/* inverse of retention curve from fsrs */
function invertRetr(retention: number, secondsElapsed: number): number {
  if (retention >= 1) return 1e6
  if (retention <= 0) return 0.01
  return ((19 / 81) * secondsElapsed) / (3600 * 24 * (Math.pow(retention, -2) - 1))
}

export function nextState(
  memoryState: t.MemoryState | undefined,
  secondsElapsed: number,
  grade: number,
  probability: number,
  w: number[]
): t.MemoryState {
  if (!memoryState) {
    return nextStateFSRS(undefined, 0, grade, w)
  } else {
    const nextMemoryState = nextStateFSRS(
      memoryState,
      Math.floor(secondsElapsed / (3600 * 24)),
      grade,
      w
    )

    const retr = getRetr(memoryState, secondsElapsed),
      nextRetr = getRetr(nextMemoryState, secondsElapsed),
      retrInterp = (1 - probability) * retr + probability * nextRetr,
      stabilityInterp = invertRetr(retrInterp, secondsElapsed),
      difficultyInterp =
        (1 - probability) * memoryState.difficulty +
        probability * nextMemoryState.difficulty

    const asymStability = softClamp(stabilityInterp, 365, 0.5)

    return {
      stability: roundf(Math.max(asymStability, getLearnTargetStability(w) / 4)),
      difficulty: roundf(difficultyInterp),
    }
  }
}

export function softClamp(n: number, max: number, ratio: number) {
  const maxLinear = max * ratio
  return n < maxLinear
    ? n
    : maxLinear +
        (max - maxLinear) * (1 - Math.exp(-(1 / (max - maxLinear)) * (n - maxLinear)))
}

export function getRetr(state: t.MemoryState, secondsElapsed: number) {
  return Math.pow(
    1 + (19 / 81) * (secondsElapsed / (state.stability * (3600 * 24))),
    -0.5
  )
}

let mockTime: number | undefined = undefined

export function setMockTime(time: number) {
  if (typeof process === 'undefined' || !process.env.VITEST)
    throw 'setMockTime can only be used in vitest'

  mockTime = time
}

export function getTime() {
  return mockTime ?? Math.floor(new Date().getTime() / 1000)
}

export function applyHistoryToCards(
  cards: t.CardStates,
  history: t.CardLearning[],
  deck: t.Deck
) {
  for (const learning of history) {
    if (flattenCard(learning).find((l) => !deck.elements[id2Card(l.cardId).element]))
      continue
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
        elId = id2Card(l.cardId).element
      return state?.lastSeen && cache.hasProps[elId]
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
      probability =
        state && flearnings.length > 1
          ? totalSuccessProb === 1
            ? 0
            : (1 - successProb) / (1 - totalSuccessProb)
          : 1,
      ret = offsetRetention(baseRet, offsets[i])

    const delayM = (learning.time - (state?.lastSeen ?? 0)) / 3600,
      delayPenalty = state?.stability < 3 && state?.lastSeen ? delayM / (delayM + 1) : 1
    //console.log(deck.elements[id2Card(flearning.cardId).element].name, probability)

    stateChanges[flearning.cardId] = nextCardState(
      state,
      flearning.score,
      probability * delayPenalty,
      learning.time,
      ret,
      deck.settings.fsrsParams ?? defaultParams,
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
  return logistic(logit(baseRetention) + offset * 0.5)
}

export function getELRetrOffset(
  element: string,
  elements: t.IdMap<t.Element>,
  cache?: t.DeckCache
) {
  cache ??= getCache(elements)
  const el = getInheritedElement(element, elements, cache),
    offset =
      // (3 * cache.depths[element]) / (cache.depths[element] + 0.5) +
      3 * Math.log1p(cache.depths[element]) + parseFloat(el.retention ?? '0') || 0
  return offset
}

export function getCardDueDates(deck: t.Deck, cache: t.DeckCache) {
  const dues: { [cardId: string]: number | undefined } = {}

  for (const cardId in deck.cards)
    dues[cardId] = getCardDue(cardId, deck.cards[cardId], deck, cache)

  return dues
}

export function getCardDue(
  cardId: string,
  state: t.CardState,
  deck: t.Deck,
  cache: t.DeckCache
) {
  if (state.lastBase) {
    const offset = getELRetrOffset(id2Card(cardId).element, deck.elements, cache),
      retention = offsetRetention(deck.settings.retention ?? defaultretention, offset)

    return state.lastBase + nextInterval(state.stability, retention)
  }
}
