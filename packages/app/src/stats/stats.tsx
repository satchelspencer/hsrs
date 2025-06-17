import React, { useMemo, useState } from 'react'
import { DateTime, DateTimeUnit } from 'luxon'
import _, { set } from 'lodash'
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
import { Icon } from '../components/icon'
import { Button } from '../components/button'
import { color } from '../styles'

interface TimeStatProps {
  stats: t.HourlyStatsMap
  options: StatsOptions
  hue?: number
}

interface DeckStatProps {
  deck: t.Deck
  options: StatsOptions
  hue?: number
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
            (bucketKey) => (grouped[bucketKey].scores[score]?.took ?? 0) / 3600
          ),
        })),
      }
    }, [props.stats, props.options]),
    hue = props.hue ?? 240,
    scoreColors = [
      '',
      getColorV(hue, 1),
      getColorV(hue, 0.75),
      getColorV(hue, 0.25),
      getColorV(hue, 0),
    ]

  return (
    <Bar
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds) => ({
          ...ds,
          backgroundColor: scoreColors[ds.label] + 'a0',
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

export function StabilityDist({ deck, options, hue }: DeckStatProps) {
  const data = useMemo(() => {
    const cache = getCache(deck.elements),
      allCards = getAllCards(deck.elements).filter((c) => !!deck.cards[card2Id(c)]),
      baseRetr = deck.settings.retention ?? defaultretention,
      stabilityValues = allCards.map((card) => {
        const ret = offsetRetention(
            baseRetr,
            getELRetrOffset(card.element, deck.elements, cache)
          ),
          state = deck.cards[card2Id(card)]
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

  const total = data.data.length,
    backgroundColors = data.data.map(
      (_, i) => getColorV(hue ?? 240, 1 - i / total) + 'a0'
    ),
    borderColors = data.data.map((_, i) => getColorV(hue ?? 240, 1 - i / total))

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
      <b>{data.seenCount}</b> seen of <b>{data.totalCards}</b> cards available (
      <b>{data.percentage}%</b>)
    </div>
  )
}

export function ProgressDist({ deck, hue }: DeckStatProps) {
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

  const colors = [color({ l: 0.6, s: 0.7, h: hue ?? 240 }), '#cdcdcd']

  return (
    <Bar
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds, i) => ({
          ...ds,
          backgroundColor: colors[i] + 'a0',
          borderColor: colors[i],
          borderWidth: 1,
        })),
      }}
      options={{
        ...commonChartOptions,
        indexAxis: 'y',
        scales: {
          x: { stacked: true, beginAtZero: true },
          y: { stacked: true },
        },
      }}
    />
  )
}

function getColorV(hue: number, t: number) {
  return color({ l: (1 - t) * 0.4 + 0.3, s: 0.7, h: (hue ?? 240) - t * 30 })
}

export function DifficultyDist({ deck, options, hue }: DeckStatProps) {
  const data = useMemo(() => {
    const allCards = getAllCards(deck.elements).filter((c) => !!deck.cards[card2Id(c)]),
      difficultyValues = allCards.map(
        (card) => deck.cards[card2Id(card)]?.difficulty ?? 0
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
      c = getColorV(hue ?? 240, t)
    return {
      background: c + 'a0',
      border: c,
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

  const c = color({ l: 0.6, s: 0.7, h: props.hue ?? 240 })

  return (
    <Chart
      type="line"
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds) =>
          ds.type === 'bar'
            ? {
                ...ds,
                borderColor: c,
                backgroundColor: c + 'a0',
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

  const c = color({ l: 0.6, s: 0.7, h: props.hue ?? 240 })
  return (
    <Line
      data={{
        labels: data.labels,
        datasets: data.datasets.map((ds) => ({
          ...ds,
          fill: false,
          borderColor: c + '9f',
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

type StreakDay = { date: string; count: number }

export function Heatmap({ stats, hue }: TimeStatProps) {
  const rhue = hue ?? 240

  const [offset, setOffset] = useState(0)

  const { weeks, maxStreak, firstStreak } = useMemo(() => {
    const dayGroups = _.groupBy(Object.values(stats), (s) =>
        DateTime.fromSeconds(s.time).minus({ hours: 4 }).toISODate()
      ),
      now = DateTime.local().plus({ day: 1 }).startOf('week').minus({ day: 1 }),
      byWeek: StreakDay[][] = []

    let max = 0
    for (let i = 0; i < 52; i++) {
      const week: StreakDay[] = []
      for (let j = 0; j < 7; j++) {
        const date = now
            .minus({ weeks: i - offset * 52 })
            .plus({ days: j })
            .toISODate(),
          count = _.sumBy(dayGroups[date], (d) =>
            _.sumBy(Object.values(d.scores), (s) => s.count)
          )
        week.push({ date, count })
        if (count > max) max = count
      }
      byWeek.unshift(week)
    }

    let streak = 0,
      maxStreak = 0,
      firstStreak = 0,
      firstMiss = false

    const startTime = _.minBy(Object.values(stats), (s) => s.time)?.time,
      limit = startTime ? -DateTime.fromSeconds(startTime).diffNow('days').days : 0

    for (let d = 0; d < limit; d++) {
      const newDate = DateTime.local()
        .minus({ day: d + 1 })
        .toISODate()
      if (dayGroups[newDate] && d < limit - 1) {
        streak++
      } else {
        if (d === 0) firstMiss = true
        if (!firstStreak) firstStreak = streak
        if (streak > maxStreak) maxStreak = streak
        streak = 0
      }
    }

    return {
      weeks: byWeek.map((col) =>
        col.map((d) => ({
          ...d,
          lvl: d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4)),
        }))
      ),
      maxStreak,
      firstStreak: firstMiss ? 0 : firstStreak,
    }
  }, [stats, offset])

  const today = DateTime.local().toISODate()

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 20,
        }}
      >
        <div>
          Current streak: <b>{firstStreak}d</b>, longest: <b>{maxStreak}d</b>
        </div>
        <div style={{ display: 'flex' }}>
          <Button onClick={(s) => setOffset((o) => o - 1)}>
            <Icon size={1.2} name="caret-left" />
          </Button>
          <Button disabled={offset === 0} onClick={(s) => setOffset((o) => o + 1)}>
            <Icon size={1.2} name="caret-right" />
          </Button>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {weeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 1,
              boxSizing: 'border-box',
            }}
          >
            {week.map((d, di) => (
              <div
                key={di}
                title={
                  d.date ? `${d.date}: ${d.count} review${d.count === 1 ? '' : 's'}` : ''
                }
                style={{
                  width: '100%',
                  paddingBottom: '100%',
                  backgroundColor:
                    d.date === today && !d.count
                      ? `oklch(0.8 0.1 250)`
                      : d.count
                      ? getColorV(rhue, d.lvl / 4) + 'd0'
                      : `oklch(0.9 0 30)`,
                  boxSizing: 'border-box',
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
