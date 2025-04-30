// default is 0, more detail is higher
// setLogLevel(0, 'sample')
// resetLogLevel()

import _ from 'lodash'

let currentLevel: number = 0,
  currentFilter: string = ''

const LSKEY = 'loglevel'

function resetLogLevel() {
  currentLevel = process.env.NODE_ENV === 'development' ? 1 : 0
  currentFilter = ''
  localStorage.removeItem(LSKEY)
}

try {
  const w = window as any
  w.setLogLevel = (f: string, n: number) => {
    currentLevel = n ?? currentLevel
    currentFilter = f ?? ''
    localStorage.setItem(LSKEY, JSON.stringify([currentLevel, currentFilter]))
  }
  w.getLogLevel = () => [currentLevel, currentFilter]
  w.resetLogLevel = resetLogLevel

  const p = localStorage.getItem(LSKEY)
  if (p) {
    const [l, f] = JSON.parse(p)
    currentLevel = l
    currentFilter = f
  } else {
    resetLogLevel()
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
