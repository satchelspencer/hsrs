import React from 'react'
import { createRoot } from 'react-dom/client'

import { Editor } from './editor/index'
import { StoreProvider } from './redux'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <StoreProvider>
      <Editor />
    </StoreProvider>
  )
}
