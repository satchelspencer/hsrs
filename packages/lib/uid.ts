import { random } from './rand'

export function uid() {
  return random().toString(36).substring(2)
}
