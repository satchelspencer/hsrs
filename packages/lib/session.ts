import { getAllCards, getElementAndParents, getElementProps } from './props'
import {
  applyHistoryToCards,
  getLearnTargetStability,
  getTime,
  nextCardState,
} from './schedule'
import * as t from './types'
import { sampleElementIstance } from './props'
import _ from 'lodash'

export function createLearningSession(
  deck: t.Deck,
  size: number,
  allowNew: boolean
): { session: t.LearningSession; new: number; due: number; next: number } {
  const learned = getLearnedElements(deck),
    { dueCards, nextCards } = getDue(deck, size, learned),
    newCards = allowNew ? _.shuffle(getNew(deck, size - dueCards.length, learned)) : [],
    previewCards = _.take(nextCards, size - dueCards.length - newCards.length) //don't use ncfactor here for better padding

  const gaps = newCards.length,
    actual = (gaps * (gaps + 1)) / 2,
    gapFactor = (dueCards.length + newCards.length) / actual,
    sumSpac = [
      0,
      ...new Array(gaps).fill(0).map((v, i) => Math.max((i + 1) * gapFactor, 1)),
    ],
    stack = _.shuffle([...dueCards, ...previewCards])

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
    next: previewCards.length,
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

  const lastCardState: t.CardState | undefined = session.cards[cardId],
    cardState = nextCardState(lastCardState, grade, 1, now)
  session.cards[cardId] = cardState

  const jitter = Math.floor(Math.random() * 3 - 1),
    targetStability = getLearnTargetStability(),
    graduated =
      cardState.stability > targetStability &&
      (!lastCardState || lastCardState.stability > targetStability),
    minGraduatedIndex = session.stack.findLastIndex((v) => {
      const state = session.cards[card2Id(v)]
      return !state || state.stability < targetStability
    }),
    midPoint = Math.floor(session.stack.length / 2),
    graduatedIndex = // if graduated reinsert randomly in the end of the stack already graduated, past half way
      minGraduatedIndex === -1
        ? session.stack.length
        : Math.max(
            1 +
              minGraduatedIndex +
              Math.floor(Math.random() * (session.stack.length - minGraduatedIndex)),
            midPoint
          ),
    learningIndex = Math.min(
      // if learning reinsert proportional to stability/target
      2 + Math.pow(cardState.stability / targetStability, 4) * 30 + jitter,
      //midPoint,
      30
    ),
    newIndex = Math.max(
      Math.min(
        Math.floor(!graduated ? learningIndex : graduatedIndex),
        session.stack.length
      ),
      1
    )

  session.stack.splice(newIndex, 0, currentCard)

  return session
}

export function getSessionDone(session: t.LearningSession | null) {
  if (!session) return { sessionDone: false, targetStability: 1 }
  const states = _.values(session.cards),
    targetStability = getLearnTargetStability()
  return {
    sessionDone:
      states.length >= _.uniqBy(session.stack, (c) => card2Id(c)).length &&
      _.every(states, (c) => c.stability >= targetStability),
    targetStability,
  }
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

function getNewCardFactor(deck: t.Deck) {
  return 4 //TODO
}

function getNew(deck: t.Deck, limit: number, learnable: t.IdMap<t.IdMap<t.Element>>) {
  const res: t.CardInstance[] = [],
    cards = _.shuffle(getAllCards(deck.elements)),
    // _.sortBy(
    //   _.shuffle(_.uniq(getAllCards(deck.elements))),
    //   (card) => Object.keys(deck.elements[card.element].params ?? {}).length //for testing nesteds
    // ),
    usedEls: { [elId: string]: true } = {},
    newCardFactor = getNewCardFactor(deck)

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
  const dueCards: t.CardInstance[] = [],
    nextCards: t.CardInstance[] = [],
    cardsIds = _.sortBy(
      Object.keys(deck.cards),
      (cardId) => deck.cards[cardId].due ?? Infinity
    ),
    now = getTime()

  while (dueCards.length + nextCards.length < limit && cardsIds.length) {
    const cardId = cardsIds.shift()!,
      state = deck.cards[cardId],
      card = id2Card(cardId),
      props = getElementProps(card.element, deck.elements),
      hasProps = !!props[card.property]

    if (hasProps && state.due && state.lastSeen) {
      if (
        state.due < now + 3600 * 12 ||
        ((state.lastScore === 1 || state.lastScore === 2) &&
          state.lastSeen > now - 3600 * 12)
      )
        sampleAndAdd(dueCards, cardId, deck, learnable)
      // cards due due date in less than 12h or missed in last 12h
      else if (state.lastSeen < now - 3600 * 12)
        sampleAndAdd(nextCards, cardId, deck, learnable) //only sample nextCards that haven't been seen in the last 12h
    }
  }

  return { dueCards, nextCards }
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
    now = getTime()

  if (!deck.elements[element]) return

  let i = 0
  while (i < SAMPLE_TRIES) {
    try {
      const elElements: t.IdMap<t.Element> = {}
      for (const eid of getElementAndParents(element, deck.elements)) {
        elElements[eid] = deck.elements[eid]
      }

      res.push({
        ...sampleElementIstance(
          element,
          { ...learnable[property], ...elElements },
          undefined,

          (elId) => {
            const jitter =
                Math.pow(Math.random() * (i / SAMPLE_TRIES), 2) *
                jitterScale *
                (Math.random() > 0.5 ? 1 : -1),
              card = deck.cards[card2Id({ element: elId, property })],
              dueIn = (card?.due ?? Infinity) - now,
              seenAgo = now - (card?.lastSeen ?? now)
            return dueIn - seenAgo + jitter
          }
        ),
        property,
      })
      break
    } catch {}
    i++
  }
}
