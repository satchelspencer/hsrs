export interface Glyph {
  strokes: string[]
}

const CMD_ARGS: Record<string, number> = {
  M: 2,
  m: 2,
  L: 2,
  l: 2,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  C: 6,
  c: 6,
  S: 4,
  s: 4,
  Q: 4,
  q: 4,
  T: 2,
  t: 2,
  Z: 0,
  z: 0,
}

function b64Decode(s: string): Uint8Array {
  const padded = s
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(s.length + ((4 - (s.length % 4)) % 4), '='),
    bin = atob(padded),
    out = new Uint8Array(bin.length)

  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function decodeStrokes(encoded: string): Glyph {
  if (!encoded) return { strokes: [] }

  const buf = b64Decode(encoded),
    strokes: string[] = []
  let i = 0,
    strokesLen = buf[i++]

  for (let s = 0; s < strokesLen; s++) {
    const tokensLen = buf[i++]
    let d = ''
    for (let t = 0; t < tokensLen; t++) {
      const cmd = String.fromCharCode(buf[i++]),
        argCount = CMD_ARGS[cmd] ?? 0,
        nums: number[] = []
      for (let j = 0; j < argCount; j++) {
        const b = buf[i++]
        nums.push(b & 0x80 ? -(b & 0x7f) : b)
      }
      d += cmd + nums.join(',')
    }
    strokes.push(d)
  }

  return { strokes }
}

function parsePath(d: string) {
  const tokens: { cmd: string; args: number[] }[] = [],
    re = /([A-Za-z])([\s\S]*?)(?=[A-Za-z]|$)/g

  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const cmd = m[1],
      argCount = CMD_ARGS[cmd] ?? 0,
      nums = argCount
        ? m[2]
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        : [],
      reps = argCount ? nums.length / argCount : 1

    for (let i = 0; i < reps; i++)
      tokens.push({ cmd, args: nums.slice(i * argCount, (i + 1) * argCount) })
  }

  return tokens
}

function b64Encode(buf: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function encodeStrokes(strokes: string[]): string {
  const bytes: number[] = [strokes.length]
  for (const stroke of strokes) {
    const tokens = parsePath(stroke)
    bytes.push(tokens.length)

    for (const { cmd, args } of tokens) {
      bytes.push(cmd.charCodeAt(0))
      for (const v of args) bytes.push(v < 0 ? 0x80 | -v : v)
    }
  }

  return b64Encode(new Uint8Array(bytes))
}
