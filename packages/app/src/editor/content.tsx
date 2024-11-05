import React, { useCallback, useEffect, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as t from '@hsrs/lib/types'
import * as styles from '../styles'
import * as r from '../redux'
import CodeInput from '../components/code'
import { MapEditor } from '../components/map'
import { LabelGroup } from '../components/labels'
import { WarnButton } from '../components/button'

export function Content() {
  const selectedEl = r.useSelector(r.selectors.selectedElement),
    dispatch = r.useDispatch()
  return (
    <div className={content}>
      {selectedEl?.element && (
        <ElementEditor
          id={selectedEl.id}
          value={selectedEl.element}
          onChange={(element) =>
            dispatch(
              element
                ? r.actions.updateElement({ ...selectedEl, element })
                : r.actions.deleteElement(selectedEl)
            )
          }
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
  onChange?: (e: t.Element | undefined) => void
}

function ElementEditor(props: ElementEditorProps) {
  const typeSelector = useCallback(
      (s) => r.selectors.elementProps(s, props.value.types),
      [props.value.types]
    ),
    typeProps = r.useSelector(typeSelector),
    childPropsSelector = useCallback(
      (s) => r.selectors.childProps(s, props.value.children),
      [props.value.children]
    ),
    childProps = r.useSelector(childPropsSelector)

  const instances = r.useSelector(r.selectors.selectedElementInstances)
  console.log(instances)

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
            <ElListPicker
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
              variables={Object.keys(childProps).flatMap((prop) =>
                _.keys(childProps[prop]).map((k) => prop + '.' + k)
              )}
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
      <div className={deleteWrapper}>
        <WarnButton onClick={() => props.onChange?.(undefined)}>delete</WarnButton>
      </div>
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

interface ElListPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  onClear?: () => void
}

const tl2raw = (tl: string[], types: t.IdMap<t.Element>) =>
    tl.map((t) => types[t]?.name).join(','),
  raw2tl = (str: string, types: t.IdMap<t.Element>) =>
    _.compact(
      (str?.split(',') ?? []).map((name) =>
        Object.keys(types).find((id) => types[id]?.name === name.trim())
      )
    )

function ElListPicker(props: ElListPickerProps) {
  const elements = r.useSelector((s) => s.deck.elements),
    [raw, setRaw] = useState(''),
    [focused, setFocused] = useState(false),
    trueRaw = tl2raw(props.value, elements)

  useEffect(() => {
    if (!focused) setRaw(trueRaw)
  }, [focused, trueRaw])

  return (
    <CodeInput
      value={raw}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      variables={Object.values(elements).map((e) => e.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      onChange={(str) => {
        setRaw(str ?? '')
        props.onChange(raw2tl(str ?? '', elements))
      }}
    />
  )
}

interface PropsEditorProps {
  value: t.Props
  onChange: (props: t.Props) => void
  fixed?: t.Props
  varColor?: string
  variables?: string[]
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
          variables={props.variables}
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
        <ElListPicker
          value={value}
          onChange={(value) => onChange(value)}
          onClear={onDelete}
        />
      )}
    />
  )
}

const deleteWrapper = cx(css`
  display: flex;
  justify-content: flex-end;
  opacity: 0.5;
`)
