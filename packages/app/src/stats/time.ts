export function formatDate(time: number) {
  const date = new Date(time * 1000)
  return `${date.getMonth() + 1}/${date.getDate()}/${date
    .getFullYear()
    .toString()
    .slice(-2)}`
}

function startOfDay(time: number) {
  const date = new Date(time * 1000)
  date.setHours(0, 0, 0, 0)
  return Math.floor(date.getTime() / 1000)
}

function startOfWeek(time: number) {
  const d = new Date(time * 1000),
    day = d.getDay(),
    diff = day * 24 * 60 * 60
  return startOfDay(time - diff)
}

function startOfMonth(time: number) {
  const d = new Date(time * 1000)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function chooseTimescaleFunction(
  minTime: number,
  maxTime: number,
  maxGroups: number
): (ts: number) => number {
  const totalSeconds = maxTime - minTime,
    totalDays = totalSeconds / (3600 * 24)

  if (totalDays < maxGroups) {
    return startOfDay
  } else if (totalDays <= 7 * maxGroups) {
    return startOfWeek
  } else {
    return startOfMonth
  }
}

export function groupByTimescale<T>(
  items: T[],
  getTime: (item: T) => number,
  maxGroups: number
): Record<number, T[]> {
  if (!items || !items.length) return {}

  let minTime = Number.POSITIVE_INFINITY,
    maxTime = Number.NEGATIVE_INFINITY

  for (const item of items) {
    const ts = getTime(item)
    if (ts < minTime) minTime = ts
    if (ts > maxTime) maxTime = ts
  }

  const timescaleFn = chooseTimescaleFunction(minTime, maxTime, maxGroups),
    grouped: Record<number, T[]> = {}

  for (const item of items) {
    const ts = getTime(item),
      bucket = timescaleFn(ts)
    if (!grouped[bucket]) grouped[bucket] = []
    grouped[bucket].push(item)
  }

  return grouped
}
