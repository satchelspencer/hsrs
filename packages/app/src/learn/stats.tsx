import React, { useEffect, useMemo } from 'react'
import _ from 'lodash'
import * as r from '../redux'

import {
  defaultretention,
  getCardDue,
  getELRetrOffset,
  getLearningCardDiff,
  getRetr,
  getTime,
  nextInterval,
  offsetRetention,
} from '@hsrs/lib/schedule'
import { getCache } from '@hsrs/lib/cache'
import {
  applySessionHistoryToCards,
  card2Id,
  id2Card,
  nextSessionState,
} from '@hsrs/lib/session'
import { css } from '@emotion/css'
import { logger } from '@hsrs/lib/log'
import { getInstanceId } from '@hsrs/lib/alias'

type CardStat =
  | {
      cardId: string
      gradf: number
      graduated: boolean
    }
  | {
      cardId: string
      s: number
      intdiff: number
      duediff: number
      seendiff: number
      retr: number
      nextDueDiff: number
    }

const log = logger(3, 'session-stack')

export function SessionStats() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()

  const stats = useMemo<CardStat[]>(() => {
    const learning = _.last(session?.history)
    if (!learning || !session || settings.vars['debug'] !== 'true') return []

    const nextStats: CardStat[] = [],
      retention = deck.settings.retention ?? defaultretention,
      { cardId, score } = learning,
      lastHistory = _.dropRight(session.history, 1),
      lastCards = {},
      now = getTime(),
      cache = getCache(deck.elements)

    applySessionHistoryToCards(lastCards, lastHistory)

    if (deck.cards[cardId] && !lastCards[cardId]) {
      const diff = getLearningCardDiff(deck.cards, learning, deck)
      for (const key in diff) {
        const eretention = offsetRetention(
            retention,
            getELRetrOffset(id2Card(key).element, deck.elements, cache)
          ),
          v = diff[key],
          current = deck.cards[key],
          currentInt = nextInterval(current?.stability, eretention),
          nextInt = nextInterval(v.stability, eretention),
          currentVal = currentInt / 24 / 3600,
          nextVal = nextInt / 24 / 3600,
          currentDue = current && getCardDue(key, current, deck, cache),
          nextDue = v && getCardDue(key, v, deck, cache)

        nextStats.push({
          cardId: key,
          s: nextVal,
          intdiff: current ? ((nextVal - currentVal) / currentVal) * 100 : 0,
          duediff: currentDue ? (now - currentDue) / 24 / 3600 : 0,
          seendiff: current?.lastSeen ? (now - current.lastSeen) / 24 / 3600 : 0,
          retr: current?.lastSeen ? getRetr(current, now - current.lastSeen) : 0,
          nextDueDiff: currentDue && nextDue ? (nextDue - currentDue) / 24 / 3600 : 0,
        })
      }
    } else {
      const nextState = nextSessionState(lastCards[cardId], score)
      nextStats.push({
        cardId,
        gradf: Math.min(nextState.stability, 1),
        graduated: nextState.stability >= 1,
        duediff: 0,
      })
    }
    return _.sortBy(nextStats, (s) => ('intdiff' in s ? -Math.abs(s.intdiff) : Infinity))
  }, [session?.history, settings.vars])

  useEffect(() => {
    log('\n', () =>
      session?.stack
        .map((s) => {
          const state = session.states[card2Id(s)]?.[getInstanceId(s)]
          return [
            s.new && !state ? '****' : '    ',
            deck.elements[s.element].name,
            s?.property,
            state?.stability,
          ].join(' ')
        })
        .join('\n')
    )
  }, [session?.stack])

  return (
    <div className={sessionStats}>
      {stats.map((stat, i) => {
        const card = id2Card(stat.cardId)
        return (
          <div key={i}>
            <b
              style={{ cursor: 'pointer' }}
              onClick={() => {
                dispatch(
                  r.actions.setSelection({
                    selection: [{ type: 'element', jump: true, id: card.element }],
                    index: 0,
                  })
                )
                dispatch(r.actions.setRoute({ route: 'lib' }))
              }}
            >
              {deck.elements[card.element].name} {card.property}
            </b>
            &nbsp;
            {'s' in stat ? (
              <>
                {stat.retr === 0 ? null : (
                  <span style={{ opacity: 0.7 }}>{round(stat.retr * 100)}%&nbsp;</span>
                )}
                {stat.seendiff === 0 ? null : (
                  <span style={{ opacity: 0.7, color: 'blue' }}>
                    {round(Math.abs(stat.seendiff))}d ago&nbsp;
                  </span>
                )}
                {stat.duediff === 0 ? null : (
                  <span style={{ opacity: 0.7 }}>
                    {round(Math.abs(stat.duediff))}d {stat.duediff < 0 ? 'early' : 'late'}
                    &nbsp;
                  </span>
                )}
                <span>now {round(stat.s)}d&nbsp;</span>
                {stat.intdiff === 0 ? null : (
                  <span
                    style={{
                      color:
                        Math.round(stat.intdiff) === 0
                          ? 'gray'
                          : stat.intdiff >= 0
                          ? 'green'
                          : 'red',
                    }}
                  >
                    {stat.intdiff > 0 ? '+' : ''}
                    {Math.round(stat.intdiff)}%
                  </span>
                )}
                {stat.nextDueDiff === 0 ? null : (
                  <span style={{ opacity: 0.7 }}>
                    {stat.nextDueDiff > 0 ? ' +' : ' -'}
                    {round(Math.abs(stat.nextDueDiff))}d
                  </span>
                )}
              </>
            ) : stat.graduated ? (
              <span style={{ color: 'green' }}>graduated!</span>
            ) : (
              <span
                style={{
                  color:
                    stat.gradf >= 1 ? 'green' : stat.gradf > 0.55 ? '#a19100' : 'red',
                }}
              >
                {round(stat.gradf * 100)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const round = (n: number) => Math.floor(n * 100) / 100

const sessionStats = css`
  position: absolute;
  top: 0;
  left: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 8px;
  font-size: 0.5em;
  opacity: 0.5;
`
