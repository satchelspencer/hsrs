import { logistic } from './schedule'
import * as t from './types'
import _ from 'lodash'
import { current, isDraft } from 'immer'

function undraft<T>(v: T): T {
  return isDraft(v) ? current(v) : v
}

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
    for (const aid of tree.ancestors[id]) tree.leaves[aid] = (tree.leaves[aid] ?? 0) + 1
  }
  tree.topo = topoOrder.reverse()
}

export function getCache(relements: t.IdMap<t.Element>) {
  const elements = undraft(relements)
  if (elements === lastEls && lastCache) return lastCache
  //console.trace('cache')
  const t = new Date().getTime()
  const cache: t.DeckCache = {
    tree: { parents: {}, children: {}, ancestors: {}, topo: [], leaves: {} },
    paramTree: { parents: {}, children: {}, ancestors: {}, topo: [], leaves: {} },
    depths: {},
    hasProps: {},
    nvds: {},
    pdepths: {},
  }

  for (const id in elements) {
    cache.tree.parents[id] = elements[id].parents.slice()
    cache.tree.ancestors[id] = [id]
    cache.depths[id] = 0
  }

  getAncestors(elements, cache.tree)

  for (const id in elements) {
    for (const aid of cache.tree.ancestors[id]) {
      const ancestor = elements[aid]
      if (
        !cache.hasProps[id] &&
        Object.keys(ancestor.props).find((c) => !!ancestor.props[c])
      )
        cache.hasProps[id] = true
    }
  }

  for (const id in elements) {
    if (cache.hasProps[id]) {
      for (const aid of cache.tree.ancestors[id]) cache.hasProps[aid] = true
    }
  }

  const paramLens: { [id: string]: number } = {},
    paramNVDCounts: { [id: string]: number } = {}

  for (const id in elements) {
    cache.paramTree.parents[id] ??= []
    cache.paramTree.parents[id].push(...elements[id].parents.slice())
    if (elements[id].virtual) continue
    const ps: { [name: string]: true } = {},
      ancestors = cache.tree.ancestors[id]
    for (const aid of ancestors) {
      for (const pname in elements[aid].params) {
        const pvalue = elements[aid].params[pname]
        if (!ps[pname] && pvalue && cache.hasProps[pvalue]) {
          ps[pname] = true
          cache.paramTree.parents[pvalue] ??= []
          cache.paramTree.parents[pvalue].push(id)
          cache.depths[id] = (cache.depths[id] ?? 0) + 1
          paramNVDCounts[id] = (paramNVDCounts[id] ?? 0) + cache.tree.leaves[pvalue]
        }
      }
    }
  }

  getAncestors(elements, cache.paramTree)

  const paramNVDTotals: { [id: string]: number } = { ...paramNVDCounts }

  for (const id of cache.paramTree.topo) {
    for (const aid of cache.paramTree.parents[id]) {
      const currentDepth = cache.depths[aid] ?? 0,
        nextDepth = cache.depths[id] ?? 0

      if (elements[aid].virtual) {
        const currentLen = paramLens[aid] ?? 0,
          nextLen = paramLens[id] ?? 1,
          finalLen = currentLen + nextLen

        cache.depths[aid] = (currentLen * currentDepth + nextLen * nextDepth) / finalLen
        paramLens[aid] = finalLen
      } else {
        cache.depths[aid] = currentDepth + nextDepth
        paramLens[aid] = 1
      }

      paramNVDTotals[aid] = (paramNVDTotals[aid] ?? 0) + (paramNVDTotals[id] ?? 0)
    }
  }

  cache.nvds = paramNVDTotals

  for (const id in elements) {
    cache.pdepths[id] = cache.depths[id]
    cache.depths[id] *= (logistic((paramNVDTotals[id] ?? 0) / 50) - 0.5) * 2
  }
  //console.log(cache, new Date().getTime() - t)

  lastCache = cache
  lastEls = elements
  return cache
}
