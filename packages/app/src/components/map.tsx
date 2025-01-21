import React, { useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as t from '@hsrs/lib/types'
import CodeInput from '../components/code'
import { Icon } from '../components/icon'
import { Button } from '../components/button'
import { LabelGroup } from './labels'

interface MapEditorRenderProps<P> {
  value: P
  key: string
  onChange: (value: P) => void
  onDelete: () => void
  placeholder?: P
}

interface MapEditorProps<T extends t.IdMap<any>> {
  value: T
  onChange: (props: T) => void
  renderInput: (props: MapEditorRenderProps<T[keyof T]>) => React.ReactNode
  placeholder?: string
  defaultValue?: T[keyof T]
  fixed?: T
  vert?: boolean
}

export function MapEditor<T extends t.IdMap<any>>(props: MapEditorProps<T>) {
  const hasOwnAdder = props.defaultValue !== undefined,
    items = _.sortBy([
      ...Object.keys(props.fixed ?? {}).filter((k) => !(k in props.value)),
      ...Object.keys(props.value),
    ])
  return hasOwnAdder || items.length > 0 ? (
    <div className={mapWrapper}>
      <LabelGroup
        vert={props.vert}
        flush={props.vert}
        items={items.map((propId) => {
          return [
            <div className={propName}>{propId}</div>,
            props.renderInput({
              key: propId,
              value: props.value[propId],
              onChange: (value) => {
                const dupe = { ...props.value } as any
                dupe[propId] = value ?? ''
                props.onChange(dupe)
              },
              onDelete: () => {
                const dupe = { ...props.value }
                delete dupe[propId]
                props.onChange(dupe)
              },
              placeholder: props.fixed?.[propId],
            }),
          ]
        })}
      />
      {hasOwnAdder && (
        <MapAdder
          onAdd={(newName: string) => {
            props.onChange({ ...props.value, [newName]: props.defaultValue })
          }}
          placeholder={props.placeholder}
        />
      )}
    </div>
  ) : null
}

interface MapAdderProps {
  onAdd: (string: string) => void
  placeholder?: string
}

export function MapAdder(props: MapAdderProps) {
  const [newName, setNewName] = useState(''),
    [adding, setAdding] = useState(false),
    addNew = () => {
      if (newName) {
        props.onAdd(newName)
        cancel()
      }
    },
    cancel = () => {
      setNewName('')
      setAdding(false)
    }
  return (
    <div className={mapEditorAddWrapper}>
      {adding && (
        <>
          &nbsp;
          <CodeInput
            placeholder={props.placeholder}
            value={newName}
            onChange={(value) => setNewName(value ?? '')}
            onEnter={addNew}
            onBlur={cancel}
            onClear={cancel}
            autoFocus
          />
        </>
      )}
      {!adding && (
        <Button onClick={() => setAdding((a) => !a)}>
          <Icon name="plus" />
        </Button>
      )}
    </div>
  )
}

const mapWrapper = cx(css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`)

export const propName = cx(css`
  color: #919191;
  font-size: 13px;
`)

const mapEditorAddWrapper = cx(css`
  display: flex;
  gap: 5px;
  align-items: center;
  width: 150px;
`)
