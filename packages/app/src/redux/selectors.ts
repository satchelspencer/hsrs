import {
  getElementParamsAndProps,
  getVariables,
  getNonVirtualDescendents,
  getElementChildren,
  generateElementInstanceSamples,
  getInheritedElement,
} from '@hsrs/lib/props'
import { createSelector } from './store'
import _ from 'lodash'
import { Selection } from './ui'
import { getCache } from '@hsrs/lib/cache'

export const selectSelections = createSelector(
  [(state) => state.ui.selections, (state) => state.deck.elements],
  (selections, elements): Selection[][] =>
    _.takeWhile(selections, (selection) =>
      _.every(selection, (selection) => (selection ? !!elements[selection.id] : false))
    )
)

export const selectSelectionByIndex = createSelector(
  [selectSelections, (state, index: number) => index],
  (selections, index): Selection[] => {
    return selections[index]
  }
)

export const selectLastJumpSelectionByIndex = createSelector(
  [selectSelections, (state, index: number) => index],
  (selections, index): Selection[] | undefined => {
    return selections[
      _.take(selections, index).findLastIndex((s) => s.length === 1 && s[0].jump) - 1
    ]
  }
)

export const selectElementById = createSelector(
  [(state) => state.deck.elements, (state, elementId: string) => elementId],
  (elements, elementId) => {
    return elements[elementId]
  }
)

export const selectInheritedElementById = createSelector(
  [(s) => s.deck.elements, (s, elementId: string) => elementId],
  (elements, elementId) => {
    return getInheritedElement(elementId, elements)
  }
)

export const selectElementPropVariables = createSelector(
  [(s) => s.deck.elements, (s, elementId: string) => elementId],
  (elements, elementId) => {
    return getVariables(getElementParamsAndProps(elementId, elements))
  }
)

export const selectElementInstanceGenerator = createSelector(
  [(state, id: string) => id, (s) => s.deck.elements],
  (elementId, elements) => {
    return generateElementInstanceSamples(elementId, elements)
  }
)

export const selectElementIdsByParent = createSelector(
  [(state) => state.deck.elements, (state, parentId?: string) => parentId],
  (elements, parentId) => {
    return getElementChildren(parentId, elements)
  }
)

export const selectNonVirtialElementIdsByParent = createSelector(
  [(state) => state.deck.elements, (state, parentId?: string) => parentId],
  (elements, parentId) => {
    return parentId
      ? getNonVirtualDescendents(parentId, elements, getCache(elements))
      : []
  }
)
