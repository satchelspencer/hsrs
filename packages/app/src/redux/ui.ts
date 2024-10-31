import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type UiState = {
  selection?: Selection
}
type Selection = { type: 'element' | 'view' | 'type'; id: string }

const uiInit: UiState = {
  selection: undefined,
}

export const ui = createSlice({
  name: 'ui',
  initialState: uiInit,
  reducers: {
    setSelection: (state, action: PayloadAction<Selection | undefined>) => {
      state.selection = action.payload
    },
  },
})
