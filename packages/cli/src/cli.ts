import { Command } from 'commander'
import fs from 'fs'
import _ from 'lodash'
import { deckVersionable, historyVersionable } from '@hsrs/lib/versions'
import { getCache } from '@hsrs/lib/cache'
import {
  DeckCache,
  IdMap,
  Element,
  CardLearning,
  CardStates,
  Deck,
} from '@hsrs/lib/types'
import { getInheritedElement, getNonVirtualDescendents } from '@hsrs/lib/props'
import { card2Id, id2Card } from '@hsrs/lib/session'
import { getInstanceId } from '@hsrs/lib/alias'
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import { DateTime } from 'luxon'
import { applyHistoryToCards } from '@hsrs/lib/schedule'
import { title } from 'process'

const program = new Command()
program.name('hsrs').version('1.0.0')

program
  .command('learnh')
  .description('Analyze learn history')
  .argument('<string>', 'path to history file')
  .requiredOption('-d, --deck <string>', 'path to deck')
  .requiredOption('-e, --element <string>', 'element to analyze')
  .action(async (str, options) => {
    const history = historyVersionable.create(
        JSON.parse(fs.readFileSync(str, 'utf8'))
      ).history,
      elements = deckVersionable.create(
        JSON.parse(fs.readFileSync(options.deck, 'utf8'))
      ).elements

    const cache = getCache(elements),
      root = Object.keys(cache.names)[0],
      elId = cache.names[root][options.element]

    const deck: Deck = {
      cards: {},
      elements: {},
      session: null,
      settings: { newSessionSize: 1, allowNew: false },
    }
    const ids: { [id: string]: number } = {},
      bins: { [date: number]: CardLearning[] } = {}
    for (const learning of history) {
      const { element } = id2Card(learning.cardId)
      if (cache.tree.ancestors[element]?.includes(elId)) {
        applyHistoryToCards(deck.cards, [learning], deck)

        const id = getInstanceId({ element, params: learning.params })
        if (!ids[id]) ids[id] = learning.time

        const bin = DateTime.fromSeconds(learning.time).startOf('week').toSeconds()
        bins[bin] ??= []
        bins[bin].push(learning)
      }
    }

    const sks = _.sortBy(Object.keys(bins), (b) => parseInt(b))

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: '#ffffff',
    })
    const image = await chartJSNodeCanvas.renderToBuffer({
      type: 'line',
      data: {
        labels: sks.map((s) => DateTime.fromSeconds(parseInt(s)).localWeekNumber),
        datasets: [
          // {
          //   type: 'line',
          //   label: 'Accuracy',
          //   data: sks.map(
          //     (s) => bins[s].filter((s) => s.score > 1).length / bins[s].length
          //   ),
          //   tension: 0.2,
          //   yAxisID: 'y1',
          //   borderColor: 'rgba(54, 162, 235, 0.6)',
          // },
          // {
          //   type: 'bar',
          //   label: 'New learned',
          //   backgroundColor: 'rgba(58, 221, 55, 0.67)',
          //   data: sks.map(
          //     (s) =>
          //       bins[s].filter((l) => l.time === deck.cards[l.cardId].firstSeen).length
          //   ),
          //   yAxisID: 'y2',
          // },
          {
            label: 'Time spent / week (h)',
            type: 'bar',
            backgroundColor: 'rgba(58, 221, 55, 0.67)',
            data: sks.map((s) => _.sumBy(bins[s as any], (b) => b.took) / 3600),
            yAxisID: 'y3',
          },
          {
            label: 'Cumulative time (h)',
            type: 'line',
            backgroundColor: 'rgb(189, 189, 189)',
            data: _.reduce(
              sks.map((s) => _.sumBy(bins[s as any], (b) => b.took) / 3600),
              (m, v) => {
                return [...m, v + (_.last(m) ?? 0)]
              },
              [] as number[]
            ),
            yAxisID: 'y4',
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
        },
        scales: {
          // y1: {
          //   type: 'linear',
          //   position: 'left',
          //   title: { display: true, text: 'Accuracy' },
          //   min: 0,
          //   max: 1,
          // },
          // y2: {
          //   type: 'linear',
          //   position: 'right',
          //   title: { display: true, text: 'Card count' },
          //   grid: { drawOnChartArea: false },
          // },
          y3: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Hours / week' },
          },
          y4: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Total hours' },
          },
          x: {
            title: { display: true, text: 'Week' },
          },
        },
      },
    })
    fs.writeFileSync('./chart.png', image)

    const image2 = await chartJSNodeCanvas.renderToBuffer({
      type: 'line',
      data: {
        labels: sks.map((s, i) => i), //DateTime.fromSeconds(parseInt(s)).localWeekNumber),
        datasets: [
          {
            type: 'line',
            label: 'Accuracy (%)',
            data: sks.map(
              (s) => (bins[s].filter((s) => s.score > 1).length / bins[s].length) * 100
            ),
            tension: 0.2,
            yAxisID: 'y2',
            borderColor: 'rgba(111, 235, 54, 0.6)',
          },
          {
            type: 'line',
            label: 'Possible conjugations',
            data: sks.map((sk, i) => {
              console.log(i)
              return (
                getElPermutations(elId, elements, cache, deck.cards, parseInt(sk)) / 3
              )
            }),
            tension: 0.2,
            yAxisID: 'y1',
            borderColor: 'rgba(176, 176, 176, 0.6)',
          },
          {
            type: 'line',
            label: 'Seen conjugations',
            data: sks.map((sk) => {
              const time = parseInt(sk)
              let total = 1
              for (const cardId in ids) {
                if (ids[cardId] < time) total++
              }
              return total / 3
            }),
            tension: 0.2,
            yAxisID: 'y1',
            borderColor: 'rgba(54, 162, 235, 0.6)',
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: true },
        },
        scales: {
          y1: {
            type: 'logarithmic',
            position: 'right',
            title: { display: true, text: 'Count' },
          },
          y2: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Accuracy' },
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
          },
          x: {
            title: { text: 'Week', display: true },
          },
        },
      },
    })
    console.log(
      sks.map((sk) => {
        const time = parseInt(sk)
        let total = 1
        for (const cardId in ids) {
          if (ids[cardId] < time) total++
        }
        return total / 3
      })
    )
    fs.writeFileSync('./chart2.png', image2)
  })

program.parse()

function getElPermutations(
  elId: string,
  elements: IdMap<Element>,
  cache: DeckCache,
  cards: CardStates,
  before: number,
  ctxt: string[] = []
) {
  let perms = 1
  if (ctxt.includes(elId) || ctxt.length > 2) return perms

  const ndvs = getNonVirtualDescendents(elId, elements, cache),
    childCtxt = [...ctxt, elId]

  for (const d of ndvs) {
    const el = getInheritedElement(d, elements, cache)
    for (const prop in el.props) {
      const state = cards[card2Id({ element: d, property: prop })]
      if (!state?.firstSeen || state.firstSeen > before) continue
      let prod = 1
      for (const param in el.params) {
        const paramElId = el.params[param]
        const perms = getElPermutations(
          paramElId,
          elements,
          cache,
          cards,
          before,
          childCtxt
        )
        if (!el.constraint?.includes(param)) prod += perms
      }
      perms += prod
    }
  }
  return perms
}
