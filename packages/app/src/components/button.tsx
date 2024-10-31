import React from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'
import * as styles from '../styles'

interface ButtonProps {
  children: React.ReactNode
  onClick: React.MouseEventHandler
  disabled?: boolean
}

export function Button(props: ButtonProps) {
  return (
    <button disabled={props.disabled} onClick={props.onClick} className={linkWrapper}>
      {props.children}
    </button>
  )
}

const linkWrapper = cx(css`
  border: none;
  flex: none;
  border-radius: 2px;
  outline-offset: -1px;
  padding: 4px 6px;
  font-size: inherit;
  background:none;
  color:${styles.color.active({l: 0.6, s: 0.2})};
  &:active,
  &:focus {
    outline: 1px solid ${styles.color.active()};
  }
  &:hover {
    color:${styles.color.active(0.6)};
  }
  cursor: pointer;
  align-items: center;
  display: flex;
`)
