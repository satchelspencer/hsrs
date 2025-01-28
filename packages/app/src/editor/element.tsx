import React, { useEffect, useMemo, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import * as t from '@hsrs/lib/types'
import * as styles from '../styles'
import * as r from '../redux'
import CodeInput from '../components/code'
import { MapAdder, MapEditor, propName } from '../components/map'
import { LabelGroup } from '../components/labels'
import { Button } from '../components/button'
import { ElementsList } from './el-list'
import { Icon } from '../components/icon'
import { computeElementInstance, computeElementMode } from '@hsrs/lib/expr'
import { findAliases } from '@hsrs/lib/props'

interface ElementEditorProps {
  id: string
  index: number
  last: boolean
}

export function ElementEditor(props: ElementEditorProps) {
  const element = r.useSelector((state) =>
      r.selectors.selectElementById(state, props.id)
    ),
    {
      props: elementProps,
      params: elementParams = {},
      constraint: elementConstraint,
      mode: elementMode,
      order: elementOrder,
      retention: elementRetention,
    } = r.useSelector((state) => r.selectors.selectInheritedElementById(state, props.id)),
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
    cards = r.useSelector((state) => state.deck.cards),
    [exampleSeed, setExampleSeed] = useState(0),
    { example, mode, exampleInstance } = useMemo(() => {
      const next = elementInstanceGenerator.next().value
      return {
        example: next && computeElementInstance(next, elements),
        mode: next && computeElementMode(next, elements),
        exampleInstance: next,
      }
    }, [element.params, exampleSeed, element.virtual])

  const [searching, setSearching] = useState(false)

  const canShowRelation =
    element.virtual &&
    Object.keys(element.params ?? {}).length === 2 &&
    Object.keys(element.props).length === 0

  return (
    <div className={editorWrapperOuter}>
      <div className={editorWrapper}>
        <div className={editorHeader}>
          <Button
            className={backButton}
            onClick={() =>
              dispatch(r.actions.setSelection({ index: props.index, selection: [] }))
            }
          >
            <Icon name="back" />
          </Button>
          <div className={exampleHead}>
            {searching ? (
              <div style={{ minWidth: 150, display: 'flex' }}>
                <ElPicker
                  value={undefined}
                  autoFocus
                  onChange={(value) => {
                    if (value) {
                      dispatch(
                        r.actions.setSelection({
                          index: props.index + 1,
                          selection: [{ id: value, type: 'element', jump: true }],
                        })
                      )
                      setSearching(false)
                    }
                  }}
                  onClear={() => setSearching(false)}
                  onBlur={() => setSearching(false)}
                  placeholder={'Open element...'}
                />
              </div>
            ) : (
              <>
                <Button
                  onClick={() =>
                    dispatch(
                      r.actions.setSelection({
                        index: props.index + 1,
                        selection: [{ type: 'stats', id: props.id }],
                      })
                    )
                  }
                >
                  <Icon name="stats" />
                </Button>
                <Button onClick={() => setSearching(true)}>
                  <Icon name="search" />
                </Button>
              </>
            )}
          </div>
        </div>
        <LabelGroup
          items={[
            [
              'Name',
              <div className={hWrapper}>
                <CodeInput
                  value={element.name}
                  throttle
                  onChange={(elname) => handleChange({ ...element, name: elname ?? '' })}
                />
                <div className={hWrapper} style={{ minWidth: 42 }}>
                  R
                  <CodeInput
                    placeholder={elementRetention ?? '+0'}
                    value={element.retention}
                    throttle
                    varColor="#467588"
                    onChange={(retention) => handleChange({ ...element, retention })}
                    onClear={() => handleChange(_.omit(element, 'retention'))}
                  />
                </div>
                <div className={hWrapper} style={{ minWidth: 36 }}>
                  O
                  <CodeInput
                    placeholder="0"
                    value={element.order}
                    throttle
                    varColor="#468864"
                    onChange={(order) => handleChange({ ...element, order })}
                    onClear={() => handleChange(_.omit(element, 'order'))}
                  />
                </div>
                <div className={cx(hWrapper)} style={{ fontSize: '0.9em', opacity: 0.5 }}>
                  #{elementOrder ?? '1'}
                </div>
                <div className={hWrapper}>
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
                  />
                  Folder
                </div>
              </div>,
            ],
            [
              'Types',
              <ElListPicker
                value={element.parents}
                onChange={(value) => handleChange({ ...element, parents: value })}
                filter={(e) => !!e.virtual}
              />,
            ],
          ]}
        />
        <LabelGroup
          vert
          items={[
            [
              <div className={exampleHead}>
                <span>Properties</span>
                <MapAdder
                  onAdd={(newName) =>
                    handleChange({
                      ...element,
                      props: { ...element.props, [newName]: null },
                    })
                  }
                  placeholder="new property name..."
                />
              </div>,
              <PropsEditor
                value={element.props}
                onChange={(p) => handleChange({ ...element, props: p })}
                fixed={elementProps}
                variables={elementPropVariables}
              />,
            ],
            [
              <div className={exampleHead}>
                <span>Params</span>
                <MapAdder
                  onAdd={(newName) =>
                    handleChange({
                      ...element,
                      params: { ...element.params, [newName]: '' },
                    })
                  }
                  placeholder="new param name..."
                />
              </div>,
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
            !!Object.keys(elementParams).length && [
              'Constrain',
              elementConstraint === undefined ? (
                <Button onClick={() => handleChange({ ...element, constraint: '' })}>
                  <Icon name="plus" />
                  add
                </Button>
              ) : (
                <CodeInput
                  varColor="#884646"
                  value={element.constraint}
                  placeholder={elementConstraint || 'Enter parameters...'}
                  onChange={(constraint) => handleChange({ ...element, constraint })}
                  onClear={() => handleChange(_.omit(element, 'constraint'))}
                />
              ),
              false,
            ],
            [
              'Mode',
              elementMode === undefined ? (
                <Button onClick={() => handleChange({ ...element, mode: '' })}>
                  <Icon name="plus" />
                  add
                </Button>
              ) : (
                <CodeInput
                  varColor="#468864"
                  value={element.mode}
                  placeholder={elementMode || 'Enter mode...'}
                  onChange={(mode) => handleChange({ ...element, mode })}
                  onClear={() => handleChange(_.omit(element, 'mode'))}
                />
              ),
              false,
            ],
            !!example && [
              <div className={exampleHead}>
                <span>Example</span>
                <Button onClick={() => setExampleSeed(Math.random())}>
                  <Icon name="refresh" />
                </Button>
              </div>,
              <>
                <LabelGroup
                  items={Object.keys(example)
                    .filter((l) => typeof example[l] === 'string')
                    .map((id) => [
                      <div className={propName}>{id}</div>,
                      <div>{example[id]}</div>,
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
                {mode && (
                  <LabelGroup
                    items={[[<div className={propName}>m</div>, <div>{mode}</div>]]}
                  />
                )}
              </>,
            ],
          ]}
        />
        {/* <Button
          onClick={() => {
            console.log(
              exampleInstance,
              findAliases(exampleInstance, 'en', elements, cards).map((c) =>
                computeElementInstance(c, elements)
              )
            )
          }}
        >
          <Icon name="test" />
        </Button> */}
        {canShowRelation && (
          <Button
            onClick={() =>
              dispatch(
                r.actions.setSelection({
                  index: props.index + 1,
                  selection: [{ id: props.id, type: 'relation' }],
                })
              )
            }
          >
            <Icon name="matrix" />
            &nbsp; View relationships&nbsp;
            <Icon name="caret-right" />
          </Button>
        )}
      </div>
      {element.virtual && <ElementsList parentId={props.id} index={props.index} />}
    </div>
  )
}

const hWrapper = cx(css`
  display: flex;
  align-items: center;
  gap: 4px;
`)

export const editorWrapperOuter = cx(css`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`)

const exampleHead = cx(css`
  display: flex;
  align-items: center;
  gap: 0px;
  & > span {
    margin-top: -2px;
  }
  height: 25px;
  margin: -8px 0;
`)

export const backButton = cx(css`
  align-self: flex-start;
  font-size: 16px;
`)

export const editorWrapper = cx(css`
  display: flex;
  width: 450px;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  align-items: stretch;
  &:not(:last-child) {
    border-bottom: 1px solid ${styles.color(0.93)};
  }
`)

export const editorHeader = cx(css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 25px;
`)

interface ElListPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  onClear?: () => void
  placeholder?: string
  multiline?: boolean
  filter?: (e: t.Element) => boolean
}

const els2raw = (els: string[], elements: t.IdMap<t.Element>) =>
    els.map((t) => elements[t]?.name).join(','),
  raw2els = (str: string, elements: t.IdMap<t.Element>) =>
    _.compact(
      (str?.split(',') ?? []).map((name) =>
        Object.keys(elements).find((id) => elements[id]?.name === name.trim())
      )
    )

export function ElListPicker(props: ElListPickerProps) {
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
        .filter(props.filter ?? (() => true))
        .map((e) => e.name)}
      onClear={props.onClear}
      varColor="#689d6a"
      throttle
      multiline={props.multiline ?? true}
      placeholder={props.placeholder}
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
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
}

function ElPicker(props: ElPickerProps) {
  const elements = r.useSelector((s) => s.deck.elements)

  return (
    <CodeInput
      autoFocus={props.autoFocus}
      value={elements[props.value ?? '']?.name}
      variables={Object.values(elements).map((e) => e.name)}
      onClear={props.onClear}
      onBlur={props.onBlur}
      varColor="#689d6a"
      placeholder={elements[props.placeholder ?? '']?.name ?? props.placeholder}
      onChange={(str) => {
        props.onChange(Object.keys(elements).find((e) => elements[e]?.name === str))
      }}
      throttle
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
      renderInput={({ value, onChange, onDelete, placeholder, key }) => {
        return (
          <div className={propTupleWrapper(true)}>
            <div className={propTupleInnerWrapper(true)}>
              <CodeInput
                value={value ?? ''}
                onChange={(v) => onChange(v || null)}
                onClear={() => {
                  if (!value) onDelete()
                }}
                hilight
                placeholder={placeholder ?? ''}
                varColor={props.varColor}
                variables={_.without(props.variables, '_.' + key)}
                throttle
                multiline
              />
            </div>
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
