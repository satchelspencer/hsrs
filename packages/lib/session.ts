import { getCache } from './cache'
import { DateTime } from 'luxon'
import { getAllCards, getInheritedElement, getLearnOrder } from './props'
import {
  defaultParams,
  defaultretention,
  getCardDueDates,
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
import { uid } from './uid'
import { getInstanceId } from './alias'

export function createLearningSession(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[],
  propsFilter: string[],
  tz: string,
  minDepth?: number,
  cache = getCache(deck.elements)
): t.SessionAndProgress {
  const log = logger(2, 'session'),
    t = new Date().getTime(),
    nc = getNewCardFactor(),
    newCount = allowNew ? nc * Math.sqrt(size / 30) * 6 : 0,
    { dueCards, nextCards, progress } = getDue(
      deck,
      size - newCount / nc,
      filter,
      propsFilter,
      tz,
      cache,
      minDepth
    ),
    newCards = allowNew
      ? cardShuffle(getNew(deck, newCount, filter, propsFilter, cache, !!minDepth))
      : [],
    previewCards = _.take(nextCards, size - dueCards.length - newCards.length), //don't use ncfactor here for better padding
    stack = distributeNewUnseenCards({
      stack: [...newCards, ...cardShuffle([...dueCards, ...previewCards])],
    })

  log(
    `took ${new Date().getTime() - t}ms\n`,
    () =>
      stack
        .map((s) => {
          return `${s.new ? '****' : '    '} ${s.property} ${
            deck.elements[s.element].name
          } - ${cleanRuby(computeElementInstance(s, deck.elements).jp)} - ${
            cache.pdepths[s.element]
          }`
        })
        .join('\n'),
    `depth ${
      stack.length
        ? stack.filter((s) => (cache.depths?.[s.element] ?? 0) >= 1).length / stack.length
        : 0
    }`
  )

  log(() => {
    const b: string[] = []
    for (const cardId in deck.cards) {
      const card = deck.cards[cardId]
      if (typeof card.stability !== 'number') b.push(cardId)
    }
    return b.length ? `BROKEN ${b.join(',')}` : 'no broken'
  })

  return {
    session: {
      reviews: estimateReviewsRemaining({ stack }),
      stack: _.uniqBy(stack, (s) => getInstanceId(s) + s.property),
      states: {},
      history: [],
      filter,
      propsFilter,
      allowNew,
    },
    new: newCards.length,
    due: dueCards.length,
    next: previewCards.length,
    progress,
  }
}

function cardShuffle(vals: t.CardInstance[]) {
  const byId = _.groupBy(_.shuffle(vals), (c) => getInstanceId(c)),
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

function distributeNewUnseenCards(session: Partial<t.LearningSession>) {
  if (!session.stack) return []
  const firstMissIndex = findStackIndex(session, (s) => s && s?.stability < MISS_THRESH)

  log('fmi', firstMissIndex)
  for (let i = firstMissIndex - 1; i >= 0; i--) {
    const card = session.stack[i],
      state = getCardState(card, session)

    const isNewUnseen = card.new && !state
    if (isNewUnseen) {
      const replacement = findStackIndex(
        session,
        (s, c, i) =>
          i > firstMissIndex &&
          ((!s && !c.new) || (s && s.stability >= 1 && s.stability <= 2))
      )

      log('nu before fmi', i, 'replace', replacement)
      if (replacement !== -1) {
        session.stack[i] = session.stack[replacement]
        session.stack[replacement] = card
      } else break
    }
  }

  return session.stack
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
  cards: t.LearningSession['states'],
  history: t.SessionCardLearning[]
) {
  for (const learning of history) {
    cards[learning.cardId] ??= {}
    cards[learning.cardId][learning.instanceId] = nextSessionState(
      cards[learning.cardId][learning.instanceId],
      learning.vscore ?? learning.score
    )
  }
}

const log = logger(3, 'session-stack')

export function gradeCard(deck: t.Deck, rgrade: number, took: number) {
  const { session } = deck
  if (!session) throw 'no session'

  const currentCard = session.stack[0]
  if (!currentCard) throw 'no card'

  const cardId = card2Id(currentCard),
    instanceId = getInstanceId(currentCard),
    now = getTime()

  const missedSibling =
      !session.states[cardId] &&
      !deck.cards[cardId] &&
      Object.keys(session.states).find((c) =>
        Object.values(session.states[c]).find(
          (s) => s.lastMiss && id2Card(c).element === currentCard.element
        )
      ),
    estReviews = getEstReviews(session),
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
    instanceId,
  })

  const cardState = nextSessionState(session.states[cardId]?.[instanceId], virtualGrade)
  session.states[cardId] ??= {}
  session.states[cardId][instanceId] = cardState

  const jitter =
      cardState.stability <= MISS_THRESH ? 0 : Math.floor(Math.random() * 3 - 1),
    graduated = cardState.stability >= 1,
    minGraduatedIndex = getMinGraduatedIndex(session),
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
    learningIndex = Math.min(
      canSpace //if not graduated reinsert 'proprtional' to stability
        ? (currentCard.new ? 0 : 2) +
            Math.pow(cardState.stability, 2) * (sessionIncs[2] * gradDistance) +
            jitter
        : Math.floor(cardState.stability * Math.max(7, session.stack.length / 2)) +
            jitter,
      minGraduatedIndex === -1 ? session.stack.length : Math.max(minGraduatedIndex, 4) // don't exceeed min grad index to prevent slow session end
    ),
    newIndex = Math.max(
      Math.min(
        Math.floor(!graduated ? learningIndex : graduatedIndex),
        session.stack.length
      ),
      1
    )

  session.stack.shift()
  session.stack.splice(newIndex, 0, currentCard)

  /* ensure a minimum gap between siblings */
  const MIN_SPACING = Math.min(Math.ceil(session.stack.length / 6), 4)
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

  /* if theres an unseen new card before the first miss then redist */
  const firstMissIndex = findStackIndex(session, (s) => s && s?.stability < MISS_THRESH),
    firstNewIndex = findStackIndex(session, (s, c) => c.new && !s)

  if (firstNewIndex !== -1 && firstMissIndex !== -1 && firstNewIndex < firstMissIndex)
    session.stack = distributeNewUnseenCards(session)

  if (getInstanceId(session.stack[0]) === _.last(session.history)?.instanceId) {
    log('first dup')
    const f = session.stack.shift()!
    session.stack.splice(2, 0, f)
  }
}

const MISS_THRESH = initSessionStabs[1] //0.5

function findStackIndex(
  session: Partial<t.LearningSession>,
  pred: (
    state: t.CardState | undefined,
    c: t.CardInstance,
    i: number
  ) => boolean | undefined,
  reverse?: boolean
) {
  if (!session.stack) return -1
  return session.stack[reverse ? 'findLastIndex' : 'findIndex']((c, i) =>
    pred(getCardState(c, session), c, i)
  )
}

function getCardState(card: t.CardInstance, session: Partial<t.LearningSession>) {
  return session.states && session.states[card2Id(card)]?.[getInstanceId(card)]
}

export async function applySessionUpdate(deck: t.Deck, update: t.UpdatePayload) {
  log('applySessionUpdate', update.commit)
  const { session } = deck
  if (!session) throw 'no session'

  if (session.commit !== update.commit || getGraduation(session) === 1) {
    log('cancel')
    return
  }

  let redist = false
  if ('remove' in update) {
    for (let i = 0; i < update.remove; i++) {
      let toRemove = findStackIndex(session, (s, c) => !s && !!c.new, true)

      if (toRemove === -1)
        toRemove = findStackIndex(session, (s, c) => !s && !c.new, true) //fall back to non new

      if (toRemove !== -1) {
        log('removing', deck.elements[session.stack[toRemove].element].name)
        session.stack.splice(toRemove, 1)
        redist = true
      }
    }
  } else if ('add' in update) {
    log('add', deck.elements[update.add.element].name)
    const insertIndex = Math.max(
      findStackIndex(session, (s, c) => !s && !!c.new, true),
      findStackIndex(session, (s) => s && s.stability < 1, true)
    )
    session.stack.splice(insertIndex + 1, 0, update.add)

    /* remove already seen, to keep stack length roughly the same, just with harder cards */
    const toRemove = findStackIndex(session, (s, c) => !s && !c.new, true)
    if (toRemove !== -1) {
      log('remove old', deck.elements[session.stack[toRemove].element].name)
      session.stack.splice(toRemove, 1)
    }
    redist = true
  }
  if (redist) {
    const first = session.stack.shift()
    session.stack = distributeNewUnseenCards(session)
    if (first) session.stack.unshift(first)
    session.commit = uid()
    log('commit', session.commit)
  }
}

export function getMinGraduatedIndex(session: t.LearningSession) {
  return findStackIndex(session, (s) => !s || s.stability < 1, true)
}

export function getEstReviews(session: t.LearningSession) {
  const cardReviewsRemaning = estimateReviewsRemaining(session)
  return session.history.length + cardReviewsRemaning
}

/* simple review estimation by simulating repeated 3 scores  */
export function estimateReviewsRemaining(session: Partial<t.LearningSession>) {
  const ncFactor = getNewCardFactor(),
    cardReviewsRemaning = _.sumBy(session.stack ?? [], (card) => {
      const state = getCardState(card, session)
      if (!state) return card.new ? ncFactor : 1

      let changedState = state,
        i = 0
      while (changedState.stability < 1 && i < 10) {
        changedState = nextSessionState(changedState, 3)
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
    count: number
    sessionSeconds: number
    accuracy: number | null
    graduation: number
  }
  shownValue?: Partial<t.PropsInstance>
  isNew?: boolean
  hasFailed?: boolean
}

export function getSessionState(
  session: t.LearningSession | null,
  elements: t.IdMap<t.Element>,
  revealed: boolean,
  cardStates: t.CardStates
): SessionState {
  const card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    nextCard = session?.stack[1],
    next = nextCard && computeElementInstance(nextCard, elements),
    element = card && getInheritedElement(card.element, elements),
    siblingCardIds = element
      ? Object.keys(element.props).map((property) => card2Id({ ...card, property }))
      : [],
    isNew =
      !!card &&
      !siblingCardIds.find((cardId) => cardStates[cardId] || session.states[cardId]),
    hasFailed =
      !!card && session.history?.findLast((v) => v.cardId === card2Id(card))?.score === 1
  return {
    progress: {
      sessionSeconds: _.sumBy(session?.history, (h) => h.took),
      count: session?.history.length ?? 0,
      accuracy:
        session &&
        session.history.filter((h) => h.score !== 1).length / session.history.length,
      graduation: getGraduation(session),
    },
    card,
    value,
    next,
    mode: card && computeElementMode(card, elements),
    shownValue: revealed ? value : _.pick(value, card?.property ?? ''),
    isNew,
    hasFailed,
  }
}

function getGraduation(session: t.LearningSession | null) {
  let graduated = 0
  const states = session?.states ?? {}
  for (const cardId in states) {
    for (const instanceId in states[cardId]) {
      const state = states[cardId][instanceId]
      if (state.stability >= 1) graduated++
    }
  }

  return !session!.stack.length ? 0 : graduated / session!.stack.length
}

export function undoGrade(session: t.LearningSession): t.LearningSession {
  const learning = session.history.pop()
  if (!learning) throw 'no card to undo'

  const stackIndex = session.stack.findIndex(
    (s) => getInstanceId(s) === learning.instanceId
  )
  if (stackIndex === -1) throw 'not in stack'

  const cardInstance = session.stack[stackIndex]
  session.stack.splice(stackIndex, 1)
  session.stack.unshift(cardInstance)

  session.states = {}
  applySessionHistoryToCards(session.states, session.history)

  return session
}

export function card2Id(card: t.Card) {
  return card.element + ':' + card.property
}

export function id2Card(id: string): t.Card {
  const [element, property] = id.split(':')
  return { element, property }
}

export function getNewCardFactor() {
  return 4
}

export function getNew(
  deck: t.Deck,
  limit: number,
  filter: string[],
  propsFilter: string[],
  cache: t.DeckCache,
  preferDeep?: boolean
): t.CardInstance[] {
  const log = logger(2, 'session')

  let maxOrder = '0'
  for (const cardId in deck.cards) {
    const { order } = getLearnOrder(
      id2Card(cardId).element,
      deck,
      undefined,
      false,
      cache
    )
    if (order && order > maxOrder) maxOrder = order.substring(0, 3)
  }

  const allCards = getAllCards(deck.elements),
    seenCards = Object.keys(deck.cards)
  let seenDeep = seenCards.filter((c) => cache.depths[id2Card(c).element]).length,
    seenTotal = seenCards.length,
    allDeep = allCards.filter((c) => cache.depths[c.element]).length,
    allTotal = allCards.length,
    seenDeepRatio = seenDeep / seenTotal,
    allDeepRatio = preferDeep ? 0.5 : allDeep / allTotal,
    priorityDeep = !!seenTotal && seenDeepRatio < allDeepRatio

  log('depth target', allDeepRatio, 'current', seenDeepRatio)

  const res: t.CardInstance[] = [],
    cards = _.orderBy(
      getAllCards(deck.elements)
        .filter((c) => !deck.cards[card2Id(c)])
        .map(
          (c) =>
            [c, getLearnOrder(c.element, deck, maxOrder, priorityDeep, cache)] as const
        )
        .filter((c) =>
          cache.depths[c[0].element]
            ? c[1].order.substring(0, maxOrder.length) <= maxOrder
            : true
        ),
      [(c) => c[1].order]
    ),
    newCardFactor = getNewCardFactor()

  //need to check if priority deep exceeds maxOrder...

  let lastSucessOrder: string | null = null,
    deepFail = false,
    fails = 0
  while (res.length < limit / newCardFactor && cards.length) {
    const [card, order] = cards.shift()!,
      id = card2Id(card),
      deep = cache.depths[card.element]

    if ((deepFail || fails > 100) && priorityDeep && deep) continue

    if ((!propsFilter.length || propsFilter.includes(card.property)) && !deck.cards[id]) {
      const added = sampleAndAdd(
        res,
        id,
        deck,
        filter,
        cache,
        undefined,
        undefined,
        preferDeep
      )
      if (deep) {
        const cat = order.order.substring(0, 3)
        if (added === true) {
          lastSucessOrder = cat
          fails = 0
        } else if (added === false) {
          fails++
          if (lastSucessOrder && cat !== lastSucessOrder) deepFail = true
        }
      }
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
  cache: t.DeckCache,
  minDepth?: number
) {
  const dues = getCardDueDates(deck, cache),
    dueCards: t.CardInstance[] = [],
    nextCards: t.CardInstance[] = [],
    nowTz = DateTime.fromSeconds(getTime()).setZone(tz).minus({ hours: 4 }),
    nowSeconds = nowTz.toSeconds(),
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
          const due = dues[cardId]
          return due && due < endOfDay ? 0 : 1
        },
        (cardId) => {
          const state = deck.cards[cardId],
            dueIn = (dues[cardId] ?? Infinity) - endOfDay,
            lastOpenMissAgo =
              state.lastMiss &&
              state.lastSeen! - state.lastMiss < 60 * 30 &&
              nowSeconds - state.lastMiss > 60 * 30
                ? (endOfDay - Math.max(state.lastMiss, state.firstSeen ?? 0)) / 8
                : Infinity
          return Math.min(lastOpenMissAgo, dueIn)
        },
      ]
    )

  let doneCount = 0,
    newCount = 0,
    dueCount = 0
  const dayCounts: { [day: number]: number } = {}
  for (const cardId of cardsIds) {
    const state = deck.cards[cardId],
      due = dues[cardId]

    if (state.firstSeen && state.firstSeen > startOfDay) newCount++
    else if (state.lastRoot && state.lastRoot > startOfDay) doneCount++
    else if (due && state.lastSeen && due < endOfDay && state.lastSeen < startOfDay) {
      const day = DateTime.fromSeconds(due).minus({ hours: 4 }).startOf('day').toSeconds()
      dayCounts[day] = (dayCounts[day] ?? 0) + 1
      dueCount++
    }
  }

  let sameDays = 0,
    sampleFailures = 0,
    nextDones = 0

  const used = {},
    chunkOrdered = _.chunk(cardsIds, limit).flatMap((c) =>
      _.sortBy(c, (c) => -cache.depths[id2Card(c).element])
    )

  while (dueCards.length + nextCards.length < limit && chunkOrdered.length) {
    const cardId = chunkOrdered.shift()!,
      state = deck.cards[cardId],
      due = dues[cardId],
      dueToday = due && due < endOfDay,
      seenToday = state.lastRoot && state.lastRoot > startOfDay,
      firstSeenToday = state.firstSeen && state.firstSeen > startOfDay,
      isDue = dueToday && !seenToday,
      isSameDay = dueToday && seenToday

    if (!firstSeenToday && isSameDay && sameDays > limit / 8 && dueCards.length) continue

    /* only upsample if minimally learned */
    const thisMinDepth =
      state.stability >=
      getLearnTargetStability(deck.settings.fsrsParams ?? defaultParams)
        ? minDepth
        : 0

    const added = sampleAndAdd(
      dueToday ? dueCards : nextCards,
      cardId,
      deck,
      filter,
      cache,
      used,
      thisMinDepth,
      !!thisMinDepth
    )
    if (!added && isDue) sampleFailures++
    if (added && isSameDay) sameDays++
    if (added && !seenToday) nextDones++

    /* finishing goal, session can be shorter down to 60 */
    if (
      deck.goal &&
      deck.goal.date === startOfDay &&
      doneCount < deck.goal.count &&
      nextDones + doneCount >= deck.goal.count &&
      dueCards.length + nextCards.length >= 60
    )
      break
  }

  const dcvs = Object.values(dayCounts),
    dailyGoal = _.max(dcvs) ?? 0,
    backlog = _.sum(dcvs) - dailyGoal,
    chipper = Math.min(backlog, dailyGoal) //backlog cant exceed single day due

  const nextGoal: t.GoalState =
    deck.goal &&
    deck.goal.date === startOfDay &&
    deck.goal.ret === deck.settings.retention
      ? deck.goal
      : {
          date: startOfDay,
          ret: deck.settings.retention,
          count: Math.min(dailyGoal + chipper, dueCount) + doneCount - sampleFailures,
        }

  const progress: t.DayProgress = {
    goal: nextGoal,
    due: Math.max(dueCount - sampleFailures + doneCount, doneCount),
    done: doneCount,
    new: newCount,
    next: nextDones,
  }

  return { dueCards, nextCards, progress }
}

const SAMPLE_TRIES = 10,
  jitterScale = 1

export function sampleAndAdd(
  res: t.CardInstance[],
  cardId: string,
  deck: t.Deck,
  filter: string[],
  cache: t.DeckCache,
  used: { [id: string]: number } = {},
  minDepth?: number,
  preferDeep?: boolean
) {
  const { element, property } = id2Card(cardId),
    now = getTime()

  if (!deck.elements[element]) return

  let hasMatch = false,
    needsMatch = false
  for (const f of filter) {
    const inv = f[0] === '!',
      elId = inv ? f.substring(1) : f,
      elMatch = elId === element || cache.tree.firstAncestors[element]?.includes(elId)
    if (inv && elMatch) return
    else if (elMatch) hasMatch = true
    if (!inv) needsMatch = true
  }
  if (filter.length && needsMatch && !hasMatch) return

  const target = deck.settings.retention ?? defaultretention,
    childTarget = Math.pow(target, 1 / Math.max(Math.pow(cache.depths[element], 8), 1))

  let i = 0
  while (i < SAMPLE_TRIES) {
    try {
      const instance = sampleElementIstance(
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
          if (!minDepth && (used[elId] ?? 0) > Math.pow(cache.pdepths[elId], 2))
            return false //prevent reuse, except if upsampling
          const card = deck.cards[card2Id({ element: elId, property })]
          if (!cache.hasProps[elId] || elId === element) return true
          else {
            const targetStability =
              getLearnTargetStability(deck.settings.fsrsParams ?? defaultParams) *
              (preferDeep
                ? 1
                : Math.pow(cache.depths[element] + cache.depths[elId], 1.5) + 1)
            return card && card.stability > targetStability
          }
        },
        minDepth
      )
      for (const x of getInstanceEls(instance)) used[x] = (used[x] ?? 0) + 1
      res.push({ ...instance, property })
      return true
    } catch {}
    i++
  }
  return false
}

export function getInstanceEls(instance: t.ElementInstance): Set<string> {
  const res = new Set<string>([instance.element]),
    queue: t.ElementInstance[] = [instance]

  while (queue.length > 0) {
    const node = queue.shift()!
    if (node.params) {
      for (const paramKey in node.params) {
        const paramValue = node.params[paramKey]
        if (paramValue) {
          res.add(paramValue.element)
          queue.push(paramValue)
        }
      }
    }
  }

  return res
}
