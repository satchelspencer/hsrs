import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import * as t from '@hsrs/lib/types'
import _ from 'lodash'

const deckInit: t.Deck = {
  elements: {},
}

export const deck = createSlice({
  name: 'deck',
  initialState: deckInit,
  reducers: {
    createElement: (
      state,
      action: PayloadAction<{ id: string; element?: Partial<t.Element> }>
    ) => {
      state.elements = {
        [action.payload.id]: {
          name: 'untitled element',
          parents: [],
          props: {},
          ...action.payload.element,
        },
        ...state.elements,
      }
    },
    updateElement: (state, action: PayloadAction<{ id: string; element: t.Element }>) => {
      if (!state.elements[action.payload.id]) throw 'element does not exist'
      state.elements[action.payload.id] = action.payload.element
    },
    deleteElement: (
      state,
      action: PayloadAction<{ id: string; fromParentId?: string }>
    ) => {
      const { id, fromParentId } = action.payload
      if (!state.elements[id]) throw 'element does not exist'

      const victim = state.elements[id],
        prevParents = victim.parents

      victim.parents = fromParentId ? _.without(victim.parents, fromParentId) : []

      if (!victim.parents.length) {
        delete state.elements[id]
        for (const elementId in state.elements) {
          const element = state.elements[elementId]
          if (element.parents.includes(id)) {
            element.parents = _.uniq([..._.without(element.parents, id), ...prevParents])
          }
        }
      }
    },
  },
})
