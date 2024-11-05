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
  const elementPropsSelector = useCallback(
      (s) => r.selectors.elementProps(s, props.id),
      [props.value.parents]
    ),
    elementProps = r.useSelector(elementPropsSelector),
    paramPropsSelector = useCallback(
      (s) => r.selectors.paramProps(s, props.value.params),
      [props.value.params]
    ),
    paramProps = r.useSelector(paramPropsSelector)

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
              value={props.value.parents}
              onChange={(value) => props.onChange?.({ ...props.value, parents: value })}
            />,
          ],
          [
            'Virtual',
            <input
              type="checkbox"
              checked={!!props.value.virtual}
              onChange={() => {
                props.onChange?.(
                  props.value.virtual
                    ? _.omit(props.value, 'virtual')
                    : { ...props.value, virtual: true }
                )
              }}
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
              fixed={elementProps}
              variables={Object.keys(paramProps).flatMap((prop) =>
                _.keys(paramProps[prop]).map((k) => prop + '.' + k)
              )}
            />,
          ],
          [
            'Params',
            <ElementParamsEditor
              value={props.value.params ?? {}}
              onChange={(p) => props.onChange?.({ ...props.value, params: p })}
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

const els2raw = (els: string[], elements: t.IdMap<t.Element>) =>
    els.map((t) => elements[t]?.name).join(','),
  raw2els = (str: string, elements: t.IdMap<t.Element>) =>
    _.compact(
      (str?.split(',') ?? []).map((name) =>
        Object.keys(elements).find((id) => elements[id]?.name === name.trim())
      )
    )

function ElListPicker(props: ElListPickerProps) {
  const elements = r.useSelector((s) => s.deck.elements),
    [raw, setRaw] = useState(''),
    [focused, setFocused] = useState(false),
    trueRaw = els2raw(props.value, elements)

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
        props.onChange(raw2els(str ?? '', elements))
      }}
    />
  )
}

interface ElPickerProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  onClear?: () => void
}

function ElPicker(props: ElPickerProps) {
  const elements = r.useSelector((s) => s.deck.elements)

  return (
    <CodeInput
      value={elements[props.value ?? '']?.name}
      variables={Object.values(elements).map((e) => e.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      onChange={(str) => {
        props.onChange(Object.keys(elements).find((e) => elements[e]?.name === str))
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

interface ElementParamsEditorProps {
  value: t.IdMap<string>
  onChange: (props: t.IdMap<string>) => void
}

function ElementParamsEditor(props: ElementParamsEditorProps) {
  return (
    <MapEditor
      value={props.value}
      onChange={props.onChange}
      defaultValue={''}
      placeholder="new param name..."
      renderInput={({ value, onChange, onDelete }) => (
        <ElPicker
          value={value}
          onChange={(value) => onChange(value ?? '')}
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
