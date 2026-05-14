export type Shortcut = '1' | '2' | '3' | '4' | 'next' | 'undo'

export function keyboardShortcuts(cb: (shortCut: Shortcut) => void) {
  const getShortCut = (event: KeyboardEvent): Shortcut | undefined => {
    if (event.code === 'Space') return 'next'
    else if (event.code === 'Digit1') return '1'
    else if (event.code === 'Digit2') return '2'
    else if (event.code === 'Digit3') return '3'
    else if (event.code === 'Digit4') return '4'
    else if (event.code === 'KeyZ' && (event.metaKey || event.ctrlKey)) return 'undo'
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const shortCut = getShortCut(event)
    if (shortCut) {
      cb(shortCut)
      event.preventDefault()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
  }
}
