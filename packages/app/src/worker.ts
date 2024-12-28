import { findAliases } from '@hsrs/lib/props'
import * as t from '@hsrs/lib/types'

type WorkerMessage = {
  type: 'findAliases'
  instance: t.ElementInstance
  propName: string
  elements: t.IdMap<t.Element>
  cards: t.CardStates
}

self.onmessage = (event) => {
  const message = event.data as WorkerMessage

  if (message.type === 'findAliases') {
    const result = findAliases(
      message.instance,
      message.propName,
      message.elements,
      message.cards
    )

    self.postMessage(result)
  }
}
