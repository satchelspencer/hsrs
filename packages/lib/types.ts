export interface Element {
  name: string
  parents: string[]
  props: Props
  params?: Params
  virtual?: true
}

export type Params = IdMap<string>

export type Props = IdMap<(string | null)[]>

export type PropsInstance = { [paramName: string]: PropsInstance | Props[string] }

export interface ElementInstance {
  element: string
  params?: IdMap<ElementInstance | undefined>
}

export interface Card {
  root: string //element id
  property: string
  reverse: boolean
}

export interface CardInstance extends Card, ElementInstance {}

export type IdMap<T> = { [id: string]: T }

export interface Deck {
  elements: IdMap<Element>
}
