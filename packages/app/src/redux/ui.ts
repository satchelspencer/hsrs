import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type UiState = {
  selections: Selection[][]
  route: string
}

export type Selection = {
  type: 'element' | 'relation' | 'stats'
  id: string
  jump?: boolean
}

const uiInit: UiState = {
  selections: [],
  route: 'learn',
}

export const ui = createSlice({
  name: 'ui',
  initialState: uiInit,
  reducers: {
    setSelection: (
      state,
      action: PayloadAction<{ selection: Selection[]; index: number }>
    ) => {
      const selections = state.selections.filter((a) => !!a),
        newSelections = selections.slice(0, action.payload.index)
      if (action.payload.selection.length)
        newSelections[action.payload.index] = action.payload.selection

      const rest = selections.slice(
          action.payload.index + (action.payload.selection.length ? 0 : 1)
        ),
        nextJumpIndex = rest.findIndex((j) => j[0]?.jump)
      if (nextJumpIndex !== -1) newSelections.push(...rest.slice(nextJumpIndex))

      state.selections = newSelections
    },
    updateSelection: (
      state,
      action: PayloadAction<{ selection: Partial<Selection>; index: number }>
    ) => {
      const newSelections = [...state.selections]
      newSelections[action.payload.index] = newSelections[action.payload.index].map(
        (s) => ({ ...s, ...action.payload.selection })
      )
      state.selections = newSelections
    },
    setRoute: (state, action: PayloadAction<{ route: string }>) => {
      state.route = action.payload.route
    },
  },
})
