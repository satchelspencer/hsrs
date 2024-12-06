import { getAllCards } from './props'
import { getTime, nextCardState } from './schedule'
import * as t from './types'
import { sampleElementIstance } from './props'
import _ from 'lodash'

export function createLearningSession(deck: t.Deck, size: number): t.LearningSession {
  const dueCards = getDue(deck.cards ?? {}, size),
    newCardFactor = 4, //TODO
    newCards = getNew(deck, (size - dueCards.length) / newCardFactor)

  const gaps = newCards.length,
    actual = (gaps * (gaps + 1)) / 2,
    gapFactor = (dueCards.length + newCards.length) / actual,
    sumSpac = [
      0,
      ...new Array(gaps).fill(0).map((v, i) => Math.max((i + 1) * gapFactor, 1)),
    ],
    cards = [...dueCards]

  let d = 0
  for (const gap of sumSpac) {
    d += gap
    const nc = newCards.shift()
    if (!nc) break
    cards.splice(Math.floor(d), 0, nc)
  }

  const session: t.LearningSession = {
    stack: cards.map((cardId) => {
      const { element, property } = id2Card(cardId)
      return {
        property,
        ...sampleElementIstance(element, deck.elements),
      }
    }),
    cards: { states: {}, history: [] },
  }

  return session
}

export function gradeCard(session: t.LearningSession, grade: number): t.LearningSession {
  const currentCard = session.stack.shift()
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    now = getTime()

  session.cards.history.push({
    ..._.pick(currentCard, 'params'),
    score: grade,
    time: now,
    took: 0,
  })

  const cardState = nextCardState(session.cards.states[cardId], grade, 1)
  session.cards.states[cardId] = cardState

  if (cardState.stability < 1) {
    const newIndex = Math.min(Math.pow(3, cardState.views ?? 1) - 1, session.stack.length)
    session.stack.splice(newIndex, 0, currentCard)
  }

  return session
}

export function card2Id(card: t.Card) {
  return card.element + ':' + card.property
}

export function id2Card(id: string): t.Card {
  const [element, property] = id.split(':')
  return { element, property }
}

function getNew(deck: t.Deck, limit: number) {
  return _.sampleSize(
    getAllCards(deck.elements).filter((c) => !deck.cards?.[card2Id(c)]),
    limit
  ).map(card2Id)
}

function getDue(cards: t.Cards, limit: number) {
  const now = getTime()
  return _.take(
    Object.keys(cards.states).filter((cardId) => {
      const state = cards.states[cardId]
      return state.due && state.due < now
    }),
    limit
  )
}
