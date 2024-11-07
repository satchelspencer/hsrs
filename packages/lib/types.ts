export interface Element {
  name: string
  parents: string[]
  props: Props
  params?: Params
  virtual?: true
}

export type Params = IdMap<string>

export type Props = IdMap<(string | null)[]>
export interface Recall {
  view: string
  element: string
}

export interface ElementInstance {
  element: string
  params?: IdMap<ElementInstance | undefined>
}

export interface RecallInstance extends Recall, ElementInstance {}

export interface ElementOverride extends ElementInstance {
  props: Props
}

export type IdMap<T> = { [id: string]: T }

export interface Deck {
  elements: IdMap<Element>
}
