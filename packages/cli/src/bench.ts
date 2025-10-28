import fs from 'fs'
import path from 'path'
import JSONStream from 'JSONStream'
import _ from 'lodash'
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

import { deckVersionable } from '@hsrs/lib/versions'
import * as t from '@hsrs/lib/types'
import { getLearningCardDiff } from '@hsrs/lib/schedule'
import { getCache } from '@hsrs/lib/cache'
import { id2Card } from '@hsrs/lib/session'

type BinState = { pass: number; fail: number }
type BinRes = BinState & { acc: number }

export async function benchmark(deckPath: string, historyPath: string, dest: string) {
  const histories = getHistoryFiles(historyPath),
    deck: t.Deck = {
      ...deckVersionable.create(JSON.parse(fs.readFileSync(deckPath, 'utf-8'))),
      session: null,
      cards: {},
      settings: { newSessionSize: 1, allowNew: true },
    },
    cache = getCache(deck.elements),
    bins: { [retr: number]: BinState } = {}
  let i = 0

  for (const history of histories) {
    if (!history.includes('.json')) continue
    console.log(history)
    const state: t.CardStates = {},
      file = fs.createReadStream(history)
    await new Promise((res) => {
      const parser = JSONStream.parse('history.*')
      file
        .pipe(parser)
        .on('data', (d: t.CardLearning) => {
          const { element } = id2Card(d.cardId),
            { diff, prob } = getLearningCardDiff(state, d, deck),
            prevSeen = state[d.cardId]?.lastRoot
          Object.assign(state, diff)
          if (
            cache.depths[element] > 0 &&
            state[d.cardId] &&
            prevSeen &&
            d.time - prevSeen > 3600 * 24
          ) {
            const bin = Math.floor(prob * 200) / 200 + ''
            bins[bin] ??= { pass: 0, fail: 0 }
            bins[bin][d.score > 1 ? 'pass' : 'fail']++
          }
          if (i++ % 10000 === 0) console.log(i - 1)
        })
        .on('end', res)
    })
  }

  const result: { [retr: number]: BinRes } = _.mapValues(bins, (b) => ({
    ...b,
    acc: b.pass / (b.pass + b.fail),
  }))

  await renderChart(result, i, dest)
}

function getHistoryFiles(historyPath: string): string[] {
  if (!fs.existsSync(historyPath)) return []
  else if (fs.lstatSync(historyPath).isDirectory())
    return fs.readdirSync(historyPath).map((file: string) => path.join(historyPath, file))
  else return [historyPath]
}

async function renderChart(
  result: { [retr: number]: BinRes },
  totalR: number,
  dest: string
) {
  const normed: [string, number, number][] = _.sortBy(Object.keys(result), (v) =>
      parseFloat(v)
    ).map((v) => {
      const res = result[v]
      return [v, res.acc, res.pass + res.fail]
    }),
    filtered = normed.filter((v) => {
      const bin = parseFloat(v[0])
      return bin >= 0.9 && bin < 0.995
    }),
    total = _.sumBy(normed, (v) => v[2]),
    rmse = Math.sqrt(
      _.sumBy(normed, (v) => v[2] * Math.pow(v[1] - parseFloat(v[0]) + 0.025, 2)) / total
    )

  const canvas = new ChartJSNodeCanvas({
    width: 500,
    height: 500,
    backgroundColour: 'white',
  })

  const buffer = await canvas.renderToBuffer(
    {
      type: 'bar',
      data: {
        datasets: [
          {
            type: 'line',
            label: 'Actual calibration',
            data: filtered.map((c) => c[1]),
            yAxisID: 'y1',
            pointStyle: false,
            borderWidth: 1,
            borderColor: '#5d8ebd',
          },
          {
            type: 'line',
            label: 'Perfect calibration',
            data: filtered.map((c) => parseFloat(c[0])),
            yAxisID: 'y1',
            pointStyle: false,
            borderWidth: 1,
            borderColor: '#f29d58',
          },
          {
            type: 'bar',
            label: 'Number of reviews',
            data: filtered.map((c) => c[2]),
            yAxisID: 'y0',
            backgroundColor: '#97b9d6a0',
          },
        ],
        labels: filtered.map((c) => c[0]),
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: `Weigthed RMSE ${rmse.toFixed(4)} from ${Math.floor(
              totalR / 1000
            )}k reviews (${Math.floor(total / 1000)}k deep)`,
          },
          legend: { position: 'top', labels: { boxHeight: 4, boxWidth: 10 } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Predicted R' },
          },
          y0: {
            min: 0,
            max: _.max(filtered.map((c) => c[2])),
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Number of reviews' },
          },
          y1: {
            min: _.min(filtered.map((c) => Math.min(c[1], parseFloat(c[0])))),
            max: 1,
            title: { display: true, text: 'Actual R' },
          },
        },
      },
    },

    'image/png'
  )
  fs.writeFileSync(dest, buffer)
}
