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
  elements: t.IdMap<t.Element>
): t.PropsInstance {
  const res: t.PropsInstance = {}

  Object.assign(res, getElementProps(elementId, elements))

  const params = _.mapValues(getElementParams(elementId, elements), (paramElement) =>
    getElementParamsAndProps(paramElement, elements)
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

export function getElementInstances(
  id: string,
  elements: t.IdMap<t.Element>,
  parents: string[] = []
): t.ElementInstance {
  const params = _.mapValues(getElementParams(id, elements), (paramElId) => {
    const matchingEl = _.shuffle(Object.keys(elements)).find(
      (id) =>
        !elements[id].virtual &&
        getElementAndParents(id, elements).includes(paramElId) &&
        !parents.includes(id)
    )
    return matchingEl && parents.length < 10
      ? getElementInstances(matchingEl, elements, [...parents, id])
      : undefined
  })
  const instance: t.ElementInstance = { element: id }
  if (Object.keys(params).length) instance.params = params
  return instance
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
