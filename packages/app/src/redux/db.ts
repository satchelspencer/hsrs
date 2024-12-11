import Dexie, { Table } from 'dexie'

import * as t from '@hsrs/lib/types'
import { flattenCard } from '@hsrs/lib/schedule'
import { id2Card } from '@hsrs/lib/session'

interface DBItem extends t.CardLearning {
  elIds: string[]
}

export function learning2db(learning: t.CardLearning): DBItem {
  const flat = flattenCard(learning)
  return { ...learning, elIds: flat.map((f) => id2Card(f.cardId).element) }
}

class CardLearningDatabase extends Dexie {
  cardLearning!: Table<DBItem, number>

  constructor() {
    super('CardLearningDatabase')
    this.version(1).stores({
      cardLearning: '++id, cardId, time, *elIds',
    })
  }
}

export const db = new CardLearningDatabase()
