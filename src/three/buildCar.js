// ─────────────────────────────────────────────────────────────────────────────
// Builds every procedural mesh of the car from the analytic surfaces.
// Pure data (BufferGeometries + anchor frames) — no React; memoised once.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  CAR, CAPS, U_MIN, U_MAX, S_ROCK, S_E, S_HOOD, T_D, T_S, T_P, T_W,
  lowerBody, greenhouse, sForY, uForX, kForX, sectionAt, greenhouseSection,
} from './carSurface'
import {
  stations, clip, densify, lattice, regionGeometry, solidify, surfaceStrip, surfacePath,
  wallsOnly, frameAt,
} from './surfaceMesh'
import { smoothstep, solveMonotone } from './math'

export const LB = { uMin: U_MIN, uMax: U_MAX, vMin: 0, vMax: 2, sign: 1 }
export const GHD = { uMin: CAR.zRw, uMax: CAR.zWs, vMin: 0, vMax: 2, sign: 1 }

const G = CAR.gap
const GS = 0.0028 // panel gap expressed in section parameter
const UV_LB = [1, 1.35] // param → ≈ metres, for flake / texture scale
const UV_GH = [1, 1.1]

const vOf = (side, s) => (side > 0 ? s : 2 - s)
const vRange = (side, s0, s1) => (side > 0 ? [s0, s1] : [2 - s1, 2 - s0])
const fold = (v) => (v <= 1 ? v : 2 - v)
const flat = (g) => (g.index ? g.toNonIndexed() : g)
const merge = (arr) => mergeGeometries(arr.map(flat), false)

// ── Fascia feature map (param-space rectangles, left half) ─────────────────
// Matches the 2026 City facelift: slim "Blade-Eye" headlamps joined by a
// full-width LED bar, a wide gloss-black Matrix-Mesh grille under it, the
// plate on a body-colour band, a big lower honeycomb intake flanked by tall
// corner vents (LED fog lamps inside) and a black splitter.
export const F = (() => {
  const sf = (y) => sForY(U_MAX - 1e-4, y)
  const sr = (y) => sForY(U_MIN + 1e-4, y)
  const mid = (a, b) => (a + b) / 2
  const f = {
    sLip: sf(0.3),
    sLg0: sf(0.305), sLg1: sf(0.44),   // lower honeycomb intake
    sFang0: sf(0.33), sFang1: sf(0.6), // tall corner vents
    sGr0: sf(0.6), sGr1: sf(0.716),    // upper Matrix-Mesh grille
    sBar: sf(0.738),                   // connected LED light bar
    sHl0: sf(0.724), sHl1: sf(0.778),  // slim Blade-Eye headlamps
    sBumper: sf(0.62),
    sTl0: sr(0.876), sTl1: sr(0.985),
    sDiff: sr(0.43),
    sRBumper: sr(0.84),
    uBumper: 1.7,
    uRBumper: -1.62,
  }
  f.uHl0 = CAPS.F.zc + 0.02
  f.uHl1 = uForX(CAPS.F, mid(f.sHl0, f.sHl1), 0.5)
  f.uGr = uForX(CAPS.F, mid(f.sGr0, f.sGr1), 0.665)
  f.uLg = uForX(CAPS.F, mid(f.sLg0, f.sLg1), 0.58)
  f.uFang0 = uForX(CAPS.F, mid(f.sFang0, f.sFang1), 0.8)
  f.uFang1 = uForX(CAPS.F, mid(f.sFang0, f.sFang1), 0.66)
  f.uTl0 = CAPS.R.zc - 0.17
  f.uTl1 = uForX(CAPS.R, mid(f.sTl0, f.sTl1), 0.36)
  return f
})()

const inBox = (u, s, u0, u1, s0, s1) => u > u0 && u < u1 && s > s0 && s < s1
const K_SR = kForX((CAR.sunroof.z0 + CAR.sunroof.z1) / 2, CAR.sunroof.halfW)

/** Height of the deck/cowl surface at (z, x). */
export function deckY(z, x) {
  const s = solveMonotone((ss) => -lowerBody(z, ss)[0], -Math.abs(x), S_E, 1)
  return lowerBody(z, s)[1]
}

// ── Station lists ───────────────────────────────────────────────────────────
function lowerStations() {
  const uFeat = [
    CAR.zFD0, CAR.zFD0 - G, CAR.zB, CAR.zB - G, CAR.zB + G, CAR.zRD1, CAR.zRD1 + G,
    CAR.zHood, CAR.zHood + G, CAR.zWs, CAR.zRw, CAR.zBoot, CAR.zBoot - G,
    F.uHl0, F.uHl1, F.uGr, F.uLg, F.uFang0, F.uFang1, F.uBumper, F.uTl0, F.uTl1, F.uRBumper,
    CAPS.F.zc, CAPS.R.zc,
  ]
  const main = stations(CAPS.R.zc, CAPS.F.zc, 0.028, uFeat)
  const capF = stations(CAPS.F.zc, U_MAX, 0.018, uFeat)
  const capR = stations(U_MIN, CAPS.R.zc, 0.018, uFeat)
  const us = [...new Set([...capR, ...main, ...capF])].sort((a, b) => a - b)
  const sFeat = [
    S_ROCK, S_ROCK + GS, S_E, S_HOOD, S_HOOD + GS,
    F.sLip, F.sLg0, F.sLg1, F.sFang0, F.sFang1, F.sGr0, F.sGr1, F.sHl0, F.sHl1, F.sBumper,
    F.sTl0, F.sTl1, F.sDiff, F.sRBumper,
  ]
  let half = stations(0, 1, 0.017, sFeat)
  half = densify(half, [0.46], [0.004, 0.0095]) // sharpen the shoulder crease
  const vs = [...new Set([...half, ...half.map((s) => 2 - s)].map((x) => +x.toFixed(10)))].sort((a, b) => a - b)
  return { us, vs }
}

function greenhouseStations() {
  const s = CAR.sunroof
  const uFeat = [
    CAR.zHeader, CAR.zRoofRear, s.z0, s.z1, s.z0 + G, s.z1 - G,
    CAR.zFD0, CAR.zFD0 - G, CAR.zB, CAR.zB + G, CAR.zB - G, CAR.zRD1, CAR.zRD1 + G,
    CAR.zGlassF, CAR.zGlassR0, CAR.zGlassR1, CAR.zQuarter,
  ]
  const us = stations(CAR.zRw, CAR.zWs, 0.024, uFeat)
  const tFeat = [T_D, T_S, T_P, T_W, K_SR, K_SR + 0.004, T_P + 0.012]
  const half = stations(0, 1, 0.02, tFeat)
  const vs = [...new Set([...half, ...half.map((t) => 2 - t)].map((x) => +x.toFixed(10)))].sort((a, b) => a - b)
  return { us, vs }
}

// ── Shell classification ────────────────────────────────────────────────────
function classifyLower(u, v) {
  const s = fold(v)
  if (s > S_E && u < CAR.zWs && u > CAR.zRw) return null // cabin opening
  if (s > S_ROCK && s < S_E && u > CAR.zRD1 && u < CAR.zFD0) return null // doors
  if (s > S_HOOD && (u > CAR.zHood || u < CAR.zBoot)) return null // hood / boot
  if (s > S_HOOD && u >= CAR.zWs) return 'body:cowl'

  if (u > CAPS.F.zc) {
    if (inBox(u, s, F.uHl0, F.uHl1, F.sHl0, F.sHl1)) return null
    if (inBox(u, s, F.uGr, U_MAX + 1, F.sGr0, F.sGr1)) return null
    if (inBox(u, s, F.uLg, U_MAX + 1, F.sLg0, F.sLg1)) return null
    if (inBox(u, s, F.uFang0, F.uFang1, F.sFang0, F.sFang1)) return null
  }
  if (u < CAPS.R.zc && inBox(u, s, F.uTl1, F.uTl0, F.sTl0, F.sTl1)) return null

  const front = u > F.uBumper && s < F.sBumper
  const rear = u < F.uRBumper && s < F.sRBumper
  const part = front ? 'bumper_front' : rear ? 'bumper_rear' : 'body'
  if (front && u > CAPS.F.zc && s < F.sLip) return `${part}:black`
  if (rear && s < F.sDiff) return `${part}:black`
  return `${part}:paint`
}

function classifyGreenhouse(u, k) {
  const t = fold(k)
  if (t < T_S) return u > CAR.zRD1 && u < CAR.zFD0 ? null : 'paint' // door uppers
  if (t < T_W) return 'paint'
  if (u > CAR.zHeader) return 'windshield'
  if (u < CAR.zRoofRear) return 'rearglass'
  const s = CAR.sunroof
  if (u > s.z0 && u < s.z1 && t > K_SR) return null
  return 'paint'
}

/** Split a lattice into one geometry per part, each with material groups. */
function partition(L, classify, matOrder, opts) {
  const keys = new Set()
  for (let i = 0; i < L.nu - 1; i++) {
    for (let j = 0; j < L.nv - 1; j++) {
      const k = classify((L.us[i] + L.us[i + 1]) / 2, (L.vs[j] + L.vs[j + 1]) / 2)
      if (k) keys.add(k)
    }
  }
  const parts = {}
  for (const key of keys) {
    const [part, mat] = key.split(':')
    ;(parts[part] ||= {})[mat] = regionGeometry(L, (u, v) => classify(u, v) === key, opts)
  }
  const out = {}
  for (const [part, mats] of Object.entries(parts)) {
    const used = matOrder.filter((m) => mats[m])
    out[part] = { geometry: mergeGeometries(used.map((m) => mats[m]), true), materials: used }
  }
  return out
}

// Black ceramic frit border on fixed glass, as vertex colour + alpha
function fritColor(alpha, distFn, width = 0.05) {
  return (u, v) => {
    const f = 1 - smoothstep(width - 0.012, width + 0.006, distFn(u, v))
    const c = 1 - f
    return [c, c, c, alpha + (1 - alpha) * f]
  }
}

// ── Doors ───────────────────────────────────────────────────────────────────
function buildDoor({ side, front, LU, GU }) {
  const z0 = front ? CAR.zB + G : CAR.zRD1 + G
  const z1 = front ? CAR.zFD0 - G : CAR.zB - G

  // Lower skin, solidified (outer paint · inner trim · shut faces)
  const [v0, v1] = vRange(side, S_ROCK + GS, S_E)
  const Llow = lattice(lowerBody, clip(LU.us, z0, z1), clip(LU.vs, v0, v1), LB)
  const lower = solidify(Llow, 0.058, { uvScale: UV_LB })

  // Upper frame (sash, B-pillar applique, division bar) from the greenhouse
  const [k0, k1] = vRange(side, 0, T_S)
  const Lup = lattice(greenhouse, clip(GU.us, z0, Math.min(z1, CAR.zWs)), clip(GU.vs, k0, k1), GHD)
  const gz0 = front ? CAR.zGlassF : CAR.zGlassR1
  const gz1 = front ? CAR.zFD0 : CAR.zGlassR0
  const isGlass = (u, k) => fold(k) < T_D && u > gz0 && u < gz1
  const isQuarter = (u, k) => !front && fold(k) < T_D && u < CAR.zQuarter
  const sash = regionGeometry(Lup, (u, k) => !isGlass(u, k) && !isQuarter(u, k), { uvScale: UV_GH })
  const quarter = front ? null : regionGeometry(Lup, isQuarter, {
    uvScale: UV_GH,
    color: fritColor(0.5, (u) => Math.min(CAR.zQuarter - u, u - CAR.zRD1) * 3, 0.03),
  })

  // Drop glass — separate lattice so it can slide down into the door
  const [g0, g1] = vRange(side, 0, T_D)
  const usW = clip(GU.us, Math.max(gz0, z0), Math.min(gz1, z1))
  const Lw = lattice(greenhouse, usW, clip(GU.vs, g0, g1), GHD)
  const glass = regionGeometry(Lw, () => true, { uvScale: UV_GH })
  glass.computeBoundingBox()
  let beltMin = Infinity
  for (const u of usW) beltMin = Math.min(beltMin, greenhouseSection(u).yE)

  // Chrome belt moulding along the glass root
  const belt = surfaceStrip(greenhouse, GHD, {
    u0: z0, u1: front ? 0.64 : z1, vc: vOf(side, 0.01), halfV: 0.009, lift: 0.0025, bulge: 0.003, segs: 48, radial: 4,
  })

  // Hinge: vertical axis at the leading edge, slightly inboard of the skin
  const hinge = new THREE.Vector3(side * (sectionAt(z1).hw - 0.035), 0.6, z1)

  // Exterior pull handle just under the shoulder line, near the trailing edge
  const hu = z0 + 0.17
  const handle = frameAt(lowerBody, LB, hu, vOf(side, sForY(hu, sectionAt(hu).yS - 0.028)))

  // Door-card features: frames on the OUTER skin; the card sits 58 mm inboard
  const midU = (z0 + z1) / 2
  const at = (u, y) => frameAt(lowerBody, LB, u, vOf(side, sForY(u, y)))
  const armU0 = z0 + (front ? 0.1 : 0.07)
  const armU1 = z1 - (front ? 0.26 : 0.12)
  const card = {
    arm: at((armU0 + armU1) / 2, 0.7), armLen: armU1 - armU0,
    pocket: at(midU - 0.02, 0.44), pocketLen: (z1 - z0) * 0.62,
    ambient: at(midU, 0.86), ambLen: z1 - z0 - 0.14,
    speaker: at(front ? z1 - 0.2 : z1 - 0.2, 0.5),
    pull: at(front ? z1 - 0.19 : z1 - 0.1, 0.79),
    switches: at(z0 + 0.36, 0.735),
  }
  return {
    side, front, hinge, lower, sash, quarter, glass, belt, handle, card, z0, z1,
    glassDrop: glass.boundingBox.max.y - beltMin + 0.012,
    glassClipY: beltMin + 0.003,
  }
}

// ── Lamp / grille recesses ──────────────────────────────────────────────────
function recessPatch(LU, u0, u1, s0, s1, side, depth) {
  const [v0, v1] = vRange(side, s0, s1)
  const L = lattice(lowerBody, clip(LU.us, u0, u1), clip(LU.vs, v0, v1), LB)
  const Lin = lattice(lowerBody, L.us, L.vs, LB, { offset: -depth })
  return {
    lens: regionGeometry(L, () => true, { uvScale: UV_LB }),
    housing: regionGeometry(Lin, () => true, { uvScale: UV_LB }),
    walls: wallsOnly(solidify(L, depth)),
  }
}

function buildHeadlight(LU, side) {
  // Slim smoked "Blade-Eye" unit: a single projector at the outer end and an
  // LED DRL blade that continues the full-width light bar.
  const r = recessPatch(LU, F.uHl0, F.uHl1, F.sHl0, F.sHl1, side, 0.032)
  const drl = surfaceStrip(lowerBody, LB, {
    u0: F.uHl0 + 0.135, u1: F.uHl1 + 0.004, vc: vOf(side, F.sBar), halfV: 0.0062, lift: -0.006, bulge: 0.004, segs: 70,
  })
  const turn = surfaceStrip(lowerBody, LB, {
    u0: F.uHl0 + 0.135, u1: F.uHl1 - 0.06, vc: vOf(side, F.sHl0 + 0.009), halfV: 0.0035, lift: -0.012, bulge: 0.002, segs: 50,
  })
  const sMid = (F.sHl0 + F.sHl1) / 2
  const leds = [
    { u: F.uHl0 + 0.07, size: 0.036 }, // projector
    { u: F.uHl0 + 0.115, size: 0.02 },
  ].map(({ u, size }) => {
    const fr = frameAt(lowerBody, LB, u, vOf(side, sMid))
    fr.position.addScaledVector(fr.normal, -0.022)
    fr.size = size
    return fr
  })
  const centre = frameAt(lowerBody, LB, (F.uHl0 + F.uHl1) / 2, vOf(side, sMid))
  return { ...r, drl, turn, leds, centre }
}

function buildTaillight(LU, side) {
  // 2026 signature: smoked lens with an "L" light guide running along the
  // lamp's lower edge and turning up the outer (wrap-around) edge.
  const r = recessPatch(LU, F.uTl1, F.uTl0, F.sTl0, F.sTl1, side, 0.036)
  const ds = F.sTl1 - F.sTl0
  const sTop = F.sTl1 - ds * 0.16
  const sBot = F.sTl0 + ds * 0.2
  const guide = surfacePath(lowerBody, LB, {
    points: [
      [F.uTl1 + 0.012, vOf(side, sBot)],
      [F.uTl0 - 0.045, vOf(side, sBot)],
      [F.uTl0 - 0.014, vOf(side, sBot + ds * 0.25)],
      [F.uTl0 - 0.014, vOf(side, sTop)],
    ],
    halfW: 0.0062, lift: -0.008, bulge: 0.004, segs: 120,
  })
  const outline = surfacePath(lowerBody, LB, {
    points: [[F.uTl0 - 0.03, vOf(side, sTop)], [F.uTl0 - 0.2, vOf(side, sTop)]],
    halfW: 0.0032, lift: -0.012, bulge: 0.002, segs: 40,
  })
  const centre = frameAt(lowerBody, LB, (F.uTl0 + F.uTl1) / 2, vOf(side, (F.sTl0 + F.sTl1) / 2))
  return { ...r, guide, outline, centre }
}

/**
 * Staggered honeycomb tile frames laid on the fascia surface (both halves,
 * mirrored about the centre-line). u is metric in the cap; s ≈ metric on the
 * front face, so cell sizes are roughly physical.
 */
function honeycomb(u0, u1, s0, s1, { cellW = 0.044, cellH = 0.024, inset = 0.008 } = {}) {
  const cells = []
  const rows = Math.max(1, Math.floor((s1 - s0) / cellH))
  const pad = ((s1 - s0) - rows * cellH) / 2
  for (let r = 0; r < rows; r++) {
    const s = s0 + pad + (r + 0.5) * cellH
    const odd = r % 2 === 1
    for (let c = 0; ; c++) {
      const u = U_MAX - (c + (odd ? 0 : 0.5)) * cellW
      if (u - cellW * 0.45 < u0) break
      if (u > u1) continue
      for (const side of odd && c === 0 ? [1] : [1, -1]) {
        const fr = frameAt(lowerBody, LB, Math.min(u, U_MAX - 1e-4), vOf(side, s))
        fr.position.addScaledVector(fr.normal, -inset)
        cells.push({ position: fr.position, normal: fr.normal, tangent: fr.tangent, w: cellW, h: cellH })
      }
    }
  }
  return cells
}

function buildGrille(LU) {
  const up = [1, -1].map((side) => recessPatch(LU, F.uGr, U_MAX, F.sGr0, F.sGr1, side, 0.04))
  const lo = [1, -1].map((side) => recessPatch(LU, F.uLg, U_MAX, F.sLg0, F.sLg1, side, 0.04))
  // Connected LED light bar across the nose (black channel + emitter)
  const bar = [1, -1].map((side) => surfaceStrip(lowerBody, LB, {
    u0: F.uHl1 - 0.002, u1: U_MAX, vc: vOf(side, F.sBar), halfV: 0.0058, lift: 0.0025, bulge: 0.004, segs: 80, radial: 6,
  }))
  const barChannel = [1, -1].map((side) => surfaceStrip(lowerBody, LB, {
    u0: F.uHl1 - 0.002, u1: U_MAX, vc: vOf(side, F.sBar), halfV: 0.0115, lift: 0.0008, bulge: 0.0015, segs: 80, radial: 4,
  }))
  return {
    housing: merge(up.map((p) => p.housing)),
    walls: merge(up.map((p) => p.walls)),
    lowerHousing: merge(lo.map((p) => p.housing)),
    lowerWalls: merge(lo.map((p) => p.walls)),
    cells: honeycomb(F.uGr, U_MAX, F.sGr0, F.sGr1, { cellW: 0.046, cellH: 0.026, inset: 0.01 }),
    lowerCells: honeycomb(F.uLg, U_MAX, F.sLg0, F.sLg1, { cellW: 0.05, cellH: 0.028, inset: 0.012 }),
    bar: merge(bar),
    barChannel: merge(barChannel),
    logo: frameAt(lowerBody, LB, U_MAX - 1e-3, vOf(1, sForY(U_MAX - 1e-4, 0.763))),
    radar: frameAt(lowerBody, LB, U_MAX - 1e-3, vOf(1, sForY(U_MAX - 1e-4, 0.592))),
  }
}

function buildFog(LU, side) {
  // Tall corner vent ("air curtain") with a slim LED fog lamp at its foot
  const r = recessPatch(LU, F.uFang0, F.uFang1, F.sFang0, F.sFang1, side, 0.04)
  const sLamp = F.sFang0 + 0.035
  const lamp = surfaceStrip(lowerBody, LB, {
    u0: F.uFang0 + 0.025, u1: F.uFang1 - 0.02, vc: vOf(side, sLamp), halfV: 0.009, lift: -0.012, bulge: 0.004, segs: 16, radial: 5,
  })
  // two vertical fins inside the vent
  const fins = [0.35, 0.65].map((t) => {
    const u = F.uFang0 + (F.uFang1 - F.uFang0) * t
    return surfacePath(lowerBody, LB, {
      points: [[u, vOf(side, sLamp + 0.03)], [u, vOf(side, F.sFang1 - 0.01)]],
      halfW: 0.0035, lift: -0.014, bulge: 0.004, segs: 12, radial: 3,
    })
  })
  const centre = frameAt(lowerBody, LB, (F.uFang0 + F.uFang1) / 2, vOf(side, sLamp))
  return { housing: r.housing, walls: r.walls, lamp, fins: merge(fins), centre }
}

// ── Wheel-arch lips ─────────────────────────────────────────────────────────
// The arch itself is a per-pixel cut in the paint shader; this adds the
// rolled flange so the opening has visible metal thickness. Segments are
// returned per owner so the rear-arch section on the rear door swings with it.
export const ARCH = { y: 0.335, r: 0.372 }
function archLip(zA, side, zMin = -Infinity, zMax = Infinity) {
  const R = ARCH.r + 0.0015
  const pos = []
  const nor = []
  const idx = []
  const steps = 72
  let rows = 0
  for (let i = 0; i <= steps; i++) {
    const th = -0.38 + ((Math.PI + 0.76) * i) / steps
    const z = zA + R * Math.cos(th)
    const y = ARCH.y + R * Math.sin(th)
    if (z < zMin || z > zMax || y < PROFILE_YB(z) + 0.004) continue
    const p = lowerBody(z, vOf(side, sForY(z, y)))
    const n = [0, -Math.sin(th), -Math.cos(th)]
    pos.push(p[0], y, z, p[0] - side * 0.045, y, z)
    nor.push(...n, ...n)
    rows++
  }
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2
    // wind so the face normal points at the wheel (matches `n`)
    if (side > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.setIndex(idx)
  return g
}
const PROFILE_YB = (z) => sectionAt(z).yB

// ── Cabin shell trims (inward offsets of the exterior surfaces) ────────────
let CABIN = null
export function buildCabinShell() {
  if (CABIN) return CABIN
  const GU = greenhouseStations()
  const LU = lowerStations()
  // Headliner + pillar trims: every opaque greenhouse region, 40 mm inboard
  const Lgh = lattice(greenhouse, GU.us, GU.vs, GHD, { offset: -0.04 })
  const headliner = regionGeometry(Lgh, (u, k) => classifyGreenhouse(u, k) === 'paint' && fold(k) > T_S - 1e-6 && u > CAR.zRw + 0.12, { flip: true, uvScale: UV_GH })
  // Lower side walls outside the door openings: kick panels + rear quarters
  const z0 = CAR.zRw - 0.02
  const usQ = clip(LU.us, z0, CAR.zRD1)
  const usK = clip(LU.us, CAR.zFD0, 1.0)
  const sides = []
  for (const side of [1, -1]) {
    const [v0, v1] = vRange(side, S_ROCK, S_E)
    for (const us of [usQ, usK]) {
      sides.push(regionGeometry(lattice(lowerBody, us, clip(LU.vs, v0, v1), LB, { offset: -0.06 }), () => true, { flip: true, uvScale: UV_LB }))
    }
  }
  CABIN = { headliner, sideTrim: merge(sides) }
  return CABIN
}

// ── Main builder ────────────────────────────────────────────────────────────
let CACHE = null
export function buildCar() {
  if (CACHE) return CACHE
  const t0 = performance.now()
  const LU = lowerStations()
  const GU = greenhouseStations()

  // Body shell
  const Lshell = lattice(lowerBody, LU.us, LU.vs, LB)
  const shell = partition(Lshell, classifyLower, ['paint', 'black', 'cowl'], { uvScale: UV_LB })

  // Greenhouse (pillars, roof, fixed glass)
  const Lgh = lattice(greenhouse, GU.us, GU.vs, GHD)
  const ghPaint = regionGeometry(Lgh, (u, k) => classifyGreenhouse(u, k) === 'paint', { uvScale: UV_GH })
  const sideDist = (k) => (fold(k) - T_W) * 1.15
  const windshield = regionGeometry(Lgh, (u, k) => classifyGreenhouse(u, k) === 'windshield', {
    uvScale: UV_GH,
    color: fritColor(0.24, (u, k) => Math.min(sideDist(k) - 0.01, (u - CAR.zHeader) * 1.25 - 0.015, (CAR.zWs - u) * 1.3), 0.055),
  })
  const rearGlass = regionGeometry(Lgh, (u, k) => classifyGreenhouse(u, k) === 'rearglass', {
    uvScale: UV_GH,
    color: fritColor(0.4, (u, k) => Math.min(sideDist(k), (CAR.zRoofRear - u) * 1.25, (u - CAR.zRw) * 1.7 - 0.01), 0.05),
  })

  const doors = {
    fl: buildDoor({ side: 1, front: true, LU, GU }),
    fr: buildDoor({ side: -1, front: true, LU, GU }),
    rl: buildDoor({ side: 1, front: false, LU, GU }),
    rr: buildDoor({ side: -1, front: false, LU, GU }),
  }

  // Hood & boot lid (solidified, hinged at the windscreen / rear-glass edge)
  const [hv0, hv1] = [S_HOOD + GS, 2 - S_HOOD - GS]
  const Lhood = lattice(lowerBody, clip(LU.us, CAR.zHood + G, U_MAX), clip(LU.vs, hv0, hv1), LB)
  const hood = {
    geometry: solidify(Lhood, 0.028, { uvScale: UV_LB, edges: [true, true, true, false] }),
    hinge: new THREE.Vector3(0, sectionAt(CAR.zHood).yT - 0.025, CAR.zHood - 0.012),
  }
  const Lboot = lattice(lowerBody, clip(LU.us, U_MIN, CAR.zBoot - G), clip(LU.vs, hv0, hv1), LB)
  const boot = {
    geometry: solidify(Lboot, 0.028, { uvScale: UV_LB, edges: [true, true, false, true] }),
    hinge: new THREE.Vector3(0, sectionAt(CAR.zBoot).yT - 0.025, CAR.zBoot + 0.012),
  }

  // Sunroof glass + the dark seal walls of the roof opening
  const sr = CAR.sunroof
  const Lsr = lattice(greenhouse, clip(GU.us, sr.z0 + G, sr.z1 - G), clip(GU.vs, K_SR + 0.004, 2 - K_SR - 0.004), GHD)
  const sunroof = {
    geometry: regionGeometry(Lsr, () => true, {
      uvScale: UV_GH,
      color: fritColor(0.5, (u, k) => Math.min((fold(k) - K_SR) * 1.1, u - sr.z0, sr.z1 - u), 0.05),
    }),
    hinge: new THREE.Vector3(0, greenhouse(sr.z1, 1)[1], sr.z1),
  }
  const Lsro = lattice(greenhouse, clip(GU.us, sr.z0, sr.z1), clip(GU.vs, K_SR, 2 - K_SR), GHD)
  const srFrame = wallsOnly(solidify(Lsro, 0.05))

  const roofMould = merge([1, -1].map((side) => surfaceStrip(greenhouse, GHD, {
    u0: -0.8, u1: 0.12, vc: vOf(side, T_P + 0.012), halfV: 0.009, lift: 0.0015, bulge: 0.004, segs: 60, radial: 5,
  })))

  // Lamps & fascia
  const headlights = { l: buildHeadlight(LU, 1), r: buildHeadlight(LU, -1) }
  const taillights = { l: buildTaillight(LU, 1), r: buildTaillight(LU, -1) }
  const grille = buildGrille(LU)
  const fogs = { l: buildFog(LU, 1), r: buildFog(LU, -1) }
  // Boot-lid lip spoiler along the deck's trailing edge (rides with the lid)
  const sLip = S_HOOD + 0.022
  const spoiler = merge([1, -1].map((side) => surfaceStrip(lowerBody, LB, {
    u0: U_MIN, u1: uForX(CAPS.R, sLip, 0.6), vc: vOf(side, sLip), halfV: 0.016, lift: 0.004, bulge: 0.014, segs: 60, radial: 8,
  })))
  // Vertical reflectors at the rear bumper corners
  const sR0 = sForY(U_MIN + 1e-4, 0.37)
  const sR1 = sForY(U_MIN + 1e-4, 0.47)
  const reflectors = merge([1, -1].map((side) => {
    const u = uForX(CAPS.R, (sR0 + sR1) / 2, 0.79)
    return surfacePath(lowerBody, LB, {
      points: [[u, vOf(side, sR0)], [u, vOf(side, sR1)]], halfW: 0.008, lift: 0.002, bulge: 0.002, segs: 10, radial: 3,
    })
  }))
  const sBadge = sForY(U_MIN + 1e-4, 0.855)
  const cityBadge = frameAt(lowerBody, LB, uForX(CAPS.R, sBadge, 0.4), vOf(1, sBadge)) // lower-left as seen from behind
  const sFog = sForY(U_MIN + 1e-4, 0.38)
  const rearFog = surfaceStrip(lowerBody, LB, {
    u0: uForX(CAPS.R, sFog, 0.56), u1: uForX(CAPS.R, sFog, 0.4), vc: vOf(-1, sFog),
    halfV: 0.01, lift: 0.003, bulge: 0.003, segs: 12, radial: 4,
  })

  const plates = {
    front: frameAt(lowerBody, LB, U_MAX - 1e-3, vOf(1, sForY(U_MAX - 1e-4, 0.514))),
    rear: frameAt(lowerBody, LB, U_MIN + 1e-3, vOf(1, sForY(U_MIN + 1e-4, 0.69))),
  }

  const sensors = []
  for (const [cap, y, xs] of [[CAPS.F, 0.47, [0.35, 0.61]], [CAPS.R, 0.53, [0.25, 0.64]]]) {
    const s = sForY(cap.dir > 0 ? U_MAX - 1e-4 : U_MIN + 1e-4, y)
    for (const x of xs) for (const side of [1, -1]) sensors.push(frameAt(lowerBody, LB, uForX(cap, s, x), vOf(side, s)))
  }

  const mirrors = {
    l: frameAt(lowerBody, LB, 0.62, vOf(1, S_E - 0.022)),
    r: frameAt(lowerBody, LB, 0.62, vOf(-1, S_E - 0.022)),
  }

  const wz = CAR.zWs + 0.028
  const wipers = {
    normal: frameAt(greenhouse, GHD, CAR.zWs - 0.12, 1.0).normal,
    a: new THREE.Vector3(-0.43, deckY(wz, 0.43) + 0.012, wz),
    b: new THREE.Vector3(0.05, deckY(wz, 0.05) + 0.012, wz),
    rear: new THREE.Vector3(0, greenhouse(CAR.zRw + 0.06, 1)[1] + 0.01, CAR.zRw + 0.06),
    rearNormal: frameAt(greenhouse, GHD, CAR.zRw + 0.14, 1.0).normal,
  }

  // Arch lips — the rear-arch segment ahead of the rear-door shut line
  // belongs to the rear door
  const archBody = merge([
    archLip(CAR.axleF, 1), archLip(CAR.axleF, -1),
    archLip(CAR.axleR, 1, -Infinity, CAR.zRD1), archLip(CAR.axleR, -1, -Infinity, CAR.zRD1),
  ])
  doors.rl.archLip = archLip(CAR.axleR, 1, CAR.zRD1 + G, Infinity)
  doors.rr.archLip = archLip(CAR.axleR, -1, CAR.zRD1 + G, Infinity)

  const result = {
    shell, ghPaint, windshield, rearGlass, doors, hood, boot, sunroof, srFrame, roofMould, archBody,
    headlights, taillights, grille, fogs, spoiler, reflectors, rearFog, plates, sensors, cityBadge,
    mirrors, wipers,
    adas: frameAt(greenhouse, GHD, CAR.zHeader + 0.075, 1.0),
    rearBadge: frameAt(lowerBody, LB, U_MIN + 1e-3, vOf(1, sForY(U_MIN + 1e-4, 0.982))),
    fin: frameAt(greenhouse, GHD, CAR.zRoofRear + 0.08, 1.0),
    buildMs: performance.now() - t0,
  }
  CACHE = result
  return result
}
