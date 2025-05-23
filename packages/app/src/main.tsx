import React, { useEffect } from 'react'
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

const routes = ['learn', 'lib', 'settings']

const darkStyles = `
  html {
    filter: hue-rotate(180deg) invert(1) contrast(0.8);
  }
  * {
    box-shadow: none !important;
  }
`

export function App() {
  const dispatch = r.useDispatch(),
    currentRoute = r.useSelector((s) => s.ui.route),
    dark = r.useSelector((s) => s.settings.vars['dark'])

  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.innerHTML =
      dark === undefined
        ? `
            @media (prefers-color-scheme: dark) {
             ${darkStyles}
            }
          `
        : dark === 'true'
        ? darkStyles
        : ''

    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [dark === undefined, dark === 'true'])

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
    box-shadow: 0 0 13px 0px #00000009;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    font-size: 1.5em;
    gap: 15px;
    @media (max-width: 45em) {
      padding: 4px;
      border-bottom: 1px solid ${styles.color(0.93)};
      border-right: none;
      flex-direction: row;
      justify-content: space-around;
    }
  `
)

const appWrapper = cx(
  styles.fill,
  css`
    display: flex;
    @media (max-width: 45em) {
      flex-direction: column;
    }
  `
)

const appBody = cx(
  css`
    display: block;
    flex: 1;
    position: relative;
  `
)
