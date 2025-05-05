import React, { useMemo } from 'react'
import { css, cx } from '@emotion/css'
import _ from 'lodash'

import * as styles from '../styles'
import * as r from '../redux'
import { Button, RadioGroup } from '../components/button'
import { createLearningSession } from '@hsrs/lib/session'
import { Icon } from '../components/icon'
import { ElListPicker } from '../editor/element'
import { Card } from './card'

export function Learn() {
  const session = r.useSelector((s) => s.deck.session),
    deck = r.useSelector((s) => s.deck),
    dispatch = r.useDispatch()

  const { allowNew, newSessionSize, filter } = r.useSelector((s) => s.deck.settings)

  const actualSessionSize = Math.pow(2, newSessionSize) * 30,
    {
      new: cardsAvailable,
      due: cardsDue,
      next: nextDue,
      progress: dayProgress,
    } = useMemo(
      () =>
        createLearningSession(deck, actualSessionSize, allowNew, filter ?? [], 'local'),
      [newSessionSize, allowNew, filter, !!session]
    )

  return (
    <div className={learnWrapper}>
      {session ? (
        <Card />
      ) : (
        <>
          {!!dayProgress.goal && (
            <div className={dprogress}>
              <div
                className={dprogressItem(dayProgress.done / dayProgress.goal.count, true)}
                style={{ zIndex: 1 }}
              />
              <div
                className={cx(
                  dprogressItem(dayProgress.next / dayProgress.goal.count),
                  fadeInOut
                )}
              />
            </div>
          )}
          <div className={desc}>
            <RadioGroup
              value={newSessionSize}
              onChange={(s) =>
                dispatch(r.actions.setDeckSettings({ newSessionSize: s as any }))
              }
              options={[
                { label: 'S', value: 1 },
                { label: 'M', value: 2 },
                { label: 'L', value: 3 },
                { label: 'XL', value: 4 },
              ]}
              buttonClassName={sizeButton}
            />
            &nbsp; &nbsp;
            <div style={{ minWidth: 150 }}>
              <ElListPicker
                multiline={false}
                placeholder="All decks..."
                value={filter ?? []}
                onChange={(value) =>
                  dispatch(r.actions.setDeckSettings({ filter: value }))
                }
              />
            </div>
          </div>
          <div className={desc} style={{ opacity: 0.7 }}>
            <b>{cardsDue}</b>&nbsp;due,&nbsp;
            <b>{cardsAvailable}</b>&nbsp;new,&nbsp;<b>{nextDue}</b>&nbsp;review&nbsp;
            <div className={desc} style={{ fontSize: 'inherit' }}>
              <input
                type="checkbox"
                checked={!!allowNew}
                onChange={() =>
                  dispatch(r.actions.setDeckSettings({ allowNew: !allowNew }))
                }
              />
              <span>Allow new</span>
            </div>
          </div>
          <Button
            className={mainAction}
            onClick={() => dispatch(r.actions.createSession({ size: actualSessionSize }))}
          >
            <Icon size={1.2} name="plus" />
            &nbsp;start session
          </Button>
        </>
      )}
    </div>
  )
}

const dprogress = cx(
  css`
    display: flex;
    width: 350px;
    max-width: 100vw;
    margin: 5px;
    height: 12px;
    border-radius: 12px;
    background: ${styles.color(0.95)};
    overflow: hidden;
  `
)

const fadeInOut = css`
  animation: fadeInOut 2s infinite ease-in-out;
  @keyframes fadeInOut {
    0% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.2;
    }
  }
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
  padding-left: 8px;
  margin-left: -8px;
  background: hsl(211 51% 78% / 0.5);
  box-sizing: content-box;
`

const dprogressItem = (done: number, border?: boolean) =>
  cx(css`
    flex: none;
    height: 12px;
    border-radius: 8px;
    width: ${done * 100 + '%'};
    max-width: 100%;
    background: ${done >= 1 ? `oklab(0.82 -0.12 0.08 / 1)` : `hsl(211deg 89% 78%)`};
    ${done < 1 && border && `border-right: 2px solid #678eb97a;`}
  `)

const sizeButton = cx(
  css`
    width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
  `
)

const desc = cx(css`
  font-size: 0.9em;
  display: flex;
  align-items: center;
`)

const mainAction = cx(css`
  font-size: 1.1em;
`)

const learnWrapper = cx(
  styles.fill,
  css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: relative;
    gap: 10px;
  `
)
