import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import * as t from '@hsrs/lib/types'

const deckInit: t.Deck = {
  elements: {},
  views: {},
}

export const deck = createSlice({
  name: 'deck',
  initialState: deckInit,
  reducers: {
    createElement: (
      state,
      action: PayloadAction<{ id: string; element?: Partial<t.Element> }>
    ) => {
      state.elements[action.payload.id] = {
        name: 'untitled element',
        types: [],
        props: {},
        ...action.payload.element,
      }
    },
    updateElement: (
      state,
      action: PayloadAction<{ id: string; element?: Partial<t.Element> }>
    ) => {
      if (!state.elements[action.payload.id]) throw 'element does not exist'
      state.elements[action.payload.id] = {
        ...state.elements[action.payload.id],
        ...action.payload.element,
      }
    },
    deleteElement: (state, action: PayloadAction<{ id: string }>) => {
      if (!state.elements[action.payload.id]) throw 'element does not exist'
      delete state.elements[action.payload.id]
    },
  },
})
