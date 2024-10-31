import React, { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as t from '@hsrs/lib/types'
import * as styles from '../styles'
import * as r from '../redux'
import CodeInput from '../components/code'
import { MapEditor } from '../components/map'
import { LabelGroup } from '../components/labels'

export function Content() {
  const selectedEl = r.useSelector(r.selectors.selectedElement),
    selectedType = r.useSelector(r.selectors.selectedType),
    dispatch = r.useDispatch()
  return (
    <div className={content}>
      {selectedEl && (
        <ElementEditor
          id={selectedEl.id}
          value={selectedEl.element}
          onChange={(element) =>
            dispatch(r.actions.updateElement({ ...selectedEl, element }))
          }
        />
      )}
      {selectedType && (
        <TypeEditor
          id={selectedType.id}
          value={selectedType.type}
          onChange={(type) => dispatch(r.actions.updateType({ ...selectedType, type }))}
        />
      )}
    </div>
  )
}

const content = cx(
  styles.surface,
  css`
    flex: 1;
  `
)

interface ElementEditorProps {
  id: string
  value: t.Element
  onChange?: (e: t.Element) => void
}

function ElementEditor(props: ElementEditorProps) {
  const typeSelector = useCallback(
      (s) => r.selectors.typeProps(s, props.value.types),
      [props.value.types + '']
    ),
    typeProps = r.useSelector(typeSelector)

  return (
    <div className={editorWrapper}>
      <LabelGroup
        items={[
          [
            'Name',
            <CodeInput
              value={props.value.name}
              onChange={(elname) =>
                props.onChange?.({ ...props.value, name: elname ?? '' })
              }
            />,
          ],
          [
            'Types',
            <TypePicker
              value={props.value.types}
              onChange={(value) => props.onChange?.({ ...props.value, types: value })}
            />,
          ],
        ]}
      />
      <LabelGroup
        vert
        items={[
          [
            'Properties',
            <PropsEditor
              value={props.value.props}
              onChange={(p) => props.onChange?.({ ...props.value, props: p })}
              fixed={typeProps}
            />,
          ],
          [
            'Children',
            <ElementChildEditor
              value={props.value.children ?? {}}
              onChange={(p) => props.onChange?.({ ...props.value, children: p })}
            />,
          ],
        ]}
      />
    </div>
  )
}

interface TypeEditorProps {
  id: string
  value: t.Type
  onChange?: (e: t.Type) => void
}

function TypeEditor(props: TypeEditorProps) {
  const typeSelector = useCallback(
      (s) => r.selectors.typeProps(s, props.value.extends),
      [props.value.extends]
    ),
    typeProps = r.useSelector(typeSelector)

  return (
    <div className={editorWrapper}>
      <LabelGroup
        items={[
          [
            'Name',
            <CodeInput
              value={props.value.name}
              onChange={(elname) =>
                props.onChange?.({ ...props.value, name: elname ?? '' })
              }
            />,
          ],
          [
            'Extends',
            <TypePicker
              value={props.value.extends ?? []}
              onChange={(value) => props.onChange?.({ ...props.value, extends: value })}
            />,
          ],
        ]}
      />
      <LabelGroup
        vert
        items={[
          [
            'Type properties',
            <PropsEditor
              value={props.value.props}
              onChange={(p) => props.onChange?.({ ...props.value, props: p })}
              fixed={typeProps}
              varColor="#888"
            />,
          ],
        ]}
      />
    </div>
  )
}

const editorWrapper = cx(css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  align-items: stretch;
  width: 550px;
`)

interface TypePickerProps {
  value: string[]
  onChange: (value: string[]) => void
  onClear?: () => void
}

const tl2raw = (tl: string[], types: t.IdMap<t.Type>) =>
    tl.map((t) => types[t]?.name).join(','),
  raw2tl = (str: string, types: t.IdMap<t.Type>) =>
    _.compact(
      (str?.split(',') ?? []).map((name) =>
        Object.keys(types).find((id) => types[id]?.name === name.trim())
      )
    )

function TypePicker(props: TypePickerProps) {
  const types = r.useSelector((s) => s.deck.types),
    [raw, setRaw] = useState(''),
    [focused, setFocused] = useState(false),
    trueRaw = tl2raw(props.value, types)

  useEffect(() => {
    if (!focused) setRaw(trueRaw)
  }, [focused, trueRaw])

  return (
    <CodeInput
      value={raw}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      variables={Object.values(types).map((t) => t.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      onChange={(str) => {
        setRaw(str ?? '')
        props.onChange(raw2tl(str ?? '', types))
      }}
    />
  )
}

interface PropsEditorProps {
  value: t.Props
  onChange: (props: t.Props) => void
  fixed?: t.Props
  varColor?: string
}

function PropsEditor(props: PropsEditorProps) {
  return (
    <MapEditor
      value={props.value}
      onChange={props.onChange}
      fixed={props.fixed}
      defaultValue={''}
      placeholder="new property name..."
      renderInput={({ value, onChange, onDelete, placeholder }) => (
        <CodeInput
          value={value}
          onChange={(value) => onChange(value ?? '')}
          onClear={onDelete}
          placeholder={placeholder}
          varColor={props.varColor}
        />
      )}
    />
  )
}

interface ElementChildEditorProps {
  value: t.IdMap<string[]>
  onChange: (props: t.IdMap<string[]>) => void
}

function ElementChildEditor(props: ElementChildEditorProps) {
  return (
    <MapEditor
      value={props.value}
      onChange={props.onChange}
      defaultValue={[]}
      placeholder="new child name..."
      renderInput={({ value, onChange, onDelete }) => (
        <TypePicker
          value={value}
          onChange={(value) => onChange(value)}
          onClear={onDelete}
        />
      )}
    />
  )
}
