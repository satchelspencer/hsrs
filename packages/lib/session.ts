import { getCache } from './cache'
import { DateTime } from 'luxon'
import { getAllCards, getInheritedElement, getLearnOrder } from './props'
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
import { logger } from './log'
import { sampleElementIstance } from './sample'

export function createLearningSession(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[],
  propsFilter: string[],
  tz: string,
  cache = getCache(deck.elements)
): t.SessionAndProgress {
  const log = logger(2, 'session'),
    t = new Date().getTime(),
    { dueCards, nextCards, progress } = getDue(
      deck,
      size,
      filter,
      propsFilter,
      tz,
      cache
    ),
    newCards = allowNew
      ? cardShuffle(getNew(deck, size - dueCards.length, filter, propsFilter, cache))
      : [],
    previewCards = _.take(nextCards, size - dueCards.length - newCards.length), //don't use ncfactor here for better padding
    stack = distributeNewUnseenCards({
      stack: [...newCards, ...cardShuffle([...dueCards, ...previewCards])],
    })

  log(`took ${new Date().getTime() - t}ms\n`, () =>
    stack
      .map((s) => {
        return `${s.new ? '****' : '    '} ${s.property} ${
          deck.elements[s.element].name
        } - ${cleanRuby(computeElementInstance(s, deck.elements).jp)}`
      })
      .join('\n')
  )

  return {
    session: {
      reviews: estimateReviewsRemaining({ stack }),
      stack,
      cards: {},
      history: [],
      filter,
      propsFilter,
      allowNew,
    },
    new: newCards.length,
    due: dueCards.length,
    next: previewCards.length,
    maxp: Math.max(0, ...previewCards.map((card) => deck.cards[card2Id(card)].due ?? 0)),
    progress,
  }
}

function cardShuffle(vals: t.CardInstance[]) {
  const byId = _.groupBy(_.shuffle(vals), (c) => c.element),
    res: t.CardInstance[] = []

  while (Object.keys(byId).length) {
    for (const bucketId of _.shuffle(Object.keys(byId))) {
      const value = byId[bucketId]?.pop()
      if (value) res.push(value)
      else delete byId[bucketId]
    }
  }

  return res
}

/* space new cards, initially distributed towards the start of session.
since they will usually be repeated multiple times, you get a more even
spacing during learning */

function distributeNewUnseenCards(
  session: Partial<t.LearningSession>,
  maxIndex = Infinity
) {
  const sessionStack = session.stack ?? [],
    stack: t.CardInstance[] = [],
    newUnseen: t.CardInstance[] = []

  for (let i = 0; i < sessionStack.length; i++) {
    const card = sessionStack[i]
    if (card.new && !session.cards?.[card2Id(card)]) newUnseen.push(card)
    else stack.push(card)
  }

  const gaps = newUnseen.length,
    actual = (gaps * (gaps + 1)) / 2,
    gapFactor = Math.min(maxIndex, sessionStack.length * 0.75) / actual,
    sumSpac = [
      0,
      ...new Array(gaps).fill(0).map((v, i) => Math.max((i + 1) * gapFactor, 1)),
    ]

  let d = 0
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
    lastMiss: grade > 2 ? state?.lastMiss : getTime(),
  }
}

export function applySessionHistoryToCards(
  cards: t.CardStates,
  history: t.SessionCardLearning[]
) {
  for (const learning of history) {
    cards[learning.cardId] = nextSessionState(
      cards[learning.cardId],
      learning.vscore ?? learning.score
    )
  }
}

export function gradeCard(deck: t.Deck, rgrade: number, took: number): t.LearningSession {
  const { session } = deck
  if (!session) throw 'no session'

  const currentCard = session.stack.shift()
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    now = getTime(),
    log = logger(3, 'session-stack')

  const missedSibling =
      !session.cards[cardId] &&
      !deck.cards[cardId] &&
      Object.keys(session.cards).find(
        (c) => session.cards[c].lastMiss && id2Card(c).element === currentCard.element
      ),
    cardReviewsRemaning = estimateReviewsRemaining(session),
    estReviews = session.history.length + cardReviewsRemaning,
    isEnding = session.history.length / estReviews >= 0.75,
    grade = missedSibling ? Math.min(rgrade, 2) : rgrade, //if new and sibling was missed, max grade of 2
    virtualGrade = Math.min(grade + (isEnding ? 1 : 0), 4) //bump grade by 1 to prevent session end being stuck

  session.history.push({
    cardId,
    ..._.pick(currentCard, 'params'),
    score: grade,
    vscore: grade === virtualGrade ? undefined : virtualGrade,
    time: now,
    took,
  })

  const cardState = nextSessionState(session.cards[cardId], virtualGrade)
  session.cards[cardId] = cardState

  const jitter = cardState.stability <= 0.5 ? 0 : Math.floor(Math.random() * 3 - 1),
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
    canSpace = session.stack.length >= 20,
    learningIndex = canSpace //if not graduated reinsert 'proprtional' to stability
      ? (currentCard.new ? 0 : 2) +
        Math.pow(cardState.stability, 2) * (sessionIncs[2] * gradDistance) +
        jitter
      : Math.floor(cardState.stability * Math.max(7, session.stack.length / 2)) + jitter,
    newIndex = Math.max(
      Math.min(
        Math.floor(!graduated ? learningIndex : graduatedIndex),
        session.stack.length
      ),
      1
    )

  session.stack.splice(newIndex, 0, currentCard)

  /* compare new session length estimation with original goal,
  if under and new cards learning, sample more new, if over
  remove new that haven't been seen */

  const ncFactor = getNewCardFactor(),
    delta = Math.floor((estReviews - session.reviews) / ncFactor)

  const cardsGroupedByEl = _.groupBy(session.stack, (card) => card.element),
    unseenEls = Object.keys(cardsGroupedByEl).filter((elId) =>
      _.every(cardsGroupedByEl[elId], (c) => !session.cards[card2Id(c)])
    )

  log('review estimation', estReviews, 'original', session.reviews, 'delta ', delta)

  let redist = false
  if (delta > 2 && session.allowNew) {
    const toRemove =
      _.findLast(session.stack, (c) => unseenEls.includes(c.element) && !!c.new) ??
      _.findLast(session.stack, (c) => !c.new) //fall back to non new

    if (toRemove && cardsGroupedByEl[toRemove.element].length <= delta) {
      session.stack = session.stack.filter((c) => c.element !== toRemove.element)
      log('removing', deck.elements[toRemove?.element!].name)
      redist = true
    }
  } else if (delta < -2 && session.allowNew && minGraduatedIndex > 10) {
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
      session.propsFilter,
      getCache(deck.elements)
    )

    if (newCards.length <= -delta) {
      log('add', deck.elements[newCards[0].element].name)
      const midPoint = session.stack.length / 2
      newCards.forEach((card) =>
        session.stack.splice(Math.floor(Math.random() * midPoint) + midPoint, 0, card)
      )

      /* remove already seen, to keep stack length roughly the same, just with harder cards */
      const toRemove = _.findLast(session.stack, (c) => !c.new)
      if (toRemove) {
        log('remove old', deck.elements[toRemove.element].name)
        session.stack = session.stack.filter((c) => c.element !== toRemove.element)
      }
      redist = true
    }
  }

  if (redist) session.stack = distributeNewUnseenCards(session, minGraduatedIndex)

  /* ensure a minimum gap between siblings */
  const MIN_SPACING = 4
  if (session.stack.length > MIN_SPACING * 3) {
    for (let i = 0; i < MIN_SPACING; i++) {
      const nextFirst = session.stack[0],
        lastSeenHistoryIndex = session.history.findLastIndex((c) => {
          const card = id2Card(c.cardId)
          return (
            card.element === nextFirst.element && card.property !== nextFirst.property
          )
        })

      if (
        lastSeenHistoryIndex !== -1 &&
        session.history.length - lastSeenHistoryIndex < MIN_SPACING
      ) {
        const [card] = session.stack.splice(0, 1)
        session.stack.splice(MIN_SPACING + Math.abs(jitter), 0, card)
      } else break
    }
  }

  return session
}

/* simple review estimation by simulating repeated 3 scores  */
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

export interface SessionState {
  card?: t.CardInstance
  value?: t.PropsInstance
  next?: t.PropsInstance
  mode?: string
  progress: {
    completion: number
    count: number
    sessionSeconds: number
    accuracy: number | null
    graduation: number
  }
  shownValue?: Partial<t.PropsInstance>
  isNew?: boolean
}

export function getSessionState(
  session: t.LearningSession | null,
  elements: t.IdMap<t.Element>,
  revealed: boolean,
  cardStates: t.CardStates
): SessionState {
  const estReviews = session ? estimateReviewsRemaining(session) : 0,
    card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    nextCard = session?.stack[1],
    next = nextCard && computeElementInstance(nextCard, elements),
    isNew =
      !!card &&
      !cardStates[card2Id(card)] &&
      !session.history.findLast((c) => id2Card(c.cardId).element === card.element)

  return {
    progress: {
      sessionSeconds: _.sumBy(session?.history, (h) => h.took),
      count: session?.history.length ?? 0,
      accuracy:
        session &&
        session.history.filter((h) => h.score !== 1).length / session.history.length,
      completion: session
        ? session.history.length / (estReviews + session.history.length)
        : 0,
      graduation: getGraduation(session),
    },
    card,
    value,
    next,
    mode: card && computeElementMode(card, elements),
    shownValue: revealed ? value : _.pick(value, card?.property ?? ''),
    isNew,
  }
}

function getGraduation(session: t.LearningSession | null) {
  const keys = Object.keys(session?.cards ?? {})
  return !keys.length
    ? 0
    : keys.filter((k) => session!.cards![k].stability >= 1).length / session!.stack.length
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
  return 4
}

function getNew(
  deck: t.Deck,
  limit: number,
  filter: string[],
  propsFilter: string[],
  cache: t.DeckCache
): t.CardInstance[] {
  const res: t.CardInstance[] = [],
    cards = _.orderBy(
      getAllCards(deck.elements).filter((c) => !deck.cards[card2Id(c)]),
      [
        (c) => getLearnOrder(c.element, deck).order,
        (c) => {
          return getLearnOrder(c.element, deck).pre
            ? (cache.depths[c.element] > 0 ? 0.25 : 1) * Math.random()
            : Math.random()
        },
        () => Math.random(),
      ]
    ),
    usedEls: { [elId: string]: true } = {},
    newCardFactor = getNewCardFactor()

  while (res.length < limit / newCardFactor && cards.length) {
    const card = cards.shift()!,
      { props } = getInheritedElement(card.element, deck.elements),
      order = getLearnOrder(card.element, deck)

    if (usedEls[card.element]) continue

    for (const property of _.shuffle(Object.keys(props))) {
      if (property[0] === '_' || (propsFilter.length && !propsFilter.includes(property)))
        continue
      const id = card2Id({ ...card, property })
      if (!deck.cards[id]) {
        sampleAndAdd(res, id, deck, filter, cache)
        usedEls[card.element] = true
      }
      if (order.pre) break
    }
  }

  return res.map((c) => ({ ...c, new: true }))
}

function getDue(
  deck: t.Deck,
  limit: number,
  filter: string[],
  propsFilter: string[],
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
        const { element, property } = id2Card(cid)
        return (
          cache.hasProps[element] &&
          !deck.elements[element].virtual &&
          (!propsFilter.length || propsFilter.includes(property))
        )
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
                ? (endOfDay - Math.max(state.lastMiss, state.firstSeen ?? 0)) / 8
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
      firstSeenToday = state.firstSeen && state.firstSeen > startOfDay,
      isDue = dueToday && !seenToday,
      isSameDay = dueToday && seenToday

    if (!firstSeenToday && isSameDay && sameDays > limit / 8 && dueCards.length) continue

    const added = sampleAndAdd(
      dueToday ? dueCards : nextCards,
      cardId,
      deck,
      filter,
      cache
    )
    if (!added && isDue) sampleFailures++
    if (added && isSameDay) sameDays++
  }

  const dcvs = Object.values(dayCounts),
    dailyGoal = _.max(dcvs) ?? 0,
    backlog = _.sum(dcvs) - dailyGoal,
    chipper = Math.min(backlog, dailyGoal) //backlog cant exceed single day due

  const nextGoal: t.GoalState =
    deck.goal && deck.goal.date === startOfDay
      ? deck.goal
      : {
          date: startOfDay,
          count: Math.min(dailyGoal + chipper, dueCount) + doneCount - sampleFailures,
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

export function sampleAndAdd(
  res: t.CardInstance[],
  cardId: string,
  deck: t.Deck,
  filter: string[],
  cache: t.DeckCache
) {
  const { element, property } = id2Card(cardId),
    now = getTime()

  if (!deck.elements[element]) return

  let hasMatch = false,
    needsMatch = false
  for (const f of filter) {
    const inv = f[0] === '!',
      elId = inv ? f.substring(1) : f,
      elMatch = elId === element || cache.tree.ancestors[element]?.includes(elId)
    if (inv && elMatch) return
    else if (elMatch) hasMatch = true
    if (!inv) needsMatch = true
  }
  if (filter.length && needsMatch && !hasMatch) return

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
              jitter = Math.pow(Math.random() * (i / SAMPLE_TRIES), 2) * jitterScale //jitter increases over time to allow compromise on difficult samples
            if (!card) return jitter

            const seenAgo = now - (card.lastSeen ?? 0),
              cr = getRetr(card, seenAgo),
              retrDiff = cr - childTarget,
              retrFactor = logistic(retrDiff), //prefer cards close to target retr
              depthFactor = logistic(-(cache.nvds[elId] ?? 0)), //prefer cards with more possible params
              seenFactor = cache.pdepths[elId] > 0 ? 1 : logistic(seenAgo / 3600 / 24) //prefer less recently seen

            return retrFactor * depthFactor * seenFactor + jitter
          },
          undefined,
          (elId) => {
            const card = deck.cards[card2Id({ element: elId, property })]
            if (!cache.hasProps[elId] || elId === element) return true
            else
              return card
                ? card.stability > targetStability
                : !cache.depths[elId] && getLearnOrder(elId, deck).pre
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
