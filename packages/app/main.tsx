import React from 'react'
import { createRoot } from 'react-dom/client'
import { fsrs } from '@hsrs/lib/fsrs'

const App = () => <div>m</div>

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<App />)
}

fsrs().then((f) => {
  console.log('!', f.memoryState([1] as any, [0] as any))
})
