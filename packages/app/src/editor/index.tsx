import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import { Column } from './column'
import * as r from '../redux'
import { Selection } from '../redux/ui'

function getSelectionKey(selection: Selection) {
  return [selection.id, selection.type].join('.')
}

export function Editor() {
  const selections = r.useSelector((s) => r.selectors.selectSelections(s)),
    selDepth = selections.length

  const wrapperRef = useRef<HTMLDivElement>(null),
    innerRef = useRef<HTMLDivElement>(null),
    [containerWidth, setContainerWidth] = useState<number>(0)

  const getNaturalContentWidth = (): number =>
    innerRef.current
      ? Array.from(innerRef.current.children).reduce((sum, child) => {
          return sum + (child as HTMLElement).offsetWidth
        }, 0)
      : 0

  useLayoutEffect(() => {
    if (innerRef.current && wrapperRef.current) {
      const naturalWidth = getNaturalContentWidth(),
        canCompress =
          wrapperRef.current.scrollLeft + naturalWidth <= wrapperRef.current.clientWidth
      setContainerWidth((prevWidth) =>
        canCompress ? naturalWidth : Math.max(prevWidth, naturalWidth)
      )
    }
  }, [selDepth])

  useEffect(() => {
    if (!wrapperRef.current) return

    const handleScroll = _.debounce(() => {
      if (!innerRef.current || !wrapperRef.current) return
      const naturalWidth = getNaturalContentWidth()
      if (naturalWidth >= wrapperRef.current.clientWidth + wrapperRef.current.scrollLeft)
        setContainerWidth(naturalWidth)
    }, 200)

    handleScroll()

    wrapperRef.current.addEventListener('scroll', handleScroll)
    return () => wrapperRef.current?.removeEventListener('scroll', handleScroll)
  }, [containerWidth, innerRef.current])

  const selectionKeys = useMemo(() => {
    const usedKeys: { [key: string]: number } = {},
      keys: string[] = []
    selections.forEach((selection, index) => {
      const key = selection?.[0] ? getSelectionKey(selection[0]) : index
      usedKeys[key] = (usedKeys[key] ?? 0) + 1
      keys.push(key + ':' + usedKeys[key])
    })
    return keys
  }, [selections])

  return (
    <div ref={wrapperRef} className={editorWrapper}>
      <div
        ref={innerRef}
        className={editorInner}
        style={{ width: containerWidth || 'auto' }}
      >
        {new Array(selDepth + 1).fill(0).map((_, index) => {
          const realIndex = selDepth - index - 1
          return (
            <Column
              key={selectionKeys[realIndex] ?? 'root'}
              index={realIndex}
              last={!index}
            />
          )
        })}
      </div>
    </div>
  )
}

const editorWrapper = cx(
  styles.fill,
  styles.surfaceTone,
  css`
    display: block;
    overflow-x: scroll;
  `
)

const editorInner = cx(
  styles.fill,
  css`
    flex-direction: row-reverse;
    justify-content: flex-end;
  `
)
