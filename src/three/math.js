// Small numeric helpers shared by the procedural car geometry.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x)
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

// Monotone cubic Hermite interpolation (Fritsch–Carlson).
// Passes through every control point without overshoot, so body profiles
// never develop ripples between knots. Extrapolates linearly past the ends.
export function monotoneSpline(points) {
  const n = points.length
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const d = []
  const m = new Array(n)
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0])
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1])
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (xs[mid] > x) hi = mid
      else lo = mid
    }
    const h = xs[lo + 1] - xs[lo]
    const t = (x - xs[lo]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * ys[lo + 1] +
      (t3 - t2) * h * m[lo + 1]
    )
  }
}

// Cubic Bézier in 2D
export function bezier2(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t) {
  const it = 1 - t
  const b0 = it * it * it
  const b1 = 3 * it * it * t
  const b2 = 3 * it * t * t
  const b3 = t * t * t
  return [
    b0 * p0x + b1 * p1x + b2 * p2x + b3 * p3x,
    b0 * p0y + b1 * p1y + b2 * p2y + b3 * p3y,
  ]
}

// Bisection root-finder for a monotone function on [a, b]
export function solveMonotone(fn, target, a, b, iters = 40) {
  let fa = fn(a) - target
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2
    const fm = fn(m) - target
    if ((fm < 0) === (fa < 0)) { a = m; fa = fm } else b = m
  }
  return (a + b) / 2
}
