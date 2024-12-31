import React, { useEffect, useRef } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { ElementEditor } from './element'
import { ElementsList } from './el-list'
import { RelationEditor } from './relation'
import { Stats } from '../stats'

interface ColumnProps {
  index: number
  last: boolean
}

export function Column(props: ColumnProps) {
  const selection = r.useSelector((s) =>
      r.selectors.selectSelectionByIndex(s, props.index)
    ),
    wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (wrapperRef.current && props.last) wrapperRef.current.scrollIntoView()
  }, [!!wrapperRef.current, selection?.[0]?.type])

  return (
    <div
      ref={wrapperRef}
      className={columnWrapper(props.index === -1, !!selection?.[0]?.jump)}
    >
      {props.index === -1 ? (
        <ElementsList index={props.index} />
      ) : selection.length === 1 ? (
        selection.map((selection) =>
          selection.type === 'element' ? (
            <ElementEditor
              key={selection.id}
              id={selection.id}
              index={props.index}
              last={props.last}
            />
          ) : selection.type === 'relation' ? (
            <RelationEditor
              key={selection.id}
              id={selection.id}
              index={props.index}
              last={props.last}
            />
          ) : selection.type === 'stats' ? (
            <Stats
              key={selection.id}
              id={selection.id}
              index={props.index}
              last={props.last}
            />
          ) : null
        )
      ) : null}
    </div>
  )
}

const columnWrapper = (first: boolean, jump: boolean) =>
  cx(
    styles.surface,
    css`
      border-right: 1px solid ${styles.color(0.93)};
      display: flex;
      flex-direction: column;
      z-index: 1;
      flex: none;
      &:not(:first-child) {
        box-shadow: 1px 0px 10px #00000010;
      }
      background: ${styles.color(0.985)};
      ${jump &&
      css`
        border-left: 1px solid ${styles.color.active()};
      `}
      overflow: hidden;
    `
  )
