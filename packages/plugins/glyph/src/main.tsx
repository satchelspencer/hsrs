import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { hsrsPlugin, CardState, HsrsPlugin } from 'hsrs-plugin'
import { GlyphCard, GlyphHandle } from './card'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
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

  const pluginRef = useRef<HsrsPlugin | null>(null)
  useEffect(() => {
    const handle = hsrsPlugin({}, setState)
    pluginRef.current = handle
    return handle.cleanup
  }, [])

  const urlVars = useMemo(() => {
      const vars: { [key: string]: string } = {}
      new URLSearchParams(window.location.search).forEach((val, key) => {
        vars[key] = val
      })
      return vars
    }, [window.location.search]),
    vars = { ...urlVars, ...state.vars }

  const onComplete = () =>
    window.parent.postMessage({ type: 'shortcut', name: 'next' }, '*')

  const glyphRef = useRef<GlyphHandle>(null)

  useEffect(() => {
    if (glyphRef.current?.svg && pluginRef.current)
      return pluginRef.current.setActiveArea(glyphRef.current.svg)
  }, [glyphRef.current?.svg])

  return <GlyphCard ref={glyphRef} {...state} vars={vars} onComplete={onComplete} />
}
