import React, { useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import { Icon } from '../components/icon'
import * as r from '../redux'
import { uid } from '@hsrs/lib/uid'
import { Button } from '../components/button'
import { Selection } from '../redux/ui'
import { Element } from '@hsrs/lib/types'
import CodeInput from '../components/code'

interface ElementsListProps {
  parentId?: string
  index: number
}

export function ElementsList(props: ElementsListProps) {
  const [showVirtual, setShowVirtual] = useState(true),
    allElementIds = r.useSelector((state) =>
      r.selectors.selectElementIdsByParent(state, props.parentId)
    ),
    nonVirtualElementIds = r.useSelector((state) =>
      r.selectors.selectNonVirtialElementIdsByParent(state, props.parentId)
    ),
    elementIds = showVirtual ? allElementIds : nonVirtualElementIds,
    elements = r.useSelector((s) => s.deck.elements),
    nextSelection = r.useSelector((s) =>
      r.selectors.selectSelectionByIndex(s, props.index + 1)
    ),
    dispatch = r.useDispatch()

  return (
    <div className={elementsListWrapper}>
      <div className={sidebarListHeader}>
        <div className={sideBarListInner}>
          <div>{props.parentId ? 'Children' : 'Base'}</div>
          <Button onClick={() => setShowVirtual((v) => !v)}>
            <Icon name={showVirtual ? 'folder-eye' : 'folder-off'} />
          </Button>
        </div>
        <ElListActions {...props} />
      </div>
      <div className={elementsListInner}>
        {elementIds.map((elementId, index) => {
          const element = elements[elementId],
            selected = !!nextSelection?.find((s) => s.id === elementId)
          return (
            <ElementListItem
              key={elementId}
              name={element.name}
              virtual={!!element.virtual}
              selected={selected}
              onClick={(e) => {
                const otherSelected =
                  e.shiftKey || e.metaKey
                    ? (nextSelection ?? []).filter((s) => s.id !== elementId)
                    : []

                const lastOther = _.last(otherSelected),
                  lastOtherIndex = lastOther && elementIds.indexOf(lastOther.id),
                  rangeMin = Math.min(lastOtherIndex ?? 0, index),
                  rangeMax = Math.max(lastOtherIndex ?? 0, index),
                  inRange =
                    lastOther && e.shiftKey
                      ? elementIds.slice(rangeMin + 1, rangeMax)
                      : [],
                  rangeSelected: Selection[] = inRange.map((id) => ({
                    id: id,
                    type: 'element',
                  })),
                  thisSelected: Selection[] =
                    selected && nextSelection.length === 1
                      ? []
                      : [{ id: elementId, type: 'element' }]

                dispatch(
                  r.actions.setSelection({
                    selection: [...otherSelected, ...rangeSelected, ...thisSelected],
                    index: props.index + 1,
                  })
                )
                e.preventDefault()
                e.stopPropagation()
                window.getSelection()?.removeAllRanges()
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

const actionsWrapper = cx(css`
  display: flex;
  align-items: center;
`)

const sideBarListInner = cx(
  css`
    display: flex;
    align-items: center;
    font-weight: 500;
    padding: 6px 8px;
  `
)

const sidebarListHeader = cx(
  styles.surfaceTone,
  css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    border-bottom: 1px solid ${styles.color(0.93)};
    position: sticky;
    top: 0;
    z-index:2;
  `
)

const elementsListWrapper = cx(css`
  min-width: 250px;
  flex: 1;
  overflow: scroll;
  background: ${styles.color(1)};
`)

const elementsListInner = cx(css`
  display: flex;
  flex-direction: column;
`)

interface ElementListItemProps {
  name: string
  selected: boolean
  virtual: boolean
  onClick?: React.EventHandler<React.MouseEvent>
}

function ElementListItem(props: ElementListItemProps) {
  return (
    <div className={elementListItem(props.selected)} onClick={props.onClick}>
      &zwnj;{props.name}
      {props.virtual && (
        <div className={elementListIcon}>
          <Icon name="caret-right" />
        </div>
      )}
    </div>
  )
}

const elementListIcon = cx(css`
  flex: 1;
  display: flex;
  flex-direction: row-reverse;
  opacity: 0.5;
`)

const elementListItem = (selected: boolean) =>
  cx(
    styles.surface,
    css`
      padding: 4px 6px;
      padding-left: 23px;
      :hover {
        background: ${styles.color(0.98)};
      }
      background: inherit;
      cursor: pointer;
      ${selected && `background:${styles.color(0.96)};`}
      position: relative;
    `
  )

interface ElListActionsProps extends ElementsListProps {}

type ElListAction = {
  string?: { variables?: string[]; placeholder: string; default?: string }
  callback: (string: string) => void
}

function ElListActions(props: ElListActionsProps) {
  const nextSelection = r.useSelector((s) =>
      r.selectors.selectSelectionByIndex(s, props.index + 1)
    ),
    lastJumpSelection = r.useSelector((s) =>
      r.selectors.selectLastJumpSelectionByIndex(s, props.index + 1)
    ),
    dispatch = r.useDispatch(),
    elements = r.useSelector((s) => s.deck.elements)

  const handleAdd = (virtual: boolean, name: string, copy?: string) => {
    const id = uid(),
      element: Partial<Element> = {
        ...(copy ? elements[copy] : {}),
        parents: props.parentId ? [props.parentId] : [],
        name: copy ? elements[copy].name + '-copy' : name,
      }
    if (virtual) element.virtual = true
    dispatch(r.actions.createElement({ id, element }))
    dispatch(
      r.actions.setSelection({
        selection: [{ type: 'element', id }],
        index: props.index + 1,
      })
    )
  }

  const actions: { [id: string]: ElListAction } = {
    del: {
      callback: () => {
        for (const selection of nextSelection) {
          dispatch(
            r.actions.deleteElement({ id: selection.id, fromParentId: props.parentId })
          )
        }
      },
    },
    copy: {
      callback: (name) => {
        for (const selection of nextSelection) {
          handleAdd(false, '', selection.id)
        }
      },
    },
    addVirtual: {
      callback: (name) => handleAdd(true, name),
      string: { placeholder: 'New folder name...' },
    },
    addNew: {
      callback: (name) => {
        const existing = Object.keys(elements).find((id) => elements[id].name === name)
        if (existing) {
          dispatch(
            r.actions.updateElement({
              id: existing,
              element: {
                ...elements[existing],
                parents: _.uniq(
                  _.compact([...elements[existing].parents, props.parentId])
                ),
              },
            })
          )
        } else handleAdd(false, name)
      },
      string: {
        placeholder: 'Element name...',
        variables: Object.keys(elements).map((id) => elements[id].name),
      },
    },
    move: {
      callback: (name) => {
        const dest = Object.keys(elements).find((id) => elements[id].name === name)
        if (!dest) return
        for (const selection of nextSelection) {
          const el = elements[selection.id]
          if (el)
            dispatch(
              r.actions.updateElement({
                id: selection.id,
                element: {
                  ...el,
                  parents: _.uniq([...el.parents, dest]),
                },
              })
            )
        }
      },
      string: {
        default: lastJumpSelection ? elements[lastJumpSelection[0].id].name : undefined,
        placeholder: 'Move to...',
        variables: Object.keys(elements)
          .filter((e) => elements[e].virtual)
          .map((id) => elements[id].name),
      },
    },
  }

  const [string, setString] = useState<string | undefined>(),
    [activeAction, setActiveAction] = useState<string | undefined>()

  const handleAction = (id: string) => {
      const action = actions[id]
      if (!action.string) action.callback('')
      else {
        setActiveAction(id)
        if (action.string.default) setString(action.string.default)
      }
    },
    cancelAction = () => {
      setString(undefined)
      setActiveAction(undefined)
    }

  return !activeAction ? (
    <div className={actionsWrapper}>
      {nextSelection && (
        <>
          <Button doubleClick onClick={() => handleAction('del')}>
            <Icon name="delete" />
          </Button>
          <Button onClick={() => handleAction('move')}>
            <Icon name="move" />
          </Button>
          <Button onClick={() => handleAction('copy')}>
            <Icon name="copy" />
          </Button>
        </>
      )}
      <Button onClick={() => handleAction('addNew')}>
        <Icon name="plus" />
      </Button>
    </div>
  ) : (
    <div className={actionInputWrapper}>
      <CodeInput
        autoFocus
        value={string}
        onChange={setString}
        onBlur={cancelAction}
        onClear={cancelAction}
        variables={activeAction ? actions[activeAction].string?.variables ?? [] : []}
        placeholder={actions[activeAction].string?.placeholder}
        onEnter={() => {
          actions[activeAction].callback(string!)
          cancelAction()
        }}
        noActivateOnTyping
      />
    </div>
  )
}

export const actionInputWrapper = cx(css`
  display: flex;
  gap: 5px;
  align-items: center;
  min-width: 150px;
  padding-right: 6px;
`)
