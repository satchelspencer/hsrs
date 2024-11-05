export interface Element {
  name: string
  parents: string[]
  props: Props
  params?: IdMap<string>
  virtual?: true
}

export type Props = IdMap<string>

type Expr = string

export interface View {
  name: string
  elements: Expr
  front: Expr
  back: Expr
}

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
  views: IdMap<View>
}
