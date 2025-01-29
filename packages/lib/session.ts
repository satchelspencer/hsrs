import {
  getAllCards,
  getElementAndParents,
  getElementOrder,
  getInheritedElement,
  isParent,
  sampleElementIstance,
} from './props'
import {
  applyHistoryToCards,
  getLearnTargetStability,
  getTime,
  nextCardState,
  nextState,
} from './schedule'
import * as t from './types'
import _ from 'lodash'

export function createLearningSession(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[]
): { session: t.LearningSession; new: number; due: number; next: number; maxp: number } {
  const learned = getLearnedElements(deck),
    { dueCards, nextCards } = getDue(deck, size, learned, filter),
    newCards = allowNew
      ? _.shuffle(getNew(deck, size - dueCards.length, learned, filter))
      : [],
    previewCards = _.take(nextCards, size - dueCards.length - newCards.length), //don't use ncfactor here for better padding
    stack = distributeNewUnseenCards({
      stack: [...newCards, ..._.shuffle([...dueCards, ...previewCards])],
    })

  return {
    session: {
      reviews: estimateReviewsRemaining({ stack }),
      stack,
      cards: {},
      history: [],
      filter,
      allowNew,
    },
    new: newCards.length,
    due: dueCards.length,
    next: previewCards.length,
    maxp: Math.max(0, ...previewCards.map((card) => deck.cards[card2Id(card)].due ?? 0)),
  }
}

function distributeNewUnseenCards(session: Partial<t.LearningSession>) {
  const sessionStack = session.stack ?? [],
    stack: t.CardInstance[] = [],
    newUnseen: t.CardInstance[] = []

  let firstUnseenIndex = -1
  for (let i = 0; i < sessionStack.length; i++) {
    const card = sessionStack[i]
    if (card.new && !session.cards?.[card2Id(card)]) {
      if (firstUnseenIndex === -1) firstUnseenIndex = i
      newUnseen.push(card)
    } else {
      stack.push(card)
    }
  }

  const gaps = newUnseen.length,
    actual = (gaps * (gaps + 1)) / 2,
    gapFactor = (sessionStack.length - firstUnseenIndex) / actual,
    sumSpac = [
      0,
      ...new Array(gaps).fill(0).map((v, i) => Math.max((i + 1) * gapFactor, 1)),
    ]

  let d = firstUnseenIndex
  for (const gap of sumSpac) {
    d += gap
    const nc = newUnseen.shift()
    if (!nc) break
    stack.splice(Math.min(Math.max(Math.floor(d)), stack.length - 1), 0, nc)
  }
  return stack
}

function getLearnedElements(deck: t.Deck): t.IdMap<t.IdMap<t.Element>> {
  const res: t.IdMap<t.IdMap<t.Element>> = {},
    all: t.IdMap<t.Element> = {},
    targetStability = getLearnTargetStability()

  for (const elid in deck.elements) {
    const el = getInheritedElement(elid, deck.elements),
      props = Object.keys(el.props),
      elAndParents = getElementAndParents(elid, deck.elements)

    if (!props.length) {
      for (const eid of elAndParents) all[eid] = deck.elements[eid]
    } else {
      for (const propName of props) {
        res[propName] ??= {}
        const state = deck.cards[card2Id({ element: elid, property: propName })]
        if (state && state.stability >= targetStability) {
          for (const eid of elAndParents) res[propName][eid] = deck.elements[eid]
        }
      }
    }
  }

  return _.mapValues(res, (v) => ({ ...v, ...all }))
}

export function gradeCard(deck: t.Deck, grade: number, took: number): t.LearningSession {
  const { session } = deck
  if (!session) throw 'no session'

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
      2 + Math.pow(cardState.stability / targetStability, 3) * 30 + jitter,
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

  const cardReviewsRemaning = estimateReviewsRemaining(session),
    ncFactor = getNewCardFactor(),
    estReviews = session.history.length + cardReviewsRemaning,
    delta = Math.floor((estReviews - session.reviews) / ncFactor)

  //console.log('!!', estReviews, session.reviews, delta)

  let redist = false
  if (delta > 0) {
    const cardsGroupedByEl = _.groupBy(session.stack, (card) => card.element),
      unseenEls = Object.keys(cardsGroupedByEl).filter((elId) =>
        _.every(cardsGroupedByEl[elId], (c) => !session.cards[card2Id(c)])
      ),
      toRemove =
        _.findLast(session.stack, (c) => unseenEls.includes(c.element) && !!c.new) ??
        _.findLast(session.stack, (c) => unseenEls.includes(c.element)) //fall back to removing a review if needed

     //console.log(toRemove && cardsGroupedByEl[toRemove.element].length)
    if (toRemove && cardsGroupedByEl[toRemove.element].length <= delta) {
      session.stack = session.stack.filter((c) => c.element !== toRemove.element)
      //console.log('removing', deck.elements[toRemove?.element!].name)
      redist = true
    }
  } else if (delta < 0 && session.allowNew) {
    const learned = getLearnedElements(deck),
      newCards = getNew(
        {
          ...deck,
          cards: {
            ..._.fromPairs(
              session.stack.map((s) => [card2Id(s), { stability: 1, difficulty: 5 }])
            ), //exclude ones already in session
            ...deck.cards,
          },
        },
        -delta,
        learned,
        session.filter
      )

    if (newCards.length <= -delta) {
      //console.log('add?', deck.elements[newCards[0].element].name)
      const midPoint = session.stack.length / 2
      newCards.forEach((card) =>
        session.stack.splice(Math.floor(Math.random() * midPoint) + midPoint, 0, card)
      )
      redist = true
    }
  }

  if (redist) session.stack = distributeNewUnseenCards(session)

  return session
}

function estimateReviewsRemaining(session: Partial<t.LearningSession>) {
  const ncFactor = getNewCardFactor(),
    targetStability = getLearnTargetStability(),
    cardReviewsRemaning = _.sumBy(session.stack ?? [], (card) => {
      const tcardId = card2Id(card),
        state = session.cards?.[tcardId]
      if (!state) return card.new ? ncFactor : 1

      let changedState = state,
        i = 0
      while (changedState.stability < targetStability && i < 10) {
        changedState = nextState(changedState, 30, i === 0 ? state.lastScore ?? 3 : 3, 1)
        i++
      }
      return i
    })

  return cardReviewsRemaning
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

function getNewCardFactor() {
  return 4 //TODO
}

function getNew(
  deck: t.Deck,
  limit: number,
  learnable: t.IdMap<t.IdMap<t.Element>>,
  filter: string[]
): t.CardInstance[] {
  const res: t.CardInstance[] = [],
    cards = _.sortBy(
      getAllCards(deck.elements),
      (c) => getElementOrder(c.element, deck.elements) + '.0.' + Math.random()
    ),
    usedEls: { [elId: string]: true } = {},
    newCardFactor = getNewCardFactor()

  while (res.length < limit / newCardFactor && cards.length) {
    const card = cards.shift()!,
      { props } = getInheritedElement(card.element, deck.elements)

    if (usedEls[card.element]) continue

    for (const property in props) {
      const id = card2Id({ ...card, property })
      if (!deck.cards[id]) {
        sampleAndAdd(res, id, deck, learnable, filter)
        usedEls[card.element] = true
      }
    }
  }

  return res.map((c) => ({ ...c, new: true }))
}

function getDue(
  deck: t.Deck,
  limit: number,
  learnable: t.IdMap<t.IdMap<t.Element>>,
  filter: string[]
) {
  const dueCards: t.CardInstance[] = [],
    nextCards: t.CardInstance[] = [],
    cardsIds = _.sortBy(
      Object.keys(deck.cards),
      (cardId) => deck.cards[cardId].due ?? Infinity
    ),
    now = getTime()

  // console.log(
  //   cardsIds.map((c) => [
  //     deck.elements[id2Card(c).element].name,
  //     deck.cards[c].due && new Date(deck.cards[c].due * 1000),
  //   ])
  // )

  while (dueCards.length + nextCards.length < limit && cardsIds.length) {
    const cardId = cardsIds.shift()!,
      state = deck.cards[cardId],
      card = id2Card(cardId),
      { props, virtual } = getInheritedElement(card.element, deck.elements),
      hasProps = !!props[card.property]

    if (!virtual && hasProps && state.due && state.lastSeen) {
      if (
        state.due < now + 3600 * 6 ||
        (state.lastMiss && state.lastMiss > now - 3600 * 6)
      )
        sampleAndAdd(dueCards, cardId, deck, learnable, filter)
      else sampleAndAdd(nextCards, cardId, deck, learnable, filter)
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
  learnable: t.IdMap<t.IdMap<t.Element>>,
  filter: string[]
) {
  const { element, property } = id2Card(cardId),
    now = getTime()

  if (!deck.elements[element]) return
  if (
    filter.length &&
    !_.some(filter, (f) => f === element || isParent(element, f, deck.elements))
  )
    return

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
            const card = deck.cards[card2Id({ element: elId, property })],
              jitter =
                Math.pow(Math.random() * (i / SAMPLE_TRIES), 2) *
                jitterScale *
                (Math.random() > 0.5 ? 1 : -1)
            if (!card) return jitter

            const dueIn = (card.due ?? Infinity) - now,
              seenAgo = now - (card.lastSeen ?? now)
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
