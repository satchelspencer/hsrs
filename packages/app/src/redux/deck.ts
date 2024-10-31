import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import * as t from '@hsrs/lib/types'

const deckInit: t.Deck = {
  elements: {},
  views: {},
  types: {},
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
    createType: (
      state,
      action: PayloadAction<{ id: string; element?: Partial<t.Type> }>
    ) => {
      state.types[action.payload.id] = {
        name: 'untitled type',
        props: {},
        ...action.payload.element,
      }
    },
    updateType: (
      state,
      action: PayloadAction<{ id: string; type?: Partial<t.Type> }>
    ) => {
      if (!state.types[action.payload.id]) throw 'type does not exist'
      state.types[action.payload.id] = {
        ...state.types[action.payload.id],
        ...action.payload.type,
      }
    },
    deleteType: (state, action: PayloadAction<{ id: string }>) => {
      if (!state.types[action.payload.id]) throw 'type does not exist'
      delete state.types[action.payload.id]
    },
  },
})
