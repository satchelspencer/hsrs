import * as t from './types'
import _ from 'lodash'

let lastEls: t.IdMap<t.Element> | null = null,
  lastCache: t.DeckCache | null = null

export function getCache(elements: t.IdMap<t.Element>) {
  if (elements === lastEls && lastCache) return lastCache
  //console.trace('cache')
  const t = new Date().getTime()
  const cache: t.DeckCache = {
    parents: {},
    children: {},
    ancestors: {},
  }

  for (const id in elements) {
    cache.parents[id] = elements[id].parents.slice()
    cache.children[id] = []
    cache.ancestors[id] = [id]
  }

  const inDegree: { [id: string]: number } = {}
  for (const childId in elements) {
    for (const p of cache.parents[childId]) cache.children[p].push(childId)
    inDegree[childId] = (inDegree[childId] ?? 0) + cache.parents[childId].length
  }

  const queue: string[] = []
  for (const id in elements) {
    if (inDegree[id] === 0) queue.push(id)
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    topoOrder.push(current)

    for (const child of cache.children[current]) {
      inDegree[child]--
      if (inDegree[child] === 0) queue.push(child)
    }
  }

  const topoOrderIndexes: { [id: string]: number } = {}
  for (let index = 0; index < topoOrder.length; index++) {
    const id = topoOrder[index]
    topoOrderIndexes[id] = index
    for (const p of cache.parents[id]) {
      cache.ancestors[id].push(p)
      for (const ancestor of cache.ancestors[p])
        if (!cache.ancestors[id].includes(ancestor)) cache.ancestors[id].push(ancestor)
    }
  }

  for (const id in cache.ancestors) {
    cache.ancestors[id].sort((a, b) => topoOrderIndexes[b] - topoOrderIndexes[a])
  }

  //console.log(cache, new Date().getTime() - t)

  lastCache = cache
  lastEls = elements
  return cache
}
