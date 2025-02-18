import React, { useEffect, useState } from 'react'
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
import { getStats, StatResult, StatsOptions } from './util'
import {
  useAvgTimeSpent,
  useCountGroupedByDayAndScore,
  useStabilityDist,
  useSeenPercentage,
  useDifficultyDist,
  useTotalCardsSeenOverTime,
  useAccuracyOverTime,
  useProgressDist,
} from './stats'
import { css, cx } from '@emotion/css'

interface StatsEditorProps {
  id: string
  index: number
  last?: boolean
}

export function Stats(props: StatsEditorProps) {
  const deck = r.useSelector((state) => state.deck),
    dispatch = r.useDispatch(),
    [options, setOptions] = useState<StatsOptions>({ maxGroups: 50, period: 'month' })

  const countGroupedByDayAndScore = useCountGroupedByDayAndScore(options),
    avgTimeSpent = useAvgTimeSpent(),
    stabilityDist = useStabilityDist(options),
    seenPercentage = useSeenPercentage(),
    difficultyDist = useDifficultyDist(options),
    useNewCards = useTotalCardsSeenOverTime(options),
    useAccuracy = useAccuracyOverTime(options),
    progressDist = useProgressDist(),
    statsDefs = [
      avgTimeSpent,
      countGroupedByDayAndScore,
      seenPercentage,
      stabilityDist,
      difficultyDist,
      useNewCards,
      useAccuracy,
      progressDist
    ],
    [stats, setStats] = useState<StatResult[]>([])

  useEffect(() => {
    let isCancelled = false
    getStats(props.id, deck, statsDefs, options).then((results) => {
      if (!isCancelled) {
        setStats(results)
      }
    })
    return () => {
      isCancelled = true
    }
  }, [props.id, options])

  return (
    <div className={editorWrapperOuter} style={{ background: 'white' }}>
      <div className={editorWrapper} style={{ overflowY: 'scroll' }}>
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
        <LabelGroup
          vert
          items={stats.map((stat, i) => [
            <span className={statName}>{stat.name}</span>,
            stat.renderFn(stat.finalData),
            !stat.singleLine,
          ])}
        />
      </div>
    </div>
  )
}

export const statName = cx(css`
  color: #919191;
`)
