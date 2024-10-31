import React from 'react'
import { cx } from '@emotion/css'

import * as styles from '../styles'
import { SideBar } from './sidebar'
import { Content } from './content'

export function Editor() {
  return (
    <Wrapper>
      <SideBar />
      <Content />
    </Wrapper>
  )
}

function Wrapper(props: { children: React.ReactNode }) {
  return <div className={cx(styles.fill)}>{props.children}</div>
}
