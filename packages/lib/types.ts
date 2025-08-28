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
  desc?: string
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
  goal?: GoalState
}

export type FSRSParams = number[] | undefined
export interface DeckSettings {
  newSessionSize: 1 | 2 | 3 | 4
  allowNew: boolean
  fsrsParams?: FSRSParams
  retention?: number
  filter?: string[]
  propsFilter?: string[]
  startOrder?: string
  minDepth?: number
}

export interface MemoryState {
  stability: number
  difficulty: number
}

export interface CardState extends MemoryState {
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

export interface SessionCardLearning extends CardLearning {
  vscore?: number
  instanceId: string
}

export interface LearningSession {
  stack: CardInstance[]
  states: { [cardId: string]: { [instanceId: string]: CardState } }
  history: SessionCardLearning[]
  reviews: number
  filter: string[]
  propsFilter: string[]
  allowNew: boolean
  commit?: string
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
  roots: { [elId: string]: string | undefined }
  firstAncestors: ListMap
}

export type DeckCache = {
  tree: TreeCache
  paramTree: TreeCache
  depths: { [elId: string]: number }
  pdepths: { [elId: string]: number }
  hasProps: { [elId: string]: boolean }
  hasParams: { [elId: string]: boolean }
  nvds: { [elId: string]: number }
  names: { [rootId: string]: { [name: string]: string } }
}

export type HourlyStats = {
  time: number
  scores: { [grade: number]: GradeStats }
  added: number
}

export type GradeStats = {
  count: number
  took: number //time spent
}

export type HourlyStatsMap = { [time: number]: HourlyStats }

export interface SessionAndProgress {
  session: LearningSession
  new: number
  due: number
  next: number
  progress: DayProgress
}

export type DayProgress = {
  goal: GoalState
  due: number
  done: number
  new: number
  next: number
}

export interface GoalState {
  date: number
  ret?: number
  count: number
}

export type GradePayload = { grade: number; took: number }

export type UpdatePayload = ({ add: CardInstance } | { remove: number }) & {
  commit?: string
}
