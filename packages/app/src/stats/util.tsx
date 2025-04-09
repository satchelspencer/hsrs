import { DateTime, DateTimeUnit } from 'luxon'
import _ from 'lodash'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LineElement,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  Filler
)

import * as t from '@hsrs/lib/types'
import { db } from '../redux/db'
import { getNonVirtualDescendents } from '@hsrs/lib/props'
import { getCache } from '@hsrs/lib/cache'
import { addLearning2Stat, getLearningHour } from '@hsrs/lib/stats'

export const commonChartOptions: any = {
  responsive: true,
  animation: false,
  plugins: { legend: { display: false } },
}

export interface StatsOptions {
  maxGroups: number
  period: 'all' | 'year' | 'month' | 'week' | 'day'
}

export async function getStats(
  parentId: string,
  deck: t.Deck,
  options: StatsOptions
): Promise<t.HourlyStatsMap> {
  const children = getNonVirtualDescendents(
      parentId,
      deck.elements,
      getCache(deck.elements)
    ),
    startTime =
      options.period === 'all'
        ? 0
        : DateTime.now()
            .minus({ [options.period]: 1 })
            .toSeconds()

  const seen: Record<string, boolean> = {},
    records: t.CardLearning[] = []
  await db.cardLearning
    .where('elIds')
    .anyOf(children)
    .and((l) => l.time > startTime)
    .each((record) => {
      const k = record.cardId + record.time
      if (seen[k]) return
      seen[k] = true
      records.push(record)
    })

  return learnings2Hours(records, deck.cards)
}

export function learnings2Hours(learnings: t.CardLearning[], states: t.CardStates) {
  const hours: t.HourlyStatsMap = {}
  for (const learning of learnings) {
    const hour = getLearningHour(learning)
    hours[hour] ??= { added: 0, scores: {}, time: hour }
    addLearning2Stat(states, learning, hours[hour])
  }
  return hours
}

function applyStats(target: t.HourlyStats, src: t.HourlyStats) {
  target.added += src.added
  for (const score in src.scores) {
    target.scores[score] ??= { took: 0, count: 0 }
    target.scores[score].count += src.scores[score].count
    target.scores[score].took += src.scores[score].took
  }
}

export function groupByTimescale(map: t.HourlyStatsMap, maxGroups: number) {
  const items = Object.values(map)

  let minTime = Infinity,
    maxTime = -Infinity

  for (const item of items) {
    const ts = item.time
    if (ts < minTime) minTime = ts
    if (ts > maxTime) maxTime = ts
  }

  const diff = DateTime.fromSeconds(maxTime).diff(
      DateTime.fromSeconds(minTime),
      'days'
    ).days,
    groupUnit: DateTimeUnit =
      diff <= maxGroups ? 'day' : diff * 7 <= maxGroups ? 'week' : 'month',
    grouped: Record<number, t.HourlyStats> = {}

  for (const item of items) {
    const bucket = DateTime.fromSeconds(item.time).startOf(groupUnit).toSeconds()
    grouped[bucket] ??= { added: 0, scores: {}, time: bucket }
    applyStats(grouped[bucket], item)
  }

  return { grouped, scale: groupUnit }
}
