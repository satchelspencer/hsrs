import _ from 'lodash'
import * as t from './types'

export function getElementAndParents(elementId: string, elements: t.IdMap<t.Element>) {
  const res: string[] = [],
    stack: string[] = [..._.castArray(elementId)]

  while (stack.length) {
    const id = stack.pop()!,
      element = elements[id]
    if (!element) continue
    res.push(id)
    for (const etype of element.parents ?? []) {
      if (!res.includes(etype)) stack.push(etype)
    }
  }

  return res
}

export function getElementChildren(
  parentId: string | undefined,
  elements: t.IdMap<t.Element>
) {
  const keys: string[] = []
  for (const key in elements) {
    const element = elements[key]
    if (parentId ? element.parents.includes(parentId) : !element.parents.length)
      keys.push(key)
  }
  return keys
}

export function getVariables(instance: t.PropsInstance, prefix = ''): string[] {
  const res: string[] = []
  for (const key in instance) {
    const value = instance[key]
    if (_.isArray(value)) res.push((prefix ? '' : '_.') + key)
    else res.push(...getVariables(value, key))
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

  Object.assign(res, getElementProps(elementId, elements))

  const params = _.mapValues(getElementParams(elementId, elements), (paramElement) =>
    getElementParamsAndProps(paramElement, elements, depth - 1)
  )

  Object.assign(res, params)

  return res
}

export function getElementProps(elementId: string, elements: t.IdMap<t.Element>) {
  const elementIds = getElementAndParents(elementId, elements).reverse(),
    res: t.Props = {}

  for (const elementId of elementIds) {
    const element = elements[elementId]
    if (!element) continue
    for (const propId in element.props) {
      res[propId] ??= [null, null]
      for (const index in element.props[propId]) {
        if (element.props[propId][index] || !res[propId][index])
          res[propId][index] = element.props[propId][index]
      }
    }
  }

  return res
}

export function getElementParams(elementId: string, elements: t.IdMap<t.Element>) {
  const elementIds = getElementAndParents(elementId, elements).reverse(),
    res: t.Params = {}

  for (const elementId of elementIds) {
    const element = elements[elementId]
    if (!element) continue
    for (const propId in element.params) {
      if (element.params[propId]) res[propId] = element.params[propId]
    }
  }

  return res
}

export function satisfies(a: string, b: string, elements: t.IdMap<t.Element>) {
  const ap = getElementAndParents(a, elements),
    bp = getElementAndParents(b, elements)

  return ap.includes(b) ? a : bp.includes(a) ? b : undefined
}

function sampleElementIstance(
  id: string,
  elements: t.IdMap<t.Element>,
  fixedParams?: t.Params,
  depth = 0
): t.ElementInstance {
  const descendents = _.shuffle(getNonVirtualDescendents(id, elements))
  for (const descendent of descendents) {
    const del = elements[descendent],
      params = getElementParams(descendent, elements)

    let failed = false
    for (const fparam in fixedParams) {
      if (!params[fparam]) continue
      const common = satisfies(fixedParams[fparam], params[fparam], elements)
      if (!common) failed = true
      else params[fparam] = common
    }

    if (failed) continue

    const inst: t.ElementInstance = {
      element: descendent,
      params: {},
    }

    const constraints: t.Params = {}
    for (const param of _.shuffle(Object.keys(params))) {
      const pinst = sampleElementIstance(params[param], elements, constraints, depth + 1)
      for (const childParam in pinst.params) {
        if (del.constraint?.includes(childParam))
          constraints[childParam] = pinst.params[childParam]!.element
      }
      inst.params![param] = pinst
    }

    return inst
  }
  throw ''
}

export function* generateElementInstanceSamples(
  id: string,
  elements: t.IdMap<t.Element>
): Generator<t.ElementInstance> {
  let fails = 0
  while (fails < 1000) {
    try {
      yield sampleElementIstance(id, elements)
      fails = 0
    } catch {
      fails++
    }
  }
}

export function getNonVirtualDescendents(id: string, elements: t.IdMap<t.Element>) {
  const thisEl = elements[id]
  if (!thisEl.virtual) return [id]

  const output: string[] = [],
    parents: string[] = [id]

  while (parents.length) {
    const parent = parents.pop()!
    for (const elId in elements) {
      const el = elements[elId]
      if (el.parents.includes(parent)) {
        if (el.virtual) parents.push(elId)
        else if (!output.includes(elId)) output.push(elId)
      }
    }
  }

  return output
}

export function getAllCards(elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = []

  for (const elId in elements) {
    cards.push(...getElementCards(elId, elements))
  }

  return cards
}

export function getElementCards(id: string, elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = [],
    el = elements[id]
  for (const propId in el.props) {
    const prop = el.props[propId]
    if (prop?.[1]) cards.push({ root: id, property: propId, reverse: false })
  }
  return cards
}

function getResolvedElements(
  id: string,
  elements: t.IdMap<t.Element>,
  paramName: string
): string[] {
  const paramValue = getElementParams(id, elements)
  const element = elements[id]
  if (!element.virtual) return paramValue[paramName] ? [paramValue[paramName]] : []
  const res: string[] = []
  for (const cid in elements) {
    const cel = elements[cid]
    if (cel.parents.includes(id)) {
      res.push(...getResolvedElements(cid, elements, paramName))
    }
  }
  return _.uniq(res)
}

function findMissingElements(
  id: string,
  elements: t.IdMap<t.Element>,
  resolved: string[]
): string[] {
  const element = elements[id],
    parents = getElementAndParents(id, elements)
  if (!element.virtual) return _.intersection(resolved, parents).length ? [] : [id]
  const res: string[] = []
  let whollyMissing = true
  for (const cid in elements) {
    const cel = elements[cid]
    if (cel.parents.includes(id)) {
      const missing = findMissingElements(cid, elements, resolved)
      if (missing.length !== 1 || missing[0] !== cid) whollyMissing = false
      res.push(...missing)
    }
  }
  return whollyMissing && res.length ? [id] : res
}

export function findMissingInstances(id: string, elements: t.IdMap<t.Element>) {
  const params = getElementParams(id, elements)
  const res: { [n: string]: string[] } = {}
  for (const paramName in params) {
    const resolved = getResolvedElements(id, elements, paramName),
      missing = findMissingElements(params[paramName], elements, resolved)
    res[paramName] = missing
  }
  return res
}

export function findCommonAncestors(
  parentId: string,
  ids: string[],
  elements: t.IdMap<t.Element>
) {
  const ancestors = ids.map((id) => getElementAndParents(id, elements))

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
