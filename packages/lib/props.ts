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

function* generatorMapValues<T>(gens: {
  [key: string]: () => Generator<T>
}): Generator<{ [key: string]: T }> {
  const keys = Object.keys(gens)
  if (!keys.length) yield {}
  else {
    const [key, ...rest] = Object.keys(gens)
    for (const v of gens[key]()) {
      for (const r of generatorMapValues(_.pick(gens, rest))) {
        yield {
          [key]: v,
          ...r,
        }
      }
    }
  }
}

function* arrayGenerator<T>(arr: T[]): Generator<T> {
  for (const item of arr) {
    yield item
  }
}

function getAllLeafElements(instance: t.ElementInstance): string[] {
  const params = Object.keys(instance.params ?? {})
  return params.length
    ? params.flatMap((k) => getAllLeafElements(instance.params![k]!))
    : [instance.element]
}

function hasDuplicateElements(instance: t.ElementInstance, exclude: string[]) {
  const all = _.difference(getAllLeafElements(instance), exclude)
  return all.length !== _.uniq(all).length
}

export function generateElementParams(
  elementId: string,
  elements: t.IdMap<t.Element>,
  fixedParams?: t.Params
) {
  const params = getElementParams(elementId, elements)
  const descOptions: { [paramName: string]: () => Generator<string> } = {}
  for (const paramName in params)
    descOptions[paramName] = () =>
      arrayGenerator(
        _.shuffle(
          getNonVirtualDescendents(
            fixedParams?.[paramName] ?? params[paramName],
            elements
          )
        )
      )
  return generatorMapValues(descOptions)
}

export function* shuffleGenerator<T>(
  generator: Generator<T>,
  blockSize = 100
): Generator<T> {
  let done = false
  while (!done) {
    let items: T[] = []
    for (let i = 0; i < blockSize; i++) {
      const next = generator.next()
      if (next.done) {
        done = true
        break
      }
      items.push(next.value)
    }
    items = _.shuffle(items)
    for (const item of items) yield item
  }
}

export function* generateElementInstances(
  id: string,
  elements: t.IdMap<t.Element>,
  fixedParams?: t.Params
): Generator<t.ElementInstance> {
  const descendents = _.shuffle(getNonVirtualDescendents(id, elements))

  let yielded = false
  for (const elementId of descendents) {
    const instance: t.ElementInstance = { element: elementId },
      constraint = elements[elementId].constraint ?? ''

    for (const selectedOptions of generateElementParams(
      elementId,
      elements,
      fixedParams
    )) {
      const childParams: t.Params = {}

      const childParamsGenerator = generatorMapValues(
        _.mapValues(
          selectedOptions,
          (option) => () => generateElementParams(option, elements)
        )
      )

      for (const nestedChildParams of childParamsGenerator) {
        let failed = false
        for (const paramName in nestedChildParams) {
          const thisChildParams = nestedChildParams[paramName]
          for (const cParamName in thisChildParams) {
            if (!constraint.includes(cParamName)) continue

            const cParamValue = thisChildParams[cParamName],
              common = childParams[cParamName]
                ? satisfies(childParams[cParamName], cParamValue, elements)
                : cParamValue

            if (common) childParams[cParamName] = common
            else {
              failed = true
              break
            }
          }
          if (failed) break
        }
        if (!failed) {
          const childGenerators = _.mapValues(
            selectedOptions,
            (param, paramName) => () =>
              generateElementInstances(param, elements, nestedChildParams[paramName])
          )
          for (const child of generatorMapValues(childGenerators)) {
            const thisInstance = Object.keys(child).length
                ? { ...instance, params: child }
                : instance,
              hasDupes = hasDuplicateElements(
                thisInstance,
                Object.values({ ...childParams, ...fixedParams })
              ),
              hasEmptyProps = _.some(elements[thisInstance.element].props, (p) =>
                _.some(p, (p) => p === 'null')
              )

            if (!hasDupes && !hasEmptyProps) {
              yield thisInstance
              yielded = true
            }
          }
        }
      }
    }
  }

  if (yielded && !fixedParams)
    for (const looped of generateElementInstances(id, elements)) {
      yield looped
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
