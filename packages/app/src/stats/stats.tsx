import React from 'react'
import _ from 'lodash'
import { Bar } from 'react-chartjs-2'

import * as t from '@hsrs/lib/types'

import { formatDate, groupByTimescale } from './time'
import { commonChartOptions, createStatHook, StatsOptions } from './util'

export const useCountGroupedByDayAndScore = createStatHook((options: StatsOptions) => ({
  name: 'Hours spent',
  initAcc: () => [] as t.CardLearning[],
  accumulator: (acc, item) => acc.push(item),
  finalize: (items) => {
    const grouped = groupByTimescale(items, (it) => it.time, options.maxGroups)

    const allScores = new Set<number>()
    for (const bucketKey in grouped) {
      const bucketItems = grouped[bucketKey]
      for (const item of bucketItems) allScores.add(item.score ?? 0)
    }
    const scoresArr = _.sortBy(Array.from(allScores)),
      sortedKeys = _.sortBy(Object.keys(grouped).map(Number))

    return {
      labels: sortedKeys.map(formatDate),
      datasets: scoresArr.map((score) => ({
        label: score + '',
        data: sortedKeys.map(
          (bucketKey) =>
            grouped[bucketKey]
              .filter((it) => (it.score ?? 0) === score)
              .reduce((acc, l) => l.took + acc, 0) / 3600
        ),
      })),
    }
  },
  render: (data) => {
    const scoreColors = ['', '#c05c5c', '#c49652', '#7ec38d', '#29c34b']
    return (
      <Bar
        data={{
          labels: data.labels,
          datasets: data.datasets.map((ds) => ({
            ...ds,
            backgroundColor: scoreColors[ds.label] + '50',
            borderColor: scoreColors[ds.label],
            borderWidth: 1,
          })),
        }}
        options={{
          ...commonChartOptions,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true },
          },
        }}
      />
    )
  },
}))

export const useAvgTimeSpent = createStatHook(() => ({
  name: 'Reviews',
  singleLine: true,
  initAcc: () => ({ total: 0, count: 0 }),
  accumulator: (acc, item) => {
    acc.total += item.took
    acc.count++
  },
  finalize: (acc) => acc,
  render: (data) => (
    <div>
      <i>{data.total}</i> over <i>{(data.total / 3600).toFixed(2)}</i> hours, averaging{' '}
      <i>{(data.total / data.count).toFixed(2)}</i> seconds
    </div>
  ),
}))
