import init, { Fsrs, initSync } from 'fsrs-browser'
import wasmUrl from 'fsrs-browser/fsrs_browser_bg.wasm?url'

export { Fsrs } from 'fsrs-browser'

export const defaultParams = [
  0.7707539200782776, 1.4344240427017212, 3.467081308364868, 16.19120979309082,
  7.254122257232666, 0.3811998963356018, 1.7041410207748413, 0.014886749908328056,
  1.3656686544418335, 0.22190921008586884, 0.8670082092285156, 1.9588409662246704,
  0.08125182241201401, 0.3044493794441223, 2.29744815826416, 0.11656399071216583,
  3.339834451675415, 0.3628292679786682, 0.34700527787208557,
]
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null

export async function fsrs(params = defaultParams) {
  if (!isNode) {
    await init({ module_or_path: wasmUrl })
  } else {
    const fs = eval('require')('fs') as typeof import('fs')
    const { webcrypto } = eval('require')('node:crypto') as typeof import('crypto')
    globalThis.crypto = webcrypto as unknown as Crypto

    const wasmPath = eval('require').resolve('fsrs-browser/fsrs_browser_bg.wasm')
    const wasmBuffer = fs.readFileSync(wasmPath)
    initSync(wasmBuffer)
  }
  return new Fsrs(new Float32Array(params))
}
