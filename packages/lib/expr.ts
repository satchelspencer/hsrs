import jexl from 'jexl'
import _ from 'lodash'
import * as t from './types'
import { getInheritedElement, satisfiesMode } from './props'
import { getCache } from './cache'

export const RUBY_DELIM = '~'

jexl.addBinaryOp(':::', 20, (a, b) => a + RUBY_DELIM + b)

jexl.addTransform('r', (val: string, search, replace) =>
  (val + '').replace(new RegExp(search + '$'), replace)
)

jexl.addTransform('rg', (val: string, search, replace) =>
  (val + '').replace(new RegExp(search, 'g'), replace)
)

jexl.addTransform('cr', (val: string, search, replace) => {
  let res = val
  for (const i in search) res = res.replace(new RegExp(search[i] + '$'), replace[i])
  return res
})

jexl.addTransform('pr', (val: string, search, replace) =>
  (val + '').replace(new RegExp('^' + search), replace)
)

jexl.addTransform('pcr', (val: string, search, replace) => {
  let res = val
  for (const i in search) res = res.replace(new RegExp('^' + search[i]), replace[i])
  return res
})

jexl.addTransform('mte', (val: string, search) => {
  const index = val.indexOf(search)
  if (index === -1) return val
  return val.slice(0, index) + val.slice(index + search.length) + search
})

jexl.addTransform('mts', (val: string, search) => {
  const index = val.indexOf(search)
  if (index === -1) return val
  return search + val.slice(0, index) + val.slice(index + search.length)
})

jexl.addFunction('e', (val: string) => {
  return `(${val}>)`
})

jexl.addFunction('s', (val: string) => {
  return `(${val}<)`
})

jexl.addFunction('b', () => {
  return `|`
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

export function run(expr: string, context: any, root?: boolean): any {
  if (expr === 'null') return undefined
  if (
    !expr.includes('.') &&
    !expr.includes('|') &&
    !expr.includes('+') &&
    !expr.includes(':::')
  )
    return expr
  try {
    const res = cacheJexl(expr, context) ?? expr
    return _.isNaN(res) ? expr : root ? moveit(res) : res
  } catch (e) {
    console.log()
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
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache = getCache(elements),
  child?: boolean
): t.PropsInstance {
  const params: t.PropsInstance = _.pickBy(
    _.mapValues(instace.params, (paramElInstance) => {
      if (!paramElInstance) return paramElInstance
      return computeElementInstance(paramElInstance, elements, cache, true)
    }),
    (a) => !!a
  )

  const { props: elProps } = getInheritedElement(instace.element, elements, cache),
    result: t.Props = {},
    execOrder = getPropExecOrder(elProps)

  for (const prop of execOrder) {
    const mapped = _.mapValues(
      _.omit(elProps, prop),
      (v, k) =>
        v &&
        run(
          v.replaceAll('.' + k, '.' + prop).replaceAll('+', ':::'),
          { ...params, _: result },
          !child
        )
    )
    result[prop] =
      elProps[prop] &&
      run(
        elProps[prop].replaceAll('+', ':::'),
        { ...params, _: result, $: mapped },
        !child
      )
  }

  return { ...result, ...params }
}

export function computeElementMode(
  instace: t.ElementInstance,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache = getCache(elements)
) {
  let mode = getInheritedElement(instace.element, elements, cache).mode

  for (const paramName in instace.params) {
    const param = instace.params[paramName]
    if (param)
      mode = satisfiesMode(mode, computeElementMode(param, elements, cache)) ?? mode
  }

  return mode?.match(/^([-*]+)?$/i) ? undefined : mode?.toLowerCase()
}

function moveit(string: string) {
  const dests: { [index: number]: { index: number; content: string } } = {}
  for (const match of string.matchAll(/\(([^)]+)([><])\)/g)) {
    const [full, content, dir] = match,
      target =
        dir === '>'
          ? string.indexOf('|', match.index)
          : string.substring(0, match.index).lastIndexOf('|'),
      index = target === -1 ? (dir === '>' ? string.length : 0) : target
    dests[index] ??= { index, content: '' }
    dests[index].content =
      dir === '>' ? dests[index].content + content : content + dests[index].content
  }

  for (const dest of _.sortBy(Object.values(dests), (d) => -d.index)) {
    string = string.substring(0, dest.index) + dest.content + string.substring(dest.index)
  }

  string = string.replace(/\(([^)]+)([><])\)/g, '').replace(/\|/g, '')

  return string
}

//console.log(moveit('hello what( not aok>) the fuck|( is>) this( amsa<) shit'))
