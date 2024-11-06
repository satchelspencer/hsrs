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

export function getElementProps(elementId: string, elements: t.IdMap<t.Element>) {
  const elementIds = getElementAndParents(elementId, elements),
    res: t.Props = {}

  for (const elementId of elementIds) {
    const element = elements[elementId]
    if (!element) continue
    for (const propId in element.props) {
      if (!res[propId]) res[propId] = element.props[propId]
    }
  }

  return res
}

export function getParamsProps(params: t.IdMap<string>, elements: t.IdMap<t.Element>) {
  return _.mapValues(params, (paramElId) => {
    const props = getElementProps(paramElId, elements)
    return props
  })
}

export function getElementInstances(
  id: string,
  elements: t.IdMap<t.Element>,
  depth = 10
): t.ElementInstance {
  const params = _.mapValues(elements[id].params, (paramElId) => {
    const matchingEl = _.shuffle(Object.keys(elements)).find(
      (id) =>
        !elements[id].virtual && getElementAndParents(id, elements).includes(paramElId)
    )
    return matchingEl && depth
      ? getElementInstances(matchingEl, elements, depth - 1)
      : undefined
  })
  const instance: t.ElementInstance = { element: id }
  if (Object.keys(params).length) instance.params = params
  return instance
}
