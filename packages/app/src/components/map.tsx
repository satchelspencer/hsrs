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
  onChange: (value: P) => void
  onDelete: () => void
}

interface MapEditorProps<T extends t.IdMap<any>> {
  value: T
  onChange: (props: T) => void
  renderInput: (props: MapEditorRenderProps<T[keyof T]>) => React.ReactNode
  placeholder?: string
  defaultValue: T[keyof T]
}

export function MapEditor<T extends t.IdMap<any>>(props: MapEditorProps<T>) {
  const [newName, setNewName] = useState(''),
    [adding, setAdding] = useState(false),
    addNew = () => {
      if (newName) {
        props.onChange({ ...props.value, [newName]: props.defaultValue })
        cancel()
      }
    },
    cancel = () => {
      setNewName('')
      setAdding(false)
    }
  return (
    <div className={mapWrapper}>
      <LabelGroup
        items={Object.keys(props.value).map((propId) => {
          return [
            <div className={propName}>{propId}</div>,
            props.renderInput({
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
            }),
          ]
        })}
      />
      <div className={mapEditorAddWrapper}>
        {adding && (
          <CodeInput
            placeholder={props.placeholder}
            value={newName}
            onChange={(value) => setNewName(value ?? '')}
            onEnter={addNew}
            onBlur={cancel}
            onClear={cancel}
            autoFocus
          />
        )}
        {!adding && (
          <Button onClick={() => setAdding((a) => !a)}>
            <Icon name="plus" /> new
          </Button>
        )}
      </div>
    </div>
  )
}

const mapWrapper = cx(css`
  display: flex;
  flex-direction: column;
  gap: 8px;
`)

const propName = cx(css`
  color: #919191;
`)

const mapEditorAddWrapper = cx(css`
  display: flex;
  gap: 5px;
  align-items: center;
  width: 150px;
`)
