import { getAllCards, getElementAndParents, getElementProps } from './props'
import { applyHistoryToCards, getTime, nextCardState } from './schedule'
import * as t from './types'
import { sampleElementIstance } from './props'
import _ from 'lodash'

export function createLearningSession(
  deck: t.Deck,
  size: number
): { session: t.LearningSession; new: number; due: number } {
  const learned = getLearnedElements(deck),
    dueCards = getDue(deck, size, learned),
    newCards = _.shuffle(getNew(deck, size - dueCards.length, learned))

  const gaps = newCards.length,
    actual = (gaps * (gaps + 1)) / 2,
    gapFactor = (dueCards.length + newCards.length) / actual,
    sumSpac = [
      0,
      ...new Array(gaps).fill(0).map((v, i) => Math.max((i + 1) * gapFactor, 1)),
    ],
    stack = [...dueCards]

  let d = 0
  for (const gap of sumSpac) {
    d += gap
    const nc = newCards.shift()
    if (!nc) break
    stack.splice(Math.floor(d), 0, nc)
  }

  return {
    session: {
      stack,
      cards: {},
      history: [],
    },
    new: gaps,
    due: dueCards.length,
  }
}

function getLearnedElements(deck: t.Deck): t.IdMap<t.IdMap<t.Element>> {
  const res: t.IdMap<t.IdMap<t.Element>> = {},
    all: t.IdMap<t.Element> = {}

  for (const elid in deck.elements) {
    const el = deck.elements[elid],
      props = Object.keys(el.props),
      elAndParents = getElementAndParents(elid, deck.elements)

    if (!props.length) {
      for (const eid of elAndParents) all[eid] = deck.elements[eid]
    } else {
      for (const propName of props) {
        res[propName] ??= {}
        if (deck.cards[card2Id({ element: elid, property: propName })]) {
          for (const eid of elAndParents) res[propName][eid] = deck.elements[eid]
        }
      }
    }
  }

  return _.mapValues(res, (v) => ({ ...v, ...all }))
}

export function gradeCard(
  session: t.LearningSession,
  grade: number,
  took: number
): t.LearningSession {
  const currentCard = session.stack.shift()
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    now = getTime()

  session.history.push({
    cardId,
    ..._.pick(currentCard, 'params'),
    score: grade,
    time: now,
    took,
  })

  const cardState = nextCardState(session.cards[cardId], grade, 1, now)
  session.cards[cardId] = cardState

  const jitter = Math.floor(Math.random() * 3 - 1),
    newIndex = Math.max(
      Math.min(
        Math.floor(
          cardState.stability < 1
            ? 1 + Math.pow(cardState.stability, 2) * 10
            : session.stack.length
        ) + jitter,
        session.stack.length
      ),
      1
    )
  session.stack.splice(newIndex, 0, currentCard)

  return session
}

export function getSessionDone(session: t.LearningSession): boolean {
  const states = _.values(session.cards)
  return states.length >= session.stack.length && _.every(states, (c) => c.stability > 1)
}

export function undoGrade(session: t.LearningSession): t.LearningSession {
  const learning = session.history.pop()
  if (!learning) throw 'no card to undo'

  const stackIndex = session.stack.findIndex((s) => card2Id(s) === learning.cardId)
  if (stackIndex === -1) throw 'not in stack'

  const cardInstance = session.stack[stackIndex]
  session.stack.splice(stackIndex, 1)
  session.stack.unshift(cardInstance)

  session.cards = {}
  applyHistoryToCards(session.cards, session.history, true)

  return session
}

export function card2Id(card: t.Card) {
  return card.element + ':' + card.property
}

export function id2Card(id: string): t.Card {
  const [element, property] = id.split(':')
  return { element, property }
}

function getNew(deck: t.Deck, limit: number, learnable: t.IdMap<t.IdMap<t.Element>>) {
  const res: t.CardInstance[] = [],
    cards = _.shuffle(getAllCards(deck.elements)),
    // _.sortBy(
    //   _.shuffle(_.uniq(getAllCards(deck.elements))),
    //   (card) => Object.keys(deck.elements[card.element].params ?? {}).length //for testing nesteds
    // ),
    usedEls: { [elId: string]: true } = {},
    newCardFactor = 4 //TODO

  while (res.length < limit / newCardFactor && cards.length) {
    const card = cards.pop()!,
      props = getElementProps(card.element, deck.elements)

    if (usedEls[card.element]) continue

    for (const property in props) {
      const id = card2Id({ ...card, property })
      if (!deck.cards[id]) {
        sampleAndAdd(res, id, deck, learnable)
        usedEls[card.element] = true
      }
    }
  }

  return res
}

function getDue(deck: t.Deck, limit: number, learnable: t.IdMap<t.IdMap<t.Element>>) {
  const res: t.CardInstance[] = [],
    cardsIds = _.shuffle(Object.keys(deck.cards)),
    now = getTime()

  while (res.length < limit && cardsIds.length) {
    const cardId = cardsIds.pop()!,
      state = deck.cards[cardId],
      card = id2Card(cardId),
      hasProps = !!deck.elements[card.element].props[card.property]
    if (hasProps && state.due && state.due < now)
      sampleAndAdd(res, cardId, deck, learnable)
  }

  return res
}

const SAMPLE_TRIES = 20,
  jitterScale = 3600 * 24 * 30

function sampleAndAdd(
  res: t.CardInstance[],
  cardId: string,
  deck: t.Deck,
  learnable: t.IdMap<t.IdMap<t.Element>>
) {
  const { element, property } = id2Card(cardId),
    el = deck.elements[element]

  let i = 0
  while (i < SAMPLE_TRIES) {
    try {
      res.push({
        ...sampleElementIstance(
          element,
          { ...learnable[property], [element]: el },
          undefined,

          (elId) => {
            const jitter =
              Math.pow(Math.random() * (i / SAMPLE_TRIES), 2) *
              jitterScale *
              (Math.random() > 0.5 ? 1 : -1)
            return (
              (deck.cards[card2Id({ element: elId, property })]?.due ?? Infinity) + jitter
            )
          }
        ),
        property,
      })
      break
    } catch {}
    i++
  }
}
