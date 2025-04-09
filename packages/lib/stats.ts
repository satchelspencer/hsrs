import _ from 'lodash'
import { DateTime } from 'luxon'
import { CardLearning, CardStates, HourlyStats } from './types'

export function getLearningHour(learning: CardLearning) {
  return DateTime.fromSeconds(learning.time).startOf('hour').toSeconds()
}

export function addLearning2Stat(
  states: CardStates,
  learning: CardLearning,
  stat: HourlyStats
) {
  const state = states[learning.cardId]
  if (!state || learning.score === 0) return
  stat.scores[learning.score] ??= { took: 0, count: 0 }
  stat.scores[learning.score].count++
  stat.scores[learning.score].took += learning.took
  if (state.firstSeen === learning.time) stat.added++
}
