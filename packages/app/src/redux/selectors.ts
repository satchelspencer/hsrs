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

export const selectedType = createSelector(
  [(s) => s.deck.types, (s) => s.ui.selection],
  (types, selection) => {
    return selection?.type === 'type'
      ? { id: selection.id, type: types[selection.id] }
      : undefined
  }
)

export const typeProps = createSelector(
  [(s) => s.deck.types, (s, typeIds?: string[]) => typeIds],
  (types, typeIds) => {
    return resolveProps(typeIds ?? [], types)
  }
)

export const childProps = createSelector(
  [(s) => s.deck.types, (s, children?: t.IdMap<string[]>) => children],
  (types, children) => {
    return resolveChildProps(children ?? {}, types)
  }
)

export const selectedElementInstances = createSelector(
  [selectedElement, (s) => s.deck.elements, (s) => s.deck.types],
  (element, elements, types) => {
    return (
      element &&
      computeElementInstance(getElementInstances(element.id, elements, types), elements)
    )
  }
)
