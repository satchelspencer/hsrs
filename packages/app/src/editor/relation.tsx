import React, { MouseEvent, useEffect, useMemo, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Button } from '../components/button'
import * as r from '../redux'
import { Icon } from '../components/icon'
import * as t from '@hsrs/lib/types'
import {
  findCommonAncestors,
  getElementAndParents,
  getElementChildren,
  getElementParams,
  getNonVirtualDescendents,
} from '@hsrs/lib/props'
import { uid } from '@hsrs/lib/uid'
import { clusterNodes, getCommonAdjs, getRelationAdjs } from '@hsrs/lib/clustering'

interface RelationEditorProps {
  id: string
  index: number
  last: boolean
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
    const childCtxt = getNodeCtxt(node),
      children = opened.includes(childCtxt)
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
  flatOpened: string[],
  order: string[][]
) {
  const params = getElementParams(elementId, elements),
    axes = _.sortBy(Object.keys(params ?? {}))

  return order.map((idList, i) => {
    return expandNodes(
      [params![axes[i]], ...idList].map((id) => ({ id })),
      elements,
      opened,
      flatOpened
    )
  })
}

function getNodeCtxt(node: Node) {
  return node.ctxt ? node.ctxt + '.' + node.id : node.id
}

function inRelation(
  relationId: string,
  params: t.IdMap<string>,
  elements: t.IdMap<t.Element>
): [boolean, string | null] {
  const nonVirtuals = getNonVirtualDescendents(relationId, elements),
    paramParentLists = _.mapValues(params, (p) => getElementAndParents(p, elements))

  let indirectMatch = false,
    directMatch: string | null = null
  for (const nonVir of nonVirtuals) {
    const nonVirParams = elements[nonVir].params!,
      matchingParams = _.mapValues(paramParentLists, (parents, paramName) =>
        parents.filter((p) => nonVirParams[paramName] === p)
      )
    if (_.every(_.values(matchingParams), (p) => p.length)) indirectMatch = true
    if (_.every(_.keys(matchingParams), (k) => matchingParams[k].includes(params[k]))) {
      directMatch = nonVir
      break
    }
  }
  return [indirectMatch, directMatch]
}

const diffs = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

export function RelationEditor(props: RelationEditorProps) {
  const elements = r.useSelector((s) => s.deck.elements)
  const showNames = (any: any) => {
      return JSON.parse(
        JSON.stringify(any).replace(/"([\w]{10,11})"/g, (v, x) => {
          return elements[x] ? '"' + elements[x].name + '"' : v
        })
      )
    },
    dispatch = r.useDispatch(), //(act) => console.log(act.type, JSON.stringify(showNames(act.payload), null, 2)), // r.useDispatch(),
    params = getElementParams(props.id, elements),
    [opened, setOpened] = useState<string[]>([]),
    [flatOpened, setFlatOpened] = useState<string[]>([]),
    [clusterIndexes, setClusterIndexesRaw] = useState([0, 0]),
    [clusterSelection, setClusterSelection] = useState<{ index: number; axis: number }>(),
    [clusterSeed, setClusterSeed] = useState(0),
    adjs = getRelationAdjs(props.id, elements),
    clusters = useMemo(() => clusterNodes(adjs), [clusterIndexes.join('.'), clusterSeed]),
    thisCluster = clusters.map((cs, index) => {
      return cs[Math.max(Math.min(cs.length - 1, clusterIndexes[index]), 0)]
    }),
    thisBoundaries =
      opened.length || flatOpened.length
        ? [[], []]
        : thisCluster.map((c) => [
            0,
            ...c.map((v, i) => _.sumBy(_.take(c, i + 1), (v) => v.length)),
          ]),
    thisOrder = thisCluster.map((c) => _.flatten(c)),
    [rows, cols] = getNodes(props.id, elements, opened, flatOpened, thisOrder),
    axes = _.sortBy(Object.keys(params ?? {})),
    [rowName, colName] = axes

  const [hoverCoord, setHoverCoord] = useState<[number, number]>()

  const toggleOpen = (node: Node, flat: boolean) => {
    const ctxt = getNodeCtxt(node),
      used = opened.includes(ctxt) || flatOpened.includes(ctxt)
    if (!flat || used)
      setOpened((opened) =>
        used ? opened.filter((v) => v.indexOf(ctxt) === -1) : [...opened, ctxt]
      )
    if (flat || used)
      setFlatOpened((flatOpened) =>
        used ? flatOpened.filter((v) => v.indexOf(ctxt) === -1) : [...flatOpened, ctxt]
      )
  }

  const cancel = (e: MouseEvent) => {
    if (e.shiftKey) e.preventDefault()
  }

  const setClusterIndexes = (value: React.SetStateAction<number[]>) => {
    setClusterIndexesRaw((s) => {
      const n = _.isFunction(value) ? value(s) : value
      return n.map((v, i) => Math.min(Math.max(v, 0), clusters[i].length - 1))
    })
  }

  useEffect(() => {
    if (props.last) {
      const handler = (e: KeyboardEvent) => {
        if (e.key.includes('Arrow')) {
          setClusterIndexes((i) => i.map((v, index) => v + diffs[e.key][index]))
          e.preventDefault()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [props.last])

  const toggleClusterSelected = (node: Node, axis: number) => {
    const index = thisCluster[axis].findIndex((c) => c.includes(node.id))
    if (
      index === -1 ||
      (clusterSelection?.axis === axis && clusterSelection.index === index)
    )
      setClusterSelection(undefined)
    else setClusterSelection({ index, axis })
  }

  useEffect(() => {
    setClusterSelection(undefined)
  }, [clusterIndexes])

  const addToCluster = (axis: number, cluster: number) => {
    const clusterValues = thisCluster[axis][cluster],
      newElId = uid(),
      commonAdjs = getCommonAdjs(clusterValues, adjs[axis]),
      thisAxis = axes[axis],
      otherAxis = axes[(axis + 1) % 2],
      common = findCommonAncestors(params![thisAxis], clusterValues, elements)

    if (!common) return

    dispatch(
      r.actions.createElement({
        id: newElId,
        element: { name: 'untitled-' + newElId, parents: [common] },
      })
    )
    for (const commonAdj of commonAdjs) {
      dispatch(
        r.actions.createElement({
          id: uid(),
          element: {
            name: elements[commonAdj].name + '-' + newElId,
            parents: [props.id],
            params: {
              [thisAxis]: newElId,
              [otherAxis]: commonAdj,
            },
          },
        })
      )
    }
    setClusterSeed(Math.random())
    dispatch(
      r.actions.setSelection({
        index: props.index + 1,
        selection: [{ id: newElId, type: 'element' }],
      })
    )
  }

  const clearCluster = (axis: number, cluster: number) => {
    const clusterValues = thisCluster[axis][cluster],
      commonAdjs = getCommonAdjs(clusterValues, adjs[axis]),
      otherAxis = (axis + 1) % 2
    for (const clusterEl of clusterValues) {
      for (const adjEl of commonAdjs) {
        const [, matchEl] = inRelation(
          props.id,
          { [axes[otherAxis]]: adjEl, [axes[axis]]: clusterEl },
          elements
        )
        if (matchEl) dispatch(r.actions.deleteElement({ id: matchEl }))
      }
    }
    setClusterSeed(Math.random())
  }

  const mergeCluster = (axis: number, cluster: number) => {
    const clusterValues = thisCluster[axis][cluster],
      commonAdjs = getCommonAdjs(clusterValues, adjs[axis]),
      thisAxis = axes[axis],
      otherAxis = axes[(axis + 1) % 2],
      common = findCommonAncestors(params![thisAxis], clusterValues, elements)

    if (!common) return

    const newElId = uid()
    console.log('create new')
    dispatch(
      r.actions.createElement({
        id: newElId,
        element: { name: 'untitled-group-' + newElId, parents: [common], virtual: true },
      })
    )
    for (const commonAdj of commonAdjs) {
      console.log('create new adj', elements[commonAdj].name)
      dispatch(
        r.actions.createElement({
          id: uid(),
          element: {
            name: elements[commonAdj].name + '-' + newElId,
            parents: [props.id],
            params: {
              [thisAxis]: newElId,
              [otherAxis]: commonAdj,
            },
          },
        })
      )
      for (const clusterValue of clusterValues) {
        const [, matchEl] = inRelation(
          props.id,
          { [otherAxis]: commonAdj, [thisAxis]: clusterValue },
          elements
        )
        if (matchEl) {
          console.log(
            'remove deep adj',
            elements[commonAdj].name,
            elements[clusterValue].name
          )
          dispatch(r.actions.deleteElement({ id: matchEl }))
        }
      }
    }
    for (const clusterValue of clusterValues) {
      const clusterElement = elements[clusterValue]
      console.log('setParent', elements[clusterValue].name)
      dispatch(
        r.actions.updateElement({
          id: clusterValue,
          element: { ...clusterElement, parents: [...clusterElement.parents, newElId] },
        })
      )
    }
    setClusterSeed(Math.random())
  }

  const splitCluster = (axis: number, cluster: number) => {
    const clusterValue = thisCluster[axis][cluster][0],
      commonAdjs = adjs[axis][clusterValue],
      otherAxisIndex = (axis + 1) % 2,
      thisAxis = axes[axis],
      otherAxis = axes[otherAxisIndex]

    for (const adj of commonAdjs) {
      const [, matchEl] = inRelation(
        props.id,
        { [otherAxis]: adj, [thisAxis]: clusterValue },
        elements
      )
      if (matchEl) {
        console.log('remove root adj', elements[adj].name, elements[clusterValue].name)
        dispatch(r.actions.deleteElement({ id: matchEl }))
      }

      for (const elementId of Object.keys(elements)) {
        const element = elements[elementId]
        if (element.parents.includes(clusterValue)) {
          if (!adjs[axis][elementId]?.includes(adj)) {
            console.log(element.name, elements[adj].name)
            console.log('create new adj', elements[adj].name)
            dispatch(
              r.actions.createElement({
                id: uid(),
                element: {
                  name: elements[adj].name + '-' + element.name,
                  parents: [props.id],
                  params: {
                    [thisAxis]: elementId,
                    [otherAxis]: adj,
                  },
                },
              })
            )
          }
        }
      }
    }
    setClusterSeed(Math.random())
  }

  const handleNodeClick = (node: Node, axis: number) => (e: React.MouseEvent) => {
      toggleClusterSelected(node, axis)
    },
    handleNodeDoubleClick = (node: Node) => (e: React.MouseEvent) => {
      dispatch(
        r.actions.setSelection({
          index: props.index + 1,
          selection: [{ id: node.id, type: 'element' }],
        })
      )
    }

  return (
    <div className={relationWrapper}>
      <div className={relationHeader}>
        <Button
          className={backButton}
          onClick={() =>
            dispatch(r.actions.setSelection({ index: props.index, selection: [] }))
          }
        >
          <Icon name="back" />
        </Button>
        <div className={relationActions}>
          <Button
            disabled={!clusterSelection}
            onClick={() => {
              if (clusterSelection)
                clearCluster(clusterSelection.axis, clusterSelection.index)
            }}
          >
            <Icon name="close" />
          </Button>
          <Button
            disabled={
              !clusterSelection ||
              thisCluster[clusterSelection.axis][clusterSelection.index].length !== 1 ||
              !elements[thisCluster[clusterSelection.axis][clusterSelection.index][0]]
                .virtual
            }
            onClick={() => {
              if (clusterSelection)
                splitCluster(clusterSelection.axis, clusterSelection.index)
            }}
          >
            <Icon name="split" />
          </Button>
          <Button
            disabled={
              !clusterSelection ||
              thisCluster[clusterSelection.axis][clusterSelection.index].length === 1
            }
            onClick={() => {
              if (clusterSelection)
                mergeCluster(clusterSelection.axis, clusterSelection.index)
            }}
          >
            <Icon name="merge" />
          </Button>
          <Button
            disabled={!clusterSelection}
            onClick={() => {
              if (clusterSelection)
                addToCluster(clusterSelection.axis, clusterSelection.index)
            }}
          >
            <Icon name="plus" />
          </Button>
        </div>
      </div>
      <div className={relationBody} onMouseOut={() => setHoverCoord(undefined)}>
        <div className={blankout}>
          <IndexControl value={clusterIndexes} onChange={setClusterIndexes} index={0} />
          <IndexControl value={clusterIndexes} onChange={setClusterIndexes} index={1} />
          <div style={{ right: 2, bottom: 2, position: 'absolute', opacity: 0.7 }}>
            <Button
              onClick={() => {
                setClusterSeed(Math.random())
                setOpened([])
                setFlatOpened([])
              }}
            >
              <Icon name="matrix" />
            </Button>
          </div>
        </div>
        <div className={tableHeader}>
          {cols.map((node, i) => {
            const nodeCtxt = getNodeCtxt(node)
            return (
              <div
                key={i}
                className={tableHeaderCell(
                  !node.indirect,
                  thisBoundaries[1].includes(i - 1),
                  thisCluster[1].findIndex((c) => c.includes(node.id)) ===
                    clusterSelection?.index && clusterSelection.axis === 1
                )}
                onMouseDown={cancel}
                onClick={handleNodeClick(node, 1)}
                onDoubleClick={handleNodeDoubleClick(node)}
              >
                <span>
                  {node.ctxt
                    ?.split('.')
                    .map(() => ' ')
                    .join('')}
                </span>
                <div
                  style={{
                    opacity: elements[node.id].virtual ? 1 : 0,
                    marginLeft: -6,
                    marginTop: (node.ctxt?.split('.')?.length ?? 0) * 4,
                  }}
                >
                  <Button
                    onClick={(e) => {
                      elements[node.id].virtual && toggleOpen(node, e.shiftKey)
                      e.stopPropagation()
                    }}
                  >
                    <Icon
                      name={
                        opened.includes(nodeCtxt) || flatOpened.includes(nodeCtxt)
                          ? 'caret-left'
                          : 'caret-down'
                      }
                    />
                  </Button>
                </div>{' '}
                <span className={headerName}>{elements[node.id].name}</span>
              </div>
            )
          })}
          <div className={tableHeaderCell(false, false, false)} />
        </div>
        <div className={tableInner}>
          <div className={tableRowHeader}>
            {rows.map((node, i) => {
              const nodeCtxt = getNodeCtxt(node)
              return (
                <div
                  key={i}
                  className={tableRowHeaderCell(
                    !node.indirect,
                    thisBoundaries[0].includes(i),
                    thisCluster[0].findIndex((c) => c.includes(node.id)) ===
                      clusterSelection?.index && clusterSelection.axis === 0
                  )}
                  onMouseDown={cancel}
                  onClick={handleNodeClick(node, 0)}
                  onDoubleClick={handleNodeDoubleClick(node)}
                >
                  <span className={headerName}>{elements[node.id].name}</span>{' '}
                  <div
                    style={{
                      opacity: elements[node.id].virtual ? 1 : 0,
                      marginTop: 4,
                      marginRight: (node.ctxt?.split('.')?.length ?? 0) * 4,
                    }}
                  >
                    <Button
                      onClick={(e) => {
                        elements[node.id].virtual && toggleOpen(node, e.shiftKey)
                        e.stopPropagation()
                      }}
                    >
                      <Icon
                        name={
                          opened.includes(nodeCtxt) || flatOpened.includes(nodeCtxt)
                            ? 'caret-down'
                            : 'caret-right'
                        }
                      />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={tableRowsWrapper}>
            {rows.map((rowNode, i) => (
              <div key={i} className={tableRow}>
                {cols.map((colNode, j) => {
                  const [matches, direct] = inRelation(
                    props.id,
                    { [rowName]: rowNode.id, [colName]: colNode.id },
                    elements
                  )
                  return (
                    <div
                      key={j}
                      className={tableCell(
                        !direct && matches,
                        hoverCoord?.[0] === i || hoverCoord?.[1] === j,
                        thisBoundaries[1].includes(j),
                        thisBoundaries[0].includes(i)
                      )}
                      onMouseOver={() => setHoverCoord([i, j])}
                      onClick={() => {
                        if (direct) {
                          dispatch(r.actions.deleteElement({ id: direct }))
                        } else if (!matches) {
                          dispatch(
                            r.actions.createElement({
                              id: uid(),
                              element: {
                                name:
                                  elements[rowNode.id].name +
                                  '-' +
                                  elements[colNode.id].name,
                                parents: [props.id],
                                params: {
                                  [rowName]: rowNode.id,
                                  [colName]: colNode.id,
                                },
                              },
                            })
                          )
                        }
                      }}
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

interface IndexControlProps {
  value: number[]
  onChange: (v: number[]) => void
  index: number
}

function IndexControl(props: IndexControlProps) {
  const inc = (amount: number) => {
    const nv = [...props.value]
    nv[props.index] = props.value[props.index] + amount
    props.onChange(nv)
  }
  return (
    <div className={indexControl(!!props.index)}>
      <Button onClick={() => inc(1)}>
        <Icon name={props.index ? 'caret-up' : 'caret-right'} />
      </Button>
      <span className={controlNumber}>{props.value[props.index]}</span>
      <Button onClick={() => inc(-1)}>
        <Icon name={props.index ? 'caret-down' : 'caret-left'} />
      </Button>
    </div>
  )
}

const controlNumber = cx(css`
  opacity: 0.7;
  font-size: 0.8em;
`)

const indexControl = (vert: boolean) =>
  cx(css`
    position: absolute;
    display: flex;
    flex-direction: ${vert ? 'column' : 'row-reverse'};
    ${vert ? 'right' : 'bottom'}: 0px;
    align-items: center;
    font-size: 16px;
    ${vert ? 'height' : 'width'}: 100%;
    justify-content: center;
    gap: 2px;
    background: ${styles.color(0.955)};
  `)

const headerName = cx(css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`)

const blankout = cx(css`
  position: absolute;
  z-index: 2;
  background: ${styles.color(0.97)};
  width: ${majorAxis - 27}px;
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
    border-bottom: 1px solid ${styles.color(0.98)};
    border-right: 1px solid ${styles.color(0.98)};
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

const tableCell = (
  indirect: boolean,
  hover: boolean,
  rowBoundary: boolean,
  colBoundary: boolean
) =>
  cx(
    tableCellBase,
    css`
      font-size: 16px;
      justify-content: center;
      color: ${!indirect ? styles.color(0.5) : styles.color(0.8)};
      ${indirect &&
      css`
        cursor: not-allowed !important;
      `}
      ${hover &&
      css`
        background: ${styles.color.active(0.99)};
      `}
      ${rowBoundary &&
      css`
        border-right-color: ${styles.color(0.93)} !important;
      `}
      ${colBoundary &&
      css`
        border-bottom-color: ${styles.color(0.93)} !important;
      `}
    `
  )

const headerCellBase = (direct: boolean, boundary: boolean, selected: boolean) =>
  cx(
    tableCellBase,
    css`
      user-select: none;
      border-color: ${boundary ? styles.color(0.91) : styles.color(0.97)} !important;
      color: ${selected
        ? styles.color.active(0.7)
        : direct
        ? styles.color(0.3)
        : styles.color(0.6)};
    `
  )

const tableHeaderCell = (direct: boolean, boundary: boolean, selected: boolean) =>
  cx(
    headerCellBase(direct, boundary, selected),
    css`
      height: ${majorAxis}px !important;
      border-bottom-color: transparent !important;
      border-right: 1px solid ${styles.color(0.94)};
      writing-mode: vertical-lr;
      text-orientation: sideways;
      transform: rotate(210deg) translate(-32px, 28px);
      padding: 16px 0px;
      text-align: left;
      justify-content: flex-start;
      & > * {
        transform: translate(4px, -5px);
      }
    `
  )

const tableRowHeaderCell = (direct: boolean, boundary: boolean, selected: boolean) =>
  cx(
    headerCellBase(direct, boundary, selected),
    css`
      border-right-color: transparent !important;
      width: ${majorAxis - 27}px !important;
      padding: 0px 8px;
      text-align: right;
      justify-content: flex-end;
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
  width: ${majorAxis - 27}px;
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
  padding-left: ${majorAxis - 27}px;
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

const relationActions = cx(css`
  display: flex;
  align-items: center;
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
