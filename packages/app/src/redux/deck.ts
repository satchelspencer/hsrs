import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import * as t from '@hsrs/lib/types'
import _ from 'lodash'
import { createLearningSession, gradeCard, undoGrade } from '@hsrs/lib/session'
import { applyHistoryToCards, computeParams } from '@hsrs/lib/schedule'
import { db, learning2db } from './db'

const deckInit: t.Deck = {
  elements: {},
  cards: {},
  session: null,
  settings: {
    newSessionSize: 1,
    allowNew: true,
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
      state.session = createLearningSession(
        state,
        action.payload.size,
        state.settings.allowNew,
        state.settings.filter ?? []
      ).session
    },
    cancelSession: (state, action: PayloadAction<{}>) => {
      state.session = null
    },
    gradeCard: (state, action: PayloadAction<{ grade: number; took: number }>) => {
      if (!state.session) throw 'no session'
      state.session = gradeCard(state, action.payload.grade, action.payload.took)
    },
    undoGrade: (state, action: PayloadAction<{}>) => {
      if (!state.session) throw 'no session'
      state.session = undoGrade(state.session)
    },
    setDeckSettings: (state, action: PayloadAction<Partial<t.DeckSettings>>) => {
      state.settings = { ...deckInit.settings, ...state.settings, ...action.payload }
    },
    importElements: (state, action: PayloadAction<t.DeckExport>) => {
      state.elements = { ...state.elements, ...action.payload.elements }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(deckThunks.endSession.fulfilled, (state, action) => {
      applyHistoryToCards(state.cards, action.payload, false, state)
      state.session = null
    })

    builder.addCase(deckThunks.recomputeCards.fulfilled, (state, action) => {
      state.cards = action.payload
    })

    builder.addCase(deckThunks.clearHistory.fulfilled, (state, action) => {
      state.cards = {}
      state.session = null
    })

    builder.addCase(deckThunks.computeParams.fulfilled, (state, action) => {
      state.settings.fsrsParams = action.payload
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
    async (_) => {
      await db.cardLearning.clear()
    }
  ),
  recomputeCards: createAsyncThunk<t.CardStates, void, { state: { deck: t.Deck } }>(
    'deck/recomputeCards',
    async (x, { getState }) => {
      const newCards: t.CardStates = {},
        deck = getState().deck
      await db.cardLearning.orderBy('id').each((learning) => {
        if (_.every(learning.elIds, (e) => deck.elements[e]))
          applyHistoryToCards(newCards, [learning], false, deck)
      })
      return newCards
    }
  ),
  computeParams: createAsyncThunk<t.FSRSParams, void, { state: { deck: t.Deck } }>(
    'deck/computeParams',
    async (x, { getState }) => {
      const cids: number[] = [],
        ratings: number[] = [],
        ids: number[] = [],
        types: number[] = []

      const deck = getState().deck

      let learnSet: t.CardLearning[] = [],
        currentId: string | null = null

      const count = await db.cardLearning.count()

      await db.cardLearning
        .orderBy(['cardId', 'id'])
        .offset(Math.max(count - 50000, 0))
        .each((learning) => {
          if (learning.score === 0) return
          if (currentId && learning.cardId !== currentId) {
            if (learnSet.length > 1) {
              const cid = learnSet[0].time * 1000 - 24 * 3600
              let lastSeen: number | null = null
              let firstSession = true
              let relearning = false
              let first = true
              for (const l of learnSet) {
                const delta = lastSeen ? l.time - lastSeen : 0
                if (delta > 3600 * 6) {
                  firstSession = false
                  relearning = false
                }
                const custom = !(delta < 3600 * 12 && !(relearning || l.score === 1))

                cids.push(cid)
                ratings.push(l.score)
                ids.push(l.time * 1000)
                types.push(first ? 0 : relearning ? 2 : custom ? 3 : 1)

                lastSeen = l.time
                if (!firstSession && l.score === 1) relearning = true
                first = false
              }
            }

            learnSet = []
          }
          currentId = learning.cardId
          learnSet.push(learning)
        })

      const params = computeParams(
        new BigInt64Array(cids.map((n) => BigInt(n))),
        new Uint8Array(ratings),
        new BigInt64Array(ids.map((n) => BigInt(n))),
        new Uint8Array(types)
      )

      return Array.from(params)
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
