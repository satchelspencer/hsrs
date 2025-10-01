import _ from 'lodash'
import * as t from './types'
import { getCache } from './cache'

export function getVariables(instance: t.PropsInstance, prefix = ''): string[] {
  const res: string[] = []
  for (const key in instance) {
    const value = instance[key]
    if (_.isObject(value)) res.push(...getVariables(value, key))
    else res.push((prefix ? '' : '_.') + key, (prefix ? '' : '$.') + key)
  }
  return prefix ? res.map((p) => prefix + '.' + p) : res
}

export function getElementParamsAndProps(
  elementId: string,
  elements: t.IdMap<t.Element>,
  depth = 10
): t.PropsInstance {
  const res: t.PropsInstance = {}

  if (!depth) return res

  const element = getInheritedElement(elementId, elements),
    params = _.mapValues(element.params ?? {}, (paramElement) =>
      getElementParamsAndProps(paramElement, elements, depth - 1)
    )
  Object.assign(res, element.props)
  Object.assign(res, params)

  return res
}

export function getInheritedElement(
  elementId: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache = getCache(elements),
  cmap?: t.ParamsMap
): t.Element {
  const element = { ...elements[elementId] },
    inheritedProps: t.Props = {},
    inheritedParams: t.Params = {},
    inheritedcpmap: t.ChildParamsMap = {}
  let inheritedConstraint: string = '',
    inheritedMode: string = '',
    inheritedRetention: string = ''

  const ancestors = cache.tree.ancestors[elementId] ?? []
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const id = ancestors[i],
      element = elements[id]
    if (!element) continue
    for (const propId in element.props) {
      if (element.props[propId] || !inheritedProps[propId])
        inheritedProps[propId] = element.props[propId]
    }
    for (const propId in element.params) {
      if (element.params[propId]) inheritedParams[propId] = element.params[propId]
    }
    if (element.constraint) inheritedConstraint = element.constraint
    if (element.mode)
      inheritedMode = satisfiesMode(element.mode, inheritedMode) ?? element.mode
    if (element.retention) inheritedRetention = element.retention
    if (element.cpmap) {
      for (const parent in element.cpmap) {
        for (const child in element.cpmap[parent]) {
          const src = element.cpmap[parent][child]
          if (src) {
            inheritedcpmap[parent] ??= {}
            inheritedcpmap[parent][child] = src
          }
        }
      }
    }
  }

  element.props = inheritedProps
  if (Object.keys(inheritedParams).length) element.params = inheritedParams
  if (inheritedConstraint) element.constraint = inheritedConstraint
  if (inheritedMode) element.mode = inheritedMode
  if (inheritedRetention) element.retention = inheritedRetention
  element.order = getElementOrder(elementId, elements)
  element.cpmap = inheritedcpmap
  if (cmap) applyCMap(element, cmap)
  return element
}

export function applyCMap(element: t.Element, cmap: t.ParamsMap) {
  for (const src in cmap) {
    const dest = cmap[src]
    for (const pname in element.props) {
      const pval = element.props[pname]
      if (pval) element.props[pname] = pval.replaceAll(src + '.', dest + '.')
    }
    if (element.constraint) element.constraint = element.constraint.replaceAll(src, dest)
    if (element.params?.[src]) {
      element.params[dest] = element.params[src]
      delete element.params[src]
    }
    if (element.cpmap) {
      for (const pname in element.cpmap) {
        const pcmap = element.cpmap[pname]
        if (pcmap[src]) {
          pcmap[dest] = pcmap[src]
          delete pcmap[src]
        }
      }
    }
  }
  //if (Object.keys(cmap).length) console.log('mapp', element)
}

export function getElementOrder(elementId: string, elements: t.IdMap<t.Element>) {
  let root = elementId
  const decs: string[] = []
  while (root) {
    const el = elements[root]
    if (!el) break
    if (el.order) decs.unshift(el.order)
    root = el.parents[0]
  }
  return decs.join('.')
}

export function satisfies(a: string, b: string, cache: t.DeckCache) {
  const ap = cache.tree.ancestors[a],
    bp = cache.tree.ancestors[b]

  return ap.includes(b) ? a : bp.includes(a) ? b : undefined
}

function getCommon(a: string = '-', b: string = '-') {
  return (a === '-' ? b : a) ?? '-'
}

export function satisfiesMode(a: string = '', b: string = '') {
  const maxLen = Math.max(a.length, b.length)
  let common = ''
  for (let i = 0; i < maxLen; i++) {
    const av = a[i],
      bv = b[i]

    if (av?.match(/[A-Z]/)) common = common + av
    else if (
      av &&
      bv &&
      av !== '-' &&
      av !== '*' &&
      bv !== '-' &&
      bv !== '*' &&
      av.toLowerCase() !== bv.toLowerCase()
    )
      return undefined
    else if (bv?.match(/[A-Z]/)) common = common + bv
    else common = common + getCommon(av, bv)
  }
  return common
}

export function getNonVirtualDescendents(
  id: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache
) {
  const thisEl = elements[id]
  if (!thisEl.virtual) return [id]

  const output: string[] = [],
    parents: string[] = [id]

  while (parents.length) {
    const parent = parents.pop()!
    for (const elId of cache.tree.children[parent]) {
      const el = elements[elId]
      if (!el) continue
      else if (el.virtual) parents.push(elId)
      else if (!output.includes(elId)) output.push(elId)
    }
  }

  return output
}

export function getAllCards(elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = []

  for (const elId in elements) {
    if (!elements[elId].virtual) cards.push(...getElementCards(elId, elements))
  }

  return cards
}

function getElementCards(id: string, elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = [],
    element = getInheritedElement(id, elements)

  if (isFrag(element)) return []

  for (const propId in element.props) {
    if (propId[0] === '_') continue //skip meta props
    const prop = element.props[propId]
    if (prop) cards.push({ element: id, property: propId })
  }
  return cards
}

export function findCommonAncestors(
  parentId: string,
  ids: string[],
  elements: t.IdMap<t.Element>
) {
  const cache = getCache(elements),
    ancestors = ids.map((id) => cache.tree.ancestors[id])

  const stack: string[] = [parentId]
  let common: string | null = null,
    minDistance = Infinity

  while (stack.length) {
    const parent = stack.shift()!,
      totalDistance = _.sum(
        ancestors.map((c) => (c.includes(parent) ? c.indexOf(parent) : Infinity))
      )
    if (totalDistance < minDistance) {
      common = parent
      minDistance = totalDistance
      stack.push(
        ...Object.keys(elements).filter(
          (e) => elements[e].parents.includes(parent) && elements[e].virtual
        )
      )
    }
  }
  return common
}

export function getLearnOrder(
  element: string,
  deck: t.Deck,
  maxOrder?: string,
  priorityDeep?: boolean,
  cache = getCache(deck.elements)
) {
  const startOrder =
      (maxOrder ?? '') > (deck.settings.startOrder ?? '')
        ? maxOrder
        : deck.settings.startOrder,
    order = getElementOrder(element, deck.elements),
    pre = !(priorityDeep && cache.depths[element]) && !!startOrder && order < startOrder,
    final = maxOrder
      ? element //use the base 36 id as the source of randomness
          .substring(0, 6)
          .split('')
          .map((c) => Math.floor(parseInt(c, 36) / 3.6) + '')
      : []

  final[2] = Math.floor(9 / Math.sqrt(cache.paramTree.parents[element]?.length || 1)) + ''

  Object.assign(final, order.split('.'))
  if (pre) Object.assign(final, startOrder.split('.'))

  return { order: final.join('.'), pre }
}

export function computeDescs(
  elementId: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache = getCache(elements)
) {
  const ancestors = cache.tree.ancestors[elementId],
    descs: [string, string][] = []

  for (const id of ancestors) {
    const el = elements[id]
    if (el.desc) descs.push([id, el.desc])
  }

  return descs
}

export function isRelation(element: t.Element) {
  return (
    !!element.virtual &&
    Object.keys(element.params ?? {}).length === 2 &&
    Object.keys(element.props).length === 0
  )
}

export function isFrag(element: t.Element) {
  return element.name[0] === '$'
}
