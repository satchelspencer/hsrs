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
  cards: Cards
  session: LearningSession | null
}

export interface MemoryState {
  stability: number
  difficulty: number
}

export interface CardState extends MemoryState {
  due?: number
  lastSeen?: number
}

type CardStates = IdMap<CardState>
export interface Cards {
  history: CardLearning[]
  states: CardStates
}

export interface CardLearning {
  cardId: string
  params?: ParamsInstance
  score: number
  time: number
  took: number
}

export interface LearningSession {
  stack: CardInstance[]
  cards: Cards
}
