import React, { useEffect, useMemo, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as t from '@hsrs/lib/types'
import * as styles from '../styles'
import * as r from '../redux'
import CodeInput from '../components/code'
import { MapEditor, propName } from '../components/map'
import { LabelGroup } from '../components/labels'
import { Button } from '../components/button'
import { ElementsList } from './el-list'
import { Icon } from '../components/icon'
import { computeElementInstance } from '@hsrs/lib/expr'
import { getElementInstances } from '@hsrs/lib/props'

interface ElementEditorProps {
  id: string
  index: number
}

export function ElementEditor(props: ElementEditorProps) {
  const element = r.useSelector((state) =>
      r.selectors.selectElementById(state, props.id)
    ),
    elementProps = r.useSelector((state) =>
      r.selectors.selectElementPropsById(state, props.id)
    ),
    paramProps = r.useSelector((state) =>
      r.selectors.selectElementParamPropsById(state, props.id)
    )

  const dispatch = r.useDispatch(),
    handleChange = (element: t.Element | undefined) =>
      dispatch(
        element
          ? r.actions.updateElement({ id: props.id, element })
          : r.actions.deleteElement({ id: props.id })
      )

  const elements = r.useSelector((state) => state.deck.elements),
    [exampleSeed, setExampleSeed] = useState(0),
    example = useMemo(() => {
      return computeElementInstance(getElementInstances(props.id, elements), elements)
    }, [element.params, exampleSeed])

  return (
    <>
      <div className={editorWrapper}>
        <Button
          className={backButton}
          onClick={() =>
            dispatch(r.actions.setSelection({ index: props.index, selection: [] }))
          }
        >
          <Icon name="back" />
        </Button>
        <LabelGroup
          items={[
            [
              'Name',
              <CodeInput
                value={element.name}
                onChange={(elname) => handleChange({ ...element, name: elname ?? '' })}
              />,
            ],
            [
              'Types',
              <ElListPicker
                value={element.parents}
                onChange={(value) => handleChange({ ...element, parents: value })}
              />,
            ],
            // [
            //   'Virtual',
            //   <input
            //     type="checkbox"
            //     checked={!!element.virtual}
            //     onChange={() =>
            //       handleChange(
            //         element.virtual
            //           ? _.omit(element, 'virtual')
            //           : { ...element, virtual: true }
            //       )
            //     }
            //   />,
            // ],
          ]}
        />
        <LabelGroup
          vert
          items={[
            [
              'Properties',
              <PropsEditor
                value={element.props}
                onChange={(p) => handleChange({ ...element, props: p })}
                fixed={
                  element.virtual
                    ? {}
                    : _.omit(elementProps, Object.keys(element.props ?? {}))
                }
                variables={Object.keys(paramProps).flatMap((prop) =>
                  _.keys(paramProps[prop]).map((k) => prop + '.' + k)
                )}
              />,
            ],
            !element.virtual && [
              'Params',
              <ElementParamsEditor
                value={element.params ?? {}}
                onChange={(p) => handleChange({ ...element, params: p })}
                onOpenElement={(id) =>
                  dispatch(
                    r.actions.setSelection({
                      selection: [{ id, type: 'element' }],
                      index: props.index + 1,
                    })
                  )
                }
              />,
            ],
            !element.virtual &&
              !!element.params &&
              example && [
                'Example',
                <>
                  <LabelGroup
                    items={Object.keys(example).map((id) => [
                      <div className={propName}>{id}</div>,
                      example[id],
                    ])}
                  />
                  <Button onClick={() => setExampleSeed(Math.random())}>
                    <Icon name='refresh' />
                  </Button>
                </>,
              ],
          ]}
        />
      </div>
      {element.virtual && <ElementsList parentId={props.id} index={props.index} />}
    </>
  )
}

const backButton = cx(css`
  align-self: flex-start;
  font-size: 16px;
`)

const editorWrapper = cx(css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  align-items: stretch;
  &:not(:last-child) {
    border-bottom: 1px solid ${styles.color(0.93)};
  }
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
  onOpenElement?: (id: string) => void
}

function ElementParamsEditor(props: ElementParamsEditorProps) {
  return (
    <MapEditor
      value={props.value}
      onChange={props.onChange}
      defaultValue={''}
      placeholder="new param name..."
      renderInput={({ value, onChange, onDelete }) => (
        <div className={paramInnerWrapper}>
          <ElPicker
            value={value}
            onChange={(value) => onChange(value ?? '')}
            onClear={onDelete}
          />
          <Button onClick={() => props.onOpenElement?.(value)}>
            <Icon name="caret-right" />
          </Button>
        </div>
      )}
    />
  )
}

const paramInnerWrapper = cx(css`
  display: flex;
`)
