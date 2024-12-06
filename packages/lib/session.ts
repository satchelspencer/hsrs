import { getAllCards, getElementAndParents } from './props'
import { getTime, nextCardState } from './schedule'
import * as t from './types'
import { sampleElementIstance } from './props'
import _ from 'lodash'

export function createLearningSession(deck: t.Deck, size: number): t.LearningSession {
  const learned = getLearnedElements(deck),
    dueCards = getDue(deck, size, learned),
    newCardFactor = 4, //TODO
    newCards = getNew(deck, (size - dueCards.length) / newCardFactor, learned)

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
    stack,
    cards: { states: {}, history: [] },
  }
}

function getLearnedElements(deck: t.Deck): t.IdMap<t.Element> {
  const elIDs: string[] = []

  for (const elid in deck.elements) {
    const el = deck.elements[elid],
      props = Object.keys(el.props)
    if (
      !props.length ||
      _.some(
        props,
        (propName) => !!deck.cards.states[card2Id({ element: elid, property: propName })]
      )
    ) {
      elIDs.push(...getElementAndParents(elid, deck.elements))
    }
  }

  return _.pick(deck.elements, elIDs)
}

export function gradeCard(session: t.LearningSession, grade: number): t.LearningSession {
  const currentCard = session.stack.shift()
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    now = getTime()

  session.cards.history.push({
    cardId,
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

function getNew(deck: t.Deck, limit: number, learnable: t.IdMap<t.Element>) {
  const res: t.CardInstance[] = [],
    cards = _.shuffle(getAllCards(deck.elements))
  // _.sortBy(
  //   _.shuffle(_.uniq(getAllCards(deck.elements))),
  //   (card) => Object.keys(deck.elements[card.element].params ?? {}).length //for testing nesteds
  // )

  while (res.length < limit && cards.length) {
    const card = cards.pop()!,
      id = card2Id(card)
    if (!deck.cards.states[id]) sampleAndAdd(res, id, deck, learnable)
  }

  return res
}

function getDue(deck: t.Deck, limit: number, learnable: t.IdMap<t.Element>) {
  const res: t.CardInstance[] = [],
    cardsIds = _.shuffle(Object.keys(deck.cards.states)),
    now = getTime()

  while (res.length < limit && cardsIds.length) {
    const cardId = cardsIds.pop()!,
      state = deck.cards.states[cardId]
    if (state.due && state.due < now) sampleAndAdd(res, cardId, deck, learnable)
  }

  return res
}

function sampleAndAdd(
  res: t.CardInstance[],
  cardId: string,
  deck: t.Deck,
  learnable: t.IdMap<t.Element>
) {
  const { element, property } = id2Card(cardId),
    el = deck.elements[element]

  let i = 0
  while (i++ < 10) {
    try {
      res.push({
        ...sampleElementIstance(element, { ...learnable, [element]: el }),
        property,
      })
      break
    } catch {}
  }
}
