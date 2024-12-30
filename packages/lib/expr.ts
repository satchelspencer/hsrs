import jexl from 'jexl'
import _ from 'lodash'
import * as t from './types'
import { getElementProps } from './props'

jexl.addTransform('r', (val: string, search, replace) =>
  (val + '').replaceAll(search, replace)
)

jexl.addTransform('cr', (val: string, search, replace) => {
  let res = val
  for (const i in search) res = res.replace(search[i], replace[i])
  return res
})

export function isValid(expr: string) {
  try {
    jexl.evalSync(expr)
    return true
  } catch {
    return false
  }
}

const compileCache: { [expr: string]: any } = {}
function cacheJexl(expr: string, context: any) {
  compileCache[expr] ??= jexl.compile(expr)
  return compileCache[expr].evalSync(context)
}

export function run(expr: string, context: any) {
  if (expr === 'null') return undefined
  if (!expr.includes('.') && !expr.includes('|') && !expr.includes('+')) return expr
  try {
    const res = cacheJexl(expr, context) ?? expr
    return _.isNaN(res) ? expr : res
  } catch {
    return expr
  }
}

export type depsTree = { [propName: string]: string[] }

export function topoSort(deps: depsTree): string[] {
  const result: string[] = []

  for (const propName in deps) {
    const toVisit = [propName],
      order: string[] = []

    while (toVisit.length) {
      const p = toVisit.pop()!
      if (result.includes(p) || order.includes(p) || !deps[p]) continue
      order.push(p)
      toVisit.push(...deps[p])
    }
    result.push(...order.reverse())
  }

  return result
}

function getPropExecOrder(props: t.Props): string[] {
  const depsTree: { [propName: string]: string[] } = {}
  for (const propName in props) {
    const expr = props[propName],
      deps = _.compact(_.uniq((expr ?? '').match(/[_$]\.(\w+)/g))).map((r) =>
        r.replace('_.', '').replace('$.', '')
      )
    depsTree[propName] = deps
  }

  return topoSort(depsTree)
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
    const mapped = _.mapValues(
      _.omit(elProps, prop),
      (v, k) => v && run(v.replaceAll('.' + k, '.' + prop), { ...params, _: result })
    )
    result[prop] =
      elProps[prop] && run(elProps[prop], { ...params, _: result, $: mapped })
  }

  return { ...result, ...params }
}
