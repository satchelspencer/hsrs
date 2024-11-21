import React from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'
import * as styles from '../styles'

interface ButtonProps {
  children: React.ReactNode
  onClick: React.MouseEventHandler
  disabled?: boolean
  className?: string
}

export function Button(props: ButtonProps) {
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      className={cx(linkWrapper(props.disabled), props.className)}
    >
      {props.children}
    </button>
  )
}

const linkWrapper = (disabled?: boolean) =>
  cx(css`
    border: none;
    flex: none;
    border-radius: 2px;
    outline-offset: -1px;
    padding: 4px 6px;
    font-size: inherit;
    background: none;
    color: ${styles.color.active({ l: 0.6, s: 0.2 })};
    &:active,
    &:focus {
      outline: none;
      //outline: 1px solid ${styles.color.active()};
    }
    &:hover {
      color: ${styles.color.active(0.6)};
    }
    cursor: pointer;
    align-items: center;
    display: flex;
    ${disabled &&
    css`
      pointer-events: none;
      opacity: 0.5;
    `}
  `)

export function WarnButton(props: ButtonProps) {
  return <Button className={warnWrapper} {...props} />
}

const warnWrapper = cx(css`
  color: #9d0006;
  &:hover {
    color: #c50007;
  }
`)
