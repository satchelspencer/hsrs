import init, { Fsrs, initSync } from 'fsrs-browser'
import wasmUrl from 'fsrs-browser/fsrs_browser_bg.wasm?url'

export { Fsrs } from 'fsrs-browser'

export const defaultParams = [
  4.837098598480225, 8.488668441772461, 13.726399421691895, 15.691049575805664,
  7.194900035858154, 0.534500002861023, 1.4603999853134155, 0.004600000102072954,
  1.5457500219345093, 0.11919999867677689, 1.0192500352859497, 1.9394999742507935,
  0.10999999940395355, 0.2960500121116638, 2.2697999477386475, 0.23149999976158142,
  2.989799976348877, 0.5165500044822693, 0.6621000170707703,
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
