import _ from 'lodash'
import * as t from './types'

export function resolveTypes(typeId: string | string[], types: t.IdMap<t.Type>) {
  const res: string[] = [],
    stack: string[] = [..._.castArray(typeId)]

  while (stack.length) {
    const id = stack.pop()!,
      type = types[id]
    if (!type) continue
    res.push(id)
    for (const etype of type.extends ?? []) {
      if (!res.includes(etype)) stack.push(etype)
    }
  }

  return res
}

export function resolveProps(typeId: string | string[], types: t.IdMap<t.Type>) {
  const typeIds = resolveTypes(typeId, types),
    res: t.Props = {}

  for (const typeId of typeIds) {
    const type = types[typeId]
    if (!type) continue
    for (const propId in type.props) {
      if (!res[propId]) res[propId] = type.props[propId]
    }
  }

  return res
}

export function resolveChildProps(children: t.IdMap<string[]>, types: t.IdMap<t.Type>) {
  return _.mapValues(children, (childId) => {
    const props = resolveProps(childId, types)
    return props
  })
}

export function getElementInstances(
  id: string,
  elements: t.IdMap<t.Element>,
  types: t.IdMap<t.Type>
): t.ElementInstance {
  const children = _.mapValues(elements[id].children, (ctypes) => {
    const matchingEl = _.shuffle(Object.keys(elements)).find(
      (id) => _.intersection(ctypes, resolveTypes(elements[id].types, types)).length
    )
    return matchingEl ? getElementInstances(matchingEl, elements, types) : undefined
  })
  const instance: t.ElementInstance = { element: id }
  if(Object.keys(children).length) instance.children = children
  return instance
}
