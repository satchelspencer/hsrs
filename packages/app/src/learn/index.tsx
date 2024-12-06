import React, { useState } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button } from '../components/button'
import { computeElementInstance } from '@hsrs/lib/expr'
import { LabelGroup } from '../components/labels'
import { propName } from '../components/map'
import { card2Id } from '@hsrs/lib/session'

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
    elements = r.useSelector((s) => s.deck.elements),
    dispatch = r.useDispatch()

  const card = session?.stack[0],
    value = card && computeElementInstance(card, elements),
    [revealed, setRevealed] = useState(false),
    shownValue = revealed ? value : _.pick(value, card?.property ?? '')

  console.log(
    JSON.stringify(
      session?.stack.map((s) => [
        elements[s.element].name,
        session.cards[card2Id(s)].state?.stability,
      ]),
      null,
      2
    )
  )

  console.log(session)

  return (
    <div className={learnWrapper}>
      {session ? (
        value ? (
          <div className={cardWrapper}>
            <div className={cardBody}>
              <LabelGroup
                items={Object.keys(shownValue ?? {}).map((id) => [
                  <div className={propName}>{id}</div>,
                  <div>{shownValue?.[id] + ''}</div>,
                ])}
              />
            </div>
            <div className={cardActions}>
              {revealed ? (
                [1, 2, 3, 4].map((grade) => (
                  <Button
                    key={grade}
                    onClick={() => {
                      setRevealed(false)
                      dispatch(r.actions.gradeCard({ grade }))
                    }}
                    className={cardAction}
                  >
                    {grade}
                  </Button>
                ))
              ) : (
                <Button onClick={() => setRevealed(true)} className={cardAction}>
                  reveal
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button onClick={() => dispatch(r.actions.endSession({}))}>
            Finish session
          </Button>
        )
      ) : (
        <Button onClick={() => dispatch(r.actions.createSession({ size: 20 }))}>
          Create session
        </Button>
      )}
    </div>
  )
}

const cardWrapper = cx(css`
  display: flex;
  flex-direction: column;
  gap: 10;
`)

const cardBody = cx(css`
  display: flex;
  flex-direction: column;
  font-size: 3em;
`)

const cardActions = cx(css`
  display: flex;
  flex-direction: row;
  gap: 10;
`)

const cardAction = cx(css``)

const learnWrapper = cx(
  styles.fill,
  css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `
)
