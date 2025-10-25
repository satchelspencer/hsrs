import { logistic, softClamp } from './schedule'
import * as t from './types'
import _ from 'lodash'
import { current, isDraft } from 'immer'
import { logger } from './log'
import { isFrag } from './props'

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

  const topoOrderIndexes: { [id: string]: number } = {},
    ancestorSets: { [id: string]: Set<string> } = {}
  for (let index = 0; index < topoOrder.length; index++) {
    const id = topoOrder[index],
      set = ancestorSets[id] ?? new Set([id])

    topoOrderIndexes[id] = index
    for (const p of tree.parents[id]) {
      set.add(p)
      const pset = ancestorSets[p]
      for (const ancestor of pset) set.add(ancestor)
    }

    ancestorSets[id] = set

    const firstAncestor = tree.parents[id][0]
    tree.firstAncestors[id] = firstAncestor
      ? [firstAncestor, ...tree.firstAncestors[firstAncestor]]
      : []
  }

  for (const id in ancestorSets) {
    const ancestors = [...ancestorSets[id]].sort(
      (a, b) => topoOrderIndexes[b] - topoOrderIndexes[a]
    )
    tree.roots[id] = ancestors.length > 1 ? _.last(ancestors) : undefined
    for (const aid of ancestors) tree.leaves[aid] = (tree.leaves[aid] ?? 0) + 1
    tree.ancestors[id] = ancestors
  }
  tree.topo = topoOrder.reverse()
}

function initTreeCache(): t.TreeCache {
  return {
    parents: {},
    children: {},
    ancestors: {},
    topo: [],
    leaves: {},
    roots: {},
    firstAncestors: {},
  }
}

/* get structure and heuristics from elements for fast lookups
tree, param-depth, leaves, name maps. */

const log = logger(2, 'cache')

export function getCache(relements: t.IdMap<t.Element>) {
  const elements = undraft(relements) //for when we're in a redux store
  if (elements === lastEls && lastCache) return lastCache
  log('cache')
  const t = new Date().getTime()
  const cache: t.DeckCache = {
    tree: initTreeCache(),
    paramTree: initTreeCache(),
    depthTree: initTreeCache(),
    depths: {},
    hasProps: {},
    hasParams: {},
    nvds: {},
    pdepths: {},
    names: {},
  }

  for (const id in elements) {
    cache.tree.parents[id] = elements[id].parents.slice()
    cache.tree.ancestors[id] = [id]
    cache.depths[id] = 0
  }

  getAncestors(elements, cache.tree)

  for (const id in elements) {
    const element = elements[id],
      root = cache.tree.roots[id] ?? '$',
      frag = isFrag(element)

    cache.names[root] ??= {}
    cache.names[root][element.name] = id

    for (const aid of cache.tree.ancestors[id]) {
      const ancestor = elements[aid]
      if (
        !cache.hasProps[id] &&
        !frag &&
        Object.keys(ancestor.props).find((c) => !!ancestor.props[c])
      )
        cache.hasProps[id] = true
      if (
        !cache.hasParams[id] &&
        ancestor.params &&
        Object.keys(ancestor.params).find((c) => !!ancestor.params?.[c])
      )
        cache.hasParams[id] = true
    }
  }

  for (const id in elements) {
    if (cache.hasProps[id]) {
      for (const aid of cache.tree.ancestors[id]) cache.hasProps[aid] = true
    }
  }

  const paramCounts: { [id: string]: number } = {},
    paramNVDCounts: { [id: string]: number } = {}

  for (const id in elements) {
    cache.paramTree.parents[id] ??= []
    cache.depthTree.parents[id] ??= []
    cache.depthTree.parents[id].push(...elements[id].parents.slice()) //depth tree has edges for both parent/child and param relationships

    if (elements[id].virtual) continue
    const ps: { [name: string]: true } = {},
      ancestors = cache.tree.ancestors[id]
    for (const aid of ancestors) {
      for (const pname in elements[aid].params) {
        const pvalue = elements[aid].params[pname]
        if (!ps[pname] && pvalue) {
          cache.paramTree.parents[pvalue] ??= []
          cache.paramTree.parents[pvalue].push(id)
          ps[pname] = true
          if (pname[0] !== '_' && !elements[aid]?.constraint?.includes(pname)) {
            cache.depthTree.parents[pvalue] ??= []
            cache.depthTree.parents[pvalue].push(id)
            cache.depths[id] = (cache.depths[id] ?? 0) + 1
            paramNVDCounts[id] = (paramNVDCounts[id] ?? 0) + cache.tree.leaves[pvalue]
            paramCounts[id] = (paramCounts[id] ?? 0) + 1
          }
        }
      }
    }
  }

  getAncestors(elements, cache.depthTree)

  getAncestors(elements, cache.paramTree)

  const paramNVDTotals: { [id: string]: number } = { ...paramNVDCounts },
    childLens: { [id: string]: number } = {},
    paramLens: { [id: string]: number } = {}

  for (const id of cache.depthTree.topo) {
    for (const aid of cache.depthTree.parents[id]) {
      const currentDepth = cache.depths[aid] ?? 0,
        nextDepth = cache.depths[id] ?? 0,
        currentNVD = paramNVDTotals[aid] ?? 0,
        nextNVD = paramNVDTotals[id] ?? 0

      if (elements[aid].virtual) {
        //in folder avg depths and nvds over children
        const currentLen = childLens[aid] ?? 0,
          nextLen = childLens[id] ?? 1,
          finalLen = currentLen + nextLen

        cache.depths[aid] = (currentLen * currentDepth + nextLen * nextDepth) / finalLen
        paramNVDTotals[aid] = (currentLen * currentNVD + nextLen * nextNVD) / finalLen
        childLens[aid] = finalLen
      } else {
        //in deep leaf avg nvds and sum depths
        const currentParam = paramLens[aid] ?? 1,
          finalParam = currentParam + 1

        cache.depths[aid] = currentDepth + nextDepth
        paramNVDTotals[aid] = (currentParam * currentNVD + nextNVD) / finalParam
        childLens[aid] = 1
        paramLens[aid] = finalParam
      }
    }
  }

  cache.nvds = paramNVDTotals

  for (const id in elements) {
    cache.pdepths[id] = cache.depths[id]
    //penalize depth
    cache.depths[id] = Math.min(
      cache.depths[id] * ((logistic((paramNVDTotals[id] ?? 0) / 50) - 0.5) * 2), //for low nvd counts
      Math.max(cache.depths[id] - Math.sqrt(cache.depths[id] - (paramCounts[id] ?? 0)), 0) //for "thin" trees
    )
    cache.depths[id] = softClamp(cache.depths[id], 3, 0)
  }
  log(cache, new Date().getTime() - t)

  lastCache = cache
  lastEls = elements
  return cache
}
