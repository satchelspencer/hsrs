import React from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'
import * as styles from '../styles'

interface LabelGroupProps {
  items: (
    | [React.ReactNode, React.ReactNode]
    | [React.ReactNode, React.ReactNode, boolean]
    | false
  )[]
  vert?: boolean
  flush?: boolean
}

export function LabelGroup(props: LabelGroupProps) {
  const altItems = props.items.map((m) => m[0])
  return (
    <>
      {props.items.map(
        (item, i) =>
          item && (
            <LabelField
              vert={props.vert}
              vertOverride={item[2]}
              flush={props.flush}
              key={i}
              title={item[0]}
              altNames={altItems}
            >
              {item[1]}
            </LabelField>
          )
      )}
    </>
  )
}

interface LabelFieldProps {
  title: React.ReactNode
  children: React.ReactNode
  altNames?: React.ReactNode[]
  vert?: boolean
  vertOverride?: boolean
  flush?: boolean
}

function LabelField(props: LabelFieldProps) {
  const ownVert = !!(props.vertOverride ?? props.vert)
  return (
    <div className={labelFieldWrapper(ownVert)}>
      <div className={labelFieldTitle}>
        {props.title}
        {!props.vert &&
          props.altNames?.map((name, i) => (
            <div style={{ height: 0, overflow: 'hidden' }} key={i}>
              {name}
            </div>
          ))}
      </div>
      <div className={labelFieldChildren(ownVert, !!props.flush)}>{props.children}</div>
    </div>
  )
}

const labelFieldWrapper = (vert: boolean) =>
  cx(css`
    display: flex;
    align-items: center;
    ${vert &&
    css`
      flex-direction: column;
      align-items: stretch;
      gap: 5px;
    `}
  `)

const labelFieldTitle = cx(css`
  flex: none;
  align-self: flex-start;
  padding: 4px 6px;
`)

const labelFieldChildren = (vert: boolean, flush: boolean) =>
  cx(css`
    flex: 1;
    overflow: hidden;
    ${vert &&
    css`
      margin-left: 4px;

      ${!flush &&
      css`
        border-left: 1px solid ${styles.color(0.92)};
        padding-left: 4px;
      `}
    `}
  `)
