import init, { Fsrs, initSync } from 'fsrs-browser'

export { Fsrs } from 'fsrs-browser'

export async function fsrs() {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    const wasmUrl = await import('fsrs-browser/fsrs_browser_bg.wasm?url')
    await init(wasmUrl.default)
  } else {
    const fs = await import('fs')
    const { webcrypto } = await import('node:crypto')
    globalThis.crypto = webcrypto as any
    const wasmPath = require.resolve('fsrs-browser/fsrs_browser_bg.wasm')
    const wasmBuffer = fs.readFileSync(wasmPath)
    initSync(wasmBuffer)
  }
  return new Fsrs(
    new Float32Array([
      0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544,
      1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567,
    ])
  )
}
