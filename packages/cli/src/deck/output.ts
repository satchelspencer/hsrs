import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import { deckVersionable } from '@hsrs/lib/versions'

export async function getOutput(srcDir: string) {
  const output = deckVersionable.create({ type: 'deck', elements: {} })

  const files = fs.readdirSync(srcDir, { recursive: true }).map((c) => String(c)),
    chunks = _.chunk(files, 2048)
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map((file) => {
        if (file.endsWith('.json')) {
          return new Promise<void>((res) => {
            const filePath = path.join(srcDir, file)
            fs.readFile(filePath, 'utf8', (e, v) => {
              const element = JSON.parse(v)
              output.elements[element._id] = _.omit(element, '_id') as any
              res()
            })
          })
        }
      })
    )
  }

  const nameToId = new Map<string, string>()
  for (const id in output.elements) {
    const name = output.elements[id].name
    if (name && !nameToId.has(name)) nameToId.set(name, id)
  }

  function name2id(name: string) {
    return nameToId.get(name) ?? name
  }

  for (const elId in output.elements) {
    const element = output.elements[elId]

    element.parents = element.parents.map((n) => name2id(n))
    if (element.params) element.params = _.mapValues(element.params, (n) => name2id(n))
  }
  return output
}
