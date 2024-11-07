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
  try {
    return jexl.evalSync(expr, context) ?? expr
  } catch {
    return expr
  }
}

export function computeElementInstance(
  instace: t.ElementInstance,
  elements: t.IdMap<t.Element>
): t.Props {
  const params = _.mapValues(instace.params, (paramElInstance) => {
    if (!paramElInstance) return paramElInstance
    return computeElementInstance(paramElInstance, elements)
  })

  const elProps = getElementProps(instace.element, elements),
    result: t.Props = {},
    execOrder = _.sortBy(Object.keys(elProps), (prop) =>
      Object.keys(elProps).find((otherProp) => elProps[prop].includes(otherProp)) ? 1 : 0
    )

  for (const prop of execOrder) {
    result[prop] = elProps[prop].map(
      (p, index) =>
        p &&
        run(p, {
          ..._.mapValues(params, (param) => _.mapValues(param, (p) => p && p[index])),
          ..._.mapValues(result, (p) => p && p[index]),
        })
    )
  }

  return result
}
