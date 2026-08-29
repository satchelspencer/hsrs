import _ from 'lodash'
import * as t from './types'

import { getCache } from './cache'
import { logger } from './log'
import { random, shuffle } from './rand'
import {
  getInheritedElement,
  getNonVirtualDescendents,
  satisfies,
  satisfiesMode,
} from './props'

/* randomly generate an instance of an element or child by id,
ensures consistent modes, constraints and avoids duplicate leaves */

export function sampleElementIstance(
  id: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache,
  fixedParams?: t.ParamsInstance,
  order?: (elId: string) => number,
  commonMode?: { mode: string }[],
  filter?: (elId: string, depth: number) => boolean,
  minDepth?: number,
  hardSample?: boolean, //
  leaves?: { [id: string]: boolean },
  parentConstrained?: boolean,
  pmap?: t.ParamsMap,
  depth = 1
): t.ElementInstance {
  const log = logger(3, 'sample', () => new Array(Math.abs(depth)).join('   '))

  if (minDepth && depth <= 1 && (!cache.depths[id] || !cache.hasProps[id])) {
    const pset = new Set<string>(),
      ownAncestors = cache.tree.ancestors[id]

    for (const aid of ownAncestors)
      for (const pp of cache.paramTree.parents[aid] ?? []) pset.add(pp)

    log('need upsample', elements[id].name, 'parents:', () =>
      [...pset].map((c) => elements[c].name)
    )

    for (const parent of evOrder(
      [...pset],
      cache.hasProps[id] ? (elid) => 1 / cache.depths[elid] : order, //most shallow first
      cache.hasProps[id]
        ? (elid) =>
            cache.pdepths[elid] > cache.pdepths[id] + 1.5 && //force upsampling w/ siblings
            (filter ? filter(elid, depth) : true)
        : filter
    )) {
      const pel = getInheritedElement(parent, elements, cache),
        pnames = Object.keys(pel.params ?? {}).filter((n) =>
          ownAncestors.includes(pel.params![n])
        )

      log('-try upsample', pel.name, pnames.length)

      if (pnames.length !== 1) continue //must be exactly 1 or non-uniq leaves possible

      const fp: t.ParamsInstance = { ...fixedParams }
      for (const pname of pnames) fp[pname] = { element: id }

      try {
        return sampleElementIstance(
          parent,
          elements,
          cache,
          fp,
          order,
          commonMode,
          filter,
          minDepth,
          hardSample,
          { ...leaves, [id]: true },
          parentConstrained
        )
      } catch (e) {
        log('upsample err', e)
      }
    }

    if (!cache.hasProps[id]) throw 'np upsample'
  }

  const rootElement = getInheritedElement(id, elements, cache)
  commonMode ??= new Array(8).fill(0).map((_, i) => {
    const rootm = rootElement.mode?.[i] ?? ''
    return { mode: rootm }
  })
  leaves ??= {}

  log('sampling', () => [
    rootElement.name,
    Object.keys(fixedParams ?? {})
      .map((k) => `${k}=${elements[fixedParams![k]!.element].name}`)
      .join(','),
    'leaves',
    Object.keys(leaves)
      .map((l) => elements[l].name)
      .join(','),
    commonMode.map((c) => c.mode || '.').join(''),
  ])

  const nonVR = getNonVirtualDescendents(id, elements, cache)

  for (const descendent of evOrder(nonVR, order, filter, hardSample, depth)) {
    log('-trying', () => [
      elements[descendent].name,
      commonMode!.map((c) => c.mode || '.').join(''),
    ])

    if (leaves[descendent]) {
      log('-is leaf', parentConstrained ? 'parent-constrained' : 'SKIP')
      if (!parentConstrained) continue
    }

    let {
      params = {},
      constraint = '',
      mode,
      cpmap,
    } = getInheritedElement(descendent, elements, cache, pmap)

    const childCommonMode = [...commonMode]

    let failed = false
    if (mode) {
      for (let i = 0; i < Math.max(childCommonMode.length, mode.length); i++) {
        const common = childCommonMode[i],
          ncommon = satisfiesMode(common.mode, mode[i])
        if (ncommon === undefined) {
          failed = true
          break
        }
        if (mode[i] === '*') childCommonMode[i] = { mode: '*' }
        else if (ncommon) {
          if (ncommon.match(/[A-Z]/)) {
            childCommonMode[i] = { mode: mode[i] ?? '' }
            common.mode = ncommon.toLowerCase()
          } else common.mode = ncommon
        }
      }
    }
    if (failed) {
      log('-mode fail', mode)
      continue
    }

    let paramsCopied = false
    for (const fparam in fixedParams) {
      if (!params[fparam]) continue
      const common = satisfies(fixedParams[fparam]!.element, params[fparam], cache)
      if (!common) {
        log('-fixed fail', fparam, elements[params[fparam]].name)
        failed = true
      } else {
        /* copy on write, params may be the shared inherited element's */
        if (!paramsCopied) {
          params = { ...params }
          paramsCopied = true
        }
        params[fparam] = common
      }
    }
    if (failed) continue

    const inst: t.ElementInstance = {
      element: descendent,
      params: {},
    }

    const constraints: t.ParamsInstance = {}
    for (const pname in params)
      if (constraint.includes(pname)) constraints[pname] = { element: params[pname] }
    for (const pname in fixedParams)
      if (constraint.includes(pname)) constraints[pname] = fixedParams[pname]
    for (const param of shuffle(Object.keys(params))) {
      try {
        const isConstrained = !!fixedParams?.[param],
          pinstmap = { ...pmap, ...(cpmap?.[param] ?? {}) }
        log('-param', param, isConstrained ? '**constrained' : 'nc')

        const elId = constraints[param]
          ? satisfies(params[param], constraints[param]!.element, cache)
          : params[param]
        if (!elId) throw 'constraint fail'

        const pin = constraints[param] ?? fixedParams?.[param]
        const pinst = sampleElementIstance(
          elId,
          elements,
          cache,
          pin?.element === elId && !_.isEmpty(pin.params)
            ? { ...constraints, ...pin.params }
            : constraints,
          order,
          childCommonMode,
          filter,
          minDepth,
          hardSample,
          param[0] === '_' ? { ...leaves } : leaves,
          isConstrained,
          pinstmap,
          depth + 1
        )
        walkParamsDeep(
          { [param]: pinst },
          (childParam, el) => {
            const mappedParam = pinstmap[childParam] ?? childParam
            if (constraint.includes(mappedParam)) constraints[mappedParam] = el
          },
          elements,
          cache
        )
        for (const src in pinstmap) {
          const dest = pinstmap[src]
          if (pinst.params?.[dest]) {
            pinst.params[src] = pinst.params[dest]
            delete pinst.params[dest]
          }
        }
        inst.params![param] = pinst
      } catch (e) {
        if (!param.endsWith('_') || depth === 1) failed = true
      }
    }
    if (failed) continue
    if (!cache.depths[inst.element] && !leaves[inst.element]) {
      leaves[inst.element] = true
      log('-adding leaf')
    }
    return inst
  }
  throw 'sample not found'
}

function* evOrder(
  els: string[],
  order?: (elId: string) => number,
  filter?: (elId: string, depth: number) => boolean,
  hardSample?: boolean,
  depth?: number
) {
  const fels = filter ? els.filter((e) => filter(e, depth ?? 0)) : els,
    ordered = order ? _.sortBy(fels, order) : shuffle(fels)

  const orders = _.sortBy(fels.map((v) => order?.(v) ?? 1)),
    minOrder = orders[0] ?? Infinity,
    maxOrder = orders[orders.length - 1] ?? -Infinity,
    normed = orders.map((o) => (maxOrder - o + minOrder + 1e-10) / maxOrder)

  let i = 0
  while (normed.length && i++ < 1000) {
    let sum = 0
    for (const v of normed) sum += v
    const sample = random() * sum

    let accum = 0,
      index = 0
    for (const v of normed) {
      accum += v
      if (accum >= sample) break
      index++
    }
    if (hardSample) index = 0
    normed.splice(index, 1)
    const [descendent] = ordered.splice(index, 1)
    if (!descendent) continue
    yield descendent
  }
}

export function* generateElementInstanceSamples(
  id: string,
  elements: t.IdMap<t.Element>
): Generator<t.ElementInstance> {
  const cache = getCache(elements)
  let fails = 0,
    dupes = 0,
    lastValue: t.ElementInstance | undefined = undefined

  while (fails < 1000) {
    try {
      const val = sampleElementIstance(id, elements, cache)
      fails = 0
      if (_.isEqual(lastValue, val) && dupes < 5) {
        dupes++
        continue
      } else {
        lastValue = val
        dupes = 0
        yield val
      }
    } catch {
      fails++
    }
  }
}

function walkParamsDeep(
  params: t.ParamsInstance | undefined,
  cb: (paramName: string, el: t.ElementInstance) => void,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache
) {
  if (params) {
    for (const paramName in params) {
      const el = params[paramName]
      if (el) {
        cb(paramName, el)
        if (el.params) {
          const { cpmap } = getInheritedElement(el.element, elements, cache)
          if (!cpmap) walkParamsDeep(el.params, cb, elements, cache)
        }
      }
    }
  }
}
