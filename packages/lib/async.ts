/* utils for running long running computations in web workers */

import { getCache } from './cache'
import _ from 'lodash'
import * as t from './types'
import { uid } from './uid'
import Worker from './worker?worker'
import { logger, getLogLevel } from './log'

export interface WorkerMessageBase<O> {
  type: string
  result?: O
  logLevel?: {
    level: number
    filter: string
  }
}

interface FindAliasesMessage extends WorkerMessageBase<t.ElementInstance[]> {
  type: 'findAliases'
  instance: t.ElementInstance
  propName: string
  elements: t.IdMap<t.Element>
  cards: t.CardStates
  cache: t.DeckCache
  filter?: string[]
}

interface CreateSessionMessage extends WorkerMessageBase<t.SessionAndProgress> {
  type: 'createSession'
  deck: t.Deck
  size: number
  allowNew: boolean
  filter: string[]
  propsFilter: string[]
  tz: string
  cache: t.DeckCache
}

interface GetNewMessage extends WorkerMessageBase<t.CardInstance[]> {
  type: 'getNew'
  deck: t.Deck
  limit: number
  filter: string[]
  propsFilter: string[]
  cache: t.DeckCache
}

interface PingMessage extends WorkerMessageBase<true> {
  type: 'ping'
}

export type WorkerMessage =
  | FindAliasesMessage
  | CreateSessionMessage
  | PingMessage
  | GetNewMessage

type WorkerMessageMeta = { messageId: string }

export type WorkerMetaMessage = WorkerMessage & WorkerMessageMeta

export type WorkerResponseMessage = {
  response: Exclude<WorkerMessage['result'], undefined>
} & WorkerMessageMeta

const workerPool: Worker[] = [new Worker(), new Worker()]
let index: number = 0

const log = logger(3, 'worker')

async function callWorkerBase<T extends WorkerMessage>(
  message: T,
  worker: Worker,
  id: string
): Promise<Exclude<T['result'], undefined>> {
  log(id, 'call', message)

  return new Promise((res) => {
    const handleMessage = (e) => {
      const data = e.data as WorkerResponseMessage
      log(id, 'message?', data)
      if (data.messageId === id) {
        worker.removeEventListener('message', handleMessage)
        res(data.response as any)
      }
    }
    worker.addEventListener('message', handleMessage)
    log(id, 'sending')
    const metaMessage: WorkerMetaMessage = {
      ...message,
      logLevel: getLogLevel(),
      messageId: id,
    }
    worker.postMessage(metaMessage)
  })
}

async function callWorker<T extends WorkerMessage>(
  message: T,
  timeout = 10000,
  id = uid(),
  depth = 0
): Promise<Exclude<T['result'], undefined>> {
  const thisIndex = index++ % workerPool.length,
    worker = workerPool[thisIndex]

  log(id, 'selected worker', thisIndex)

  /* check for timeout to handle chromes killed workers :( */
  const res = await Promise.race([
    callWorkerBase(message, worker, id),
    new Promise<false>((res) => setTimeout(() => res(false), timeout)),
  ])

  if (res === false) {
    log(id, 'timed out')
    worker.terminate()
    if (workerPool[thisIndex] === worker) {
      workerPool[thisIndex] = new Worker()
      worker.terminate()
    }
    if (depth < 1) return callWorker(message, timeout, id, depth + 1)
    else {
      window.location.reload()
      throw 'max depth exceeded'
    }
  } else return res
}

export async function findAliasesAync(
  instance: t.ElementInstance,
  propName: string,
  deck: t.Deck,
  filter?: string[]
) {
  const message: FindAliasesMessage = {
    type: 'findAliases',
    instance,
    propName,
    elements: deck.elements,
    cards: deck.cards,
    cache: getCache(deck.elements),
    filter,
  }
  return callWorker(message)
}

export function createSessionAsync(
  deck: t.Deck,
  size: number,
  allowNew: boolean,
  filter: string[],
  propsFilter: string[],
  tz: string
) {
  const message: CreateSessionMessage = {
    type: 'createSession',
    deck,
    size,
    allowNew,
    filter,
    propsFilter,
    tz,
    cache: getCache(deck.elements),
  }
  return callWorker(message)
}

export function getNewAsync(
  deck: t.Deck,
  limit: number,
  filter: string[],
  propsFilter: string[]
) {
  const message: GetNewMessage = {
    type: 'getNew',
    deck,
    limit,
    filter,
    propsFilter,
    cache: getCache(deck.elements),
  }
  return callWorker(message)
}
