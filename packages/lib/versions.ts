import { versionable } from '@hsrs/lib/versionable'
import * as t from '@hsrs/lib/types'

export const historyVersionable = versionable<t.HistoryExport>(1)

export const deckVersionable = versionable<t.DeckExport>(1)
