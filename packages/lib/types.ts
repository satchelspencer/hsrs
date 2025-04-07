export interface Element {
  name: string
  parents: string[]
  props: Props
  params?: Params
  virtual?: true
  constraint?: string
  mode?: string
  order?: string
  retention?: string
}

export type Params = IdMap<string>

export type Props = IdMap<string | null>

export type PropsInstance = { [paramName: string]: PropsInstance | Props[string] }

export interface ElementInstance {
  element: string
  params?: ParamsInstance
}

export type ParamsInstance = IdMap<ElementInstance | undefined>
export interface Card {
  element: string
  property: string
}

export interface CardInstance extends Card, ElementInstance {
  new?: boolean
}

export type IdMap<T> = { [id: string]: T }

export interface Deck {
  elements: IdMap<Element>
  cards: CardStates
  session: LearningSession | null
  settings: DeckSettings
  working?: boolean
}

export interface Daily {
  day: string
  goal: number
  pgoal: number
  done: number
  new: number
}

export type FSRSParams = number[] | undefined
export interface DeckSettings {
  newSessionSize: 1 | 2 | 3 | 4
  allowNew: boolean
  fsrsParams?: FSRSParams
  retention?: number
  filter?: string[]
}

export interface MemoryState {
  stability: number
  difficulty: number
}

export interface CardState extends MemoryState {
  due?: number
  lastSeen?: number
  lastBase?: number
  lastScore?: number
  lastMiss?: number
  firstSeen?: number
  lastRoot?: number
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
  reviews: number
  filter: string[]
  allowNew: boolean
}

export interface HistoryExport {
  type: 'history'
  history: CardLearning[]
}

export interface DeckExport {
  type: 'deck'
  elements: IdMap<Element>
}

export type ListMap = { [id: string]: string[] }

export type TreeCache = {
  parents: ListMap
  children: ListMap
  ancestors: ListMap
  topo: string[]
  leaves: { [elId: string]: number }
}

export type DeckCache = {
  tree: TreeCache
  paramTree: TreeCache
  depths: { [elId: string]: number }
  pdepths: { [elId: string]: number }
  hasProps: { [elId: string]: boolean }
  nvds: { [elId: string]: number }
}
