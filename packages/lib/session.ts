import { getCache } from './cache'
import { DateTime } from 'luxon'
import {
  getAllCards,
  getElementOrder,
  getInheritedElement,
  isParent,
  sampleElementIstance,
} from './props'
import {
  defaultParams,
  defaultretention,
  getLearnTargetStability,
  getRetr,
  getTime,
  logistic,
} from './schedule'
import * as t from './types'
import _ from 'lodash'
import { computeElementInstance, computeElementMode } from './expr'
import { cleanRuby } from './ruby'

export function createLearningSession(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[],
  tz: string,
  cache = getCache(deck.elements)
): t.SessionAndProgress {
  //const t = new Date().getTime()
  const { dueCards, nextCards, progress } = getDue(deck, size, filter, tz, cache),
    newCards = allowNew
      ? _.shuffle(getNew(deck, size - dueCards.length, filter, cache))
      : [],
    previewCards = _.take(nextCards, size - dueCards.length - newCards.length), //don't use ncfactor here for better padding
    stack = distributeNewUnseenCards({
      stack: [...newCards, ..._.shuffle([...dueCards, ...previewCards])],
    })

  // console.log(
  //   'sess',
  //   new Date().getTime() - t,
  //   '\n\n',
  //   stack.map((s) => cleanRuby(computeElementInstance(s, deck.elements).jp)).join('\n'),
  //   stack
  // )
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
    progress,
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

const initSessionStabs = [0.25, 0.5, 1, 2],
  sessionIncs = [
    Math.pow(0.5, 1 / 1), //half in one step
    Math.pow(0.5, 1 / 2), //half in two steps
    Math.pow(2, 1 / 2), //double in two steps
    Math.pow(2, 1 / 1), //double in one step
  ]
export function nextSessionState(
  state: t.CardState | undefined,
  grade: number
): t.CardState {
  return {
    stability: Math.max(
      state ? state.stability * sessionIncs[grade - 1] : initSessionStabs[grade - 1],
      initSessionStabs[0]
    ),
    difficulty: 0,
  }
}

export function applySessionHistoryToCards(
  cards: t.CardStates,
  history: t.CardLearning[]
) {
  for (const learning of history) {
    cards[learning.cardId] = nextSessionState(cards[learning.cardId], learning.score)
  }
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

  const cardState = nextSessionState(session.cards[cardId], grade)
  session.cards[cardId] = cardState

  const jitter = Math.floor(Math.random() * 3 - 1),
    graduated = cardState.stability >= 1,
    minGraduatedIndex = session.stack.findLastIndex((v) => {
      const state = session.cards[card2Id(v)]
      return !state || state.stability < 1
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
    gradDistance = deck.cards[cardId] ? 20 : 30,
    learningIndex = Math.min(
      2 + Math.pow(cardState.stability, 2) * (sessionIncs[2] * gradDistance) + jitter
    ), // if learning reinsert proportional to stability/target
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

  const cardsGroupedByEl = _.groupBy(session.stack, (card) => card.element),
    unseenEls = Object.keys(cardsGroupedByEl).filter((elId) =>
      _.every(cardsGroupedByEl[elId], (c) => !session.cards[card2Id(c)])
    )

  //console.log('!!', estReviews, session.reviews, delta)

  let redist = false
  if (delta > 2) {
    const toRemove = _.findLast(
      session.stack,
      (c) => unseenEls.includes(c.element) && !!c.new
    )

    //console.log(toRemove && cardsGroupedByEl[toRemove.element].length)
    if (toRemove && cardsGroupedByEl[toRemove.element].length <= delta) {
      session.stack = session.stack.filter((c) => c.element !== toRemove.element)
      //console.log('removing', deck.elements[toRemove?.element!].name)
      redist = true
    }
  } else if (delta < -2 && session.allowNew) {
    const newCards = getNew(
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
      session.filter,
      getCache(deck.elements)
    )

    if (newCards.length <= -delta) {
      //console.log('add?', deck.elements[newCards[0].element].name)
      const midPoint = session.stack.length / 2
      newCards.forEach((card) =>
        session.stack.splice(Math.floor(Math.random() * midPoint) + midPoint, 0, card)
      )

      const toRemove = _.findLast(
        session.stack,
        (c) => unseenEls.includes(c.element) && !c.new
      )
      //console.log('remove sub', deck.elements[toRemove?.element!].name)
      if (toRemove)
        session.stack = session.stack.filter((c) => c.element !== toRemove.element)
      redist = true
    }
  }

  if (redist) session.stack = distributeNewUnseenCards(session)

  return session
}

export function estimateReviewsRemaining(session: Partial<t.LearningSession>) {
  const ncFactor = getNewCardFactor(),
    cardReviewsRemaning = _.sumBy(session.stack ?? [], (card) => {
      const tcardId = card2Id(card),
        state = session.cards?.[tcardId]
      if (!state) return card.new ? ncFactor : 1

      let changedState = state,
        i = 0
      while (changedState.stability < 1 && i < 10) {
        changedState = nextSessionState(changedState, i === 0 ? state.lastScore ?? 3 : 3)
        i++
      }
      return i
    })

  return cardReviewsRemaning
}

export function getSessionState(
  session: t.LearningSession | null,
  elements: t.IdMap<t.Element>,
  revealed: boolean
) {
  const estReviews = session ? estimateReviewsRemaining(session) : 0,
    card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    nextCard = session?.stack[1],
    next = nextCard && computeElementInstance(nextCard, elements)

  return {
    progress: {
      sessionSeconds: _.sumBy(session?.history, (h) => h.took),
      accuracy:
        session &&
        session.history.filter((h) => h.score !== 1).length / session.history.length,
      completion: session
        ? session.history.length / (estReviews + session.history.length)
        : 0,
    },
    card,
    value,
    next,
    mode: card && computeElementMode(card, elements),
    shownValue: revealed ? value : _.pick(value, card?.property ?? ''),
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
  applySessionHistoryToCards(session.cards, session.history)

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
  filter: string[],
  cache: t.DeckCache
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
      if (property[0] === '_') continue
      const id = card2Id({ ...card, property })
      if (!deck.cards[id]) {
        sampleAndAdd(res, id, deck, filter, cache)
        usedEls[card.element] = true
      }
    }
  }

  return res.map((c) => ({ ...c, new: true }))
}

function getDue(
  deck: t.Deck,
  limit: number,
  filter: string[],
  tz: string,
  cache: t.DeckCache
) {
  const dueCards: t.CardInstance[] = [],
    nextCards: t.CardInstance[] = [],
    nowTz = DateTime.fromSeconds(getTime()).setZone(tz).minus({ hours: 4 }),
    endOfDay = nowTz.endOf('day').plus({ hours: 4 }).toSeconds(),
    startOfDay = nowTz.startOf('day').plus({ hours: 4 }).toSeconds(),
    cardsIds = _.orderBy(
      Object.keys(deck.cards).filter((cid) => {
        const elid = id2Card(cid).element
        return cache.hasProps[elid] && !deck.elements[elid].virtual
      }),
      [
        (cardId) => {
          const state = deck.cards[cardId]
          return state.due && state.due < endOfDay ? 0 : 1
        },
        (cardId) => {
          const state = deck.cards[cardId],
            dueIn = (state.due ?? Infinity) - endOfDay,
            lastOpenMissAgo =
              state.lastMiss && state.lastSeen! - state.lastMiss < 60 * 30
                ? (endOfDay - state.lastMiss) / 8
                : Infinity
          return Math.min(dueIn, lastOpenMissAgo)
        },
      ]
    )

  let doneCount = 0,
    newCount = 0,
    dueCount = 0
  const dayCounts: { [day: number]: number } = {}
  for (const cardId of cardsIds) {
    const state = deck.cards[cardId]

    if (state.firstSeen && state.firstSeen > startOfDay) newCount++
    else if (state.lastRoot && state.lastRoot > startOfDay) doneCount++
    else if (
      state.due &&
      state.lastSeen &&
      state.due < endOfDay &&
      state.lastSeen < startOfDay
    ) {
      const day = DateTime.fromSeconds(state.due!)
        .minus({ hours: 4 })
        .startOf('day')
        .toSeconds()
      dayCounts[day] = (dayCounts[day] ?? 0) + 1
      dueCount++
    }
  }

  let sameDays = 0,
    sampleFailures = 0

  while (dueCards.length + nextCards.length < limit && cardsIds.length) {
    const cardId = cardsIds.shift()!,
      state = deck.cards[cardId],
      dueToday = state.due && state.due < endOfDay,
      seenToday = state.lastSeen && state.lastSeen > startOfDay,
      isDue = dueToday && !seenToday,
      isSameDay = dueToday && seenToday

    if (isSameDay && sameDays > limit / 8 && dueCards.length) continue //prevent same days from keeping progress back

    const added = sampleAndAdd(isDue ? dueCards : nextCards, cardId, deck, filter, cache)
    if (!added && isDue) sampleFailures++
    if (added && isSameDay) sameDays++
  }

  const dcvs = Object.values(dayCounts),
    dailyGoal = _.max(dcvs) ?? 0,
    backlog = _.sum(dcvs) - dailyGoal,
    chipper = Math.min(backlog, dailyGoal) //backlog cant exceed single day due

  const cz = nowTz.zoneName,
    nextGoal: t.GoalState =
      deck.goal && deck.goal.tz === cz && deck.goal.date === startOfDay
        ? deck.goal
        : {
            tz: cz!,
            date: startOfDay,
            count: dailyGoal + doneCount - sampleFailures + chipper,
          }

  const progress: t.DayProgress = {
    goal: nextGoal,
    due: Math.max(dueCount - sampleFailures + doneCount, doneCount),
    done: doneCount,
    new: newCount,
    next: dueCards.length - sameDays, //next discounts same day reviews
  }

  return { dueCards, nextCards, progress }
}

const SAMPLE_TRIES = 20,
  jitterScale = 1

function sampleAndAdd(
  res: t.CardInstance[],
  cardId: string,
  deck: t.Deck,
  filter: string[],
  cache: t.DeckCache
) {
  const { element, property } = id2Card(cardId),
    now = getTime()

  if (!deck.elements[element]) return
  if (
    filter.length &&
    !_.some(filter, (f) => f === element || isParent(element, f, deck.elements))
  )
    return

  const target = deck.settings.retention ?? defaultretention,
    childTarget = Math.pow(target, 1 / Math.max(Math.pow(cache.depths[element], 8), 1)),
    targetStability =
      getLearnTargetStability(deck.settings.fsrsParams ?? defaultParams) *
      (Math.pow(cache.depths[element], 1.5) + 1)

  let i = 0
  while (i < SAMPLE_TRIES) {
    try {
      res.push({
        ...sampleElementIstance(
          element,
          deck.elements,
          cache,
          undefined,
          (elId) => {
            const card = deck.cards[card2Id({ element: elId, property })],
              jitter = Math.pow(Math.random() * (i / SAMPLE_TRIES), 2) * jitterScale
            if (!card) return jitter

            const seenAgo = now - (card.lastSeen ?? 0),
              cr = getRetr(card, seenAgo),
              retrDiff = cr - childTarget,
              retrFactor = logistic(retrDiff),
              depthFactor = logistic(-(cache.nvds[elId] ?? 0)),
              seenFactor = cache.pdepths[elId] > 0 ? 1 : logistic(seenAgo / 3600 / 24)

            return retrFactor * depthFactor * seenFactor + jitter
          },
          undefined,
          (elId) => {
            const card = deck.cards[card2Id({ element: elId, property })]
            if (!cache.hasProps[elId] || elId === element) return true
            else return card && card.stability > targetStability
          }
        ),
        property,
      })
      return true
    } catch {}
    i++
  }
  return false
}
