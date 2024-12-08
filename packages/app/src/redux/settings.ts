import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type SetingsState = {
  plugins: { [pluginName: string]: string }
  vars: { [varName: string]: string }
}

const settingsInit: SetingsState = {
  plugins: {},
  vars: {},
}

export const settings = createSlice({
  name: 'settings',
  initialState: settingsInit,
  reducers: {
    setSettings: (state, action: PayloadAction<{ settings: SetingsState }>) => {
      state.plugins = action.payload.settings.plugins
      state.vars = action.payload.settings.vars
    },
  },
})
