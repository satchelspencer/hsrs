import React, { useMemo } from 'react'
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
import { getTime } from '@hsrs/lib/schedule'
import { id2Card } from '@hsrs/lib/session'

export interface StatDefinition<TAcc = any, TFinal = any> {
  name: string
  initAcc: () => TAcc
  accumulator: (accumulatedData: TAcc, item: t.CardLearning) => void
  finalize: (accumulatedData: TAcc, cards: t.CardStates) => TFinal
  render: (finalData: TFinal) => React.ReactNode
  singleLine?: boolean
}

export function createStatHook<TAcc, TFinal, TDeps extends readonly any[]>(
  config: (...deps: TDeps) => StatDefinition<TAcc, TFinal>
) {
  return function useStatHook(...deps: TDeps) {
    return useMemo(() => config(...deps), deps)
  }
}

export const commonChartOptions: any = {
  responsive: true,
  animation: false,
  plugins: { legend: { display: false } },
}

export interface StatResult extends StatDefinition {
  renderFn: (data: any) => React.ReactNode
  finalData: any
}

export async function getStats(
  parentId: string,
  deck: t.Deck,
  statsDefs: StatDefinition[],
  options: StatsOptions
): Promise<StatResult[]> {
  const children = getNonVirtualDescendents(parentId, deck.elements),
    accumulators = statsDefs.map((stat) => stat.initAcc()),
    now = getTime(),
    startTime =
      options.period === 'all'
        ? 0
        : options.period === 'year'
        ? now - 3600 * 24 * 365
        : options.period === 'month'
        ? now - 3600 * 24 * 30
        : options.period === 'week'
        ? now - 3600 * 24 * 7
        : options.period === 'day'
        ? now - 3600 * 24
        : Infinity

  await db.cardLearning
    .where('elIds')
    .anyOf(children)
    .and((l) => l.time > startTime)
    .each((record) => {
      for (const i in statsDefs) {
        const stat = statsDefs[i],
          accum = accumulators[i]
        if (record.score) stat.accumulator(accum, record)
      }
    })

  return statsDefs.map((stat, i) => ({
    ...stat,
    renderFn: stat.render,
    finalData: stat.finalize(
      accumulators[i],
      _.pickBy(deck.cards, (c, v) => children.includes(id2Card(v).element))
    ),
  }))
}

export interface StatsOptions {
  maxGroups: number
  period: 'all' | 'year' | 'month' | 'week' | 'day'
}
