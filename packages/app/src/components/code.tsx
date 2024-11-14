import _ from 'lodash'
import React, { useEffect, useMemo, useRef } from 'react'
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import {
  autocompletion,
  acceptCompletion,
  CompletionContext,
} from '@codemirror/autocomplete'
import { LRLanguage, LanguageSupport } from '@codemirror/language'
import { parser } from '@lezer/javascript'
import { keymap, EditorView } from '@codemirror/view'
import { injectGlobal } from '@emotion/css'
import * as styles from '../styles'
import { tags } from '@lezer/highlight'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Prec } from '@codemirror/state'

injectGlobal`
  .ͼ1.cm-focused{
    outline: 1px solid ${styles.color.active()};
  }
  .cm-editor{
    border-radius: 2px;  
    border: 1px solid ${styles.color(0.9)};
    outline-offset: -1px;     
  }
  .cm-tooltip-autocomplete{
    border-radius: 2px;  
    border: 1px solid ${styles.color(0.85)} !important;
  }

  .cm-content{
    padding:3px 0px !important;
  }
`

const language = LRLanguage.define({ parser: parser.configure({ dialect: 'jsx' }) })

interface CodeInputProps {
  value?: string
  onChange?: (value?: string) => void
  onClear?: () => void
  onEnter?: () => void
  variables?: string[]
  onFocus?: React.FocusEventHandler
  onBlur?: React.FocusEventHandler
  placeholder?: string
  autoFocus?: boolean
  varColor?: string
  throttle?: boolean
  multiline?: boolean
}

export default function CodeInput(props: CodeInputProps) {
  const editorRef = React.useRef<ReactCodeMirrorRef>(null)

  const extension = useMemo(() => {
    const highlightStyle = HighlightStyle.define([
      { tag: tags.variableName, color: props.varColor ?? '#468588' },
      { tag: tags.propertyName, color: props.varColor ?? '#468588' },
      { tag: tags.operator, color: '#458588' },
      { tag: tags.literal, color: '#7c6f64' },
    ])
    return new LanguageSupport(language, [syntaxHighlighting(highlightStyle)])
  }, [props.varColor])

  function variableAutocomplete(context: CompletionContext) {
    const word = context.matchBefore(/\w*/),
      fullWord = context.matchBefore(/[\w\.]*/)
    if (!fullWord || !word || (word.from === word.to && !context.explicit)) return null

    return {
      from: fullWord.from,
      options: (props.variables ?? []).map((name) => ({ label: name })),
      validFor: /^\w*$/,
    }
  }

  const handleBackspaceEmpty = () => {
    const editorState = editorRef.current?.view?.state
    if (editorState && editorState.doc.length === 0) {
      props.onClear?.()
      throttleOnChange.cancel()
    }
    return false
  }

  const handleEnter = () => {
    if (props.onEnter) {
      props.onEnter?.()
      return true
    } else return props.multiline ? false : true
  }

  const extensions = [
    extension,
    Prec.highest(
      keymap.of([
        { key: 'Tab', run: acceptCompletion },
        { key: 'Backspace', run: handleBackspaceEmpty },
        { key: 'Enter', run: handleEnter },
      ])
    ),
    autocompletion({ override: [variableAutocomplete], activateOnTypingDelay: 500 }),
  ]
  if (props.multiline) extensions.push(EditorView.lineWrapping)

  const onChangeRef = useRef(props.onChange),
    throttleOnChange = useMemo(
      () =>
        _.debounce(
          (value) => {
            onChangeRef.current?.(value)
          },
          props.throttle ? 500 : 0
        ),
      []
    )
  useEffect(() => {
    onChangeRef.current = props.onChange
  }, [props.onChange])

  return (
    <CodeMirror
      ref={editorRef}
      value={props.value}
      onChange={throttleOnChange}
      extensions={extensions}
      indentWithTab={false}
      style={{ fontSize: 12, flex: 1, minHeight: 25 }}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
      }}
    />
  )
}
