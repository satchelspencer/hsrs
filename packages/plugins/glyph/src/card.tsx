import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { CardState } from 'hsrs-plugin'
import { decodeStrokes } from './codec'
import { strokeMatches, Point } from './matcher'
import { cleanRuby } from '@hsrs/lib/ruby'

export interface GlyphVars extends Record<string, string> {
  strokes: string
  glyph: string
  test: 'copy' | 'recall'
  canvas: string
}

export interface GlyphProps extends CardState {
  onComplete?: () => void
}

export interface GlyphHandle {
  svg: SVGSVGElement | null
}

export function useGlyphState(props: GlyphProps) {
  const vars = props.vars as Partial<GlyphVars>,
    canvas = Number(vars.canvas) || 109,
    strokesProp = vars.strokes || '_st',
    glyphProp = vars.glyph || 'jp',
    test = vars.test || 'copy',
    value = props.value || {},
    encoded = (value[strokesProp] as string) || '',
    targetChar = (value[glyphProp] as string) || '',
    expectedPaths = useMemo(() => decodeStrokes(encoded).strokes, [encoded])

  const [completed, setCompleted] = useState(0),
    [attempts, setAttempts] = useState(0),
    [drawing, setDrawing] = useState<Point[] | null>(null)

  useEffect(() => {
    setCompleted(0)
    setAttempts(0)
    setDrawing(null)
  }, [props.id])

  const numCompleted = completed,
    allDone = numCompleted >= expectedPaths.length

  const svgRef = useRef<SVGSVGElement>(null)

  const events: Record<string, (e: React.PointerEvent) => void> = {
    onPointerDown: (e) => {
      if (allDone) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const p = toCanvas(svgRef.current, e.clientX, e.clientY)
      if (p) setDrawing([p])
    },
    onPointerMove: (e) => {
      if (!drawing) return
      const p = toCanvas(svgRef.current, e.clientX, e.clientY)
      if (p) setDrawing([...drawing, p])
    },
    onPointerUp: () => {
      if (!drawing || drawing.length < 2) {
        setDrawing(null)
        return
      }
      const result = strokeMatches(drawing, expectedPaths[numCompleted], canvas)

      if (result.matched) {
        setCompleted(completed + 1)
        setAttempts(0)
        if (completed + 1 === expectedPaths.length && !props.revealed)
          props.onComplete?.()
      } else {
        setAttempts(attempts + 1)
      }
      setDrawing(null)
    },
    onPointerCancel: () => setDrawing(null),
  }

  const shownKeys = Object.keys(value).filter(
    (k) =>
      k !== strokesProp &&
      (test !== 'copy' || k !== glyphProp) &&
      typeof value[k] === 'string' &&
      value[k]
  )

  return {
    canvas,
    test,
    targetChar,
    expectedPaths,
    numCompleted,
    allDone,
    attempts,
    drawing,
    shownKeys,
    svgRef,
    events,
    ...props,
  }
}

export const GlyphCard = forwardRef<GlyphHandle, GlyphProps>(
  function GlyphCard(props, ref) {
    const state = useGlyphState(props),
      half = state.canvas / 2

    useImperativeHandle(ref, () => ({ svg: state.svgRef.current }), [
      state.svgRef.current,
    ])

    return (
      <div style={pageStyle}>
        <style>{`@keyframes flash { from { opacity: 0.7 } to { opacity: 0 } }`}</style>
        <div style={promptStyle}>
          {state.test === 'copy' && state.expectedPaths.length > 0 && (
            <svg
              viewBox={`0 0 ${state.canvas} ${state.canvas}`}
              style={{ width: '10vh', height: '10vh' }}
            >
              {state.expectedPaths.map((d, i) => (
                <path key={i} d={d} stroke="#000" {...strokeStyle} />
              ))}
            </svg>
          )}
          {state.shownKeys.map((k) => {
            const v = cleanRuby(state.value[k])
            const display =
              state.test === 'recall' && state.targetChar
                ? v.replaceAll(state.targetChar, '_')
                : v
            return display !== '_' ? (
              <div key={k} style={{ opacity: 0.7 }}>
                {display}
              </div>
            ) : null
          })}
        </div>
        <svg
          ref={state.svgRef}
          viewBox={`0 0 ${state.canvas} ${state.canvas}`}
          style={canvasStyle}
          {...state.events}
        >
          <line x1={half} y1={0} x2={half} y2={state.canvas} {...guideStyle} />
          <line x1={0} y1={half} x2={state.canvas} y2={half} {...guideStyle} />
          {state.revealed &&
            state.expectedPaths.map((_, j) => {
              const i = state.expectedPaths.length - 1 - j
              const d = state.expectedPaths[i]
              const remaining = i - state.numCompleted
              if (remaining < 0) return null
              const t =
                remaining /
                Math.max(1, state.expectedPaths.length - state.numCompleted - 1)
              const gray = Math.round(
                (GUIDE_START + Math.pow(t, GUIDE_EXP) * (GUIDE_END - GUIDE_START)) * 255
              )
              const hex = gray.toString(16).padStart(2, '0')
              return (
                <path
                  key={`guide-${i}`}
                  d={d}
                  stroke={`#${hex}${hex}${hex}`}
                  {...strokeStyle}
                  style={{ transition: 'stroke 0.3s' }}
                />
              )
            })}
          {state.expectedPaths.slice(0, state.numCompleted).map((d, i) => (
            <path key={i} d={d} stroke="#000" {...strokeStyle} />
          ))}
          {state.attempts > 0 && state.expectedPaths[state.numCompleted] && (
            <path
              key={state.attempts}
              d={state.expectedPaths[state.numCompleted]}
              stroke="#d33"
              {...strokeStyle}
              style={{ animation: 'flash 0.6s forwards' }}
            />
          )}
          {state.drawing && state.drawing.length > 1 && (
            <polyline
              points={state.drawing.map((p) => `${p.x},${p.y}`).join(' ')}
              stroke="#3a7"
              {...strokeStyle}
            />
          )}
        </svg>
        <div style={{ opacity: 0.6, fontSize: '0.9em' }}>
          {state.allDone
            ? 'complete'
            : `stroke ${state.numCompleted + 1} / ${state.expectedPaths.length}` +
              (state.attempts > 0
                ? ` — ${state.attempts} miss${state.attempts > 1 ? 'es' : ''}`
                : '')}
        </div>
      </div>
    )
  }
)

function toCanvas(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number
): Point | null {
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const p = pt.matrixTransform(ctm.inverse())

  return { x: p.x, y: p.y }
}

const GUIDE_START = 0.7,
  GUIDE_END = 0.95,
  GUIDE_EXP = 0.2

const pageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  padding: '1em',
  boxSizing: 'border-box',
  gap: 12,
}

const promptStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  fontSize: '1.5em',
  textAlign: 'center',
}

const guideStyle: React.SVGAttributes<SVGElement> = {
  stroke: '#eee',
  strokeWidth: 0.3,
}

const strokeStyle: React.SVGAttributes<SVGElement> = {
  strokeWidth: 4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

const canvasStyle: React.CSSProperties = {
  width: 'min(70vh, 70vw)',
  height: 'min(70vh, 70vw)',
  border: '2px solid #ccc',
  borderRadius: 6,
  background: '#fff',
  touchAction: 'none',
  cursor: 'crosshair',
}
