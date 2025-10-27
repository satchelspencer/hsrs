import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import { deckVersionable } from '@hsrs/lib/versions'

export function getOutput(srcDir: string) {
  const output = deckVersionable.create({ type: 'deck', elements: {} })

  fs.readdirSync(srcDir, { recursive: true }).forEach((file) => {
    if (file.endsWith('.json')) {
      const filePath = path.join(srcDir, file),
        element = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      output.elements[element._id] = _.omit(element, '_id') as any
    }
  })

  function name2id(name: string) {
    for (const id in output.elements) {
      if (output.elements[id].name === name) return id
    }
    return name
  }

  for (const elId in output.elements) {
    const element = output.elements[elId]

    element.parents = element.parents.map((n) => name2id(n))
    if (element.params) element.params = _.mapValues(element.params, (n) => name2id(n))
  }
  return output
}
