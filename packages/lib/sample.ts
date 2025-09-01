import _ from 'lodash'
import * as t from './types'

import { getCache } from './cache'
import { logger } from './log'
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
  fixedParams?: t.Params,
  order?: (elId: string) => number,
  commonMode?: { mode: string }[],
  filter?: (elId: string) => boolean,
  minDepth?: number,
  hardSample?: boolean, //
  leaves?: { [id: string]: boolean },
  parentConstrained?: boolean,
  depth = 1
): t.ElementInstance {
  const log = logger(3, 'sample', new Array(Math.abs(depth)).join('   '))

  if (minDepth && depth <= 1 && (cache.depths[id] < minDepth || !cache.hasProps[id])) {
    const pset = new Set<string>(),
      ownAncestors = cache.tree.ancestors[id]

    for (const aid of ownAncestors)
      for (const pp of cache.paramTree.parents[aid] ?? []) pset.add(pp)

    log(
      'need upsample',
      elements[id].name,
      'parents:',
      [...pset].map((c) => elements[c].name)
    )

    for (const parent of evOrder(
      [...pset],
      0,
      cache.hasProps[id] ? (elid) => 1 / cache.depths[elid] : order, //most shallow first
      cache.hasProps[id]
        ? (elid) =>
            cache.pdepths[elid] > cache.pdepths[id] + 1.5 && //force upsampling w/ siblings
            (filter ? filter(elid) : true)
        : filter
    )) {
      const pel = getInheritedElement(parent, elements, cache),
        pnames = Object.keys(pel.params ?? {}).filter((n) =>
          ownAncestors.includes(pel.params![n])
        )

      log('-try upsample', pel.name, pnames.length)

      if (pnames.length !== 1) continue //must be exactly 1 or non-uniq leaves possible

      const fp: t.Params = { ...fixedParams }
      for (const pname of pnames) fp[pname] = id

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
      .map((k) => `${k}=${elements[fixedParams![k]].name}`)
      .join(','),
    'leaves',
    Object.keys(leaves)
      .map((l) => elements[l].name)
      .join(','),
    commonMode.map((c) => c.mode || '.').join(''),
  ])

  const nonVR = getNonVirtualDescendents(id, elements, cache)

  for (const descendent of evOrder(nonVR, depth, order, filter, hardSample)) {
    log(
      '-trying',
      elements[descendent].name,
      commonMode.map((c) => c.mode || '.').join('')
    )

    if (leaves[descendent]) {
      log('-is leaf', parentConstrained ? 'parent-constrained' : 'SKIP')
      if (!parentConstrained) continue
    }

    const {
      params = {},
      constraint = '',
      mode,
    } = getInheritedElement(descendent, elements, cache)

    const childCommonMode = [...commonMode]

    let failed = false
    if (fixedParams && mode) {
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
            childCommonMode[i] = { mode: ncommon }
            common.mode = ncommon.toLowerCase()
          } else common.mode = ncommon
        }
      }
    }
    if (failed) {
      log('-mode fail', mode)
      continue
    }

    for (const fparam in fixedParams) {
      if (!params[fparam]) continue
      const common = satisfies(fixedParams[fparam], params[fparam], cache)
      if (!common) {
        log('-fixed fail', fparam, elements[params[fparam]].name)
        failed = true
      } else params[fparam] = common
    }
    if (failed) continue

    const inst: t.ElementInstance = {
      element: descendent,
      params: {},
    }

    const constraints: t.Params = _.pickBy(
      { ...params, ...(fixedParams ?? {}) },
      (_, v) => constraint.includes(v)
    )
    for (const param of _.sortBy(Object.keys(params), (pname) =>
      constraints[pname] ? 0 : Math.random()
    )) {
      try {
        const isConstrained = !!fixedParams?.[param]
        log('-param', param, isConstrained ? '**constrained' : 'nc')
        const pinst = sampleElementIstance(
          params[param],
          elements,
          cache,
          constraints,
          order,
          childCommonMode,
          filter,
          minDepth,
          hardSample,
          leaves,
          isConstrained,
          depth + 1
        )
        walkParamsDeep({ [param]: pinst }, (childParam, el) => {
          if (constraint.includes(childParam)) constraints[childParam] = el.element
        })
        inst.params![param] = pinst
      } catch (e) {
        failed = true //catching allows full search but impacts perf
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
  depth: number,
  order?: (elId: string) => number,
  filter?: (elId: string) => boolean,
  hardSample?: boolean
) {
  const fels = filter ? els.filter(filter) : els,
    ordered = order ? _.sortBy(fels, order) : _.shuffle(fels)

  const orders = _.sortBy(fels.map((v) => order?.(v) ?? 1)),
    minOrder = orders[0] ?? Infinity,
    maxOrder = orders[orders.length - 1] ?? -Infinity,
    normed = orders.map((o) => (maxOrder - o + minOrder + 1e-10) / maxOrder)

  let i = 0
  while (normed.length && i++ < 1000) {
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

  while (fails < 100) {
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
