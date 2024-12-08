import React from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as r from '../redux'
import { LabelGroup } from '../components/labels'
import { MapEditor } from '../components/map'
import CodeInput from '../components/code'

export function Settings() {
  const settings = r.useSelector((s) => s.settings),
    dispatch = r.useDispatch()
  return (
    <div className={settingsWrapper}>
      <LabelGroup
        vert
        items={[
          [
            'Plugins',
            <StrMapEditor
              value={settings.plugins}
              onChange={(plugins) =>
                dispatch(r.actions.setSettings({ settings: { ...settings, plugins } }))
              }
              placeholder="plugin name..."
            />,
          ],
          [
            'Variables',
            <StrMapEditor
              value={settings.vars}
              onChange={(vars) =>
                dispatch(r.actions.setSettings({ settings: { ...settings, vars } }))
              }
              placeholder="variable name..."
            />,
          ],
        ]}
      />
    </div>
  )
}

type StrMap = { [v: string]: string }

interface StrMapEditorProps {
  value: StrMap
  onChange: (v: StrMap) => void
  placeholder: string
}

function StrMapEditor(props: StrMapEditorProps) {
  return (
    <MapEditor
      value={props.value}
      onChange={props.onChange}
      defaultValue={''}
      placeholder={props.placeholder}
      renderInput={({ value, onChange, onDelete, placeholder, key }) => (
        <div className={inputWrapper}>
          <CodeInput
            value={value ?? ''}
            onChange={(v) => onChange(v ?? '')}
            onClear={() => {
              if (!value) onDelete()
            }}
            placeholder={placeholder ?? ''}
            throttle
          />
        </div>
      )}
    />
  )
}

const inputWrapper = cx(css`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
`)

const settingsWrapper = cx(
  css`
    display: flex;
    /* align-items: center;
    justify-content: center; */
    flex-direction: column;
    padding: 20px;
    gap: 10px;
    width: 400px;
  `
)
