import React from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Button } from '../components/button'
import * as r from '../redux'
import { Icon } from '../components/icon'

interface RelationEditorProps {
  id: string
  index: number
}

const testRows = 30,
  testCols = 9,
  majorAxis = 75,
  minorAxis = 25

export function RelationEditor(props: RelationEditorProps) {
  const dispatch = r.useDispatch()
  return (
    <div className={relationWrapper}>
      <div className={relationHeader}>
        <Button
          className={backButton}
          onClick={() =>
            dispatch(
              r.actions.updateSelection({
                index: props.index,
                selection: { relation: undefined },
              })
            )
          }
        >
          <Icon name="back" />
        </Button>
      </div>
      <div className={relationBody}>
        <div className={blankout} />
        <div className={tableHeader}>
          {new Array(testCols).fill(0).map((r, j) => (
            <div key={j} className={tableHeaderCell}>
              {j}
            </div>
          ))}
        </div>
        <div className={tableInner}>
          <div className={tableRowHeader}>
            {new Array(testRows).fill(0).map((r, j) => (
              <div key={j} className={tableRowHeaderCell}>
                {j}
              </div>
            ))}
          </div>
          <div className={tableRowsWrapper}>
            {new Array(testRows).fill(0).map((r, i) => (
              <div key={i} className={tableRow}>
                {new Array(testCols).fill(0).map((r, j) => (
                  <div key={j} className={tableCell}></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const blankout = cx(css`
  position: absolute;
  z-index: 2;
  background: ${styles.color(0.99)};
  width: ${majorAxis}px;
  height: ${majorAxis}px;
  border-bottom: 1px solid ${styles.color(0.94)};
  border-right: 1px solid ${styles.color(0.94)};
  box-sizing: border-box;
`)

const tableRow = cx(
  css`
    display: flex;
    height: ${minorAxis}px;
  `
)

const tableCell = cx(
  css`
    height: ${minorAxis}px;
    width: ${minorAxis}px;
    border-bottom: 1px solid ${styles.color(0.94)};
    border-right: 1px solid ${styles.color(0.94)};
    box-sizing: border-box;
    line-height: ${minorAxis}px;
    text-align: right;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `
)

const tableHeaderCell = cx(
  tableCell,
  css`
    height: ${majorAxis}px !important;
    border-color: ${styles.color(0.95)} !important;
    writing-mode: vertical-lr;
    text-orientation: sideways;
    padding: 8px 0px;
  `
)

const tableRowHeaderCell = cx(
  tableCell,
  css`
    border-color: ${styles.color(0.95)} !important;
    width: ${majorAxis}px !important;
    padding: 0px 8px;
  `
)

const tableRowsWrapper = cx(css``)

const tableInner = cx(css`
  display: flex;
  width: max-content;
  align-items: stretch;
  flex: 1;
`)

const tableRowHeader = cx(css`
  width: ${majorAxis}px;
  background: ${styles.color(0.98)};
  align-self: stretch;
  position: sticky;
  left: 0;
`)

const tableHeader = cx(css`
  height: ${majorAxis}px;
  background: ${styles.color(0.98)};
  position: sticky;
  align-self: stretch;
  top: 0;
  z-index: 1;
  display: flex;
  padding-left: ${majorAxis}px;
  min-width: max-content;
`)

const backButton = cx(css`
  align-self: flex-start;
  font-size: 16px;
`)

const relationHeader = cx(css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 25px;
  padding: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid ${styles.color(0.94)};
`)
const relationBody = cx(css`
  flex: 1;
  background: ${styles.color(1)};
  overflow: scroll;
  display: flex;
  flex-direction: column;
`)

const relationWrapper = cx(css`
  height: 100%;
  max-width: 70vw;
  min-width: 450px;
  display: flex;
  flex-direction: column;
`)
