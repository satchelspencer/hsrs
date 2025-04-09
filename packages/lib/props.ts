import _ from 'lodash'
import * as t from './types'
import { computeElementInstance, computeElementMode } from './expr'
import lcs from 'node-lcs'
import { card2Id } from './session'
import { getCache } from './cache'
import { cleanRuby } from './ruby'

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

export function isParent(
  elementId: string,
  parent: string,
  elements: t.IdMap<t.Element>
) {
  const stack: string[] = [..._.castArray(elementId)]

  while (stack.length) {
    const id = stack.pop()!,
      element = elements[id]
    if (!element) continue

    if (id === parent) return true
    for (const etype of element.parents ?? []) {
      stack.push(etype)
    }
  }

  return false
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
    if (_.isObject(value)) res.push(...getVariables(value, key))
    else res.push((prefix ? '' : '_.') + key, (prefix ? '' : '$.') + key)
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

  const element = getInheritedElement(elementId, elements),
    params = _.mapValues(element.params ?? {}, (paramElement) =>
      getElementParamsAndProps(paramElement, elements, depth - 1)
    )
  Object.assign(res, element.props)
  Object.assign(res, params)

  return res
}

export function getInheritedElement(
  elementId: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache = getCache(elements)
): t.Element {
  const element = { ...elements[elementId] },
    inheritedProps: t.Props = {},
    inheritedParams: t.Params = {}
  let inheritedConstraint: string = '',
    inheritedMode: string = '',
    inheritedRetention: string = ''

  const ancestors = cache.tree.ancestors[elementId] ?? []
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const id = ancestors[i],
      element = elements[id]
    if (!element) continue
    for (const propId in element.props) {
      if (element.props[propId] || !inheritedProps[propId])
        inheritedProps[propId] = element.props[propId]
    }
    for (const propId in element.params) {
      if (element.params[propId]) inheritedParams[propId] = element.params[propId]
    }
    if (element.constraint) inheritedConstraint = element.constraint
    if (element.mode)
      inheritedMode = satisfiesMode(element.mode, inheritedMode) ?? element.mode
    if (element.retention) inheritedRetention = element.retention
  }

  element.props = inheritedProps
  if (Object.keys(inheritedParams).length) element.params = inheritedParams
  if (inheritedConstraint) element.constraint = inheritedConstraint
  if (inheritedMode) element.mode = inheritedMode
  if (inheritedRetention) element.retention = inheritedRetention
  element.order = getElementOrder(elementId, elements)
  return element
}

export function getElementOrder(elementId: string, elements: t.IdMap<t.Element>) {
  let root = elementId
  const decs: string[] = []
  while (root) {
    const el = elements[root]
    if (!el) break
    if (el.order) decs.unshift(el.order)
    root = el.parents[0]
  }
  return decs.join('.')
}

export function satisfies(a: string, b: string, cache: t.DeckCache) {
  const ap = cache.tree.ancestors[a],
    bp = cache.tree.ancestors[b]

  return ap.includes(b) ? a : bp.includes(a) ? b : undefined
}

function getCommon(a: string = '-', b: string = '-') {
  return (a === '-' ? b : a) ?? '-'
}

export function satisfiesMode(a: string = '', b: string = '') {
  const maxLen = Math.max(a.length, b.length)
  let common = ''
  for (let i = 0; i < maxLen; i++) {
    const av = a[i],
      bv = b[i]

    if (
      av &&
      bv &&
      av !== '-' &&
      av !== '*' &&
      bv !== '-' &&
      bv !== '*' &&
      av.toLowerCase() !== bv.toLowerCase()
    )
      return undefined
    common = common + getCommon(av, bv)
  }
  return common
}

type MetaInstance = t.ElementInstance & {
  s: number
  v: string
}

const instanceCache: {
  [key: string]: { iv: t.PropsInstance; value: string; omode: string | undefined }
} = {}

export function findAliases(
  instance: t.ElementInstance,
  propName: string,
  elements: t.IdMap<t.Element>,
  cards: t.CardStates,
  cache: t.DeckCache
) {
  const tv = computeElementInstance(instance, elements, cache),
    target = tv[propName] as string,
    matchingInstances: { [iid: string]: MetaInstance } = {},
    exactInstances: { [iid: string]: t.ElementInstance } = {},
    sampleTestedInstances: { [iid: string]: boolean } = {},
    targetMode = computeElementMode(instance, elements, cache) ?? ''

  for (let i = 0; i < 4; i++) {
    for (const elId in elements) {
      if (elements[elId].virtual) continue
      const {
          props,
          params = {},
          constraint,
        } = getInheritedElement(elId, elements, cache),
        propNames = Object.keys(props),
        matchingParams: { [paramName: string]: MetaInstance[] } = {}

      for (const paramName in params) {
        matchingParams[paramName] ??= []
        const param = params[paramName]
        for (const iid in matchingInstances) {
          const inst = matchingInstances[iid]
          if (cache.tree.ancestors[inst.element].includes(param))
            matchingParams[paramName].push(inst)
        }
      }

      const paramNames = Object.keys(params),
        paramValues = paramNames.map((p) =>
          _.take(_.orderBy(matchingParams[p], [(v) => -v.s, (v) => v.v.length]), 8)
        ),
        instances: t.ElementInstance[] = paramNames.length
          ? _.compact(
              permute(paramValues).map((perm) => {
                if (failsConstraint(perm, constraint)) return false
                const oinstance: t.ElementInstance = { element: elId, params: {} }
                for (const i in paramNames) oinstance.params![paramNames[i]] = perm[i]
                return oinstance
              })
            )
          : [{ element: elId, params: {} }]

      for (const oinstance of instances) {
        const key = getInstanceId(oinstance)
        if (!instanceCache[key]) {
          const iv = computeElementInstance(oinstance, elements, cache)
          instanceCache[key] = {
            iv,
            value: getPropValue(iv, propName),
            omode: computeElementMode(oinstance, elements, cache) ?? '',
          }
        }
        const { iv, value, omode } = instanceCache[key],
          split = value.split('.').filter((a) => !!a),
          sim =
            split.reduce((memo, fv) => {
              const sim = getSimilarity(fv, target)
              return memo + sim.length / fv.length - fv.indexOf(sim) / fv.length
            }, 0) / split.length,
          oinstanceCardId = card2Id({ element: oinstance.element, property: propName })

        if (
          matchingInstances[key] ||
          !value.length ||
          (!cards[oinstanceCardId] && cache.hasProps[oinstance.element])
        )
          continue
        if (sim >= 0.5) matchingInstances[key] = { ...oinstance, s: sim, v: value }
        if (
          cleanRuby(iv[propName]) === cleanRuby(target) &&
          !_.isEqual(_.pick(iv, propNames), _.pick(tv, propNames)) &&
          targetMode === omode
        ) {
          const matchId = propNames.map((n) => iv[n]).join('.') //just cause its readable
          if (!sampleTestedInstances[matchId]) {
            sampleTestedInstances[matchId] = true
            const instanceEls = _.uniq(_.reverse(getInstanceEls(oinstance)))
            try {
              const inst = sampleElementIstance(
                  oinstance.element,
                  elements,
                  cache,
                  undefined,
                  (id) => -instanceEls.indexOf(id),
                  undefined,
                  (id) => instanceEls.includes(id),
                  true
                ),
                computed = computeElementInstance(inst, elements, cache)
              if (computed[propName] === iv[propName])
                exactInstances[propNames.map((n) => iv[n]).join('.')] = oinstance
            } catch {}
          }
        }
      }
    }
  }
  return Object.values(exactInstances)
}

function getInstanceEls(instance: t.ElementInstance): string[] {
  return [
    instance.element,
    ...Object.values(instance.params ?? {})
      .filter((c) => !!c)
      .flatMap((c) => getInstanceEls(c)),
  ]
}

function failsConstraint(insts: MetaInstance[], constraint?: string): boolean {
  const constraints: { [paramName: string]: string } = {}
  let failed = false
  for (const inst of insts) {
    for (const paramName in inst.params) {
      const paramValue = inst.params?.[paramName]
      if (!paramValue) continue

      if (
        constraint?.includes(paramName) &&
        constraints[paramName] &&
        constraints[paramName] !== paramValue.element
      ) {
        failed = true
        break
      } else {
        constraints[paramName] = paramValue?.element
      }
    }
    if (failed) break
  }
  return failed
}

export function getInstanceId(instance: t.ElementInstance): string {
  const res: string[] = [instance.element],
    queue: t.ElementInstance[] = [instance]

  while (queue.length > 0) {
    const node = queue.shift()!
    if (node.params) {
      for (const paramKey in node.params) {
        res.push(paramKey, '=')
        const paramValue = node.params[paramKey]
        if (paramValue) {
          res.push(paramValue.element)
          queue.push(paramValue)
        }
      }
    }
  }

  return res.join('')
}

function getPropValue(pi: t.PropsInstance, propName: string) {
  if (pi[propName] && typeof pi[propName] === 'string') return pi[propName]
  let res: string[] = []
  for (const j in pi) {
    const v = pi[j]
    if (v && typeof v !== 'string') res.push(getPropValue(v, propName))
  }
  return res.join('.')
}

function getSimilarity(a: string, b: string): string {
  return lcs(a, b)['sequence']
}

function permute<T>(lists: T[][]) {
  const [first, ...rest] = lists
  if (rest.length) {
    const rests = permute(rest),
      res: T[][] = []

    for (const l of first) {
      for (const r of rests) {
        res.push([l, ...r])
      }
    }
    return res
  } else return (first ?? []).map((v) => [v])
}

function walkParamsDeep(
  params: t.ParamsInstance | undefined,
  cb: (paramName: string, el: t.ElementInstance) => void
) {
  if (params) {
    for (const paramName in params) {
      const el = params[paramName]
      if (el) {
        cb(paramName, el)
        if (el.params) walkParamsDeep(el.params, cb)
      }
    }
  }
}

export function sampleElementIstance(
  id: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache,
  fixedParams?: t.Params,
  order?: (elId: string) => number,
  commonMode?: { mode: string }[],
  filter?: (elId: string) => boolean,
  hardSample?: boolean,
  leaves?: { [id: string]: boolean }
): t.ElementInstance {
  const rootElement = getInheritedElement(id, elements, cache)
  commonMode ??= new Array(8).fill(0).map((_, i) => {
    const rootm = rootElement.mode?.[i] ?? ''
    return { mode: rootm && rootm.toUpperCase() === rootm ? '*' : rootm }
  })
  leaves ??= {}

  const nonVR = getNonVirtualDescendents(id, elements, cache),
    nonV = filter ? nonVR.filter(filter) : nonVR,
    descendents = order ? _.sortBy(nonV, order) : _.shuffle(nonV)

  const orders = _.sortBy(nonV.map((v) => order?.(v) ?? 1)),
    minOrder = orders[0] ?? Infinity,
    maxOrder = orders[orders.length - 1] ?? -Infinity,
    normed = orders.map((o) => (maxOrder - o + minOrder + 1e-10) / maxOrder)

  // console.log(
  //   elements[id].name,
  //   descendents.map((d, i) => elements[d].name + ' ' + normed[i])
  // )

  while (normed.length) {
    const sum = _.sumBy(normed),
      sample = Math.random() * sum

    let accum = 0,
      index = 0
    for (const v of normed) {
      accum += v
      if (accum >= sample) break
      index++
    }
    if (hardSample) index = 0
    if (Math.random() > 0.99) normed.splice(index, 1)
    const [descendent] = descendents.splice(index, 1)
    if (!descendent) continue

    const {
      params = {},
      constraint = '',
      mode,
    } = getInheritedElement(descendent, elements, cache)

    let failed = false
    if (fixedParams && mode) {
      for (let i = 0; i < Math.max(commonMode.length, mode.length); i++) {
        const common = commonMode[i],
          ncommon = satisfiesMode(common.mode, mode[i])
        if (ncommon === undefined) {
          failed = true
          break
        }
        if (ncommon) common.mode = ncommon
      }
    }
    if (failed) continue

    for (const fparam in fixedParams) {
      if (!params[fparam]) continue
      const common = satisfies(fixedParams[fparam], params[fparam], cache)
      if (!common) failed = true
      else params[fparam] = common
    }
    if (failed) continue

    for (const param in params) {
      if (!fixedParams?.[param] && leaves[params[param]]) failed = true
    }
    if (failed) continue

    const inst: t.ElementInstance = {
      element: descendent,
      params: {},
    }

    const constraints: t.Params = _.pickBy(
        { ...params, ...(fixedParams ?? {}) },
        (_, v) => constraint.includes(v)
      ),
      childCommonMode = commonMode.map((c, i) =>
        mode?.[i] && (mode[i] === '*' || mode[i].toUpperCase() === mode[i])
          ? { mode: '*' }
          : c
      )
    for (const param of _.sortBy(Object.keys(params), (pname) =>
      constraints[pname] ? 0 : Math.random()
    )) {
      const pinst = sampleElementIstance(
        params[param],
        elements,
        cache,
        constraints,
        order,
        childCommonMode,
        filter,
        hardSample,
        leaves
      )
      walkParamsDeep({ [param]: pinst }, (childParam, el) => {
        if (constraint.includes(childParam)) constraints[childParam] = el.element
        if (!_.keys(el.params).length) leaves[el.element] = true
      })
      inst.params![param] = pinst
    }

    return inst
  }
  throw 'sample not found'
}

export function* generateElementInstanceSamples(
  id: string,
  elements: t.IdMap<t.Element>
): Generator<t.ElementInstance> {
  const cache = getCache(elements)
  let fails = 0
  while (fails < 1000) {
    try {
      yield sampleElementIstance(id, elements, cache)
      fails = 0
    } catch {
      fails++
    }
  }
}

export function getNonVirtualDescendents(
  id: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache
) {
  const thisEl = elements[id]
  if (!thisEl.virtual) return [id]

  const output: string[] = [],
    parents: string[] = [id]

  while (parents.length) {
    const parent = parents.pop()!
    for (const elId of cache.tree.children[parent]) {
      const el = elements[elId]
      if (!el) continue
      else if (el.virtual) parents.push(elId)
      else if (!output.includes(elId)) output.push(elId)
    }
  }

  return output
}

export function getAllCards(elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = []

  for (const elId in elements) {
    if (!elements[elId].virtual) cards.push(...getElementCards(elId, elements))
  }

  return cards
}

export function getElementCards(id: string, elements: t.IdMap<t.Element>): t.Card[] {
  const cards: t.Card[] = [],
    { props } = getInheritedElement(id, elements)

  for (const propId in props) {
    if (propId[0] === '_') continue //skip meta props
    const prop = props[propId]
    if (prop) cards.push({ element: id, property: propId })
  }
  return cards
}

function getResolvedElements(
  id: string,
  elements: t.IdMap<t.Element>,
  paramName: string
): string[] {
  const { params: paramValue = {} } = getInheritedElement(id, elements)
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
    cache = getCache(elements),
    parents = cache.tree.ancestors[id]
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
  const { params = {} } = getInheritedElement(id, elements)
  const res: { [n: string]: string[] } = {}
  for (const paramName in params) {
    const resolved = getResolvedElements(id, elements, paramName),
      missing = findMissingElements(params[paramName], elements, resolved)
    res[paramName] = missing
  }
  return res
}

export function findCommonAncestors(
  parentId: string,
  ids: string[],
  elements: t.IdMap<t.Element>
) {
  const cache = getCache(elements),
    ancestors = ids.map((id) => cache.tree.ancestors[id])

  const stack: string[] = [parentId]
  let common: string | null = null,
    minDistance = Infinity

  while (stack.length) {
    const parent = stack.shift()!,
      totalDistance = _.sum(
        ancestors.map((c) => (c.includes(parent) ? c.indexOf(parent) : Infinity))
      )
    if (totalDistance < minDistance) {
      common = parent
      minDistance = totalDistance
      stack.push(
        ...Object.keys(elements).filter(
          (e) => elements[e].parents.includes(parent) && elements[e].virtual
        )
      )
    }
  }
  return common
}
