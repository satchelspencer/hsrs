import _ from 'lodash'
import * as t from './types'
import { computeElementInstance, computeElementMode } from './expr'
import lcs from 'node-lcs'
import { card2Id } from './session'
import { cleanRuby } from './ruby'
import { logger } from './log'
import { sampleElementIstance } from './sample'
import { getInheritedElement } from './props'

type MetaInstance = t.ElementInstance & {
  s: number
  v: string
}

const instanceCache: {
  [key: string]: { iv: t.PropsInstance; value: string; omode: string | undefined }
} = {}

/* given an element instance, search for other instances that
 differ outside of propName and share the same mode, 
and meet sampling constraints. best effort */

export function findAliases(
  instance: t.ElementInstance,
  propName: string,
  elements: t.IdMap<t.Element>,
  cards: t.CardStates,
  cache: t.DeckCache,
  filter?: string[]
) {
  const log = logger(2, 'alias'),
    tv = computeElementInstance(instance, elements, cache),
    target = tv[propName] as string,
    matchingInstances: { [iid: string]: MetaInstance } = {},
    exactInstances: { [iid: string]: t.ElementInstance } = {},
    sampleTestedInstances: { [iid: string]: boolean } = {},
    targetMode = computeElementMode(instance, elements, cache) ?? ''

  log(target)

  for (let i = 0; i < 4; i++) {
    for (const elId in elements) {
      if (
        elements[elId].virtual ||
        (filter && !filter.includes(cache.tree.roots[elId] ?? ''))
      )
        continue
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
                if (failsConstraint(paramNames, perm, constraint)) return false
                const oinstance: t.ElementInstance = { element: elId, params: {} }
                for (const i in paramNames) oinstance.params![paramNames[i]] = perm[i]
                return oinstance
              })
            )
          : [{ element: elId, params: {} }]

      for (const oinstance of instances) {
        const key = propName + ':' + getInstanceId(oinstance)
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
        if (isEqualAtProp(iv, tv, propName, propNames) && targetMode === omode) {
          const matchId = propNames.map((n) => iv[n]).join('.') //just cause its readable
          if (!sampleTestedInstances[matchId]) {
            log('possible ', () => tv, ' = ', iv)
            sampleTestedInstances[matchId] = true
            const instanceEls = _.uniq(_.reverse(getInstanceEls(oinstance)))
            log(' - insance els ', () => instanceEls.map((c) => elements[c].name))
            for (let i = 0; i < 5; i++) {
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

                log(' - resampled ', () => propNames.map((n) => computed[n]).join(', '))
                if (isEqualAtProp(computed, tv, propName, propNames)) {
                  exactInstances[matchId] = inst
                  log(' - exact*****')
                  break
                }
              } catch (e) {
                log(' - sample err', e)
              }
            }
          }
        }
      }
    }
  }
  return Object.values(exactInstances)
}

function isEqualAtProp(
  a: t.PropsInstance,
  b: t.PropsInstance,
  propName: string,
  propNames: string[]
) {
  let diffed = false,
    equaled = false
  for (const name of propNames) {
    const av = cleanRuby(a[name]),
      bv = cleanRuby(b[name])
    if (name === propName && av === bv) equaled = true
    else if (av !== bv) diffed = true
  }
  return diffed && equaled
}

function getInstanceEls(instance: t.ElementInstance): string[] {
  return [
    instance.element,
    ...Object.values(instance.params ?? {})
      .filter((c) => !!c)
      .flatMap((c) => getInstanceEls(c)),
  ]
}

/* failures like 上げています is be cause this is isn't deep */
function failsConstraint(
  paramNames: string[],
  insts: MetaInstance[],
  constraint?: string
): boolean {
  const constraints: { [paramName: string]: string } = {}
  let failed = false
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i]
    const instParamName = paramNames[i]

    if (constraint?.includes(instParamName)) {
      if (constraints[instParamName] && constraints[instParamName] !== inst.element) {
        failed = true
        break
      } else constraints[instParamName] = inst.element
    }

    for (const paramName in inst.params) {
      const paramValue = inst.params?.[paramName]
      if (!paramValue) continue

      if (constraint?.includes(paramName)) {
        if (constraints[paramName] && constraints[paramName] !== paramValue.element) {
          failed = true
          break
        } else constraints[paramName] = paramValue?.element
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
