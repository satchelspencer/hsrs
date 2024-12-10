import React, { useEffect, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import { LabelGroup } from '../components/labels'
import { propName } from '../components/map'
import { card2Id, getSessionDone } from '@hsrs/lib/session'
import { getElementAndParents } from '@hsrs/lib/props'
import { getTime } from '@hsrs/lib/schedule'

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
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
    sessionDone = session && getSessionDone(session)

  // console.log(
  //   plugin,
  //   sessionDone,
  //   settings.plugins[plugin ?? ''],
  //   JSON.stringify(
  //     session?.stack.map((s) =>
  //       [
  //         elements[s.element].name,
  //         s?.property,
  //         s.element,
  //         //s?.params
  //         session.cards.states[card2Id(s)]?.stability,
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
  }, [])

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

  return (
    <div className={learnWrapper}>
      {session ? (
        sessionDone ? (
          <Button onClick={() => dispatch(r.actions.endSession({}))}>
            Finish session
          </Button>
        ) : value ? (
          <div className={cardWrapper}>
            <div className={cardBody}>
              {plugin ? (
                <iframe
                  allow="autoplay"
                  className={frame}
                  ref={pluginRef}
                  src={pluginUrl}
                  onLoad={() => setPluginLoaded(false)}
                />
              ) : (
                <LabelGroup
                  items={Object.keys(shownValue ?? {}).map((id) => [
                    <div className={propName}>{id}</div>,
                    <div>{shownValue?.[id] + ''}</div>,
                  ])}
                />
              )}
            </div>
            <div className={cardActions}>
              {revealed ? (
                [1, 2, 3, 4].map((grade) => (
                  <Button
                    key={grade}
                    onClick={() => setGrade(grade)}
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
          </div>
        ) : null
      ) : (
        <Button onClick={() => dispatch(r.actions.createSession({ size: 100 }))}>
          Create session
        </Button>
      )}
      <Button onClick={() => dispatch(r.actions.endSession({}))}>Finish session</Button>
      <Button onClick={() => dispatch(r.actions.clearHistory({}))}>clear history</Button>
    </div>
  )
}

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
  font-size: 3em;
  flex: 1;
`)

const cardActions = cx(css`
  display: flex;
  flex-direction: row;
  gap: 10;
`)

const cardAction = cx(css``)

const learnWrapper = cx(
  styles.fill,
  css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `
)
