import { getCache } from './cache'
import _ from 'lodash'
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

interface CreateSessionMessage extends WorkerMessageBase<t.SessionAndProgress> {
  type: 'createSession'
  deck: t.Deck
  size: number
  allowNew: boolean
  filter: string[]
  tz: string
  cache: t.DeckCache
}

interface PingMessage extends WorkerMessageBase<true> {
  type: 'ping'
}

export type WorkerMessage = FindAliasesMessage | CreateSessionMessage | PingMessage

type WorkerMessageMeta = { messageId: string }

export type WorkerMetaMessage = WorkerMessage & WorkerMessageMeta

export type WorkerResponseMessage = {
  response: Exclude<WorkerMessage['result'], undefined>
} & WorkerMessageMeta

const workerPool = [new Worker(), new Worker()],
  pending: number[] = []

function callWorker<T extends WorkerMessage>(
  message: T
): Promise<Exclude<T['result'], undefined>> {
  let workerIndex = 0,
    minPending = pending[0] ?? 0
  for (let i = 0; i < workerPool.length; i++) {
    const wp = pending[i] ?? 0
    if (wp < minPending) {
      workerIndex = i
      minPending = wp
    }
  }
  const worker = workerPool[workerIndex]

  pending[workerIndex] = (pending[workerIndex] ?? 0) + 1
  return new Promise((res) => {
    const id = uid()
    const handleMessage = (e) => {
      const data = e.data as WorkerResponseMessage
      if (data.messageId === id) {
        worker.removeEventListener('message', handleMessage)
        pending[workerIndex] -= 1
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

export function createSessionAsync(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[],
  tz: string
) {
  const message: CreateSessionMessage = {
    type: 'createSession',
    deck,
    size,
    allowNew,
    filter,
    tz,
    cache: getCache(deck.elements),
  }
  return callWorker(message)
}
