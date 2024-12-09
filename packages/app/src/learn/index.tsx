import React, { useEffect, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import { LabelGroup } from '../components/labels'
import { propName } from '../components/map'
import { card2Id } from '@hsrs/lib/session'
import { getElementAndParents } from '@hsrs/lib/props'

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
    pluginUrl = plugin && settings.plugins[plugin]

  // console.log(
  //   plugin,
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

  // console.log(session)

  const pluginRef = useRef<HTMLIFrameElement>(null),
    [pluginLoaded, setPluginLoaded] = useState(false)

  useEffect(() => {
    const handleMessage = (e: MessageEvent<any>) => {
      if (e.origin === pluginUrl) {
        setPluginLoaded(true)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (pluginRef.current?.contentWindow && pluginUrl && pluginLoaded) {
      pluginRef.current.contentWindow.postMessage(
        { value, vars: settings.vars, revealed, property: card?.property },
        pluginUrl
      )
    }
  }, [shownValue, settings.vars, revealed, pluginLoaded])

  return (
    <div className={learnWrapper}>
      {session ? (
        value ? (
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
                    onClick={() => {
                      setRevealed(false)
                      dispatch(r.actions.gradeCard({ grade }))
                    }}
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
