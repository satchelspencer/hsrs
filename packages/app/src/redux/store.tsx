import React, { useEffect, useState } from 'react'
import { useDispatch as ud, useSelector as us } from 'react-redux'
import { combineReducers, configureStore, createSelector as cs } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import { PersistGate } from 'redux-persist/integration/react'
import storage from 'redux-persist/lib/storage'
import { Provider } from 'react-redux'
import { deck, deckThunks } from './deck'
import { ui } from './ui'
import { settings } from './settings'
import { ready, setParams } from '@hsrs/lib/schedule'

export const actions = {
  ...deck.actions,
  ...deckThunks,
  ...ui.actions,
  ...settings.actions,
}

const reducer = persistReducer(
  { storage, key: 'root' },
  combineReducers({
    deck: deck.reducer,
    ui: ui.reducer,
    settings: settings.reducer,
  })
)

export const store = configureStore({
  reducer: reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

let lastParams: number[] | undefined
store.subscribe(() => {
  const params = store.getState().deck.settings.fsrsParams
  if (lastParams !== params) {
    setParams(params)
    lastParams = params
  }
})

export function StoreProvider(props: { children: React.ReactNode }) {
  const [fsrsReady, setFSRSReady] = useState(false)
  useEffect(() => {
    ready().then(() => setFSRSReady(true))
  }, [])
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {fsrsReady && props.children}
      </PersistGate>
    </Provider>
  )
}

export const persistor = persistStore(store)

type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useDispatch = ud.withTypes<AppDispatch>()
export const useSelector = us.withTypes<RootState>()
export const createSelector = cs.withTypes<RootState>()
