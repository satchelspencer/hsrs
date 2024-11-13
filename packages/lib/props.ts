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

    for (const selectedOptions of generatorMapValues(descOptions)) {
      const childParams: t.Params = {}

      let failed = false
      for (const paramName in selectedOptions) {
        const thisChildParams = getElementParams(selectedOptions[paramName], elements)
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
        const fixedGenerators = _.mapValues(
          childParams,
          (param) => () =>
            arrayGenerator(_.shuffle(getNonVirtualDescendents(param, elements)))
        )
        for (const fixedParams of generatorMapValues(fixedGenerators)) {
          const childGenerators = _.mapValues(
            selectedOptions,
            (param) => () => generateElementInstances(param, elements, fixedParams)
          )
          for (const child of generatorMapValues(childGenerators)) {
            const thisInstance = Object.keys(child).length
                ? { ...instance, params: child }
                : instance,
              hasDupes = hasDuplicateElements(
                thisInstance,
                Object.values({ ...childParams, ...fixedParams })
              )

            if (!hasDupes) {
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
