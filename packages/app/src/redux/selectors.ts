import { getElementProps, getParamsProps, getElementInstances } from '@hsrs/lib/props'
import { createSelector } from './store'
import { computeElementInstance } from '@hsrs/lib/expr'
import _ from 'lodash'
import { Selection } from './ui'

export const selectSelections = createSelector(
  [(state) => state.ui.selections, (state) => state.deck.elements],
  (selections, elements): Selection[] =>
    _.takeWhile(selections, (selection) =>
      selection && selection.type === 'element' ? !!elements[selection.id] : false
    )
)

export const selectSelectionByIndex = createSelector(
  [selectSelections, (state, index: number) => index],
  (selections, index): Selection | undefined => {
    return selections[index]
  }
)

export const selectElementById = createSelector(
  [(state) => state.deck.elements, (state, elementId: string) => elementId],
  (elements, elementId) => {
    return elements[elementId]
  }
)

export const selectElementPropsById = createSelector(
  [(s) => s.deck.elements, (s, elementId: string) => elementId],
  (elements, elementId) => {
    return getElementProps(elementId, elements)
  }
)

export const selectElementParamPropsById = createSelector(
  [(state) => state.deck.elements, (state, elementId: string) => elementId],
  (elements, elementId) => {
    return getParamsProps(elements[elementId].params ?? {}, elements)
  }
)

export const selectElementInstancesById = createSelector(
  [(state, id: string) => id, (s) => s.deck.elements],
  (elementId, elements) => {
    return computeElementInstance(getElementInstances(elementId, elements), elements)
  }
)

export const selectElementIdsByParent = createSelector(
  [(state) => state.deck.elements, (state, parentId?: string) => parentId],
  (elements, parentId) => {
    const keys: string[] = []
    for (const key in elements) {
      const element = elements[key]
      if (parentId ? element.parents.includes(parentId) : !element.parents.length)
        keys.push(key)
    }
    return keys
  }
)
