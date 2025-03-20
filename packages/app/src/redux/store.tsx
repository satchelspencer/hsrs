import React from 'react'
import _ from 'lodash'
import { useDispatch as ud, useSelector as us } from 'react-redux'
import { combineReducers, configureStore, createSelector as cs } from '@reduxjs/toolkit'
import { persistStore, persistReducer, createTransform } from 'redux-persist'
import { PersistGate } from 'redux-persist/integration/react'
import storage from 'redux-persist/lib/storage'
import { Provider } from 'react-redux'
import { deck, deckThunks } from './deck'
import { ui } from './ui'
import { settings } from './settings'

export const actions = {
  ...deck.actions,
  ...deckThunks,
  ...ui.actions,
  ...settings.actions,
}

const FilterTransform = createTransform<any, any>(
  null,
  (deck) => _.omit(deck, 'working'),
  { whitelist: ['deck'] }
)

const reducer = persistReducer(
  { storage, key: 'root', transforms: [FilterTransform as any] },
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

export function StoreProvider(props: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {props.children}
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
