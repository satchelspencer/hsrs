import React, { useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button, RadioGroup } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import {
  applySessionHistoryToCards,
  card2Id,
  createLearningSession,
  getSessionState,
  id2Card,
  nextSessionState,
} from '@hsrs/lib/session'
import {
  defaultretention,
  getELRetrOffset,
  getLearningCardDiff,
  offsetRetention,
  getRetr,
  getTime,
  grades,
  nextInterval,
} from '@hsrs/lib/schedule'
import { Icon } from '../components/icon'
import { findAliasesAync } from '@hsrs/lib/async'
import * as t from '@hsrs/lib/types'
import { ElListPicker } from '../editor/element'
import { getCache } from '@hsrs/lib/cache'

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

const round = (n: number) => Math.floor(n * 100) / 100

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    elements = r.useSelector((s) => s.deck.elements),
    settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()

  const [revealed, setRevealed] = useState(false),
    sessionState = useMemo(
      () => getSessionState(session, elements, revealed),
      [session, elements, revealed]
    ),
    { progress, card, value, mode, shownValue, next } = sessionState,
    cache = getCache(elements),
    plugin =
      card &&
      (cache.tree.ancestors[card.element] ?? [])
        .map((e) => elements[e].name)
        .find((e) => settings.plugins[e]),
    pluginUrl = plugin && settings.plugins[plugin]

  const [aliases, setAliases] = useState<t.PropsInstance[]>([])
  const reqId = useRef(0)
  useEffect(() => {
    setAliases([])
    if (card) {
      const nid = ++reqId.current
      findAliasesAync(card, card?.property, deck).then((aliases) => {
        if (nid === reqId.current)
          setAliases(aliases.map((d) => computeElementInstance(d, elements)))
      })
    }
  }, [card])

  // useEffect(() => {
  //   console.log(plugin, sessionDone)
  //   console.log(
  //     session?.stack
  //       .map((s) =>
  //         [
  //           s.new && !session.cards[card2Id(s)] ? '****' : '    ',
  //           elements[s.element].name,
  //           s?.property,
  //           //s.element,
  //           //s?.params
  //           session.cards[card2Id(s)]?.stability,
  //         ].join(' ')
  //       )
  //       .join('\n')
  //   )
  // }, [card])

  const [time, setTime] = useState<number>(getTime())

  useEffect(() => {
    setTime(getTime())
  }, [card])

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
            getELRetrOffset(id2Card(key).element, elements, cache)
          ),
          v = diff[key],
          current = deck.cards[key],
          currentInt = nextInterval(current?.stability, eretention),
          nextInt = nextInterval(v.stability, eretention),
          currentVal = currentInt / 24 / 3600,
          nextVal = nextInt / 24 / 3600

        nextStats.push({
          cardId: key,
          s: nextVal,
          intdiff: current ? ((nextVal - currentVal) / currentVal) * 100 : 0,
          duediff: current?.due ? (now - current.due) / 24 / 3600 : 0,
          seendiff: current?.lastSeen ? (now - current.lastSeen) / 24 / 3600 : 0,
          retr: current?.lastSeen ? getRetr(current, now - current.lastSeen) : 0,
          nextDueDiff: current?.due && v?.due ? (v.due - current.due) / 24 / 3600 : 0,
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

  const setGrade = (grade: number) => {
      setRevealed(false)
      dispatch(r.actions.gradeCard({ grade, took: Math.min(getTime() - time, 60) }))
    },
    undoGrade = () => {
      dispatch(r.actions.undoGrade({}))
      setRevealed(false)
    }

  const handleKey = useRef<(key: string, meta: boolean, ctrl: boolean) => void>()
  handleKey.current = (key, meta, ctrl) => {
    if (key === ' ') {
      if (revealed) setGrade(3)
      else setRevealed(true)
    } else if (key === '1' && revealed) setGrade(1)
    else if (key === '2' && revealed) setGrade(2)
    else if (key === '3' && revealed) setGrade(3)
    else if (key === '4' && revealed) setGrade(4)
    else if (key === 'z' && (meta || ctrl)) undoGrade()
  }

  const pluginRef = useRef<HTMLIFrameElement>(null),
    [pluginLoaded, setPluginLoaded] = useState(false)

  useEffect(() => {
    setPluginLoaded(false)

    const handleMessage = (e: MessageEvent<any>) => {
      if ('key' in e.data) handleKey.current?.(e.data.key, e.data.meta, e.data.ctrl)
      if (e.data.type === 'ready') setPluginLoaded(true)
    }
    window.addEventListener('message', handleMessage)

    const keyHanlder = (e: KeyboardEvent) =>
      handleKey.current?.(e.key, e.metaKey, e.ctrlKey)
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
            next,
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
      progress: dayProgress,
    } = useMemo(
      () =>
        createLearningSession(deck, actualSessionSize, allowNew, filter ?? [], 'local'),
      [newSessionSize, allowNew, filter, !!session]
    )

  return (
    <div className={learnWrapper}>
      {session && (
        <div className={progressWrapper}>
          <div
            className={progressInner}
            style={{ width: progress.completion * 100 + '%' }}
          />
        </div>
      )}
      {session ? (
        progress.completion === 1 ? (
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
              {progress.sessionSeconds > 60 ? (
                <>{(progress.sessionSeconds / 60).toFixed(1)} minutes</>
              ) : (
                <>{progress.sessionSeconds.toFixed(1)} seconds</>
              )}
              . {progress.accuracy && Math.floor(progress.accuracy * 100)}% accuracy
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
                Object.keys(shownValue ?? {}).map((id) => (
                  <div>{shownValue?.[id] + ''}</div>
                ))
              )}
              <div className={sessionActions}>
                <Icon onClick={() => dispatch(r.actions.endSession())} name="close" />
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
              <div
                className={actionsInner}
                style={{ justifyContent: 'start', flex: 'none' }}
              >
                {!revealed && (
                  <Button onClick={() => undoGrade()} className={undoAction}>
                    undo
                  </Button>
                )}
              </div>
              <div className={actionsInner}>
                {revealed ? (
                  grades.map((grade, index) => (
                    <Button
                      key={grade}
                      onClick={() => setGrade(index + 1)}
                      className={cardAction}
                    >
                      {grade}
                      <span className={gradeHint}>&nbsp;[{index + 1}]</span>
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
                style={{
                  justifyContent: 'end',
                  fontSize: '1.2em',
                  opacity: 0.7,
                  flex: 'none',
                }}
              >
                {!revealed && (
                  <Button
                    onClick={() => {
                      dispatch(
                        r.actions.setSelection({
                          selection: [{ type: 'element', jump: true, id: card!.element }],
                          index: 0,
                        })
                      )
                      dispatch(r.actions.setRoute({ route: 'lib' }))
                    }}
                  >
                    <Icon name="open" />
                  </Button>
                )}
              </div>
            </div>
            <div
              className={tapArea(false)}
              onClick={() => (revealed ? setGrade(1) : undoGrade())}
            />
            <div
              className={tapArea(true)}
              onClick={() => (revealed ? setGrade(3) : setRevealed(true))}
            />
          </div>
        ) : null
      ) : (
        <>
          {!!dayProgress.goal && (
            <div className={dprogress}>
              <div
                className={dprogressItem(dayProgress.done / dayProgress.goal.count, true)}
                style={{ zIndex: 1 }}
              />
              <div
                className={cx(
                  dprogressItem(dayProgress.next / dayProgress.goal.count),
                  fadeInOut
                )}
              />
            </div>
          )}
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
            <div className={desc} style={{ fontSize: 'inherit' }}>
              <input
                type="checkbox"
                checked={!!allowNew}
                onChange={() =>
                  dispatch(r.actions.setDeckSettings({ allowNew: !allowNew }))
                }
              />
              <span>Allow new</span>
            </div>
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

const dprogress = cx(
  css`
    display: flex;
    width: 350px;
    max-width: 100vw;
    margin: 5px;
    height: 12px;
    border-radius: 12px;
    background: ${styles.color(0.95)};
    overflow: hidden;
  `
)

const fadeInOut = css`
  animation: fadeInOut 2s infinite ease-in-out;
  @keyframes fadeInOut {
    0% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.2;
    }
  }
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
  padding-left: 8px;
  margin-left: -8px;
  background: hsl(211 51% 78% / 0.5);
  box-sizing: content-box;
`

const dprogressItem = (done: number, border?: boolean) =>
  cx(css`
    flex: none;
    height: 12px;
    border-radius: 8px;
    width: ${done * 100 + '%'};
    max-width: 100%;
    background: ${done >= 1 ? `oklab(0.82 -0.12 0.08 / 1)` : `hsl(211deg 89% 78%)`};
    ${done < 1 && border && `border-right: 2px solid #678eb97a;`}
  `)

const tapArea = (right: boolean) =>
  cx(css`
    position: absolute;
    z-index: 1;
    top: 48px;
    bottom: 48px;
    ${right ? 'right:0;' : 'left:0;'}
    width:33%;
    @media (min-width: 45em) {
      display: none;
    }
  `)

const gradeHint = cx(
  css`
    font-size: 0.7em;
    opacity: 0.6;
    @media (max-width: 45em) {
      display: none;
    }
  `
)

const progressWrapper = cx(css`
  height: 5px;
  background: ${styles.color(0.9)};
  width: 100%;
  position: absolute;
  bottom: 0;
`)

const progressInner = cx(css`
  position: absolute;
  height: 100%;
  left: 0;
  background: ${styles.color.active(0.8)};
  opacity: 0.7;
  transition: 0.2s all;
`)

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
`)

const sessionActions = cx(css`
  position: absolute;
  top: 0;
  right: 0;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8em;
  opacity: 0.4;
  cursor: pointer;
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
  align-items: center;
  justify-content: center;
`)

const cardActions = cx(css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`)

const actionsInner = cx(css`
  display: flex;
  flex: 1;
  justify-content: space-around;
  max-width: 40em;
`)

const cardAction = cx(css`
  color: ${styles.color.active(0.7)};
  font-size: 1.15em;
`)

const undoAction = cx(
  cardAction,
  css`
    color: ${styles.color(0.7)} !important;
  `
)

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
