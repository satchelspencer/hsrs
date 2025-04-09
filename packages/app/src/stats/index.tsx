import React, { useEffect, useMemo, useState } from 'react'
import _ from 'lodash'

import * as r from '../redux'
import { LabelGroup } from '../components/labels'
import { Button, RadioGroup } from '../components/button'
import { Icon } from '../components/icon'
import {
  backButton,
  editorHeader,
  editorWrapper,
  editorWrapperOuter,
} from '../editor/element'
import { getStats, StatsOptions } from './util'
import { css, cx } from '@emotion/css'
import { Deck, HourlyStatsMap } from '@hsrs/lib/types'
import {
  Accuracy,
  DifficultyDist,
  HoursSpent,
  NewCards,
  ProgressDist,
  Reviews,
  SeenPercentage,
  StabilityDist,
} from './stats'
import { getCache } from '@hsrs/lib/cache'
import { getNonVirtualDescendents, isParent } from '@hsrs/lib/props'
import { id2Card } from '@hsrs/lib/session'

interface StatsEditorProps {
  id: string
  index: number
  last?: boolean
}

export function Stats(props: StatsEditorProps) {
  const deck = r.useSelector((state) => state.deck),
    dispatch = r.useDispatch(),
    [options, setOptions] = useState<StatsOptions>({ maxGroups: 50, period: 'month' }),
    [stats, setStats] = useState<HourlyStatsMap>({}),
    [loading, setLoading] = useState(false)

  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    getStats(props.id, deck, options).then((results) => {
      if (!isCancelled) {
        setLoading(false)
        setStats(results)
      }
    })
    return () => {
      isCancelled = true
    }
  }, [props.id, options])

  const subDeck = useMemo<Deck>(() => {
    const children = getNonVirtualDescendents(
        props.id,
        deck.elements,
        getCache(deck.elements)
      ),
      elements = _.pickBy(
        _.pickBy(deck.elements, (e, id) =>
          children.find((cid) => cid === id || isParent(cid, id, deck.elements))
        )
      )
    return {
      ...deck,
      elements,
      cards: _.pickBy(deck.cards, (c, v) => !!elements[id2Card(v).element]),
    }
  }, [deck, props.id])

  return (
    <div className={editorWrapperOuter} style={{ background: 'white' }}>
      <div className={editorWrapper(false)} style={{ overflowY: 'scroll' }}>
        <div className={editorHeader}>
          <Button
            className={backButton}
            onClick={() =>
              dispatch(
                r.actions.setSelection({
                  index: props.index,
                  selection: [],
                })
              )
            }
          >
            <Icon name="back" />
          </Button>
        </div>
        <LabelGroup
          items={[
            [
              'Detail',
              <RadioGroup
                value={options.maxGroups}
                onChange={(s) => setOptions((o) => ({ ...o, maxGroups: s }))}
                options={[
                  { label: 'low', value: 10 },
                  { label: 'med', value: 50 },
                  { label: 'high', value: 500 },
                ]}
              />,
            ],
            [
              'Period',
              <RadioGroup
                value={options.period}
                onChange={(s) => setOptions((o) => ({ ...o, period: s as any }))}
                options={[
                  { label: 'all', value: 'all' },
                  { label: 'year', value: 'year' },
                  { label: 'month', value: 'month' },
                  { label: 'week', value: 'week' },
                  { label: 'day', value: 'day' },
                ]}
              />,
            ],
          ]}
        />
        {loading ? (
          'Loading...'
        ) : (
          <LabelGroup
            vert
            items={[
              ['Hours spent', <HoursSpent stats={stats} options={options} />],
              ['Reviews', <Reviews stats={stats} options={options} />, false],
              ['Stability', <StabilityDist deck={subDeck} options={options} />],
              ['Progress', <SeenPercentage deck={subDeck} options={options} />, false],
              [
                'Progress distribution',
                <ProgressDist deck={subDeck} options={options} />,
              ],
              [
                'Difficulty distribution',
                <DifficultyDist deck={subDeck} options={options} />,
              ],
              ['Total new cards seen', <NewCards stats={stats} options={options} />],
              ['Accuracy', <Accuracy stats={stats} options={options} />],
            ]}
          />
        )}
      </div>
    </div>
  )
}

export const statName = cx(css`
  color: #919191;
`)
