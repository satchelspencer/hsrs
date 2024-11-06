import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type UiState = {
  selections: Selection[][]
}

export type Selection = { type: 'element' | 'view'; id: string }

const uiInit: UiState = {
  selections: [],
}

export const ui = createSlice({
  name: 'ui',
  initialState: uiInit,
  reducers: {
    setSelection: (
      state,
      action: PayloadAction<{ selection: Selection[]; index: number }>
    ) => {
      const newSelections = state.selections.slice(0, action.payload.index)
      if (action.payload.selection.length)
        newSelections[action.payload.index] = action.payload.selection
      state.selections = newSelections
    },
  },
})
