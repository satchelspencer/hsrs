import { getCache } from './cache'
import { getInheritedElement } from './props'
import { card2Id, id2Card } from './session'
import * as t from './types'
import _ from 'lodash'

export const defaultParams = [
  0.7707539200782776, 1.4344240427017212, 3.467081308364868, 16.19120979309082,
  7.254122257232666, 0.3811998963356018, 1.7041410207748413, 0.014886749908328056,
  1.3656686544418335, 0.22190921008586884, 0.8670082092285156, 1.9588409662246704,
  0.08125182241201401, 0.3044493794441223, 2.29744815826416, 0.11656399071216583,
  3.339834451675415, 0.3628292679786682, 0.34700527787208557,
]
export const defaultretention = 0.965
export const grades = ['again', 'hard', 'good', 'easy']

export function getLearnTargetStability(w: number[]) {
  return nextStateFSRS(undefined, 0, 3, w).stability * 0.9
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
    due: base + nextInterval(memoryState.stability, retention),
    firstSeen: cardState?.firstSeen ?? now,
    lastRoot: root ? now : cardState?.lastRoot,
  }
}

export function nextInterval(stability: number, retention: number) {
  return Math.floor(nextIntervalFSRS(stability, retention) * 24 * 3600)
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
      stability: roundf(Math.max(asymStability, getLearnTargetStability(w) / 4)),
      difficulty: roundf(difficultyInterp),
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
        state && flearnings.length > 1 ? (1 - successProb) / (1 - totalSuccessProb) : 1,
      ret = offsetRetention(baseRet, offsets[i])

    //console.log(deck.elements[id2Card(flearning.cardId).element].name, probability)

    stateChanges[flearning.cardId] = nextCardState(
      state,
      flearning.score,
      probability,
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

/* fsrs in js */
function nextIntervalFSRS(stability: number, retention: number) {
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
