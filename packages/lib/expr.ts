import jexl from 'jexl'
import _ from 'lodash'
import * as t from './types'

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
  try{
    return jexl.evalSync(expr, context) ?? expr
  }catch{
    return expr
  }
}

export function computeElementInstance(
  instace: t.ElementInstance,
  elements: t.IdMap<t.Element>
): t.Props {
  const children = _.mapValues(instace.children, (child) => {
      if (!child) return child
      return computeElementInstance(child, elements)
    }),
    element = elements[instace.element]

  return _.mapValues(element.props, (prop) => run(prop, children))
}
