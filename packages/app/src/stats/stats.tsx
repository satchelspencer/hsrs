import React, { useMemo } from 'react'
import { DateTime, DateTimeUnit } from 'luxon'
import _ from 'lodash'
import { Bar, Chart, Line } from 'react-chartjs-2'

import * as t from '@hsrs/lib/types'

import { commonChartOptions, groupByTimescale, StatsOptions } from './util'
import { getAllCards, getInheritedElement } from '@hsrs/lib/props'
import { card2Id, id2Card } from '@hsrs/lib/session'
import { getCache } from '@hsrs/lib/cache'
import {
  defaultretention,
  getELRetrOffset,
  nextInterval,
  offsetRetention,
} from '@hsrs/lib/schedule'

interface TimeStatProps {
  stats: t.HourlyStatsMap
  options: StatsOptions
}

interface DeckStatProps {
  deck: t.Deck
  options: StatsOptions
}

function formatDate(seconds: number, scale: DateTimeUnit) {
  return DateTime.fromSeconds(seconds).toFormat(
    scale === 'year' ? 'yyyy' : scale === 'month' ? 'MMM yyyy' : 'MMM d'
  )
}

export function HoursSpent(props: TimeStatProps) {
  const data = useMemo(() => {
      const { grouped, scale } = groupByTimescale(props.stats, props.options.maxGroups),
        scoresArr = [1, 2, 3, 4],
        sortedKeys = _.sortBy(Object.keys(grouped).map(Number))
      return {
        labels: sortedKeys.map((d) => formatDate(d, scale)),
        datasets: scoresArr.map((score) => ({
          label: score + '',
          data: sortedKeys.map(
            (bucketKey) => (grouped[bucketKey].scores[score]?.took ?? 0) / 3600 / 24
          ),
        })),
      }
    }, [props.stats, props.options]),
    scoreColors = ['', '#c24141', '#cd9138', '#50bf68', '#29c34b']

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
}

export function Reviews(props: TimeStatProps) {
  const data = useMemo(() => {
    let count = 0,
      took = 0

    for (const d in props.stats) {
      for (const s in props.stats[d].scores) {
        count += props.stats[d].scores[s].count
        took += props.stats[d].scores[s].took
      }
    }
    return { count, took }
  }, [props.stats, props.options])

  return (
    <div>
      <i>{data.count}</i> over <i>{(data.took / 3600).toFixed(2)}</i> hours, averaging{' '}
      <i>{(data.took / data.count).toFixed(2)}</i> seconds
    </div>
  )
}

export function StabilityDist({ deck, options }: DeckStatProps) {
  const data = useMemo(() => {
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
  }, [])

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
}

export function SeenPercentage({ deck }: DeckStatProps) {
  const data = useMemo(() => {
    const allCards = getAllCards(deck.elements),
      totalCards = allCards.length,
      seenCount = allCards.filter((c) => !!deck.cards[card2Id(c)]).length,
      percentage = totalCards > 0 ? ((seenCount / totalCards) * 100).toFixed(2) : '0.00'
    return { seenCount, totalCards: totalCards, percentage }
  }, [deck])

  return (
    <div>
      <i>{data.seenCount}</i> seen of <i>{data.totalCards}</i> cards available (
      <i>{data.percentage}%</i>)
    </div>
  )
}

export function ProgressDist({ deck }: DeckStatProps) {
  const data = useMemo(() => {
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
  }, [deck])

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
}

export function DifficultyDist({ deck, options }: DeckStatProps) {
  const data = useMemo(() => {
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
  }, [deck, options])

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
}

export function NewCards(props: TimeStatProps) {
  const data = useMemo(() => {
    const { grouped, scale } = groupByTimescale(props.stats, props.options.maxGroups),
      sortedKeys = _.sortBy(Object.keys(grouped).map(Number)),
      newCounts = sortedKeys.map((key) => grouped[key].added),
      cumulativeCounts = newCounts.reduce((acc: number[], count, i) => {
        if (i === 0) acc.push(count)
        else acc.push(acc[i - 1] + count)
        return acc
      }, [])

    return {
      labels: sortedKeys.map((d) => formatDate(d, scale)),
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
  }, [props.stats, props.options])

  return (
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
  )
}

export function Accuracy(props: TimeStatProps) {
  const data = useMemo(() => {
    const { grouped, scale } = groupByTimescale(props.stats, props.options.maxGroups),
      sortedKeys = _.sortBy(Object.keys(grouped).map(Number)),
      accuracyValues = sortedKeys.map((key) => {
        const events = grouped[key],
          total = _.sumBy(Object.values(events.scores), (v) => v.count),
          passed = total - (events.scores[1]?.count ?? 0),
          accuracy = total ? (passed / total) * 100 : 0
        return parseFloat(accuracy.toFixed(2))
      })

    return {
      labels: sortedKeys.map((d) => formatDate(d, scale)),
      datasets: [{ label: 'Accuracy (%)', data: accuracyValues }],
    }
  }, [props.stats, props.options])

  return (
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
  )
}
