import { getAllCards } from './props'
import { fsrs, nextState } from './schedule'
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
    cards: _.fromPairs(cards.map((c) => [c, { history: [] }])),
  }

  return session
}

export function gradeCard(session: t.LearningSession, grade: number): t.LearningSession {
  const currentCard = session.stack.shift()
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    card = session.cards[cardId],
    lastHistory = _.last(card.history),
    now = getTime()

  card.history.push({
    ..._.pick(currentCard, 'params'),
    score: grade,
    time: now,
    took: 0,
  })

  card.state = nextState(card.state, lastHistory ? now - lastHistory.time : 0, grade, 1)

  if (card.state.stability < 1) {
    const views = card.history.length,
      newIndex = Math.min(Math.pow(3, views) - 1, session.stack.length)
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

function getTime() {
  return new Date().getTime() / 1000
}

function getDue(cards: t.Cards, limit: number) {
  const now = getTime()

  return _.take(
    Object.keys(cards).filter((cardId) => {
      const card = cards[cardId],
        lastTime = _.last(card.history)?.time,
        due =
          lastTime &&
          card.state &&
          fsrs!.nextInterval(card.state.stability, 0.9, 3) * 24 * 3600

      return due && due < now
    }),
    limit
  )
}
