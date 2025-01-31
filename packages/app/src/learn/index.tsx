import React, { useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button, RadioGroup } from '../components/button'
import { computeElementInstance, computeElementMode } from '@hsrs/lib/expr'
import { LabelGroup } from '../components/labels'
import { propName } from '../components/map'
import {
  card2Id,
  createLearningSession,
  getSessionDone,
  id2Card,
} from '@hsrs/lib/session'
import { getElementAndParents, getInheritedElement } from '@hsrs/lib/props'
import {
  applyHistoryToCards,
  getLearningCardDiff,
  getLearnTargetStability,
  getRetention,
  getRetr,
  getTime,
  grades,
  nextCardState,
  nextInterval,
} from '@hsrs/lib/schedule'
import { Icon } from '../components/icon'
import Worker from '../worker?worker'
import * as t from '@hsrs/lib/types'
import { ElListPicker } from '../editor/element'
import { getCache } from '@hsrs/lib/cache'

const worker = new Worker()

type CardStat =
  | {
      cardId: string
      gradf: number
      graduated: boolean
    }
  | {
      cardId: string
      s: number
      sdiff: number
      duediff: number
      seendiff: number
      retr: number
    }

const round = (n: number) => Math.floor(n * 100) / 100

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    elements = r.useSelector((s) => s.deck.elements),
    settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()

  const card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    mode = card && computeElementMode(card, elements),
    [revealed, setRevealed] = useState(false),
    shownValue = revealed ? value : _.pick(value, card?.property ?? ''),
    plugin =
      card &&
      getElementAndParents(card.element, elements)
        .map((e) => elements[e].name)
        .find((e) => settings.plugins[e]),
    pluginUrl = plugin && settings.plugins[plugin],
    { sessionDone, targetStability } = getSessionDone(session)

  const [aliases, setAliases] = useState<t.PropsInstance[]>([])
  useEffect(() => {
    setAliases([])
    if (card) {
      worker.onmessage = ({ data }) => {
        setAliases(data.map((d) => computeElementInstance(d, elements)))
      }
      worker.postMessage({
        type: 'findAliases',
        instance: card,
        propName: card?.property,
        elements: elements,
        cache: getCache(elements),
        cards: deck.cards,
      })
    }
  }, [card])

  // useEffect(() => {
  //   console.log(
  //     plugin,
  //     sessionDone,
  //     targetStability,
  //     JSON.stringify(
  //       session?.stack.map((s) =>
  //         [
  //           s.new && !session.cards[card2Id(s)] ? '****' : '    ',
  //           elements[s.element].name,
  //           s?.property,
  //           //s.element,
  //           //s?.params
  //           session.cards[card2Id(s)]?.stability,
  //         ].join(' ')
  //       ),
  //       null,
  //       2
  //     )
  //   )
  // }, [card])

  const [time, setTime] = useState<number>(getTime())

  useEffect(() => {
    setTime(getTime())
  }, [card])

  const stats = useMemo<CardStat[]>(() => {
    const learning = _.last(session?.history)
    if (!learning || !session) return []

    const nextStats: CardStat[] = [],
      retention = deck.settings.retention ?? 0.9,
      { cardId, score } = learning,
      lastHistory = _.dropRight(session.history, 1),
      lastCards = {},
      now = getTime()

    applyHistoryToCards(lastCards, lastHistory, true, deck)

    if (deck.cards[cardId] && !lastCards[cardId]) {
      const diff = getLearningCardDiff(deck.cards, learning, deck)
      for (const key in diff) {
        const element = getInheritedElement(id2Card(key).element, deck.elements),
          eretention = getRetention(retention, element.retention),
          v = diff[key],
          current = deck.cards[key],
          currentInt = nextInterval(current?.stability, eretention),
          nextInt = nextInterval(v.stability, eretention),
          currentVal = currentInt / 24 / 3600,
          nextVal = nextInt / 24 / 3600

        nextStats.push({
          cardId: key,
          s: nextVal,
          sdiff: current ? ((nextVal - currentVal) / currentVal) * 100 : 0,
          duediff: current?.due ? (now - current.due) / 24 / 3600 : 0,
          seendiff: current?.lastSeen ? (now - current.lastSeen) / 24 / 3600 : 0,
          retr: current?.lastSeen ? getRetr(current, now - current.lastSeen) : 0,
        })
      }
    } else {
      const nextState = nextCardState(lastCards[cardId], score, 1, getTime()),
        targetInterval = getLearnTargetStability()
      nextStats.push({
        cardId,
        gradf: Math.min(nextState.stability / targetInterval, 1),
        graduated: nextState.stability >= targetInterval,
        duediff: 0,
      })
    }
    return _.sortBy(nextStats, (s) => ('sdiff' in s ? -Math.abs(s.sdiff) : Infinity))
  }, [session?.history])

  const setGrade = (grade: number) => {
    setRevealed(false)
    dispatch(r.actions.gradeCard({ grade, took: Math.min(getTime() - time, 60) }))
  }

  const handleKey = useRef<(key: string, meta: boolean) => void>()
  handleKey.current = (key, meta) => {
    if (key === ' ') {
      if (revealed) setGrade(3)
      else setRevealed(true)
    } else if (key === '1' && revealed) setGrade(1)
    else if (key === '2' && revealed) setGrade(2)
    else if (key === '3' && revealed) setGrade(3)
    else if (key === '4' && revealed) setGrade(4)
    else if (key === 'z' && meta) {
      dispatch(r.actions.undoGrade({}))
      setRevealed(false)
    }
  }

  const pluginRef = useRef<HTMLIFrameElement>(null),
    [pluginLoaded, setPluginLoaded] = useState(false)

  useEffect(() => {
    setPluginLoaded(false)

    const handleMessage = (e: MessageEvent<any>) => {
      if ('key' in e.data) handleKey.current?.(e.data.key, e.data.meta)
      if (e.data.type === 'ready') setPluginLoaded(true)
    }
    window.addEventListener('message', handleMessage)

    const keyHanlder = (e: KeyboardEvent) => handleKey.current?.(e.key, e.metaKey)
    window.addEventListener('keydown', keyHanlder)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', keyHanlder)
    }
  }, [pluginRef.current])

  useEffect(() => {
    if (pluginRef.current?.contentWindow && pluginUrl && pluginLoaded) {
      pluginRef.current.contentWindow.postMessage(
        {
          type: 'state',
          state: {
            value,
            aliases,
            vars: settings.vars,
            revealed,
            property: card?.property,
            id: card2Id(card),
            mode,
          },
        },
        pluginUrl
      )
    }
  }, [shownValue, settings.vars, revealed, pluginLoaded, aliases])

  const { allowNew, newSessionSize, filter } = r.useSelector((s) => s.deck.settings),
    actualSessionSize = Math.pow(2, newSessionSize) * 30,
    {
      new: cardsAvailable,
      due: cardsDue,
      next: nextDue,
      maxp,
    } = useMemo(
      () => createLearningSession(deck, actualSessionSize, allowNew, filter ?? []),
      [newSessionSize, allowNew, filter, !!session]
    ),
    sessionSeconds = _.sumBy(session?.history, (h) => h.took),
    accuracy =
      session &&
      session.history.filter((h) => h.score !== 1).length / session.history.length

  return (
    <div className={learnWrapper}>
      {session ? (
        sessionDone ? (
          <>
            <Button
              className={mainAction}
              onClick={() => dispatch(r.actions.endSession())}
            >
              <Icon size={1.2} name="check" />
              &nbsp;finish session
            </Button>
            <div className={desc}>
              {session.history.length} reviews done in{' '}
              {sessionSeconds > 60 ? (
                <>{(sessionSeconds / 60).toFixed(1)} minutes</>
              ) : (
                <>{sessionSeconds.toFixed(1)} seconds</>
              )}
              . {accuracy && Math.floor(accuracy * 100)}% accuracy
            </div>
          </>
        ) : value ? (
          <div className={cardWrapper}>
            <div className={cardBody}>
              {plugin ? (
                <iframe
                  allow="autoplay"
                  className={frame}
                  ref={pluginRef}
                  src={pluginUrl}
                />
              ) : (
                <LabelGroup
                  items={Object.keys(shownValue ?? {}).map((id) => [
                    <div className={propName}>{id}</div>,
                    <div>{shownValue?.[id] + ''}</div>,
                  ])}
                />
              )}
              <div className={sessionActions}>
                <Button onClick={() => dispatch(r.actions.endSession())}>
                  <Icon name="close" />
                </Button>
              </div>
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
                              selection: [
                                { type: 'element', jump: true, id: card.element },
                              ],
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
                            <span style={{ opacity: 0.7 }}>
                              {round(stat.retr * 100)}%&nbsp;
                            </span>
                          )}
                          {stat.seendiff === 0 ? null : (
                            <span style={{ opacity: 0.7, color: 'blue' }}>
                              {round(Math.abs(stat.seendiff))}d ago&nbsp;
                            </span>
                          )}
                          {stat.duediff === 0 ? null : (
                            <span style={{ opacity: 0.7 }}>
                              {round(Math.abs(stat.duediff))}d{' '}
                              {stat.duediff < 0 ? 'early' : 'late'}&nbsp;
                            </span>
                          )}
                          <span>now {round(stat.s)}d&nbsp;</span>
                          {stat.sdiff === 0 ? null : (
                            <span
                              style={{
                                color:
                                  Math.round(stat.sdiff) === 0
                                    ? 'gray'
                                    : stat.sdiff >= 0
                                    ? 'green'
                                    : 'red',
                              }}
                            >
                              {stat.sdiff > 0 ? '+' : ''}
                              {Math.round(stat.sdiff)}%
                            </span>
                          )}
                        </>
                      ) : stat.graduated ? (
                        <span style={{ color: 'green' }}>graduated!</span>
                      ) : (
                        <span
                          style={{
                            color:
                              stat.gradf >= 1
                                ? 'green'
                                : stat.gradf > 0.55
                                ? '#a19100'
                                : 'red',
                          }}
                        >
                          {round(stat.gradf * 100)}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={cardActions}>
              <div className={actionsInner} style={{ justifyContent: 'start' }}>
                <div className={sessionProgress}>
                  {
                    session.stack.filter(
                      (s) => session.cards[card2Id(s)]?.stability >= targetStability
                    ).length
                  }
                  /{session.stack.length}
                </div>
              </div>
              <div className={actionsInner}>
                {revealed ? (
                  grades.map((grade, index) => (
                    <Button
                      key={grade}
                      onClick={() => setGrade(index)}
                      className={cardAction}
                    >
                      {grade}
                      <span style={{ fontSize: '0.7em', opacity: 0.6 }}>
                        &nbsp;[{index + 1}]
                      </span>
                    </Button>
                  ))
                ) : (
                  <Button onClick={() => setRevealed(true)} className={cardAction}>
                    reveal
                  </Button>
                )}
              </div>
              <div
                className={actionsInner}
                style={{ justifyContent: 'end', fontSize: '1.1em' }}
              >
                <Button
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
                  <Icon name="open" />
                </Button>
              </div>
            </div>
          </div>
        ) : null
      ) : (
        <>
          <div className={desc}>
            <RadioGroup
              value={newSessionSize}
              onChange={(s) =>
                dispatch(r.actions.setDeckSettings({ newSessionSize: s as any }))
              }
              options={[
                { label: 'S', value: 1 },
                { label: 'M', value: 2 },
                { label: 'L', value: 3 },
                { label: 'XL', value: 4 },
              ]}
              buttonClassName={sizeButton}
            />
            &nbsp; &nbsp;
            <div style={{ minWidth: 150 }}>
              <ElListPicker
                multiline={false}
                placeholder="All cards..."
                value={filter ?? []}
                onChange={(value) =>
                  dispatch(r.actions.setDeckSettings({ filter: value }))
                }
              />
            </div>
          </div>
          <div className={desc} style={{ opacity: 0.7 }}>
            <b>{cardsDue}</b>&nbsp;due,&nbsp;
            <b>{cardsAvailable}</b>&nbsp;new,&nbsp;<b>{nextDue}</b>&nbsp;review&nbsp;
            {maxp ? `(+${((maxp - getTime()) / 24 / 3600).toFixed(2)}d)` : null}
            <input
              type="checkbox"
              checked={!!allowNew}
              onChange={() =>
                dispatch(r.actions.setDeckSettings({ allowNew: !allowNew }))
              }
            />
            <span>Allow new</span>
          </div>
          <Button
            className={mainAction}
            onClick={() => dispatch(r.actions.createSession({ size: actualSessionSize }))}
          >
            <Icon size={1.2} name="plus" />
            &nbsp;start session
          </Button>
        </>
      )}
    </div>
  )
}

const sizeButton = cx(
  css`
    width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
  `
)

const desc = cx(css`
  font-size: 0.9em;
  display: flex;
  align-items: center;
`)

const mainAction = cx(css`
  font-size: 1.1em;
  /* background: ${styles.color(0.95)};
  border: 1px solid ${styles.color(0.93)};
  color: ${styles.color(0.4)};
  padding: 10px;
  border-radius: 4px; */
`)

const sessionActions = cx(css`
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`)

const sessionStats = cx(css`
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
`)

const sessionProgress = cx(css`
  color: ${styles.color(0.7)};
`)

const frame = cx(
  css`
    width: 100%;
    height: 100%;
    border: none;
  `
)

const cardWrapper = cx(
  styles.fill,
  css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
  `
)

const cardBody = cx(css`
  display: flex;
  flex-direction: column;
  font-size: 2em;
  flex: 1;
`)

const cardActions = cx(css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`)

const actionsInner = cx(css`
  display: flex;
  gap: 20px;
  flex: 1;
  justify-content: center;
`)

const cardAction = cx(css`
  color: ${styles.color.active(0.7)};
  font-size: 1.15em;
`)

const learnWrapper = cx(
  styles.fill,
  css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: relative;
    gap: 10px;
  `
)
