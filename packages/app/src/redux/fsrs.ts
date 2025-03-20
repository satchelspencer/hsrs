import init, { Fsrs } from 'fsrs-browser'
import wasmUrl from 'fsrs-browser/fsrs_browser_bg.wasm?url'

let fsrs: Fsrs | null = null,
  waiting: (() => void)[] = [],
  initing = false

export async function initfsrs(): Promise<Fsrs> {
  if (fsrs) return fsrs
  else if (initing)
    return new Promise((res) => {
      waiting.push(() => res(fsrs!))
    })
  else {
    initing = true
    await init({ module_or_path: wasmUrl })
    fsrs = new Fsrs()
    waiting.forEach((cb) => cb())
    return fsrs
  }
}

export async function computeParams(
  cids: BigInt64Array,
  ratings: Uint8Array,
  ids: BigInt64Array,
  types: Uint8Array
) {
  const fsrs = await initfsrs()
  return fsrs!.computeParametersAnki(
    new Date().getTimezoneOffset() - 4 * 60,
    cids,
    ratings,
    ids,
    types,
    null,
    true
  )
}
