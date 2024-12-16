export interface Element {
  name: string
  parents: string[]
  props: Props
  params?: Params
  virtual?: true
  constraint?: string
}

export type Params = IdMap<string>

export type Props = IdMap<string | null>

export type PropsInstance = { [paramName: string]: PropsInstance | Props[string] }

export interface ElementInstance {
  element: string
  params?: ParamsInstance
}

type ParamsInstance = IdMap<ElementInstance | undefined>
export interface Card {
  element: string
  property: string
}

export interface CardInstance extends Card, ElementInstance {}

export type IdMap<T> = { [id: string]: T }

export interface Deck {
  elements: IdMap<Element>
  cards: CardStates
  session: LearningSession | null
  settings: DeckSettings
}

export type FSRSParams = number[] | undefined
export interface DeckSettings {
  newSessionSize: 1 | 2 | 3 | 4
  allowNew: boolean
  fsrsParams?: FSRSParams
  retention?: number
}

export interface MemoryState {
  stability: number
  difficulty: number
}

export interface CardState extends MemoryState {
  due?: number
  lastSeen?: number
}

export type CardStates = IdMap<CardState>

export interface CardLearning {
  cardId: string
  params?: ParamsInstance
  score: number
  time: number
  took: number
}

export interface LearningSession {
  stack: CardInstance[]
  cards: CardStates
  history: CardLearning[]
}

export interface HistoryExport {
  type: 'history'
  history: CardLearning[]
}

export interface DeckExport {
  type: 'deck'
  elements: IdMap<Element>
}
