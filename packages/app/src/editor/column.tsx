import React, { useEffect, useRef } from 'react'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import * as r from '../redux'
import { ElementEditor } from './element'
import { ElementsList } from './el-list'

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
  }, [!!wrapperRef.current])

  return (
    <div ref={wrapperRef} className={columnWrapper(props.index === -1)}>
      {props.index === -1 ? (
        <ElementsList index={props.index} />
      ) : (
        selection &&
        selection.type === 'element' && (
          <ElementEditor id={selection.id} index={props.index} />
        )
      )}
    </div>
  )
}

const columnWrapper = (first: boolean) =>
  cx(
    styles.surface,
    css`
      width: ${first ? 450 : 450}px;
      border-right: 1px solid ${styles.color(0.93)};
      display: flex;
      flex-direction: column;
      z-index: 1;
      flex: none;
      box-shadow: 1px 0px 10px #00000010;
      background: ${styles.color(0.99)};
    `
  )
