// Wheel parts. All built with the axle along +Y (outboard = +Y) at the
// origin; the Wheel component rotates the assembly onto the car's X axis.
import * as THREE from 'three'
import { CAR } from './carSurface'

const TYRE_R = CAR.tireR
const RIM_R = CAR.rimR
const HALF_W = CAR.tireW / 2

/** Tyre cross-section revolved around the axle. Profile index spacing puts
 *  the tread on v ∈ [0.22, 0.78] to match the tread normal map. */
export function tyreGeometry(segments = 96) {
  const pts = []
  const bead = RIM_R + 0.006
  const side = (sgn, n) => {
    // bead → sidewall bulge → shoulder
    const out = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const r = bead + (TYRE_R - 0.012 - bead) * t
      const bulge = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.011
      const y = sgn * (HALF_W - 0.012 + bulge - 0.004 * t)
      out.push(new THREE.Vector2(r, y))
    }
    return out
  }
  const inboard = side(-1, 9)
  const outboard = side(1, 9).reverse()
  const tread = []
  const n = 22
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = -HALF_W + 0.008 + (2 * HALF_W - 0.016) * t
    // rounded shoulders, slightly crowned tread
    const e = Math.abs(t - 0.5) * 2
    const r = TYRE_R - 0.012 * Math.pow(e, 6) - 0.002 * e * e
    tread.push(new THREE.Vector2(r, y))
  }
  const profile = [...inboard, ...tread.slice(1, -1), ...outboard]
  const g = new THREE.LatheGeometry(profile, segments)
  // Lathe winds faces inward for an outward-going profile on the inboard
  // half; compute normals after ensuring consistent orientation.
  g.computeVertexNormals()
  return g
}

/** Rim barrel + outer lip. */
export function rimBarrelGeometry(segments = 96) {
  const pts = [
    [RIM_R - 0.012, -HALF_W + 0.004],
    [RIM_R + 0.004, -HALF_W + 0.006],
    [RIM_R + 0.006, -HALF_W + 0.016],
    [RIM_R - 0.006, -HALF_W + 0.02],
    [RIM_R - 0.008, 0.02],
    [RIM_R - 0.004, HALF_W - 0.03],
    [RIM_R + 0.004, HALF_W - 0.012],
    [RIM_R + 0.011, HALF_W - 0.006],
    [RIM_R + 0.012, HALF_W + 0.0],
    [RIM_R + 0.004, HALF_W + 0.004],
    [RIM_R - 0.012, HALF_W - 0.004],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, segments)
  g.computeVertexNormals()
  return g
}

function sectorHole(r1, r2, a0, a1, round = 0.012, steps = 18) {
  // Window between spokes: outer arc r2 (a0→a1), inner arc r1 (a1→a0),
  // corners softened by pulling the arc ends in.
  const path = new THREE.Path()
  const da0 = round / r2
  const da1 = round / r1
  for (let i = 0; i <= steps; i++) {
    const a = a0 + da0 + (a1 - a0 - 2 * da0) * (i / steps)
    const x = Math.cos(a) * r2
    const y = Math.sin(a) * r2
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  // corner to inner arc
  const ia1 = a1 - da1 * 1.6
  const ia0 = a0 + da1 * 1.6
  path.quadraticCurveTo(Math.cos(a1) * (r2 - round), Math.sin(a1) * (r2 - round), Math.cos(ia1) * (r1 + round * 0.5), Math.sin(ia1) * (r1 + round * 0.5))
  for (let i = 0; i <= steps; i++) {
    const a = ia1 + (ia0 - ia1) * (i / steps)
    path.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
  }
  path.quadraticCurveTo(Math.cos(a0) * (r2 - round), Math.sin(a0) * (r2 - round), Math.cos(a0 + da0) * r2, Math.sin(a0 + da0) * r2)
  return path
}

function curvedHole(r1, r2, a0, width, twist, steps = 16) {
  // Turbine-style slot: centre-line spirals by `twist` from r1 to r2
  const path = new THREE.Path()
  const left = []
  const right = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = r1 + (r2 - r1) * t
    const w = (width * (0.55 + 0.45 * t)) / r
    const a = a0 + twist * t
    left.push([Math.cos(a - w) * r, Math.sin(a - w) * r])
    right.push([Math.cos(a + w) * r, Math.sin(a + w) * r])
  }
  path.moveTo(...left[0])
  for (const p of left) path.lineTo(...p)
  for (const p of right.reverse()) path.lineTo(...p)
  path.closePath()
  return path
}

/** Window whose side edges sweep by `twist` radians from hub to rim. */
function twistedHole(r1, r2, a0, a1, twist, steps = 14) {
  const pts = []
  const ang = (a, t) => a + twist * t * t
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = r1 + (r2 - r1) * t
    pts.push([Math.cos(ang(a0, t)) * r, Math.sin(ang(a0, t)) * r])
  }
  for (let i = 1; i <= steps; i++) {
    const a = a0 + twist + ((a1 - a0) * i) / steps
    pts.push([Math.cos(a) * r2, Math.sin(a) * r2])
  }
  for (let i = steps - 1; i >= 0; i--) {
    const t = i / steps
    const r = r1 + (r2 - r1) * t
    pts.push([Math.cos(ang(a1, t)) * r, Math.sin(ang(a1, t)) * r])
  }
  for (let i = 1; i < steps; i++) {
    const a = a1 - ((a1 - a0) * i) / steps
    pts.push([Math.cos(a) * r1, Math.sin(a) * r1])
  }
  const p = new THREE.Path()
  p.moveTo(...pts[0])
  for (let i = 1; i < pts.length; i++) p.lineTo(...pts[i])
  p.closePath()
  return p
}

/** Spoked rim face for a style. Returns a geometry with groups:
 *  0 = machined faces, 1 = spoke side walls (pocket colour).
 *  stock  — 2026 City ZX 16″ diamond-cut, five twisted twin-spokes
 *  sport  — V-grade style multi-spoke, gunmetal grey
 *  carbon — aero turbine accessory wheel */
export function rimFaceGeometry(style) {
  const R = RIM_R - 0.006
  const shape = new THREE.Shape()
  shape.absarc(0, 0, R, 0, Math.PI * 2, false)
  const hub = 0.062
  if (style === 'stock') {
    const n = 5
    const pair = (Math.PI * 2) / n
    for (let i = 0; i < n; i++) {
      const base = (i / n) * Math.PI * 2
      shape.holes.push(twistedHole(hub + 0.02, R - 0.013, base + 0.24, base + pair - 0.24, 0.32))
      shape.holes.push(twistedHole(hub + 0.058, R - 0.022, base - 0.045, base + 0.045, 0.32, 10))
    }
  } else if (style === 'carbon') {
    const n = 14
    for (let i = 0; i < n; i++) {
      shape.holes.push(curvedHole(hub + 0.02, R - 0.016, (i / n) * Math.PI * 2, 0.0115, 0.42))
    }
  } else {
    // sport: 10 slender spokes (V-grade multi-spoke)
    const n = 10
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      shape.holes.push(sectorHole(hub + 0.026, R - 0.012, a0 + 0.1, a1 - 0.1, 0.011, 12))
    }
  }
  const depth = style === 'carbon' ? 0.022 : 0.026
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.0035,
    bevelSegments: 3,
    curveSegments: 48,
  })
  // ExtrudeGeometry: z ∈ [−bevel, depth+bevel]; map z → +Y (outboard) and dish
  // the face so spokes sweep inward toward the hub (concave wheel).
  const pos = g.attributes.position
  const dish = style === 'stock' ? 0.028 : style === 'carbon' ? 0.012 : 0.02
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, y) / R
    const off = -dish * (1 - r * r)
    pos.setXYZ(i, x, z + off + HALF_W - 0.05, -y)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/** Centre cap disc with a raised "H" badge. */
export function centreCapGeometry() {
  const cap = new THREE.CylinderGeometry(0.034, 0.036, 0.012, 40)
  cap.translate(0, HALF_W - 0.012, 0)
  return cap
}

export function hBadgeGeometry(size = 0.026) {
  // Stylised Honda "H": two flared uprights joined by a crossbar
  const s = size
  const shape = new THREE.Shape()
  shape.moveTo(-0.5 * s, 0.42 * s)
  shape.lineTo(-0.3 * s, 0.42 * s)
  shape.lineTo(-0.24 * s, 0.08 * s)
  shape.lineTo(0.24 * s, 0.08 * s)
  shape.lineTo(0.3 * s, 0.42 * s)
  shape.lineTo(0.5 * s, 0.42 * s)
  shape.lineTo(0.4 * s, -0.42 * s)
  shape.lineTo(0.22 * s, -0.42 * s)
  shape.lineTo(0.2 * s, -0.08 * s)
  shape.lineTo(-0.2 * s, -0.08 * s)
  shape.lineTo(-0.22 * s, -0.42 * s)
  shape.lineTo(-0.4 * s, -0.42 * s)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: s * 0.08, bevelEnabled: true, bevelThickness: s * 0.03, bevelSize: s * 0.02, bevelSegments: 2, curveSegments: 4,
  })
  g.center()
  return g
}

/** Rounded frame around the H for grille / boot badges. */
export function badgeRingGeometry(w = 0.11, h = 0.085, t = 0.006) {
  const outer = new THREE.Shape()
  const r = h * 0.28
  const rr = (shape, W, H, R) => {
    shape.moveTo(-W / 2 + R, -H / 2)
    shape.lineTo(W / 2 - R, -H / 2)
    shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R)
    shape.lineTo(W / 2, H / 2 - R)
    shape.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2)
    shape.lineTo(-W / 2 + R, H / 2)
    shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R)
    shape.lineTo(-W / 2, -H / 2 + R)
    shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2)
  }
  rr(outer, w, h, r)
  const hole = new THREE.Path()
  rr(hole, w - t * 2, h - t * 2, r * 0.8)
  outer.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(outer, {
    depth: 0.003, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 8,
  })
  g.center()
  return g
}

export function lugGeometry() {
  const g = new THREE.CylinderGeometry(0.0085, 0.0095, 0.02, 6)
  return g
}

/** Ventilated brake disc (revolved rectangle) + darker hat. */
export function discGeometry() {
  const pts = [
    [0.07, -0.012], [0.138, -0.012], [0.14, -0.01], [0.14, 0.01], [0.138, 0.012], [0.07, 0.012],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 64)
  g.computeVertexNormals()
  g.translate(0, -0.02, 0)
  return g
}

export function discHatGeometry() {
  const g = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 40)
  g.translate(0, -0.01, 0)
  return g
}

/** Caliper: annular sector straddling the disc edge (non-rotating). */
export function caliperGeometry() {
  const s = new THREE.Shape()
  const r0 = 0.1
  const r1 = 0.158
  const a0 = -0.55
  const a1 = 0.55
  s.absarc(0, 0, r1, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 20,
  })
  // z (extrude) → axle (Y), centred over the disc
  g.rotateX(-Math.PI / 2)
  g.translate(0, -0.045, 0)
  return g
}
