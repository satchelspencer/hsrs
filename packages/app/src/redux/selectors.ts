import { getElementProps, getParamsProps, getElementInstances } from '@hsrs/lib/props'
import * as t from '@hsrs/lib/types'
import { createSelector } from './store'
import { computeElementInstance } from '@hsrs/lib/expr'

export const selectedElement = createSelector(
  [(s) => s.deck.elements, (s) => s.ui.selection],
  (elements, selection) => {
    return selection?.type === 'element'
      ? { id: selection.id, element: elements[selection.id] }
      : undefined
  }
)

export const elementProps = createSelector(
  [(s) => s.deck.elements, (s, elementId: string) => elementId],
  (elements, elementId) => {
    return getElementProps(elementId, elements)
  }
)

export const paramProps = createSelector(
  [(s) => s.deck.elements, (s, params?: t.IdMap<string>) => params],
  (elements, params) => {
    return getParamsProps(params ?? {}, elements)
  }
)

export const selectedElementInstances = createSelector(
  [selectedElement, (s) => s.deck.elements],
  (element, elements) => {
    return (
      element &&
      computeElementInstance(getElementInstances(element.id, elements), elements)
    )
  }
)
