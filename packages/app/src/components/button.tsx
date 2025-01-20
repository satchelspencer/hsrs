import React from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'
import * as styles from '../styles'

interface ButtonProps {
  children: React.ReactNode
  onClick: React.MouseEventHandler
  doubleClick?: boolean
  disabled?: boolean
  active?: boolean
  className?: string
}

export function Button(props: ButtonProps) {
  return (
    <button
      disabled={props.disabled}
      onClick={!props.doubleClick ? props.onClick : undefined}
      onDoubleClick={props.doubleClick ? props.onClick : undefined}
      className={cx(linkWrapper(props.disabled, props.active), props.className)}
    >
      {props.children}
    </button>
  )
}

const linkWrapper = (disabled?: boolean, active?: boolean) =>
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
    ${active &&
    css`
      color: ${styles.color.active(0.5)};
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

export function SolidButton(props: ButtonProps) {
  return <Button className={solidWrapper} {...props} />
}

const solidWrapper = cx(css`
  background: ${styles.color(0.97)};
  border: 1px solid ${styles.color(0.95)};
`)

interface RadioGroupProps<T> {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  buttonClassName?: string
}

export function RadioGroup<T>(props: RadioGroupProps<T>) {
  return (
    <div className={radioWrapper}>
      {props.options.map((option, i) => {
        return (
          <Button
            key={i}
            onClick={() => props.onChange(option.value)}
            className={cx(
              selectableButton(props.value === option.value),
              props.buttonClassName
            )}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}

const radioWrapper = cx(css`
  display: flex;
  gap: 16px;
  padding: 1px;
`)

const selectableButton = (selected?: boolean) =>
  cx(css`
    background: ${styles.color(0.95)};
    ${selected &&
    css`
      outline: 2px solid ${styles.color.active()} !important;
    `}
  `)
