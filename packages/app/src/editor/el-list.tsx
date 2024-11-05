import React, { useCallback } from 'react'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Icon } from '../components/icon'
import * as r from '../redux'
import { uid } from '@hsrs/lib/uid'
import { Button } from '../components/button'

interface ElementsListProps {
  parentId?: string
  index: number
}

export function ElementsList(props: ElementsListProps) {
  const elementIds = r.useSelector((state) =>
      r.selectors.selectElementIdsByParent(state, props.parentId)
    ),
    elements = r.useSelector((s) => s.deck.elements)

  const selectNextSelection = useCallback(
      (s) => r.selectors.selectSelectionByIndex(s, props.index + 1),
      [props.index]
    ),
    nextSelection = r.useSelector(selectNextSelection),
    dispatch = r.useDispatch()

  return (
    <div className={elementsListWrapper}>
      <div className={sidebarListHeader}>
        <div className={sideBarListInner}>
          <div>{props.parentId ? 'Children' : 'Base'}</div>
        </div>
        <Button
          onClick={() => {
            const id = uid()
            dispatch(
              r.actions.createElement({
                id,
                element: { parents: props.parentId ? [props.parentId] : [] },
              })
            )
            dispatch(
              r.actions.setSelection({
                selection: { type: 'element', id },
                index: props.index + 1,
              })
            )
          }}
        >
          <Icon name="plus" />
        </Button>
      </div>
      <div className={elementsListInner}>
        {elementIds.map((elementId) => {
          const element = elements[elementId],
            selected = nextSelection?.id === elementId
          return (
            <ElementListItem
              key={elementId}
              name={element.name}
              selected={selected}
              onClick={() =>
                dispatch(
                  r.actions.setSelection({
                    selection: selected ? undefined : { id: elementId, type: 'element' },
                    index: props.index + 1,
                  })
                )
              }
            />
          )
        })}
      </div>
    </div>
  )
}

const sideBarListInner = cx(
  css`
    display: flex;
    align-items: center;
    font-weight: 500;
  `
)

const sidebarListHeader = cx(
  styles.surfaceTone,
  css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    gap: 4px;
    border-bottom: 1px solid ${styles.color(0.93)};
  `
)

const elementsListWrapper = cx(css`
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
  onClick?: React.EventHandler<React.MouseEvent>
}

function ElementListItem(props: ElementListItemProps) {
  return (
    <div className={elementListItem(props.selected)} onClick={props.onClick}>
      &zwnj;{props.name}
    </div>
  )
}

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
    `
  )
