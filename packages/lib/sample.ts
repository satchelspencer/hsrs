import _ from 'lodash'
import * as t from './types'
import jexl from 'jexl'

import { getCache } from './cache'
import { logger } from './log'
import {
  getInheritedElement,
  getNonVirtualDescendents,
  satisfies,
  satisfiesMode,
} from './props'
import { computeElementInstance, run } from './expr'
import { cleanRuby } from './ruby'

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
  hardSample?: boolean, //
  leaves?: { [id: string]: boolean },
  parentConstrained?: boolean,
  depth = 1
): t.ElementInstance {
  const log = logger(3, 'sample', new Array(depth).join('   ')),
    rootElement = getInheritedElement(id, elements, cache)
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

  log('sampling', () => [
    rootElement.name,
    Object.keys(fixedParams ?? {})
      .map((k) => `${k}=${elements[fixedParams![k]].name}`)
      .join(','),
    'leaves',
    Object.keys(leaves)
      .map((l) => elements[l].name)
      .join(','),
  ])
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

    log('-trying', elements[descendent].name)

    if (leaves[descendent]) {
      log('-is leaf', parentConstrained ? 'parent-constrained' : 'SKIP')
      if (!parentConstrained) continue
    }

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
        hardSample,
        leaves,
        isConstrained,
        depth + 1
      )
      walkParamsDeep({ [param]: pinst }, (childParam, el) => {
        if (constraint.includes(childParam)) constraints[childParam] = el.element
      })
      inst.params![param] = pinst
    }
    if (!cache.depths[inst.element] && !leaves[inst.element]) {
      leaves[inst.element] = true
      log('-adding leaf')
    }
    return inst
  }
  throw 'sample not found'
}

export async function simpleElementSample(
  id: string,
  elements: t.IdMap<t.Element>,
  cache: t.DeckCache,
  propName: string,
  rank: (prefix: string, suffixes: string[]) => Promise<number[]>,
  prob: (str: string) => Promise<number>,
  depth = 1,
  prefix = ''
): Promise<t.ElementInstance> {
  const log = logger(3, 'simple', new Array(depth).join('   '))

  log('sampling', elements[id].name, 'prefix', prefix)

  let descs = _.shuffle(getNonVirtualDescendents(id, elements, cache))

  const prefixContributions = descs.map((d) =>
    computePartialResult({ element: d, params: {} }, elements, propName)
  )

  const ranks = prefix
    ? await rank(prefix, prefixContributions)
    : prefixContributions.map((f) => Math.random())

  let i = 0
  for (const descendentId of _.sortBy(
    descs,
    (d) => -ranks[descs.indexOf(d) * Math.pow(Math.random(), 1 )]
  )) {
    const element = getInheritedElement(descendentId, elements, cache),
      expr = element.props[propName] ?? '',
      params = element.params ?? {}

    log('descendent', element.name, ranks[i])

    const templateResult = run(
        expr,
        _.mapValues(params, (_, k) => ({ [propName]: `{{${k}}}` }))
      ),
      outputOrderedParamNames = _.sortBy(Object.keys(params), (p) =>
        templateResult.indexOf(`{{${p}}}`)
      ),
      resultInstance: t.ElementInstance = {
        element: descendentId,
        params: {},
      }

    log(templateResult)

    let dprefix = ''

    let failed = false
    for (const paramName of outputOrderedParamNames) {
      log(' - param', paramName)
      try {
        const paramId = params[paramName],
          child = await simpleElementSample(
            paramId,
            elements,
            cache,
            propName,
            rank,
            prob,
            depth + 1,
            prefix + dprefix
          )
        resultInstance.params![paramName] = child

        const partial = computePartialResult(resultInstance, elements, propName)
        if (partial) dprefix = partial
      } catch {
        failed = true
        break
      }
    }
    if (failed) {
      log('failed')
      continue
    }

    const partialResult =
      prefix + cleanRuby(computePartialResult(resultInstance, elements, propName))
    const p = prefix ? await prob(partialResult) : 1

    log('result', partialResult, p)

    if (p > 0.1) return resultInstance

    if (i++ > 20) break
  }

  throw 'none found'
}

function computePartialResult(
  instace: t.ElementInstance,
  elements: t.IdMap<t.Element>,
  propName: string
) {
  const partialResult = computeElementInstance(instace, elements)[propName] as string
  if (partialResult)
    return cleanRuby(
      partialResult.includes('undefined')
        ? partialResult.substring(0, partialResult.indexOf('undefined'))
        : partialResult
    )
  else return ''
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
