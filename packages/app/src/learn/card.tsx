import React, { useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'
import { Shortcut, keyboardShortcuts } from 'hsrs-plugin'
import type { OutgoingMessage } from 'hsrs-plugin'

import * as styles from '../styles'
import * as r from '../redux'
import { Button } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import { card2Id, getSessionState } from '@hsrs/lib/session'
import { getTime, grades } from '@hsrs/lib/schedule'
import { Icon } from '../components/icon'
import { findAliasesAync } from '@hsrs/lib/async'
import * as t from '@hsrs/lib/types'
import { getCache } from '@hsrs/lib/cache'
import { cleanRuby } from '@hsrs/lib/ruby'
import { SessionStats } from './stats'

function matchPlugin(name: string, plugins: Record<string, string>): string | undefined {
  if (plugins[name]) return plugins[name]
  for (const key of Object.keys(plugins)) {
    if (key.includes('*')) {
      const re = new RegExp('^' + key.replace(/\*/g, '.*') + '$')
      if (re.test(name)) return plugins[key]
    }
  }
}

export function Card() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    elements = r.useSelector((s) => s.deck.elements),
    settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()

  const [revealed, setRevealed] = useState(false),
    sessionState = useMemo(
      () => getSessionState(session, elements, revealed, deck.cards),
      [session, elements, revealed]
    ),
    { progress, card, value, mode, shownValue, next } = sessionState,
    sessionDone = progress.graduation === 1,
    cache = getCache(elements),
    plugin =
      card &&
      (cache.tree.ancestors[card.element] ?? [])
        .map((e) => elements[e].name)
        .find((e) => matchPlugin(e, settings.plugins)),
    pluginUrl = plugin && matchPlugin(plugin, settings.plugins)

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

  const [time, setTime] = useState<number>(getTime())

  useEffect(() => {
    setTime(getTime())
  }, [card])

  const setGrade = (grade: number) => {
      setRevealed(false)
      if (!sessionDone)
        dispatch(
          r.actions.gradeCardAndUpdate({ grade, took: Math.min(getTime() - time, 60) })
        )
    },
    undoGrade = () => {
      dispatch(r.actions.undoGrade({}))
      setRevealed(false)
    }

  const handleShortCut = useRef<(sc: Shortcut) => void>(() => {})
  handleShortCut.current = (sc) => {
    if (sc === 'next') {
      if (revealed) setGrade(3)
      else setRevealed(true)
    } else if (sc === '1' && revealed) setGrade(1)
    else if (sc === '2' && revealed) setGrade(2)
    else if (sc === '3' && revealed) setGrade(3)
    else if (sc === '4' && revealed) setGrade(4)
    else if (sc === 'undo') undoGrade()
  }

  const allPluginUrls = useMemo(
    () => [...new Set(Object.values(settings.plugins))],
    [settings.plugins]
  )

  const pluginRefs = useRef<Record<string, HTMLIFrameElement | null>>({}),
    [pluginLoaded, setPluginLoaded] = useState<Record<string, boolean>>({}),
    [pluginVisible, setPluginVisible] = useState<string | null>(null)

  const prevPluginUrl = useRef(pluginUrl)
  useEffect(() => {
    const prev = prevPluginUrl.current
    prevPluginUrl.current = pluginUrl
    if (prev && prev !== pluginUrl) {
      const prevRef = pluginRefs.current[prev]
      if (prevRef?.contentWindow)
        prevRef.contentWindow.postMessage(
          { type: 'state', state: { revealed: false, id: '' } },
          prev
        )
    }
    setPluginVisible(null)
    setActiveArea(null)
  }, [pluginUrl])

  const [activeArea, setActiveArea] = useState<Rect>(null),
    tapAreaRefs = useRef<(HTMLDivElement | null)[]>([null, null])

  useEffect(() => {
    const handleMessage = (e: MessageEvent<OutgoingMessage>) => {
      if (e.data.type === 'shortcut') handleShortCut.current(e.data.name)
      if (e.data.type === 'activeArea') setActiveArea(e.data.rect)
      if (e.data.type === 'ready') {
        for (const [url, el] of Object.entries(pluginRefs.current)) {
          if (el?.contentWindow === e.source)
            setPluginLoaded((prev) => ({ ...prev, [url]: true }))
        }
      }
    }
    window.addEventListener('message', handleMessage)

    const cleanupShortcuts = keyboardShortcuts((shortCut) => {
      handleShortCut.current(shortCut)
    })

    return () => {
      window.removeEventListener('message', handleMessage)
      cleanupShortcuts()
    }
  }, [])

  useEffect(() => {
    const activeRef = pluginUrl ? pluginRefs.current[pluginUrl] : null
    if (activeRef?.contentWindow && pluginUrl && pluginLoaded[pluginUrl]) {
      activeRef.contentWindow.postMessage(
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
      requestAnimationFrame(() => setPluginVisible(pluginUrl))
    }
  }, [shownValue, settings.vars, revealed, pluginLoaded, aliases, pluginUrl])

  return (
    <>
      {session && (
        <div className={progressWrapper}>
          <div
            className={progressInner}
            style={{ width: progress.graduation * 100 + '%' }}
          />
        </div>
      )}
      {!session ? null : progress.graduation === 1 || !session.stack.length ? (
        <>
          <Button className={mainAction} onClick={() => dispatch(r.actions.endSession())}>
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
            {allPluginUrls.map((url) => (
              <iframe
                key={url}
                allow="autoplay"
                className={frame}
                style={{ display: pluginVisible === url ? 'block' : 'none' }}
                ref={(el) => {
                  pluginRefs.current[url] = el
                }}
                src={url}
              />
            ))}
            {!plugin &&
              Object.keys(shownValue ?? {}).map((id) => {
                const value = shownValue?.[id]
                return (
                  id[0] !== '_' &&
                  value &&
                  typeof value === 'string' && (
                    <div key={id} className={cardValue}>
                      {cleanRuby(value)}
                    </div>
                  )
                )
              })}
            <div className={sessionActions}>
              <Icon onClick={() => dispatch(r.actions.endSession())} name="close" />
            </div>
            <SessionStats />
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
          {[false, true].map((right, i) => (
            <div
              key={+right}
              ref={(el) => {
                tapAreaRefs.current[i] = el
              }}
              className={tapArea(right)}
              style={excludeArea(
                activeArea,
                pluginUrl ? pluginRefs.current[pluginUrl] : null,
                tapAreaRefs.current[i]
              )}
              onClick={() =>
                revealed
                  ? setGrade(right ? 3 : 1)
                  : right
                    ? setRevealed(true)
                    : undoGrade()
              }
            />
          ))}
        </div>
      ) : null}
    </>
  )
}

const cardValue = css`
  padding: 8px;
`

const tapArea = (right: boolean) => css`
  position: absolute;
  z-index: 1;
  top: 48px;
  bottom: 48px;
  ${right ? 'right:0;' : 'left:0;'}
  width:33%;
  @media (min-width: 45em) {
    display: none;
  }
`

type Rect = Extract<OutgoingMessage, { type: 'activeArea' }>['rect']

function excludeArea(
  area: Rect,
  container: HTMLElement | null,
  element: HTMLElement | null
): React.CSSProperties | undefined {
  if (!area || !container || !element) return undefined

  const fr = container.getBoundingClientRect(),
    tr = element.getBoundingClientRect(),
    left = fr.left + area.x - tr.left,
    top = fr.top + area.y - tr.top,
    right = left + area.width,
    bottom = top + area.height

  return {
    clipPath:
      `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0,` +
      ` ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px)`,
  }
}

const gradeHint = css`
  font-size: 0.7em;
  opacity: 0.6;
  @media (max-width: 45em) {
    display: none;
  }
`

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
