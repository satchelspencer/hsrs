import fs from 'fs'
import path from 'path'
import stringify from 'json-stable-stringify'
import _ from 'lodash'
import { getOutput } from './output'

export function importDir(destDir: string, deckPath: string) {
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })

  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'))

  function id2Name(id, deck) {
    return deck.elements[id]?.name ?? id
  }

  function getPath(id, deck) {
    const element = deck.elements[id],
      firstParent = element.parents[0]
    if (!firstParent) return []
    else return [...getPath(firstParent, deck), deck.elements[firstParent].name]
  }

  for (const elId in deck.elements) {
    const element = deck.elements[elId]

    const elDirPath = getPath(elId, deck)
    if (element.virtual) elDirPath.push(element.name)

    const dirPath = path.join(destDir, ...elDirPath)
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })

    fs.writeFileSync(
      path.join(dirPath, element.virtual ? '_.json' : `${element.name}.json`),
      stringify(
        {
          ...element,
          parents: element.parents.map((id) => id2Name(id, deck)),
          params:
            element.params && _.mapValues(element.params, (id) => id2Name(id, deck)),
          _id: elId,
        },
        { space: 2 }
      )!
    )
  }

  const output = getOutput(destDir)
  if (!_.isEqual(output, deck)) throw 'import failed to replicate'
}
