// Cabin geometry: dashboard extrusions, seats, steering wheel, console.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const DASH_HALF_W = 0.74

/** Extrude a side profile (points in car z/y) across the cabin width. */
function extrudeProfile(points, halfW, bevel = 0.018, curveSegments = 24) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.length === 4) shape.quadraticCurveTo(p[0], p[1], p[2], p[3])
    else shape.lineTo(p[0], p[1])
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: halfW * 2 - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments,
  })
  // shape x → car z, extrude → car −x (proper rotation, keeps winding)
  g.rotateY(-Math.PI / 2)
  g.translate(halfW - bevel, 0, 0)
  g.computeVertexNormals()
  return g
}

export function dashboardGeometry() {
  // Upper pad (black soft-touch): windshield base → rounded lip → face top
  const upper = extrudeProfile([
    [0.95, 0.985],
    [0.82, 1.03, 0.68, 1.05],
    [0.6, 1.052, 0.585, 1.025],
    [0.583, 0.985],
    [0.6, 0.93],
    [0.95, 0.93],
  ], DASH_HALF_W, 0.016)
  // Lower dash (ivory) with the knee-roll curving under to the firewall
  const lower = extrudeProfile([
    [0.62, 0.928],
    [0.6, 0.9],
    [0.608, 0.8, 0.66, 0.72],
    [0.74, 0.64, 0.95, 0.6],
    [0.95, 0.928],
  ], DASH_HALF_W - 0.006, 0.02)
  return { upper, lower }
}

/** Rounded box helper (width, height, depth, radius). */
export const rbox = (w, h, d, r, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) - 1e-4)

let SEAT = null
/** Front bucket seat parts in a local frame (origin = cushion rear-centre, facing +Z). */
export function seatGeometry() {
  if (SEAT) return SEAT
  SEAT = {
    cushion: rbox(0.5, 0.1, 0.5, 0.045),
    cushionInsert: rbox(0.29, 0.035, 0.42, 0.016),
    cushionBolster: rbox(0.1, 0.085, 0.47, 0.04),
    back: rbox(0.5, 0.62, 0.11, 0.05),
    backInsert: rbox(0.29, 0.5, 0.03, 0.014),
    backBolster: rbox(0.1, 0.54, 0.14, 0.045),
    shoulder: rbox(0.46, 0.08, 0.12, 0.04),
    headrest: rbox(0.27, 0.17, 0.1, 0.045),
    post: new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8),
    base: rbox(0.36, 0.1, 0.42, 0.02),
    rail: rbox(0.04, 0.03, 0.62, 0.01),
  }
  return SEAT
}

let BENCH = null
export function benchGeometry() {
  if (BENCH) return BENCH
  BENCH = {
    cushion: rbox(1.24, 0.12, 0.5, 0.05),
    cushionInsert: rbox(0.36, 0.03, 0.4, 0.014),
    back: rbox(1.24, 0.5, 0.13, 0.05),
    backInsert: rbox(0.36, 0.38, 0.03, 0.014),
    headrest: rbox(0.26, 0.12, 0.08, 0.035),
    armrestPanel: rbox(0.26, 0.4, 0.02, 0.01),
  }
  return BENCH
}

let WHEEL = null
/** 3-spoke steering wheel facing −Z (toward the driver) at the origin. */
export function steeringGeometry() {
  if (WHEEL) return WHEEL
  const rim = new THREE.TorusGeometry(0.183, 0.0175, 18, 72)
  const hub = new THREE.CylinderGeometry(0.068, 0.074, 0.05, 40)
  hub.rotateX(Math.PI / 2)
  hub.scale(1.25, 0.95, 1)
  const spoke = rbox(0.12, 0.034, 0.022, 0.01)
  const lowerSpoke = rbox(0.05, 0.11, 0.022, 0.012)
  const column = new THREE.CylinderGeometry(0.045, 0.055, 0.28, 24)
  column.rotateX(Math.PI / 2)
  column.translate(0, -0.01, 0.17)
  const paddle = rbox(0.028, 0.052, 0.006, 0.0028)
  const stalk = new THREE.CylinderGeometry(0.007, 0.006, 0.13, 10)
  stalk.rotateZ(Math.PI / 2)
  WHEEL = { rim, hub, spoke, lowerSpoke, column, paddle, stalk }
  return WHEEL
}

/** Air vent: rounded recess frame + horizontal vanes, facing −Z. */
export function ventGeometry(w, h) {
  const frame = rbox(w + 0.016, h + 0.016, 0.02, 0.012)
  const recess = rbox(w, h, 0.012, 0.008)
  const vane = rbox(w - 0.01, 0.004, 0.014, 0.0015, 2)
  return { frame, recess, vane, count: Math.max(3, Math.round(h / 0.014)) }
}
