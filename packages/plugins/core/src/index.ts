import { CardState, InitOptions } from './types'
import { keyboardShortcuts } from './keys'

export type { CardState } from './types'
export { keyboardShortcuts } from './keys'
export type { Shortcut } from './keys'

export function hsrsPlugin(
  options: InitOptions,
  onState: (state: CardState) => void
): () => void {
  const { allowedOrigins } = options

  const handleMessage = (event: MessageEvent) => {
    if (allowedOrigins && !allowedOrigins.includes(event.origin)) return
    const data = event.data
    if (typeof data === 'object' && data?.type === 'state') {
      onState(data.state)
    }
  }

  const cleanupShortcuts = keyboardShortcuts((shortCut) => {
    const msg = { type: 'shortcut', name: shortCut }
    const targetOrigin = allowedOrigins?.[0] || '*'
    window.parent.postMessage(msg, targetOrigin)
  })

  window.addEventListener('message', handleMessage)

  const msg = { type: 'ready' }
  const targetOrigin = allowedOrigins?.[0] || '*'
  window.parent.postMessage(msg, targetOrigin)

  return () => {
    window.removeEventListener('message', handleMessage)
    cleanupShortcuts()
  }
}
