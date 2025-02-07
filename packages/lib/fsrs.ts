import init, { Fsrs, initSync } from 'fsrs-browser'
import wasmUrl from 'fsrs-browser/fsrs_browser_bg.wasm?url'

export { Fsrs } from 'fsrs-browser'

export const defaultParams = [
  0.6560816764831543, 1.2259827852249146, 3.3084070682525635, 15.996855735778809,
  7.283199310302734, 0.331362783908844, 1.6143580675125122, 0.06892812252044678,
  1.3586113452911377, 0.29770612716674805, 0.8671701550483704, 1.9723122119903564,
  0.12932589650154114, 0.2762293815612793, 2.3015899658203125, 0.14697358012199402,
  3.2725982666015625, 0.07841892540454865, 0.2692943811416626,
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
