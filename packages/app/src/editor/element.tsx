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
    elementParams = r.useSelector((state) =>
      r.selectors.selectElementParamsById(state, props.id)
    ),
    elementPropVariables = r.useSelector((state) =>
      r.selectors.selectElementPropVariables(state, props.id)
    )

  const elementInstanceGenerator = r.useSelector((s) =>
    r.selectors.selectElementInstanceGenerator(s, props.id)
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
    { example, exampleInstance } = useMemo(() => {
      const next = elementInstanceGenerator.next().value
      return {
        example: next && computeElementInstance(next, elements),
        exampleInstance: next,
      }
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
                throttle
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
            [
              'Virtual',
              <input
                type="checkbox"
                checked={!!element.virtual}
                onChange={() =>
                  handleChange(
                    element.virtual
                      ? _.omit(element, 'virtual')
                      : { ...element, virtual: true }
                  )
                }
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
                value={element.props}
                onChange={(p) => handleChange({ ...element, props: p })}
                fixed={elementProps}
                variables={elementPropVariables}
              />,
            ],
            [
              'Params',
              <ElementParamsEditor
                value={element}
                onChange={handleChange}
                fixed={elementParams}
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
            !!Object.keys(element.params ?? {}).length && [
              'Constrain',
              element.constraint === undefined ? (
                <Button onClick={() => handleChange({ ...element, constraint: '' })}>
                  <Icon name="plus" />
                  Add
                </Button>
              ) : (
                <CodeInput
                  value={element.constraint}
                  placeholder="Enter parameters..."
                  onChange={(constraint) => handleChange({ ...element, constraint })}
                  onClear={() => handleChange(_.omit(element, 'constraint'))}
                />
              ),
              false,
            ],
            !!example && [
              <div className={exampleHead}>
                Example
                <Button onClick={() => setExampleSeed(Math.random())}>
                  <Icon name="refresh" />
                </Button>
              </div>,
              <>
                <LabelGroup
                  items={Object.keys(example)
                    .filter((l) => _.isArray(example[l]) && _.every(example[l]))
                    .map((id) => [
                      <div className={propName}>{id}</div>,
                      <div>
                        {example[id]?.[0]} {example[id]?.[1]}
                      </div>,
                    ])}
                />
                {!Object.keys(_.omit(example, Object.keys(exampleInstance.params ?? {})))
                  .length && (
                  <LabelGroup
                    items={Object.keys(exampleInstance.params ?? {}).map((id) => [
                      <div className={propName}>{id}</div>,
                      <div>{elements[exampleInstance.params[id].element].name}</div>,
                    ])}
                  />
                )}
              </>,
            ],
          ]}
        />
        <Button
          onClick={() => {
            console.log(example)
            // const gen = generateElementInstances(props.id, elements)
            // let i = 0
            // while (i++ < 10) {
            //   console.log(JSON.stringify(gen.next().value))
            // }
          }}
        >
          <Icon name="test" />
        </Button>
      </div>
      {element.virtual && <ElementsList parentId={props.id} index={props.index} />}
    </>
  )
}

const exampleHead = cx(css`
  display: flex;
  align-items: center;
`)

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
      variables={Object.values(elements)
        .filter((e) => e.virtual)
        .map((e) => e.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      throttle
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
  placeholder?: string
}

function ElPicker(props: ElPickerProps) {
  const elements = r.useSelector((s) => s.deck.elements)

  return (
    <CodeInput
      value={elements[props.value ?? '']?.name}
      variables={Object.values(elements).map((e) => e.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      placeholder={elements[props.placeholder ?? '']?.name}
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
      vert
      value={props.value}
      onChange={props.onChange}
      fixed={props.fixed}
      defaultValue={[]}
      placeholder="new property name..."
      renderInput={({ value, onChange, onDelete, placeholder, key }) => {
        const vert = _.some(value, (v) => {
          const m = v??placeholder
          return m && m.length > 25
        })
        return (
          <div className={propTupleWrapper(vert)}>
            {[0, 1].map((index) => (
              <div key={index} className={propTupleInnerWrapper(vert)}>
                <CodeInput
                  value={value?.[index] ?? ''}
                  onChange={(v) => {
                    const newValue = [...(value ?? [null, null])]
                    newValue[index] = v || null
                    onChange(newValue)
                  }}
                  onClear={() => {
                    if (!value?.find((v) => !!v)) onDelete()
                  }}
                  placeholder={placeholder?.[index] ?? ''}
                  varColor={props.varColor}
                  variables={_.without(props.variables, '_.' + key)}
                  throttle
                  multiline
                />
              </div>
            ))}
          </div>
        )
      }}
    />
  )
}

const propTupleWrapper = (vert: boolean) =>
  cx(css`
    display: flex;
    flex-direction: ${vert ? 'column' : 'row'};
    gap: 6px;
  `)

const propTupleInnerWrapper = (vert: boolean) =>
  cx(css`
    flex: 1;
    display: flex;
    flex-direction: column;
    ${!vert &&
    css`
      max-width: 50%;
    `}
  `)

interface ElementParamsEditorProps {
  value: t.Element
  onChange: (props: t.Element) => void
  onOpenElement?: (id: string) => void
  fixed?: t.Params
}

function ElementParamsEditor(props: ElementParamsEditorProps) {
  const handleChange = (value: t.Element) => {
    const params = value.params ?? {}
    const newValue: t.Element = { ...value, params }
    if (!Object.keys(params).length) delete newValue.params
    props.onChange(newValue)
  }

  return (
    <MapEditor
      value={props.value.params ?? {}}
      onChange={(params) => handleChange({ ...props.value, params })}
      fixed={props.fixed}
      defaultValue={''}
      placeholder="new param name..."
      renderInput={({ value, onChange, onDelete, placeholder, key }) => (
        <div className={paramInnerWrapper}>
          <ElPicker
            value={value}
            onChange={(value) => onChange(value ?? '')}
            onClear={onDelete}
            placeholder={placeholder}
          />
          <Button onClick={() => props.onOpenElement?.(value ?? placeholder)}>
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
