import { createSelector } from './store'

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
