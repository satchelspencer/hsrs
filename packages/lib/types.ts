export interface Type {
  name: string
  extends?: string[]
  props: Props
}

export interface Element {
  name: string
  types: string[]
  props: Props
  children?: IdMap<string[]>
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
  children?: IdMap<ElementInstance | undefined>
}

export interface RecallInstance extends Recall, ElementInstance {}

export interface ElementOverride extends ElementInstance {
  props: Props
}

export type IdMap<T> = { [id: string]: T }

export interface Deck {
  types: IdMap<Type>
  elements: IdMap<Element>
  views: IdMap<View>
}
