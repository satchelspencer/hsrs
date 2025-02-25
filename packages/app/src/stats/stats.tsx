import React from 'react'
import _ from 'lodash'
import { Bar, Chart, Line } from 'react-chartjs-2'

import * as t from '@hsrs/lib/types'

import { formatDate, groupByTimescale } from './time'
import { commonChartOptions, createStatHook, StatsOptions } from './util'
import { getAllCards, getInheritedElement } from '@hsrs/lib/props'
import { card2Id, id2Card } from '@hsrs/lib/session'
import { getCache } from '@hsrs/lib/cache'
import {
  defaultretention,
  getELRetrOffset,
  nextInterval,
  offsetRetention,
} from '@hsrs/lib/schedule'

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
    const scoreColors = ['', '#c24141', '#cd9138', '#50bf68', '#29c34b']
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
  name: 'Interval distribution',
  initAcc: () => ({}),
  accumulator: () => {},
  finalize: (x, deck) => {
    const cache = getCache(deck.elements),
      baseRetr = deck.settings.retention ?? defaultretention,
      stabilityValues = Object.keys(deck.cards).map((cardId) => {
        const { element } = id2Card(cardId),
          ret = offsetRetention(baseRetr, getELRetrOffset(element, deck.elements, cache)),
          state = deck.cards[cardId]
        return nextInterval(state.stability, ret) / 3600 / 24 //invertRetr(ret, state.stability * 3600 * 24)
      }),
      sortedStabilities = _.sortBy(stabilityValues),
      ninetyPercentileValue =
        sortedStabilities[Math.floor(0.99 * sortedStabilities.length)] || 0,
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

export const useProgressDist = createStatHook(() => ({
  name: 'Progress distribution',
  initAcc: () => ({}),
  accumulator: () => {},
  finalize: (acc, deck) => {
    const allCards = getAllCards(deck.elements),
      seenMap: { [order: string]: number } = {},
      totalMap: { [order: string]: number } = {}

    for (const c of allCards) {
      const order = (
        getInheritedElement(c.element, deck.elements).order ?? '0'
      ).substring(0, 3)
      if (!!deck.cards[card2Id(c)]) seenMap[order] = (seenMap[order] ?? 0) + 1
      totalMap[order] = (totalMap[order] ?? 0) + 1
    }

    const labels = _.sortBy(Object.keys(totalMap))

    return {
      labels,
      datasets: [
        { label: 'Completed', data: labels.map((l) => seenMap[l] ?? 0) },
        { label: 'Remaining', data: labels.map((l) => totalMap[l] - (seenMap[l] ?? 0)) },
      ],
    }
  },
  render: (data) => {
    const colors = ['#50bf68', '#cdcdcd']
    return (
      <Bar
        data={{
          labels: data.labels,
          datasets: data.datasets.map((ds, i) => ({
            ...ds,
            backgroundColor: colors[i] + '50',
            borderColor: colors[i],
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

export const useDifficultyDist = createStatHook((options: StatsOptions) => ({
  name: 'Difficulty distribution',
  initAcc: () => ({}),
  accumulator: () => {},
  finalize: (acc, deck) => {
    const difficultyValues = Object.values(deck.cards).map(
        (card) => card.difficulty ?? 0
      ),
      minDiff = 1,
      maxDiff = 9,
      groups =
        options.maxGroups !== undefined
          ? Math.max(9, Math.ceil(options.maxGroups / 9) * 9)
          : 9,
      range = maxDiff - minDiff,
      binSize = range / groups,
      bins = Array(groups).fill(0)

    for (const diff of difficultyValues) {
      const binIndex = Math.min(Math.floor((diff - minDiff) / binSize), groups - 1)
      bins[binIndex]++
    }

    const labels = bins.map((_, i) => (minDiff + i * binSize).toFixed(1))

    return { labels, data: bins }
  },
  render: (data) => {
    function getGradientColor(i: number, total: number) {
      const t = total > 1 ? i / (total - 1) : 0,
        r = Math.round(230 * t),
        g = Math.round(230 * (1 - t))
      return {
        background: `rgba(${r}, ${g}, 0, 0.3)`,
        border: `rgb(${r}, ${g}, 0,0.7)`,
      }
    }

    const total = data.data.length,
      backgroundColors = data.data.map((_, i) => getGradientColor(i, total).background),
      borderColors = data.data.map((_, i) => getGradientColor(i, total).border)

    return (
      <Bar
        data={{
          labels: data.labels,
          datasets: [
            {
              label: 'Card Count',
              data: data.data,
              backgroundColor: backgroundColors,
              borderColor: borderColors,
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

export const useTotalCardsSeenOverTime = createStatHook((options: StatsOptions) => ({
  name: 'Total New Cards Seen',
  initAcc: () => [] as t.CardLearning[],
  accumulator: (acc, item) => acc.push(item),
  finalize: (items, deck) => {
    const newCardEvents: t.CardLearning[] = []
    for (const item of items) {
      if (deck.cards[item.cardId]?.firstSeen === item.time) newCardEvents.push(item)
    }
    const grouped = groupByTimescale(newCardEvents, (it) => it.time, options.maxGroups),
      sortedKeys = _.sortBy(Object.keys(grouped).map(Number)),
      labels = sortedKeys.map(formatDate),
      newCounts = sortedKeys.map((key) => grouped[key].length),
      cumulativeCounts = newCounts.reduce((acc: number[], count, i) => {
        if (i === 0) acc.push(count)
        else acc.push(acc[i - 1] + count)
        return acc
      }, [])
    return {
      labels,
      datasets: [
        {
          label: 'Total Cards Seen',
          data: cumulativeCounts,
          type: 'line',
          yAxisID: 'y1',
        },
        { label: 'New Cards Seen', data: newCounts, type: 'bar', yAxisID: 'y2' },
      ],
    }
  },
  render: (data) => (
    <Chart
      type="line"
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds) =>
          ds.type === 'bar'
            ? {
                ...ds,
                borderColor: '#50bf68',
                backgroundColor: '#50bf6850',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y1',
              }
            : {
                ...ds,
                fill: false,
                borderColor: '#9696969f',
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.1,
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y2',
              }
        ),
      }}
      options={{
        ...commonChartOptions,
        scales: {
          x: { stacked: false },
          y1: { stacked: false, beginAtZero: true },
          y2: {
            stacked: false,
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
          },
        },
      }}
    />
  ),
}))

export const useAccuracyOverTime = createStatHook((options: StatsOptions) => ({
  name: 'Accuracy',
  initAcc: () => [] as t.CardLearning[],
  accumulator: (acc, item) => acc.push(item),
  finalize: (items) => {
    const grouped = groupByTimescale(items, (it) => it.time, options.maxGroups),
      sortedKeys = _.sortBy(Object.keys(grouped).map(Number)),
      labels = sortedKeys.map(formatDate),
      accuracyValues = sortedKeys.map((key) => {
        const events = grouped[key],
          total = events.length,
          passed = events.filter((it) => (it.score ?? 0) >= 2).length,
          accuracy = total ? (passed / total) * 100 : 0
        return parseFloat(accuracy.toFixed(2))
      })

    return { labels, datasets: [{ label: 'Accuracy (%)', data: accuracyValues }] }
  },
  render: (data) => (
    <Line
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds) => ({
          ...ds,
          fill: false,
          borderColor: '#2967c39f',
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: data.datasets[0].data.length > 100 ? 1 : 2,
        })),
      }}
      options={{
        ...commonChartOptions,
        scales: { x: { stacked: false }, y: { stacked: false } },
      }}
    />
  ),
}))
