// ─────────────────────────────────────────────────────────────────────────────
// Analytic body surface for a Honda City (5th gen) style 3-box sedan.
//
// World frame (metres, real scale):  +Y up, ground at y = 0
//                                    +Z = nose, −Z = tail
//                                    +X = car's LEFT side, −X = RIGHT (driver, RHD)
//
// The body is two parametric surfaces:
//
//   lowerBody(u, v) — the "tub" from rocker to beltline/deck, closed at the
//     nose and tail by superellipse caps.  u is metric along the car (equal
//     to z in the main section, arc-length around the plan-view corner in the
//     caps); v ∈ [0, 2] runs around the cross-section: 0 = left rocker,
//     1 = top centre, 2 = right rocker.
//
//   greenhouse(u, k) — the cabin above the beltline (glass, pillars, roof).
//     u = z, k ∈ [0, 2]: 0 = left belt, 1 = roof centre, 2 = right belt.
//
// Every panel (doors, hood, boot, windows, lamps…) is a rectangle in one of
// these parameter domains, so cut lines line up perfectly and opening panels
// carry exactly the same curvature as the body around them.
// ─────────────────────────────────────────────────────────────────────────────
import { monotoneSpline, clamp, smoothstep, bezier2, solveMonotone } from './math'

const DEG = Math.PI / 180

export const CAR = {
  length: 4.594, // 2026 facelift (May 2026): 4594 × 1748 × 1489 mm, WB 2600
  width: 1.748,
  height: 1.489,
  zFront: 2.315,  // front overhang 0.94 m (longer facelift bumper)
  zRear: -2.279,  // rear overhang 1.054 m
  axleF: 1.375,
  axleR: -1.225,
  wheelX: 0.745,
  tireR: 0.309,
  tireW: 0.19,
  rimR: 0.2032,
  archR: 0.375,

  // Greenhouse span (centre-line): windshield base → rear-window base
  zWs: 0.96,
  zRw: -1.38,
  zHeader: 0.07,     // windshield top edge
  zRoofRear: -0.8,   // rear-window top edge
  // Sunroof opening
  sunroof: { z0: -0.48, z1: 0.0, halfW: 0.39 },

  // Opening-panel shut lines (z)
  zHood: 1.02,       // hood rear edge (hinge)
  zBoot: -1.45,      // boot-lid front edge (hinge)
  zFD0: 0.845,       // front door leading edge
  zB: -0.235,        // B-pillar shut line (front/rear doors meet)
  zRD1: -1.065,      // rear door trailing edge
  zGlassF: -0.205,   // front-door glass rear edge (B-pillar applique ahead of it)
  zGlassR0: -0.275,  // rear-door glass front edge
  zGlassR1: -0.83,   // rear-door glass rear edge (division bar)
  zQuarter: -0.855,  // fixed quarter-glass front edge

  gap: 0.0032,       // panel gap (each side)
}

// Section feature indices (per half, s ∈ [0,1])
export const S_ROCK = 0.075 // door bottom edge
export const S_B = 0.46     // shoulder character line (max width)
export const S_E = 0.62     // beltline / fender-top edge
export const S_HOOD = 0.668 // hood & boot shut line on the deck

// Greenhouse feature indices (per half, t ∈ [0,1])
export const T_D = 0.30 // daylight-opening (glass) top
export const T_S = 0.36 // door sash outer edge
export const T_P = 0.40 // pillar / roof-rail crease
export const T_W = 0.50 // inner edge of pillar band → glass / roof

const TUMBLE = 28 * DEG
const TAN_T = Math.tan(TUMBLE)
const SIN_T = Math.sin(TUMBLE)
const COS_T = Math.cos(TUMBLE)
const TUCK = 0.07

// ── Side-view & plan-view profiles (functions of z) ─────────────────────────
// yE: beltline / fender top / deck edge
const yE = monotoneSpline([
  [-2.4, 1.0], [-1.8, 1.034], [-1.3, 1.045], [-0.6, 1.033], [0.2, 1.009],
  [0.84, 0.987], [1.2, 0.938], [1.6, 0.872], [1.86, 0.827], [2.4, 0.745],
])
// yS: shoulder character line (widest point of the body side)
const yS = monotoneSpline([
  [-2.4, 0.897], [-1.8, 0.913], [-1.2, 0.906], [-0.4, 0.887], [0.4, 0.867],
  [0.9, 0.851], [1.3, 0.81], [1.86, 0.742], [2.4, 0.69],
])
// yB: rocker / bumper bottom
const yB = monotoneSpline([
  [-2.4, 0.33], [-1.8, 0.318], [-1.74, 0.31], [-1.58, 0.245], [-1.25, 0.205], [1.2, 0.205],
  [1.55, 0.226], [1.8, 0.236], [1.86, 0.238], [2.4, 0.242],
])
// hw: half-width at the shoulder
const hw = monotoneSpline([
  [-2.4, 0.842], [-1.8, 0.862], [-1.0, 0.874], [0.8, 0.874], [1.86, 0.864], [2.4, 0.846],
])
// Deck crown (hood/boot centre above fender edge)
const crown = monotoneSpline([[-2.4, 0.034], [-1.3, 0.034], [0.96, 0.043], [2.4, 0.043]])

export const PROFILE = { yE, yS, yB, hw, crown }

// ── Lower-body cross-section ────────────────────────────────────────────────
// Tiny cache: lattice rows evaluate the same z for every v, plus z ± h for
// finite-difference normals, so a handful of slots gives ~100% hit rate.
const SEC_CACHE = new Map()
export function sectionAt(z) {
  const hit = SEC_CACHE.get(z)
  if (hit) return hit
  const sec = computeSection(z)
  if (SEC_CACHE.size > 32) SEC_CACHE.clear()
  SEC_CACHE.set(z, sec)
  return sec
}
function computeSection(z) {
  const e = yE(z)
  const s = yS(z)
  const b = yB(z)
  const w = hw(z)
  const inset = (TAN_T * (e - s)) / 1.45
  return { yE: e, yS: s, yB: b, hw: w, yT: e + crown(z), inset, xE: w - inset }
}

// Deck / roof cross-section: cubic Bézier from an edge point (x0,y0) whose
// tangent continues the 28° tumblehome, rolling over into a crowned top.
export function deckCurve(x0, y0, yTop, t) {
  const h = Math.max(yTop - y0, 1e-4)
  const k = 0.8 * h
  return bezier2(x0, y0, x0 - SIN_T * k, y0 + COS_T * k, 0.4 * x0, yTop, 0, yTop, t)
}

export function sectionPoint(sec, s) {
  if (s <= S_B) {
    const t = s / S_B
    return [sec.hw - TUCK * Math.pow(1 - t, 2.2), sec.yB + (sec.yS - sec.yB) * t]
  }
  if (s <= S_E) {
    const t = (s - S_B) / (S_E - S_B)
    return [sec.hw - sec.inset * (0.25 * t + 0.75 * Math.pow(t, 1.6)), sec.yS + (sec.yE - sec.yS) * t]
  }
  return deckCurve(sec.xE, sec.yE, sec.yT, (s - S_E) / (1 - S_E))
}

// ── Nose / tail superellipse caps ───────────────────────────────────────────
function makeCap({ zc, dir, p, reach }) {
  const sec = sectionAt(zc)
  const secIn = sectionAt(zc - dir * 0.02)
  const W = sec.hw
  const D = reach(sec.yS)
  const N = 600
  const as = new Float64Array(N + 1)
  const ls = new Float64Array(N + 1)
  let px = W
  let pz = 0
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2)
    const x = W * Math.pow(Math.max(Math.cos(a), 0), 2 / p)
    const z = D * Math.pow(Math.sin(a), 2 / p)
    as[i] = a
    ls[i] = i === 0 ? 0 : ls[i - 1] + Math.hypot(x - px, z - pz)
    px = x
    pz = z
  }
  return { zc, dir, p, reach, sec, secIn, as, ls, len: ls[N] }
}

function capAngle(cap, l) {
  const { ls, as } = cap
  if (l <= 0) return 0
  if (l >= cap.len) return Math.PI / 2
  let lo = 0
  let hi = ls.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (ls[mid] > l) hi = mid
    else lo = mid
  }
  const t = (l - ls[lo]) / (ls[hi] - ls[lo])
  return as[lo] + (as[hi] - as[lo]) * t
}

// 2026 nose: rounder plan-view corners than the old squared fascia, and a
// face that rakes back from the bumper peak up to the light bar / hood lip.
const CAP_F = makeCap({
  zc: 1.86,
  dir: 1,
  p: 3.3,
  reach: (y) => {
    const Dm = CAR.zFront - 1.86
    const pk = 0.45
    return y < pk ? Dm - 0.8 * (pk - y) ** 2 : Dm - 1.4 * (y - pk) ** 2
  },
})
const CAP_R = makeCap({
  zc: -1.8,
  dir: -1,
  p: 5.2,
  reach: (y) => {
    const Dm = -1.8 - CAR.zRear
    const pk = 0.55
    return y < pk ? Dm - 0.55 * (pk - y) ** 2 : Dm - 0.36 * (y - pk) ** 2
  },
})

export const U_MIN = CAP_R.zc - CAP_R.len
export const U_MAX = CAP_F.zc + CAP_F.len
export const CAPS = { F: CAP_F, R: CAP_R }

function capPoint(cap, l, s) {
  const a = capAngle(cap, l)
  const [x0, y0] = sectionPoint(cap.sec, s)
  const [, y0in] = sectionPoint(cap.secIn, s)
  const slope = (0.85 * (y0 - y0in)) / 0.02 // dy per metre travelled outward (damped)
  const f = Math.pow(Math.max(Math.cos(a), 0), 2 / cap.p)
  const g = Math.pow(Math.sin(a), 2 / cap.p)
  const off = cap.reach(y0) * g
  return [x0 * f, y0 + slope * off, cap.zc + cap.dir * off]
}

/** Lower body. u ∈ [U_MIN, U_MAX], v ∈ [0, 2]. Returns [x, y, z]. */
export function lowerBody(u, v) {
  const left = v <= 1
  const s = left ? v : 2 - v
  let p
  if (u > CAP_F.zc) p = capPoint(CAP_F, u - CAP_F.zc, s)
  else if (u < CAP_R.zc) p = capPoint(CAP_R, CAP_R.zc - u, s)
  else {
    const xy = sectionPoint(sectionAt(u), s)
    p = [xy[0], xy[1], u]
  }
  if (!left) p[0] = -p[0]
  return p
}

// ── Greenhouse ──────────────────────────────────────────────────────────────
const yT_rear = yE(CAR.zRw) + crown(CAR.zRw)
const yT_front = yE(CAR.zWs) + crown(CAR.zWs)

// Roof centre-line: windshield → roof → rear window
const yG = monotoneSpline([
  [-1.75, yT_rear - 0.2], [CAR.zRw, yT_rear], [-1.28, 1.16], [-1.15, 1.265], [-1.0, 1.352],
  [-0.85, 1.42], [-0.65, 1.468], [-0.4, 1.489], [-0.1, 1.481], [0.07, 1.446],
  [0.2, 1.392], [0.4, 1.296], [0.6, 1.19], [0.8, 1.09], [CAR.zWs, yT_front],
  [1.3, yT_front - 0.2],
])
const D_A = 0.2   // A-pillar sweep behind windshield centre
const D_C = 0.17  // C-pillar sweep ahead of rear-glass centre
const ROOF_CROWN = 0.05
const SASH = 0.024
const DLO_REAR0 = -0.5 // where the DLO top starts dropping toward the tail
const DLO_REAR1 = -1.045 // DLO tip on the beltline

const GH_CACHE = new Map()
export function greenhouseSection(z) {
  const hit = GH_CACHE.get(z)
  if (hit) return hit
  const sec = computeGreenhouseSection(z)
  if (GH_CACHE.size > 32) GH_CACHE.clear()
  GH_CACHE.set(z, sec)
  return sec
}
function computeGreenhouseSection(z) {
  const e = yE(z)
  const w = hw(z)
  const inset = (TAN_T * (e - yS(z))) / 1.45
  const xE = w - inset
  const g = yG(z)
  const hP = Math.max(e, Math.min(yG(z + D_A), yG(z - D_C)) - ROOF_CROWN)
  // DLO (daylight opening) top line, with a rounded rear corner that runs
  // down to a tip on the beltline
  const t = clamp((z - DLO_REAR1) / (DLO_REAR0 - DLO_REAR1), 0, 1)
  const rearCurve = e + (hP - SASH - e) * Math.pow(Math.sin((t * Math.PI) / 2), 0.85)
  const hD = Math.max(e, Math.min(hP - SASH, rearCurve))
  const sashW = SASH * smoothstep(DLO_REAR1 - 0.02, DLO_REAR1 + 0.06, z)
  const hS = Math.min(hP, hD + sashW)
  // Width of the pillar band in Bézier parameter: wider at the C-pillar base
  const bw = 0.26 + 0.24 * smoothstep(-0.9, -1.35, z)
  return { yE: e, xE, yG: g, hP, hD, hS, bw }
}

function sidePoint(sec, y) {
  const span = sec.hP - sec.yE
  const bulge = span > 1e-3 ? 0.012 * Math.sin((Math.PI * (y - sec.yE)) / span) : 0
  return [sec.xE - (y - sec.yE) * TAN_T + bulge, y]
}

export function greenhousePoint(sec, t) {
  if (t <= T_D) return sidePoint(sec, sec.yE + (sec.hD - sec.yE) * (t / T_D))
  if (t <= T_S) return sidePoint(sec, sec.hD + (sec.hS - sec.hD) * ((t - T_D) / (T_S - T_D)))
  if (t <= T_P) return sidePoint(sec, sec.hS + (sec.hP - sec.hS) * ((t - T_S) / (T_P - T_S)))
  const [xR] = sidePoint(sec, sec.hP)
  const b = t <= T_W ? sec.bw * ((t - T_P) / (T_W - T_P)) : sec.bw + (1 - sec.bw) * ((t - T_W) / (1 - T_W))
  return deckCurve(xR, sec.hP, sec.yG, b)
}

/** Greenhouse. u = z ∈ [zRw, zWs], k ∈ [0, 2]. */
export function greenhouse(u, k) {
  const left = k <= 1
  const t = left ? k : 2 - k
  const sec = greenhouseSection(u)
  const [x, y] = greenhousePoint(sec, t)
  return [left ? x : -x, y, u]
}

// ── Inverse helpers (feature placement) ─────────────────────────────────────
/** Lower-body s (left half) whose point at param u has height y. */
export function sForY(u, y) {
  return solveMonotone((s) => lowerBody(u, s)[1], y, 0, S_E + 0.12 * (1 - S_E))
}
/** Cap u at which a given lower-body line (s) reaches |x| = x (front: u > zc). */
export function uForX(cap, s, x) {
  const fn = (l) => Math.abs(capPoint(cap, l, s)[0])
  const l = solveMonotone((ll) => -fn(ll), -x, 0, cap.len)
  return cap.dir > 0 ? cap.zc + l : cap.zc - l
}
/** Greenhouse k (left half, top part) whose point has |x| = x at z. */
export function kForX(z, x) {
  return solveMonotone((t) => -greenhouse(z, t)[0], -x, T_P, 1)
}

export const GH = { yG, D_A, D_C }
