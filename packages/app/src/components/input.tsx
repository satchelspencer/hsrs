import React from 'react'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'

interface TextInputProps {
  value?: string
  onChange?: (value?: string) => void
}

export function TextInput(props: TextInputProps) {
  return (
    <input
      className={cx(input)}
      value={props.value ?? ''}
      autoFocus
      onChange={(e) => props.onChange?.(e.target.value || undefined)}
    />
  )
}

const input = cx(
  styles.surface,
  css`
    border: 1px solid ${styles.color(0.9)};
    border-radius: 2px;
    outline-offset: -1px;
    padding: 4px 6px;
    font-size: inherit;
    background: ${styles.color(1)};
    &:active,
    &:focus {
      outline: 1px solid ${styles.color.active()};
    }
  `
)
