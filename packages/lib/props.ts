import _ from 'lodash'
import * as t from './types'
import { computeElementInstance } from './expr'
import lcs from 'node-lcs'
import { card2Id } from './session'

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

export function isParent(
  elementId: string,
  parent: string,
  elements: t.IdMap<t.Element>
) {
  const stack: string[] = [..._.castArray(elementId)]

  while (stack.length) {
    const id = stack.pop()!,
      element = elements[id]
    if (!element) continue

    if (id === parent) return true
    for (const etype of element.parents ?? []) {
      stack.push(etype)
    }
  }

  return false
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
      if (element.props[propId] || !res[propId]) res[propId] = element.props[propId]
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

type MetaInstance = t.ElementInstance & {
  s: number
  v: string
}

export function findAliases(
  instance: t.ElementInstance,
  propName: string,
  elements: t.IdMap<t.Element>,
  cards: t.CardStates
) {
  const tv = computeElementInstance(instance, elements),
    target = tv[propName] as string,
    matchingInstances: { [iid: string]: MetaInstance } = {},
    exactInstances: { [iid: string]: t.ElementInstance } = {}

  for (let i = 0; i < 3; i++) {
    const simTarget = i + 1
    for (const elId in elements) {
      const element = elements[elId]

      if (element.virtual) continue

      const params = getElementParams(elId, elements),
        propNames = Object.keys(getElementProps(elId, elements)),
        matchingParams: { [paramName: string]: MetaInstance[] } = {}

      for (const paramName in params) {
        matchingParams[paramName] ??= []
        const param = params[paramName]
        for (const iid in matchingInstances) {
          const inst = matchingInstances[iid]
          if (isParent(inst.element, param, elements))
            matchingParams[paramName].push(inst)
        }
      }

      const paramNames = Object.keys(params),
        paramValues = paramNames.map((p) =>
          _.take(
            _.sortBy(matchingParams[p], (v) => -v.s),
            5
          )
        ),
        instances: t.ElementInstance[] = paramNames.length
          ? _.compact(
              permute(paramValues).map((perm) => {
                if (failsConstraint(perm, element.constraint)) return false
                const oinstance: t.ElementInstance = { element: elId, params: {} }
                for (const i in paramNames) oinstance.params![paramNames[i]] = perm[i]
                return oinstance
              })
            )
          : [{ element: elId, params: {} }]

      for (const oinstance of instances) {
        const iv = computeElementInstance(oinstance, elements),
          fvalue = getFlatPropValue(iv, propName),
          sim = getSimilarity(fvalue, target),
          iid = getInstanceId(oinstance)

        if (matchingInstances[iid]) continue
        if (sim >= simTarget) matchingInstances[iid] = { ...oinstance, s: sim, v: fvalue }
        if (
          iv[propName] === target &&
          !_.isEqual(_.pick(iv, propNames), _.pick(tv, propNames)) &&
          !!cards[card2Id({ element: oinstance.element, property: propName })]
        ) {
          exactInstances[propNames.map((n) => iv[n]).join('.')] = oinstance
        }
      }
    }
  }
  return Object.values(exactInstances)
}

function failsConstraint(insts: MetaInstance[], constraint?: string): boolean {
  const constraints: { [paramName: string]: string } = {}
  let failed = false
  for (const inst of insts) {
    for (const paramName in inst.params) {
      const paramValue = inst.params?.[paramName]
      if (!paramValue) continue

      if (
        constraint?.includes(paramName) &&
        constraints[paramName] &&
        constraints[paramName] !== paramValue.element
      ) {
        failed = true
        break
      } else {
        constraints[paramName] = paramValue?.element
      }
    }
    if (failed) break
  }
  return failed
}

function getInstanceId(i: t.ElementInstance) {
  return `${i.element}:(${Object.keys(i.params ?? {})
    .map((k) => `${k}:${getInstanceId(i.params?.[k]!)}`)
    .join(',')})`
}

function getFlatPropValue(pi: t.PropsInstance, propName: string) {
  let res = ''
  for (const j in pi) {
    const v = pi[j]
    if (j === propName) res += v
    if (v && typeof v !== 'string') res += '.' + getFlatPropValue(v, propName)
  }
  return res
}

function getSimilarity(a: string, b: string): number {
  return lcs(a, b)['sequence'].length
}

function permute<T>(lists: T[][]) {
  const [first, ...rest] = lists
  if (rest.length) {
    const rests = permute(rest),
      res: T[][] = []

    for (const l of first) {
      for (const r of rests) {
        res.push([l, ...r])
      }
    }
    return res
  } else return (first ?? []).map((v) => [v])
}

export function sampleElementIstance(
  id: string,
  elements: t.IdMap<t.Element>,
  fixedParams?: t.Params,
  order?: (elId: string) => number
): t.ElementInstance {
  const nonV = getNonVirtualDescendents(id, elements),
    descendents = order ? _.sortBy(nonV, order) : _.shuffle(nonV)
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
      const pinst = sampleElementIstance(params[param], elements, constraints, order)
      for (const childParam in pinst.params) {
        if (del.constraint?.includes(childParam))
          constraints[childParam] = pinst.params[childParam]!.element
      }
      inst.params![param] = pinst
    }

    return inst
  }
  throw 'sample not found'
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
    if (!elements[elId].virtual) cards.push(...getElementCards(elId, elements))
  }

  return cards
}

export function getElementCards(id: string, elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = [],
    props = getElementProps(id, elements)

  for (const propId in props) {
    const prop = props[propId]
    if (prop) cards.push({ element: id, property: propId })
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
