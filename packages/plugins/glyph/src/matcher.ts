export interface Point {
  x: number
  y: number
}

export interface MatchResult {
  matched: boolean
  frechet: number
  startAngleDiff: number
  endAngleDiff: number
}

const SAMPLES = 10,
  FRECHET_RATIO = 0.25,
  ANGLE_THRESHOLD = Math.PI / 2,
  ANGLE_SKIP = 3

function dist(a: Point, b: Point) {
  const dx = a.x - b.x,
    dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

export function resamplePolyline(points: Point[], n: number): Point[] {
  if (points.length === 0) return []

  if (points.length === 1) return new Array(n).fill(points[0])

  const lens: number[] = [0]
  for (let i = 1; i < points.length; i++)
    lens.push(lens[i - 1] + dist(points[i - 1], points[i]))

  const total = lens[lens.length - 1]
  if (total === 0) return new Array(n).fill(points[0])

  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1)
    let j = 1
    while (j < lens.length - 1 && lens[j] < target) j++
    const s0 = lens[j - 1],
      s1 = lens[j],
      t = s1 === s0 ? 0 : (target - s0) / (s1 - s0)
    out.push({
      x: points[j - 1].x + t * (points[j].x - points[j - 1].x),
      y: points[j - 1].y + t * (points[j].y - points[j - 1].y),
    })
  }

  return out
}

function frechetDistance(a: Point[], b: Point[]) {
  const n = a.length,
    m = b.length,
    ca: number[][] = Array.from({ length: n }, () => new Array(m).fill(-1))
  function rec(i: number, j: number): number {
    if (ca[i][j] > -1) return ca[i][j]
    const d = dist(a[i], b[j])
    if (i === 0 && j === 0) ca[i][j] = d
    else if (i > 0 && j === 0) ca[i][j] = Math.max(rec(i - 1, 0), d)
    else if (i === 0 && j > 0) ca[i][j] = Math.max(rec(0, j - 1), d)
    else ca[i][j] = Math.max(Math.min(rec(i - 1, j), rec(i - 1, j - 1), rec(i, j - 1)), d)
    return ca[i][j]
  }

  return rec(n - 1, m - 1)
}

function samplePath(d: string, n: number): Point[] {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  const total = path.getTotalLength()
  if (!total) return []
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const t = total * (i / (n - 1)),
      p = path.getPointAtLength(t)
    points.push({ x: p.x, y: p.y })
  }

  return points
}

function strokeAngle(points: Point[], end: 'start' | 'end') {
  const a = end === 'start' ? 0 : points.length - ANGLE_SKIP,
    b = a + ANGLE_SKIP - 1
  return Math.atan2(points[b].y - points[a].y, points[b].x - points[a].x)
}

function angleDiff(a: number, b: number) {
  return Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
}

export function strokeMatches(
  userPoints: Point[],
  expectedPath: string,
  canvasSize: number
): MatchResult {
  const user = resamplePolyline(userPoints, SAMPLES),
    expected = resamplePolyline(samplePath(expectedPath, SAMPLES), SAMPLES),
    frechet = frechetDistance(user, expected),
    frechetThreshold = canvasSize * FRECHET_RATIO,
    startAngleDiff = angleDiff(
      strokeAngle(user, 'start'),
      strokeAngle(expected, 'start')
    ),
    endAngleDiff = angleDiff(strokeAngle(user, 'end'), strokeAngle(expected, 'end')),
    matched =
      frechet <= frechetThreshold &&
      startAngleDiff <= ANGLE_THRESHOLD &&
      endAngleDiff <= ANGLE_THRESHOLD

  return { matched, frechet, startAngleDiff, endAngleDiff }
}
