import React from 'react'
import { createRoot } from 'react-dom/client'
import { css, cx } from '@emotion/css'

import * as styles from './styles'
import { Editor } from './editor/index'
import { StoreProvider } from './redux'
import { Button } from './components/button'
import { Icon } from './components/icon'
import * as r from './redux'
import { Learn } from './learn'
import { Settings } from './settings'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )
}

const routes = ['learn', 'lib', 'history', 'settings']

export function App() {
  const dispatch = r.useDispatch(),
    currentRoute = r.useSelector((s) => s.ui.route)
  return (
    <div className={appWrapper}>
      <div className={appNav}>
        {routes.map((route) => {
          return (
            <Button
              key={route}
              active={currentRoute === route}
              onClick={() => dispatch(r.actions.setRoute({ route }))}
            >
              <Icon name={route as any} />
            </Button>
          )
        })}
      </div>
      <div className={appBody}>
        {currentRoute === 'lib' && <Editor />}
        {currentRoute === 'learn' && <Learn />}
        {currentRoute === 'settings' && <Settings />}
      </div>
    </div>
  )
}

const appNav = cx(
  css`
    border-right: 1px solid ${styles.color(0.93)};
    box-shadow: 0 0 13px 0px #00000014;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    font-size: 1.5em;
    gap: 15px;
  `
)

const appWrapper = cx(
  styles.fill,
  css`
    display: flex;
  `
)

const appBody = cx(
  css`
    display: block;
    flex: 1;
    position: relative;
  `
)
