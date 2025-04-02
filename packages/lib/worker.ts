import { WorkerMessage, WorkerMetaMessage, WorkerResponseMessage } from './async'
import { findAliases } from './props'

function handleMessage(
  message: WorkerMessage
): Exclude<WorkerMessage['result'], undefined> {
  if (message.type === 'findAliases') {
    return findAliases(
      message.instance,
      message.propName,
      message.elements,
      message.cards,
      message.cache
    )
  }
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
