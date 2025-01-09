import React from 'react'
import _ from 'lodash'
import { Bar } from 'react-chartjs-2'

import * as t from '@hsrs/lib/types'

import { formatDate, groupByTimescale } from './time'
import { commonChartOptions, createStatHook, StatsOptions } from './util'
import { getAllCards } from '@hsrs/lib/props'
import { card2Id } from '@hsrs/lib/session'

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
      <i>{data.count}</i> over <i>{(data.total / 3600).toFixed(2)}</i> hours, averaging{' '}
      <i>{(data.total / data.count).toFixed(2)}</i> seconds
    </div>
  ),
}))

export const useStabilityDist = createStatHook((options: StatsOptions) => ({
  name: 'Stability distribution',
  initAcc: () => ({}),
  accumulator: () => {},
  finalize: (x, deck) => {
    const stabilityValues = Object.values(deck.cards).map((card) => card.stability),
      sortedStabilities = _.sortBy(stabilityValues),
      ninetyPercentileValue =
        sortedStabilities[Math.floor(0.95 * sortedStabilities.length)] || 0,
      filteredStabilities = stabilityValues.filter(
        (stability) => stability <= ninetyPercentileValue
      ),
      minStability = Math.min(...filteredStabilities),
      maxStability = Math.max(...filteredStabilities, 0),
      range = Math.max(maxStability - minStability, 0),
      binSize = range / options.maxGroups || 1,
      bins = Array(options.maxGroups).fill(0)

    for (const stability of filteredStabilities)
      bins[
        Math.min(Math.floor((stability - minStability) / binSize), options.maxGroups - 1)
      ]++

    return {
      labels: bins.map((c, i) =>
        c ? `${(minStability + i * binSize).toFixed(0)}d` : undefined
      ),
      data: bins,
    }
  },
  render: (data) => {
    return (
      <Bar
        data={{
          labels: data.labels,
          datasets: [
            {
              label: 'Card Count',
              data: data.data,
              backgroundColor: '#518bc150',
              borderColor: '#518bc1',
              borderWidth: 1,
            },
          ],
        }}
        options={{
          ...commonChartOptions,
          scales: { x: { stacked: false }, y: { stacked: false, beginAtZero: true } },
        }}
      />
    )
  },
}))

export const useSeenPercentage = createStatHook(() => ({
  name: 'Progress',
  singleLine: true,
  initAcc: () => ({}),
  accumulator: () => {},
  finalize: (acc, deck) => {
    const allCards = getAllCards(deck.elements),
      totalCards = allCards.length,
      seenCount = allCards.filter((c) => !!deck.cards[card2Id(c)]).length,
      percentage = totalCards > 0 ? ((seenCount / totalCards) * 100).toFixed(2) : '0.00'
    return { seenCount, totalCards: totalCards, percentage }
  },
  render: (data) => (
    <div>
      <i>{data.seenCount}</i> seen of <i>{data.totalCards}</i> cards available (
      <i>{data.percentage}%</i>)
    </div>
  ),
}))
