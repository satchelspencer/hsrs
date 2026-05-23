import { CardState, InitOptions } from './types'
import { keyboardShortcuts } from './keys'

export type { CardState, OutgoingMessage } from './types'
export { keyboardShortcuts } from './keys'
export type { Shortcut } from './keys'

export interface HsrsPlugin {
  cleanup: () => void
  setActiveArea: (el: Element | null) => () => void
}

export function hsrsPlugin(
  options: InitOptions,
  onState: (state: CardState) => void
): HsrsPlugin {
  const { allowedOrigins } = options
  const targetOrigin = allowedOrigins?.[0] || '*'

  const handleMessage = (event: MessageEvent) => {
    if (allowedOrigins && !allowedOrigins.includes(event.origin)) return
    const data = event.data
    if (typeof data === 'object' && data?.type === 'state') {
      onState(data.state)
    }
  }

  const cleanupShortcuts = keyboardShortcuts((shortCut) => {
    window.parent.postMessage({ type: 'shortcut', name: shortCut }, targetOrigin)
  })

  window.addEventListener('message', handleMessage)
  window.parent.postMessage({ type: 'ready' }, targetOrigin)

  return {
    cleanup: () => {
      window.removeEventListener('message', handleMessage)
      cleanupShortcuts()
    },
    setActiveArea: (el: Element | null) => {
      const post = (
        rect: { x: number; y: number; width: number; height: number } | null
      ) => window.parent.postMessage({ type: 'activeArea', rect }, targetOrigin)

      if (!el) {
        post(null)
        return () => {}
      }

      let last = ''
      const update = () => {
        const r = el.getBoundingClientRect(),
          key = `${r.x},${r.y},${r.width},${r.height}`
        if (key !== last) {
          last = key
          post({ x: r.x, y: r.y, width: r.width, height: r.height })
        }
      }

      const observer = new ResizeObserver(update)
      observer.observe(el)
      update()

      return () => {
        observer.disconnect()
        post(null)
      }
    },
  }
}
