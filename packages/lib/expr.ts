import jexl from 'jexl'
import _ from 'lodash'
import * as t from './types'
import { getElementProps } from './props'

jexl.addTransform('replace', (val: string, search, replace) =>
  (val + '').replaceAll(search, replace)
)

export function isValid(expr: string) {
  try {
    jexl.evalSync(expr)
    return true
  } catch {
    return false
  }
}

export function run(expr: string, context: any) {
  if (expr === 'null') return undefined
  try {
    return jexl.evalSync(expr, context) ?? expr
  } catch {
    return expr
  }
}

function getPropExecOrder(props: t.Props): string[] {
  const depsTree: { [propName: string]: string[] } = {}
  for (const propName in props) {
    const expr = props[propName],
      deps = _.compact(_.uniq(expr.flatMap((e) => (e ?? '').match(/_\.(\w+)/g)))).map(
        (r) => r.replace('_.', '')
      )
    depsTree[propName] = deps
  }

  const result: string[] = []

  for (const propName in depsTree) {
    const toVisit = [propName],
      order: string[] = []

    while (toVisit.length) {
      const p = toVisit.pop()!
      if (result.includes(p) || order.includes(p)) continue
      order.push(p)
      toVisit.push(...depsTree[p])
    }
    result.push(...order.reverse())
  }

  return result
}

function selectIndex(t: t.PropsInstance, index: number) {
  return _.mapValues(t, (v) => {
    if (!_.isArray(v)) return selectIndex(v, index)
    else return v[index]
  })
}

export function computeElementInstance(
  instace: t.ElementInstance,
  elements: t.IdMap<t.Element>
): t.PropsInstance {
  const params: t.PropsInstance = _.pickBy(
    _.mapValues(instace.params, (paramElInstance) => {
      if (!paramElInstance) return paramElInstance
      return computeElementInstance(paramElInstance, elements)
    }),
    (a) => !!a
  )

  const elProps = getElementProps(instace.element, elements),
    result: t.Props = {},
    execOrder = getPropExecOrder(elProps)

  for (const prop of execOrder) {
    result[prop] = elProps[prop].map((p, index) => {
      if (!p) return p
      return run(p, selectIndex({ ...params, ...result }, index))
    })
  }

  return { ...result, ...params }
}
