import React, { MouseEvent, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Button } from '../components/button'
import * as r from '../redux'
import { Icon } from '../components/icon'
import * as t from '@hsrs/lib/types'
import {
  getElementAndParents,
  getElementChildren,
  getElementParams,
  getNonVirtualDescendents,
} from '@hsrs/lib/props'

interface RelationEditorProps {
  id: string
  index: number
}

const majorAxis = 180,
  minorAxis = 30

type Node = { id: string; indirect?: boolean; ctxt?: string }

function expandNodes(
  nodes: Node[],
  elements: t.IdMap<t.Element>,
  opened: string[],
  flatOpened: string[]
) {
  const res: Node[] = []
  for (const node of nodes) {
    res.push(node)
    const childCtxt = node.ctxt ? node.ctxt + '.' + node.id : node.id
    const children = opened.includes(childCtxt)
      ? getElementChildren(node.id, elements)
      : flatOpened.includes(childCtxt)
      ? getNonVirtualDescendents(node.id, elements)
      : []
    res.push(
      ...expandNodes(
        children.map((c) => ({ id: c, indirect: true, ctxt: childCtxt })),
        elements,
        opened,
        flatOpened
      )
    )
  }
  return res
}

function getNodes(
  elementId: string,
  elements: t.IdMap<t.Element>,
  opened: string[],
  flatOpened: string[]
) {
  const element = elements[elementId],
    nonVirtuals = getNonVirtualDescendents(elementId, elements),
    axes = _.sortBy(Object.keys(element.params ?? {}))

  const nodes: Node[][] = [[], []]
  for (const axisIndex in axes) {
    nodes[axisIndex].push({ id: element.params![axes[axisIndex]] })
  }

  for (const nonVirtualId of nonVirtuals) {
    const veParams = getElementParams(nonVirtualId, elements)
    for (const axisIndex in axes) {
      nodes[axisIndex].push({ id: veParams[axes[axisIndex]] })
    }
  }

  return nodes.map((nodeList, i) => {
    const uniq = _.uniqBy(nodeList, (d) => d.id)
    return expandNodes(uniq, elements, opened, flatOpened)
  })
}

function inRelation(
  relationId: string,
  params: t.IdMap<string>,
  elements: t.IdMap<t.Element>
) {
  const nonVirtuals = getNonVirtualDescendents(relationId, elements),
    paramParentLists = _.mapValues(params, (p) => getElementAndParents(p, elements))

  let indirectMatch = false,
    directMatch = false
  for (const nonVir of nonVirtuals) {
    const nonVirParams = elements[nonVir].params!,
      matchingParams = _.mapValues(paramParentLists, (parents, paramName) =>
        parents.filter((p) => nonVirParams[paramName] === p)
      )
    if (_.every(_.values(matchingParams), (p) => p.length)) indirectMatch = true
    if (_.every(_.keys(matchingParams), (k) => matchingParams[k].includes(params[k]))) {
      directMatch = true
      break
    }
  }
  return [indirectMatch, directMatch]
}

export function RelationEditor(props: RelationEditorProps) {
  const dispatch = r.useDispatch(),
    elements = r.useSelector((s) => s.deck.elements),
    element = elements[props.id],
    [opened, setOpened] = useState<string[]>([]),
    [flatOpened, setFlatOpened] = useState<string[]>([]),
    [rows, cols] = getNodes(props.id, elements, opened, flatOpened),
    [rowName, colName] = _.sortBy(Object.keys(element.params ?? {}))

  const [hoverCoord, setHoverCoord] = useState<[number, number]>()

  const toggleOpen = (node: Node, flat: boolean) => {
    const ctxt = node.ctxt ? node.ctxt + '.' + node.id : node.id,
      used = opened.includes(ctxt) || flatOpened.includes(ctxt)
    if (!flat || used)
      setOpened((opened) => (used ? _.without(opened, ctxt) : [...opened, ctxt]))
    if (flat || used)
      setFlatOpened((flatOpened) =>
        used ? _.without(flatOpened, ctxt) : [...flatOpened, ctxt]
      )
  }

  const cancel = (e: MouseEvent) => {
    if (e.shiftKey) e.preventDefault()
  }

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
      <div className={relationBody} onMouseOut={() => setHoverCoord(undefined)}>
        <div className={blankout} />
        <div className={tableHeader}>
          {cols.map((node, i) => (
            <div
              key={node.id + node.ctxt}
              className={tableHeaderCell(!node.indirect)}
              onMouseDown={cancel}
              onClick={(e) => elements[node.id].virtual && toggleOpen(node, e.shiftKey)}
            >
              {node.ctxt?.split('.').map(() => (
                <>&nbsp;</>
              ))}
              <div style={{ opacity: elements[node.id].virtual ? 1 : 0, marginLeft: -6 }}>
                <Icon
                  name={
                    opened.includes(node.id) || flatOpened.includes(node.id)
                      ? 'caret-left'
                      : 'caret-down'
                  }
                />
              </div>{' '}
              <span>{elements[node.id].name}</span>
            </div>
          ))}
        </div>
        <div className={tableInner}>
          <div className={tableRowHeader}>
            {rows.map((node, i) => (
              <div
                key={node.id + node.ctxt}
                className={tableRowHeaderCell(!node.indirect)}
                onMouseDown={cancel}
                onClick={(e) => elements[node.id].virtual && toggleOpen(node, e.shiftKey)}
              >
                <span>{elements[node.id].name}</span>{' '}
                <div style={{ opacity: elements[node.id].virtual ? 1 : 0, marginTop: 4 }}>
                  <Icon
                    name={
                      opened.includes(node.id) || flatOpened.includes(node.id)
                        ? 'caret-down'
                        : 'caret-right'
                    }
                  />
                </div>
                {node.ctxt?.split('.').map(() => (
                  <>&nbsp;</>
                ))}
              </div>
            ))}
          </div>
          <div className={tableRowsWrapper}>
            {rows.map((rowNode, i) => (
              <div key={rowNode.id + rowNode.ctxt} className={tableRow}>
                {cols.map((colNode, j) => {
                  const [matches, direct] = inRelation(
                    props.id,
                    { [rowName]: rowNode.id, [colName]: colNode.id },
                    elements
                  )
                  return (
                    <div
                      key={colNode.id + colNode.ctxt}
                      className={tableCell(
                        !direct && matches,
                        hoverCoord?.[0] === i || hoverCoord?.[1] === j
                      )}
                      onMouseOver={() => setHoverCoord([i, j])}
                    >
                      {matches && <Icon name="check" />}
                    </div>
                  )
                })}
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
  height: ${majorAxis - 27}px;
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

const tableCellBase = cx(
  css`
    height: ${minorAxis}px;
    width: ${minorAxis}px;
    border-bottom: 1px solid ${styles.color(0.94)};
    border-right: 1px solid ${styles.color(0.94)};
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    line-height: ${minorAxis}px;
    display: flex;
    align-items: center;
    cursor: pointer;
  `
)

const tableCell = (indirect: boolean, hover: boolean) =>
  cx(
    tableCellBase,
    css`
      font-size: 16px;
      justify-content: center;
      color: ${!indirect ? styles.color.active(0.5) : styles.color(0.8)};
      ${indirect &&
      css`
        cursor: not-allowed !important;
      `}
      ${hover &&
      css`
        background: ${styles.color.active(0.99)};
      `}
    `
  )

const tableHeaderCell = (direct: boolean) =>
  cx(
    tableCellBase,
    css`
      height: ${majorAxis}px !important;
      border-color: ${styles.color(0.94)} !important;
      border-bottom-color: transparent !important;
      writing-mode: vertical-lr;
      text-orientation: sideways;
      transform: rotate(210deg) translate(-32px, 28px);
      padding: 16px 0px;
      text-align: left;
      justify-content: flex-start;
      color: ${direct ? styles.color(0.3) : styles.color(0.6)};
      & > * {
        transform: translate(2px, -5px);
      }
    `
  )

const tableRowHeaderCell = (direct: boolean) =>
  cx(
    tableCellBase,
    css`
      border-color: ${styles.color(0.94)} !important;
      border-right-color: transparent !important;
      width: ${majorAxis}px !important;
      padding: 0px 8px;
      text-align: right;
      justify-content: flex-end;
      color: ${direct ? styles.color(0.3) : styles.color(0.6)};
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
  border-right: 1px solid ${styles.color(0.94)} !important;
  box-sizing: border-box;
`)

const tableHeader = cx(css`
  height: ${majorAxis - 27}px;
  background: ${styles.color(0.98)};
  position: sticky;
  align-self: stretch;
  top: 0;
  z-index: 1;
  display: flex;
  padding-left: ${majorAxis}px;
  padding-right: 86px;
  min-width: max-content;
  border-bottom: 1px solid ${styles.color(0.94)} !important;
  box-sizing: border-box;
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
