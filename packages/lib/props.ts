import _ from 'lodash'
import * as t from './types'

export function resolveTypes(typeId: string | string[], types: t.IdMap<t.Type>) {
  const res: string[] = [],
    stack: string[] = [..._.castArray(typeId)]

  while (stack.length) {
    const id = stack.pop()!,
      type = types[id]
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
