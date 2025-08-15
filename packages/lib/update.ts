import * as t from './types'
import _ from 'lodash'
import { getNewAsync } from './async'
import { card2Id, getEstReviews, getMinGraduatedIndex, getNewCardFactor } from './session'
import { logger } from './log'
import { getTime } from './schedule'

const log = logger(3, 'session-stack')

let pending: number | undefined = undefined

export async function getSessionUpdate(
  deck: t.Deck
): Promise<t.UpdatePayload | undefined> {
  log('getSessionUpdate')
  const { session } = deck
  if (!session) throw 'no session'

  const minGraduatedIndex = getMinGraduatedIndex(session),
    estReviews = getEstReviews(session),
    ncFactor = getNewCardFactor(),
    delta = Math.floor((estReviews - session.reviews) / ncFactor),
    commit = session.commit

  log('delta', estReviews, 'original', session.reviews, 'delta ', delta)

  if (delta > 1 && session.allowNew) {
    log('remove', delta)
    return { remove: true, commit }
  } else if (
    delta < -2 &&
    session.allowNew &&
    minGraduatedIndex > session.stack.length / 4
  ) {
    log('sampling', -delta, pending)

    const now = getTime()
    if (pending && now - pending < 10000) {
      log('bail pending')
      return
    }

    pending = now
    const [newCard] = await getNewAsync(
      {
        ...deck,
        cards: {
          ..._.fromPairs(
            session.stack.map((s) => [card2Id(s), { stability: 1, difficulty: 5 }])
          ), //exclude ones already in session
          ...deck.cards,
        },
      },
      1,
      session.filter,
      session.propsFilter,
      !!deck.settings.minDepth
    )
    pending = undefined
    if (newCard) return { add: newCard, commit }
  }
}
