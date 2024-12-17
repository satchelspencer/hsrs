import React, { useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import { LabelGroup } from '../components/labels'
import { propName } from '../components/map'
import { card2Id, createLearningSession, getSessionDone } from '@hsrs/lib/session'
import { getElementAndParents } from '@hsrs/lib/props'
import { getTime, grades } from '@hsrs/lib/schedule'
import { Icon } from '../components/icon'

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    elements = r.useSelector((s) => s.deck.elements),
    settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()

  const card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    [revealed, setRevealed] = useState(false),
    shownValue = revealed ? value : _.pick(value, card?.property ?? ''),
    plugin =
      card &&
      getElementAndParents(card.element, elements)
        .map((e) => elements[e].name)
        .find((e) => settings.plugins[e]),
    pluginUrl = plugin && settings.plugins[plugin],
    { sessionDone, targetStability } = getSessionDone(session)

  // console.log(
  //   plugin,
  //   sessionDone,
  //   targetStability,
  //   JSON.stringify(
  //     session?.stack.map((s) =>
  //       [
  //         elements[s.element].name,
  //         s?.property,
  //         s.element,
  //         //s?.params
  //         session.cards[card2Id(s)]?.stability,
  //       ].join(', ')
  //     ),
  //     null,
  //     2
  //   )
  // )

  const [time, setTime] = useState<number>(getTime())

  useEffect(() => {
    setTime(getTime())
  }, [card])

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
    const handleMessage = (e: MessageEvent<any>) => {
      if (e.origin === pluginUrl) {
        if ('key' in e.data) handleKey.current?.(e.data.key, e.data.meta)
        setPluginLoaded(true)
      }
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
            vars: settings.vars,
            revealed,
            property: card?.property,
            id: card2Id(card),
          },
        },
        pluginUrl
      )
    }
  }, [shownValue, settings.vars, revealed, pluginLoaded])

  const allowNew = r.useSelector((s) => s.deck.settings?.allowNew),
    sessionSize = r.useSelector((s) => s.deck.settings?.newSessionSize ?? 1),
    actualSessionSize = Math.pow(2, sessionSize) * 30,
    {
      new: cardsAvailable,
      due: cardsDue,
      next: nextDue,
    } = useMemo(
      () => createLearningSession(deck, actualSessionSize, allowNew),
      [deck, sessionSize, allowNew]
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
          <Button
            className={mainAction}
            onClick={() => dispatch(r.actions.createSession({ size: actualSessionSize }))}
          >
            <Icon size={1.2} name="plus" />
            &nbsp;start session
          </Button>
          <div className={sizePicker}>
            {['S', 'M', 'L', 'XL'].map((s, index) => {
              return (
                <Button
                  key={index}
                  className={sizeButton(sessionSize === index + 1)}
                  onClick={() =>
                    dispatch(
                      r.actions.setDeckSettings({ newSessionSize: (index + 1) as any })
                    )
                  }
                >
                  {s}
                </Button>
              )
            })}
          </div>
          <div className={desc}>
            {cardsDue} due, {cardsAvailable} new, {nextDue} review
          </div>
          <div className={desc}>
            <input
              type="checkbox"
              checked={!!allowNew}
              onChange={() =>
                dispatch(r.actions.setDeckSettings({ allowNew: !allowNew }))
              }
            />{' '}
            <span>Allow new cards</span>
          </div>
        </>
      )}
    </div>
  )
}

const sizePicker = cx(css`
  display: flex;
  gap: 20px;
`)

const sizeButton = (selected?: boolean) =>
  cx(css`
    background: ${styles.color(0.95)};
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    ${selected &&
    css`
      outline: 2px solid ${styles.color.active()} !important;
    `}
  `)

const desc = cx(css`
  font-size: 0.9em;
  opacity: 0.7;
  display: flex;
  align-items: center;
`)

const mainAction = cx(css`
  font-size: 1.3em;
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
