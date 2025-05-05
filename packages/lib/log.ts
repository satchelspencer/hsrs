// default is 0, more detail is higher
// setLogLevel(0, 'sample')
// resetLogLevel()

import _ from 'lodash'

let currentLevel: number = 0,
  currentFilter: string = ''

const LSKEY = 'loglevel'

export function setLogLevel(f?: string, n?: number) {
  currentLevel = n ?? (process.env.NODE_ENV === 'development' ? 1 : 0)
  currentFilter = f ?? ''
  try {
    localStorage.setItem(LSKEY, JSON.stringify([currentLevel, currentFilter]))
  } catch {}
}

export function getLogLevel() {
  return {
    level: currentLevel,
    filter: currentFilter,
  }
}

try {
  const w = window as any
  w.setLogLevel = setLogLevel
  w.getLogLevel = () => [currentLevel, currentFilter]

  const p = localStorage.getItem(LSKEY)
  if (p) {
    const [l, f] = JSON.parse(p)
    setLogLevel(f, l)
  } else {
    setLogLevel()
  }
} catch {}

type LogArgs = (any | (() => any))[]

function logBase(level: number, key: string | undefined, ...data: LogArgs) {
  if (level <= currentLevel || (key && currentFilter.includes(key)))
    console.log(
      ...(key ? [`%c[${key}]`, 'color:#aaa'] : []),
      ...data.flatMap((d) => (typeof d === 'function' ? d() : d))
    )
}

export function log(level: number, ...data: LogArgs) {
  logBase(level, undefined, ...data)
}

export function logger(level: number, key: string, ...prefix: LogArgs) {
  const cb = (...data: LogArgs) => {
    logBase(level, key, ...prefix, ...data)
  }
  return cb
}
