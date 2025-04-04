import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { hsrsPlugin, CardState } from 'hsrs-plugin'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}

const ttsCache = new Map<string, string | undefined>()

interface CardProps extends CardState {
  tts: (text: string, raw?: string) => Promise<string | undefined>
}

function dedupeAudio<T extends string | undefined>(text: T) {
  return text && [...new Set(text.split('~, '))].join(', ').replaceAll('~', '')
}

export function useTtsState(state: CardProps) {
  const modeKeys = state.vars['modes']?.split('.').map((c) => c.split('-')) ?? [],
    value = state.value ?? {},
    mode = state.mode ?? '',
    keys = Object.keys(value),
    ttsKey = state.vars['tts'] && keys.find((k) => eqk(state.vars['tts'], k)),
    txtKey = state.vars['txt'] && keys.find((k) => eqk(state.vars['txt'], k)),
    shownKeys = (state.revealed ? keys : state.property ? [state.property] : []).filter(
      (k) => typeof value[k] === 'string' && (state.revealed || k !== ttsKey)
    ),
    valueWithALiases = state.revealed
      ? Object.fromEntries(
          Object.entries(state.value).map(([key, value]) => [
            key,
            typeof value === 'string'
              ? [value, ...state.aliases.map((a) => a[key])].join('~, ')
              : value,
          ])
        )
      : state.value

  const aref = useRef<HTMLAudioElement>(null),
    cardHasAudio =
      ttsKey &&
      value[ttsKey]?.length &&
      (state.property === ttsKey || shownKeys.includes(ttsKey)),
    [loaded, setLoaded] = useState(false),
    audioRaw = txtKey && valueWithALiases[txtKey],
    audioTxt = cardHasAudio && (ttsKey[0] !== '_' ? valueWithALiases[ttsKey] : audioRaw),
    modeText = (mode + '')
      .split('')
      .map((c, i) => modeKeys[i]?.find((v) => v[0] === c))
      .filter((v) => !!v)
      .join(', ')

  const playSrc = () => {
    if (!audioTxt) return
    const src = ttsCache.get(audioTxt)
    if (src && aref.current) {
      aref.current.src = src
      setLoaded(true)
      aref.current?.play()
    } else {
      setLoaded(true)
      speechSynthesis.pause()
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(audioTxt)
      utterance.lang = state.vars['lang']
      speechSynthesis.speak(utterance)
    }
  }

  const reqId = useRef(0)
  useEffect(() => {
    const nid = ++reqId.current
    setLoaded(false)
    if (aref.current) aref.current.pause()
    speechSynthesis.pause()
    speechSynthesis.cancel()
    if (cardHasAudio && aref.current && audioTxt) {
      if (ttsCache.get(audioTxt)) {
        playSrc()
      } else {
        console.log(dedupeAudio(audioTxt), dedupeAudio(audioRaw))
        state.tts(dedupeAudio(audioTxt), dedupeAudio(audioRaw)).then((audioSrc) => {
          ttsCache.set(audioTxt, audioSrc)
          if (reqId.current !== nid) return
          playSrc()
        })
      }
    }
  }, [audioTxt, aref.current, state.id, cardHasAudio])

  const [styles, setStyles] = useState<React.CSSProperties>({})
  useEffect(() => {
    const newStyles: React.CSSProperties = {}
    for (const varName in state.vars) {
      if (varName.indexOf('style:') === 0) {
        const [, cssProp] = varName.split(':'),
          values = (state.vars[varName] ?? '').split(','),
          sampleValue = values.flatMap((f, i) => new Array(values.length - i).fill(f))
        newStyles[cssProp] = sampleValue[Math.floor(Math.random() * sampleValue.length)]
      }
    }
    setStyles(newStyles)
  }, [state.id])
  const shownStyles =
    (shownKeys.includes(ttsKey ?? '') || shownKeys.includes(txtKey ?? '')) &&
    !state.revealed
      ? styles
      : {}

  return {
    shownKeys,
    shownStyles,
    modeText,
    valueWithALiases,
    cardHasAudio,
    playSrc,
    loaded,
    aref,
    modeKey: shownKeys.find((k) => k !== ttsKey && k !== txtKey),
    ...state,
  }
}

function Card(props: CardProps) {
  const state = useTtsState(props)
  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        top: 0,
        left: 0,
        fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
        fontSize: '2em',
        gap: '5px',
        padding: '1em',
        boxSizing: 'border-box',
        textAlign: 'center',
        ...state.shownStyles,
      }}
    >
      {state.shownKeys.map((k, i) => (
        <div
          style={{ opacity: state.revealed && k === state.property ? 0.5 : 1 }}
          key={k}
        >
          {k === state.modeKey && state.modeText && (
            <span style={{ opacity: 0.4, fontStyle: 'italic' }}>
              &nbsp;({state.modeText})&nbsp;
            </span>
          )}
          {(state.valueWithALiases[k] + '').replaceAll('~', '')}
        </div>
      ))}
      <audio hidden ref={state.aref} controls />
      {state.cardHasAudio && (
        <svg
          style={{ cursor: 'pointer', opacity: 0.5 }}
          xmlns="http://www.w3.org/2000/svg"
          height="1em"
          viewBox="0 -960 960 960"
          width="1em"
          fill={state.loaded ? 'black' : 'gray'}
          onClick={() => state.playSrc()}
        >
          <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
        </svg>
      )}
    </div>
  )
}

function App() {
  const [state, setState] = useState<CardState>({
    value: {},
    aliases: [],
    vars: {},
    revealed: false,
    property: '',
    id: '',
    mode: '',
  })

  useEffect(() => hsrsPlugin({}, setState), [])

  const urlVars = useMemo(() => {
      const vars: { [key: string]: string } = {}
      new URLSearchParams(window.location.search).forEach((val, key) => {
        vars[key] = val
      })
      return vars
    }, [window.location.search]),
    vars = { ...urlVars, ...state.vars },
    fetchTTS = async (text: string, raw?: string) => {
      if (!vars['google-key']) return undefined
      try {
        const resp = await window.fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${vars['google-key']}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input:
                raw && raw !== text
                  ? { ssml: `<speak><sub alias="${text}">${raw}</sub></speak>` }
                  : { text },
              voice: { languageCode: vars['lang'], name: vars['voice'] },
              audioConfig: { audioEncoding: 'MP3' },
            }),
          }
        )
        const json = await resp.json()

        return 'data:audio/mp3;base64,' + json.audioContent
      } catch {
        return undefined
      }
    }

  return <Card {...state} vars={vars} tts={fetchTTS} />
}

function eqk(a: string, b: string) {
  return a.replace(/^_/, '') === b.replace(/^_/, '')
}
