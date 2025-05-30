import { Command } from 'commander'
import fs from 'fs'
import _ from 'lodash'
import { deckVersionable } from '@hsrs/lib/versions'
import { getCache } from '@hsrs/lib/cache'
import { simpleElementSample } from '@hsrs/lib/sample'
import { setLogLevel } from '@hsrs/lib/log'
import path from 'path'

const program = new Command()
program.name('hsrs').version('1.0.0')

program
  .command('learnh')
  .description('Analyze learn history')
  .argument('<string>', 'path to deck file')
  .requiredOption('-e, --element <string>', 'element to analyze')
  .action(async (str, options) => {
    const { getLlama } = await import('node-llama-cpp')
    const llama = await getLlama()
    const model = await llama.loadModel({
      modelPath: path.join(
        __dirname,
        '../models',
        //'Llama-4-Scout-17B-6E-Instruct.i1-Q4_K_S.gguf'
        //'llama1B.Q8_0.gguf'
        //'Meta-Llama-3.1-8B-Instruct-Q4_K_S.gguf'
        'nekomata-7b.Q4_K_S.gguf'
      ),
    })
    const context = await model.createContext()
    const sequence = context.getSequence()

    await sequence.evaluateWithoutGeneratingNewTokens(model.tokenize('a'))
    console.log('ready...')
    setLogLevel('simple')
    const elements = deckVersionable.create(
      JSON.parse(fs.readFileSync(str, 'utf8'))
    ).elements

    const cache = getCache(elements),
      root = Object.keys(cache.names)[0],
      elId = cache.names[root][options.element]

    const fetch = await import('node-fetch')

    const res = await simpleElementSample(
      elId,
      elements,
      cache,
      'jp',
      async (prefix, options) => {
        const tokens = model.tokenize(prefix)
        const last = tokens.pop()!

        await sequence.clearHistory()
        await sequence.evaluateWithoutGeneratingNewTokens(tokens)

        const res = await sequence
          .evaluateWithMetadata([last], { confidence: true, probabilities: true })
          .next()

        return options.map((v, i) => {
          const tt = model.tokenize(v)
          return res.value!.probabilities.get(tt[0]) ?? 0
        })
      },
      async (str) => {
        const [first, ...rest] = model.tokenize(str)

        if (!rest.length) return 1

        await sequence.clearHistory()

        const it = sequence.evaluateWithMetadata([first], { confidence: true }, {})

        let sum = 0
        for (let i = 0; i < rest.length; i++) {
          const res = await it.next(rest[i])
          sum += res.value!.confidence
        }

        return sum / rest.length
      }
    )
  })

program.parse()
