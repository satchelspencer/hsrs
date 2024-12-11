import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import * as t from '@hsrs/lib/types'
import _ from 'lodash'
import { createLearningSession, gradeCard, undoGrade } from '@hsrs/lib/session'
import { applyHistoryToCards } from '@hsrs/lib/schedule'
import { db, learning2db } from './db'

const deckInit: t.Deck = {
  elements: {},
  cards: {},
  session: null,
  settings: {
    newSessionSize: 1,
  },
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
      deleteElementDeep(state.elements, action.payload.id, action.payload.fromParentId)
    },
    createSession: (state, action: PayloadAction<{ size: number }>) => {
      state.session = createLearningSession(state, action.payload.size)
    },
    gradeCard: (state, action: PayloadAction<{ grade: number; took: number }>) => {
      if (!state.session) throw 'no session'
      state.session = gradeCard(state.session, action.payload.grade, action.payload.took)
    },
    undoGrade: (state, action: PayloadAction<{}>) => {
      if (!state.session) throw 'no session'
      state.session = undoGrade(state.session)
    },
    setDeckSettings: (state, action: PayloadAction<Partial<t.DeckSettings>>) => {
      state.settings = { ...deckInit.settings, ...state.settings, ...action.payload }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(deckThunks.endSession.fulfilled, (state, action) => {
      applyHistoryToCards(state.cards, action.payload)
      state.session = null
    })

    builder.addCase(deckThunks.recomputeCards.fulfilled, (state, action) => {
      state.cards = action.payload
    })

    builder.addCase(deckThunks.clearHistory.fulfilled, (state, action) => {
      state.cards = {}
      state.session = null
    })
  },
})

export const deckThunks = {
  endSession: createAsyncThunk<t.CardLearning[], void, { state: { deck: t.Deck } }>(
    'deck/endSession',
    async (_, { getState }) => {
      const state = getState().deck
      if (!state.session) throw 'no session'
      await db.cardLearning.bulkAdd(state.session.history.map(learning2db))
      return state.session.history
    }
  ),
  clearHistory: createAsyncThunk<void, void, { state: { deck: t.Deck } }>(
    'deck/clearHistory',
    async (_, { getState }) => {
      await db.cardLearning.clear()
    }
  ),
  recomputeCards: createAsyncThunk<t.CardStates, void, { state: { deck: t.Deck } }>(
    'deck/recomputeCards',
    async (_, { getState }) => {
      const newCards: t.CardStates = {}
      await db.cardLearning.orderBy('id').each((learning) => {
        applyHistoryToCards(newCards, [learning])
      })
      return newCards
    }
  ),
}

function deleteElementDeep(
  elements: t.IdMap<t.Element>,
  id: string,
  parentId?: string,
  ctxt: string[] = []
) {
  if (!elements[id]) throw 'element does not exist'
  if (ctxt.includes(id)) throw 'loop'

  const victim = elements[id],
    prevParents = victim.parents

  victim.parents = parentId ? _.without(prevParents, parentId) : []

  if (!victim.parents.length) {
    delete elements[id]
    const childCtxt = [...ctxt, id]
    for (const elementId in elements) {
      const element = elements[elementId]
      if (Object.values(element.params ?? {}).includes(id))
        deleteElementDeep(elements, elementId, undefined, childCtxt)
      else if (element.parents.includes(id))
        deleteElementDeep(elements, elementId, id, childCtxt)
    }
  }
}
