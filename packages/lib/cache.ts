import * as t from './types'
import _ from 'lodash'

let lastEls: t.IdMap<t.Element> | null = null,
  lastCache: t.DeckCache | null = null

function getAncestors(elements: t.IdMap<t.Element>, tree: t.TreeCache) {
  const inDegree: { [id: string]: number } = {}

  for (const id in elements) {
    tree.parents[id] ??= []
    tree.ancestors[id] ??= []
    tree.children[id] ??= []
    inDegree[id] ??= 0
  }

  for (const childId in elements) {
    for (const p of tree.parents[childId]) {
      tree.children[p] ??= []
      tree.children[p].push(childId)
    }
    inDegree[childId] += tree.parents[childId].length
  }

  const queue: string[] = []
  for (const id in elements) {
    if (inDegree[id] === 0) queue.push(id)
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    topoOrder.push(current)

    for (const child of tree.children[current]) {
      inDegree[child]--
      if (inDegree[child] === 0) queue.push(child)
    }
  }

  const topoOrderIndexes: { [id: string]: number } = {}
  for (let index = 0; index < topoOrder.length; index++) {
    const id = topoOrder[index]
    tree.ancestors[id] ??= []
    topoOrderIndexes[id] = index
    for (const p of tree.parents[id]) {
      tree.ancestors[id].push(p)
      for (const ancestor of tree.ancestors[p])
        if (!tree.ancestors[id].includes(ancestor)) tree.ancestors[id].push(ancestor)
    }
  }

  for (const id in tree.ancestors) {
    tree.ancestors[id].sort((a, b) => topoOrderIndexes[b] - topoOrderIndexes[a])
  }
}

export function getCache(elements: t.IdMap<t.Element>) {
  if (elements === lastEls && lastCache) return lastCache
  //console.trace('cache')
  const t = new Date().getTime()
  const cache: t.DeckCache = {
    tree: {
      parents: {},
      children: {},
      ancestors: {},
    },
    paramTree: {
      parents: {},
      children: {},
      ancestors: {},
    },
    depths: {},
  }

  for (const id in elements) {
    cache.tree.parents[id] = elements[id].parents.slice()
    cache.tree.ancestors[id] = [id]
    cache.depths[id] = 0
  }

  getAncestors(elements, cache.tree)

  const paramCounts: { [id: string]: number } = {}

  for (const id in elements) {
    const ps: { [name: string]: true } = {},
      ancestors = cache.tree.ancestors[id]
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const aid = ancestors[i]
      for (const pname in elements[aid].params) {
        const pvalue = elements[aid].params[pname]
        if (!ps[pname] && pvalue) {
          ps[pname] = true
          cache.paramTree.parents[pvalue] ??= []
          cache.paramTree.parents[pvalue].push(id)
          paramCounts[id] = (paramCounts[id] ?? 0) + 1
        }
      }
    }
  }

  getAncestors(elements, cache.paramTree)

  const paramTotals: { [id: string]: number } = {},
    paramLens: { [id: string]: number } = {}

  for (const id in elements) {
    for (const aid of cache.tree.ancestors[id]) {
      paramTotals[aid] = (paramTotals[aid] ?? 0) + (paramCounts[id] ?? 0)
      paramLens[aid] = (paramLens[aid] ?? 0) + 1
    }
  }

  for (const id in elements) {
    cache.depths[id] += paramTotals[id] / paramLens[id]
    for (const aid of cache.paramTree.ancestors[id]) cache.depths[aid] += cache.depths[id]
  }
  //console.log(cache, new Date().getTime() - t)

  lastCache = cache
  lastEls = elements
  return cache
}
