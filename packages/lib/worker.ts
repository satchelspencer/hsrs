import { WorkerMessage, WorkerMetaMessage, WorkerResponseMessage } from './async'
import { setLogLevel } from './log'
import { findAliases } from './alias'
import { createLearningSession } from './session'

function handleMessage(
  message: WorkerMessage
): Exclude<WorkerMessage['result'], undefined> {
  if (message.logLevel) setLogLevel(message.logLevel.filter, message.logLevel.level)

  if (message.type === 'findAliases') {
    return findAliases(
      message.instance,
      message.propName,
      message.elements,
      message.cards,
      message.cache,
      message.filter
    )
  }
  if (message.type === 'createSession') {
    return createLearningSession(
      message.deck,
      message.size,
      message.allowNew,
      message.filter,
      message.tz,
      message.cache
    )
  }
  if (message.type === 'ping') return true
  throw 'unhandled message'
}

self.onmessage = (event) => {
  const message = event.data as WorkerMetaMessage

  const response: WorkerResponseMessage = {
    messageId: message.messageId,
    response: handleMessage(message),
  }
  self.postMessage(response)
}
