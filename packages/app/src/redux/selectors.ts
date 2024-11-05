import { resolveProps, resolveChildProps, getElementInstances } from '@hsrs/lib/props'
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
  [(s) => s.deck.elements, (s, elementIds?: string[]) => elementIds],
  (elements, typeIds) => {
    return resolveProps(typeIds ?? [], elements)
  }
)

export const childProps = createSelector(
  [(s) => s.deck.elements, (s, children?: t.IdMap<string[]>) => children],
  (elements, children) => {
    return resolveChildProps(children ?? {}, elements)
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
