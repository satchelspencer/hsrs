import React from 'react'
import { css, cx } from '@emotion/css'

import * as styles from '../styles'
import { Column } from './column'
import * as r from '../redux'
import { getAllCards } from '@hsrs/lib/props'

export function Editor() {
  const selDepth = r.useSelector((s) => r.selectors.selectSelections(s).length),
    cards = r.useSelector((s) =>
      getAllCards(s.deck.elements).map(
        (c) => `${s.deck.elements[c.root].name}:${c.property}`
      )
    )
  //console.log(cards.join('\n'))
  return (
    <Wrapper>
      {new Array(selDepth + 1).fill(0).map((v, index) => {
        const realIndex = selDepth - index - 1
        return <Column key={realIndex} index={realIndex} last={!index} />
      })}
    </Wrapper>
  )
}

function Wrapper(props: { children: React.ReactNode }) {
  return (
    <div className={editorWrapper}>
      <div className={editorInner}>{props.children}</div>
    </div>
  )
}

const editorWrapper = cx(
  styles.fill,
  styles.surfaceTone,
  css`
    display: block;
    overflow: scroll;
  `
)

const editorInner = cx(
  styles.fill,
  css`
    flex-direction: row-reverse;
    justify-content: flex-end;
  `
)
