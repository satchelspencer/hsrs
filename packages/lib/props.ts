import _ from 'lodash'
import * as t from './types'

export function resolveTypes(elementIds: string | string[], elements: t.IdMap<t.Element>) {
  const res: string[] = [],
    stack: string[] = [..._.castArray(elementIds)]

  while (stack.length) {
    const id = stack.pop()!,
      element = elements[id]
    if (!element) continue
    res.push(id)
    for (const etype of element.types ?? []) {
      if (!res.includes(etype)) stack.push(etype)
    }
  }

  return res
}

export function resolveProps(typeId: string | string[], elements: t.IdMap<t.Element>) {
  const elementIds = resolveTypes(typeId, elements),
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

export function resolveChildProps(
  children: t.IdMap<string[]>,
  elements: t.IdMap<t.Element>
) {
  return _.mapValues(children, (childId) => {
    const props = resolveProps(childId, elements)
    return props
  })
}

export function getElementInstances(
  id: string,
  elements: t.IdMap<t.Element>
): t.ElementInstance {
  const children = _.mapValues(elements[id].children, (ctypes) => {
    const matchingEl = _.shuffle(Object.keys(elements)).find(
      (id) => _.intersection(ctypes, resolveTypes(elements[id].types, elements)).length
    )
    return matchingEl ? getElementInstances(matchingEl, elements) : undefined
  })
  const instance: t.ElementInstance = { element: id }
  if (Object.keys(children).length) instance.children = children
  return instance
}
