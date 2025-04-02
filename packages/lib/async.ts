import { getCache } from './cache'
import * as t from './types'
import { uid } from './uid'
import Worker from './worker?worker'

export interface WorkerMessageBase<O> {
  type: string
  result?: O
}

interface FindAliasesMessage extends WorkerMessageBase<t.ElementInstance[]> {
  type: 'findAliases'
  instance: t.ElementInstance
  propName: string
  elements: t.IdMap<t.Element>
  cards: t.CardStates
  cache: t.DeckCache
}

interface PingMessage extends WorkerMessageBase<true> {
  type: 'ping'
}

export type WorkerMessage = FindAliasesMessage | PingMessage

type WorkerMessageMeta = { messageId: string }

export type WorkerMetaMessage = WorkerMessage & WorkerMessageMeta

export type WorkerResponseMessage = {
  response: Exclude<WorkerMessage['result'], undefined>
} & WorkerMessageMeta

const worker = new Worker()

function callWorker<T extends WorkerMessage>(
  message: T
): Promise<Exclude<T['result'], undefined>> {
  return new Promise((res) => {
    const id = uid()
    const handleMessage = (e) => {
      const data = e.data as WorkerResponseMessage
      if (data.messageId === id) {
        worker.removeEventListener('message', handleMessage)
        res(data.response as any)
      }
    }
    worker.addEventListener('message', handleMessage)
    worker.postMessage({ ...message, messageId: id })
  })
}

export async function findAliasesAync(
  instance: t.ElementInstance,
  propName: string,
  deck: t.Deck
) {
  const message: FindAliasesMessage = {
    type: 'findAliases',
    instance,
    propName,
    elements: deck.elements,
    cards: deck.cards,
    cache: getCache(deck.elements),
  }
  return callWorker(message)
}
