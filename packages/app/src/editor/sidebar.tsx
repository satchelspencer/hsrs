import React, { useState } from 'react'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Icon } from '../components/icon'
import * as r from '../redux'
import { uid } from '@hsrs/lib/uid'
import { Button } from '../components/button'

export function SideBar() {
  const { elements, types } = r.useSelector((s) => s.deck),
    selection = r.useSelector((s) => s.ui.selection),
    dispatch = r.useDispatch()

  return (
    <div className={sideBar}>
      <SideBarList
        fill
        title="Elements"
        onAdd={() => {
          const id = uid()
          dispatch(r.actions.createElement({ id }))
          dispatch(r.actions.setSelection({ type: 'element', id }))
        }}
      >
        {Object.keys(elements).map((id) => (
          <SideBarListItem
            selected={selection?.type === 'element' && selection.id === id}
            onClick={() => dispatch(r.actions.setSelection({ type: 'element', id: id }))}
            key={id}
            name={elements[id].name}
          />
        ))}
      </SideBarList>
      <SideBarList
        title="Types"
        onAdd={() => {
          const id = uid()
          dispatch(r.actions.createType({ id }))
          dispatch(r.actions.setSelection({ type: 'type', id }))
        }}
      >
        {Object.keys(types).map((id) => (
          <SideBarListItem
            selected={selection?.type === 'type' && selection.id === id}
            onClick={() => dispatch(r.actions.setSelection({ type: 'type', id: id }))}
            key={id}
            name={types[id].name}
          />
        ))}
      </SideBarList>
    </div>
  )
}

const sideBar = cx(
  styles.surface,
  css`
    width: 350px;
    border-right: 1px solid ${styles.color(0.9)};
    display: flex;
    flex-direction: column;
    > * {
      border-bottom: 1px solid ${styles.color(0.92)};
    }
  `
)

interface SideBarListProps {
  fill?: boolean
  title: string
  children?: React.ReactNode
  onAdd?: () => void
}

function SideBarList(props: SideBarListProps) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <div className={sidebarListHeader}>
        <div className={sideBarListInner} onClick={() => setOpen((o) => !o)}>
          {/* <Icon name={open ? 'caret-down' : 'caret-right'} /> */}
          <div>{props.title}</div>
        </div>
        <Button onClick={() => props.onAdd?.()}>
          <Icon name="plus" />
        </Button>
      </div>
      <div className={sidebarListContent(props, open)}>{props.children}</div>
    </>
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

const sidebarListContent = (props: SideBarListProps, open: boolean) =>
  cx(
    styles.surface,
    css`
      display: flex;
      flex-direction: column;
      overflow: scroll;
      flex-grow: ${props.fill && open ? 1 : 0};
      flex-basis: ${open ? 'auto' : 0};
      interpolate-size: allow-keywords;
      transition: 0.2s all;
      background: ${styles.color(1)};
    `
  )

interface SideBarListItemProps {
  name: string
  selected: boolean
  onClick?: React.EventHandler<React.MouseEvent>
}

function SideBarListItem(props: SideBarListItemProps) {
  return (
    <div className={sidebarListItem(props.selected)} onClick={props.onClick}>
      &zwnj;{props.name}
    </div>
  )
}

const sidebarListItem = (selected: boolean) =>
  cx(
    styles.surface,
    css`
      padding: 4px 6px;
      padding-left: 23px;
      :hover {
        background: ${styles.color(0.97)};
      }
      background: inherit;
      cursor: pointer;
      ${selected && `background:${styles.color(0.96)};`}
    `
  )
