import { Shortcut } from './keys'

type PropMap = { [prop: string]: string }

export interface CardState {
  id: string
  value: PropMap
  next?: PropMap
  aliases: PropMap[]
  vars: PropMap
  revealed: boolean
  property: string
  mode: string
}

export interface StateUpdateMessage {
  type: 'state'
  state: CardState
}

export interface ShortcutMessage {
  type: 'shortcut'
  name: Shortcut
}

export interface ReadyMessage {
  type: 'ready'
}

export interface ActiveAreaMessage {
  type: 'activeArea'
  rect: {
    x: number
    y: number
    width: number
    height: number
  } | null
}

export interface InitOptions {
  allowedOrigins?: string[]
}

export type IncomingMessage = StateUpdateMessage
export type OutgoingMessage = ReadyMessage | ShortcutMessage | ActiveAreaMessage
