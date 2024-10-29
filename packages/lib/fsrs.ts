import init, { Fsrs, initSync } from 'fsrs-browser'

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
  return new Fsrs()
}
