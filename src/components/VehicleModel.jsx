import { useEffect, useLayoutEffect, useMemo, useRef, createRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bvh } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'
import { useCarState } from '../hooks/useCarState'
import { flyTo } from '../hooks/useCameraRig'
import { EXTERIOR_MESH_TO_HOTSPOT } from '../constants/hotspots'
import { CAR, GH } from '../three/carSurface'
import { buildCar } from '../three/buildCar'
import { getCarMaterials, applyPaint } from '../three/materials'
import { getInteriorMaterials } from '../three/interiorMaterials'
import { hBadgeGeometry, badgeRingGeometry } from '../three/wheelGeometry'
import Wheel, { WheelTub } from './car/Wheel'
import Mirror from './car/Mirror'

const DOOR_KEYS = ['fl', 'fr', 'rl', 'rr']
const UP = new THREE.Vector3(0, 1, 0)

/** Quaternion whose +Z faces `normal` with +Y kept as upright as possible. */
function faceQuat(normal, up = UP) {
  const z = normal.clone().normalize()
  const x = new THREE.Vector3().crossVectors(up, z)
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0)
  x.normalize()
  const y = new THREE.Vector3().crossVectors(z, x)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}
/** Quaternion rotating +Y onto `dir`. */
const yQuat = (dir) => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())

const FRONT_WIPER_RATES = { int1: 1.1, int2: 1.9, low: 3.4, high: 5.6 }
const REAR_WIPER_RATES = { int: 1.4, low: 2.8, high: 4.8 }

// ── Small shared geometries ─────────────────────────────────────────────────
let SMALL = null
function smallGeo() {
  if (SMALL) return SMALL
  const handle = new THREE.CapsuleGeometry(0.013, 0.13, 6, 16)
  handle.rotateZ(Math.PI / 2)
  handle.scale(1, 0.9, 0.55)
  const ledCup = new THREE.LatheGeometry(
    [[0.0, -0.012], [0.4, -0.011], [0.75, -0.006], [0.95, 0.004], [1.0, 0.01]].map(([r, y]) => new THREE.Vector2(r, y)),
    32,
  )
  const ledLens = new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)
  ledLens.scale(1, 0.35, 1)
  const sensor = new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 24)
  const plate = new THREE.BoxGeometry(0.5, 0.12, 0.006)
  const fogLens = new THREE.CylinderGeometry(0.036, 0.036, 0.012, 32)
  const fogRing = new THREE.TorusGeometry(0.038, 0.005, 8, 40)
  const finShape = new THREE.Shape()
  finShape.moveTo(-0.1, 0)
  finShape.quadraticCurveTo(-0.02, 0.012, 0.045, 0.062)
  finShape.quadraticCurveTo(0.062, 0.07, 0.07, 0.055)
  finShape.lineTo(0.085, 0)
  finShape.closePath()
  const fin = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4, curveSegments: 16,
  })
  fin.translate(0, 0, -0.025)
  fin.rotateY(Math.PI / 2) // length along −Z… authored so +X tip points rearward
  // Matrix-Mesh grille cell: bevelled hexagonal ring (flat-top), facing +Z.
  // The rings' rims catch the studio light and trace the honeycomb outline.
  const hexPath = (r) => {
    const p = new THREE.Path()
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2
      if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else p.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    return p
  }
  const hexShape = new THREE.Shape(hexPath(1).getPoints())
  hexShape.holes.push(hexPath(0.74))
  const hex = new THREE.ExtrudeGeometry(hexShape, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.08, bevelSegments: 2, curveSegments: 1,
  })
  hex.translate(0, 0, -0.5)
  const radar = new THREE.CylinderGeometry(0.014, 0.014, 0.006, 32)
  radar.rotateX(Math.PI / 2)
  SMALL = {
    handle, ledCup, ledLens, sensor, plate, fogLens, fogRing, fin, hex, radar,
    logoBadge: hBadgeGeometry(0.046), logoRing: badgeRingGeometry(0.066, 0.051, 0.005),
    smallBadge: hBadgeGeometry(0.048), smallRing: badgeRingGeometry(0.068, 0.053, 0.005),
  }
  return SMALL
}

/** Chrome "CITY" script for the boot, drawn to a canvas. */
let CITY_TEX = null
function cityTexture() {
  if (CITY_TEX) return CITY_TEX
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.font = '800 104px "Arial Black", Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.save()
  g.translate(256, 66)
  g.scale(1.25, 1) // wide, flat lettering like the badge
  g.fillText('CITY', 0, 0)
  g.restore()
  CITY_TEX = new THREE.CanvasTexture(c)
  CITY_TEX.anisotropy = 8
  return CITY_TEX
}

/** Instanced honeycomb tiles laid on the fascia (one draw call). */
function Honeycomb({ cells, material }) {
  const S = smallGeo()
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const basis = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const sc = new THREE.Vector3()
    const x = new THREE.Vector3()
    const y = new THREE.Vector3()
    cells.forEach((c, i) => {
      x.copy(c.tangent).addScaledVector(c.normal, -c.tangent.dot(c.normal)).normalize()
      y.crossVectors(c.normal, x)
      q.setFromRotationMatrix(basis.makeBasis(x, y, c.normal))
      sc.set(c.w * 0.5, c.h * 0.5 / 0.866, 0.014)
      mesh.setMatrixAt(i, m.compose(c.position, q, sc))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells])
  return <instancedMesh ref={ref} args={[S.hex, material, cells.length]} />
}

// ── Door card details (interior side of each door) ──────────────────────────
const SKIN = 0.058 // door thickness (solidify) — the card surface is this far inboard
function DoorCard({ d }) {
  const IM = getInteriorMaterials()
  const c = d.card
  const geos = useMemo(() => {
    // Card features are placed along the inward normal from the outer skin
    const inset = (fr, extra) => fr.position.clone().addScaledVector(fr.normal, -(SKIN + extra))
    return {
      arm: new THREE.BoxGeometry(0.075, 0.042, c.armLen, 1, 1, 8),
      pocket: new THREE.BoxGeometry(0.034, 0.075, c.pocketLen),
      strip: new THREE.BoxGeometry(0.008, 0.007, c.ambLen),
      speaker: new THREE.CylinderGeometry(0.075, 0.075, 0.012, 40),
      pull: new THREE.BoxGeometry(0.03, 0.03, 0.12),
      sw: new THREE.BoxGeometry(0.06, 0.022, 0.17),
      armPos: inset(c.arm, 0.036),
      pocketPos: inset(c.pocket, 0.016),
      stripPos: inset(c.ambient, 0.003),
      speakerPos: inset(c.speaker, 0.005),
      pullPos: inset(c.pull, 0.018),
      swPos: inset(c.switches, 0.07),
    }
  }, [c])
  return (
    <group>
      <mesh geometry={geos.arm} material={IM.leatherDark} position={geos.armPos} />
      <mesh geometry={geos.pocket} material={IM.hardPlastic} position={geos.pocketPos} />
      <mesh geometry={geos.strip} material={IM.ambient} position={geos.stripPos} name={`ambient_door_${d.front ? 'f' : 'r'}${d.side > 0 ? 'l' : 'r'}`} />
      <mesh geometry={geos.speaker} material={IM.vent} position={geos.speakerPos} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={geos.pull} material={IM.satin} position={geos.pullPos} />
      {d.front && <mesh geometry={geos.sw} material={IM.pianoBlack} position={geos.swPos} />}
    </group>
  )
}

// ── Door ────────────────────────────────────────────────────────────────────
function Door({ k, d, doorRef, windowRef, windowMat, mirrorRef, mirrorGlassRef, frame }) {
  const M = getCarMaterials()
  const IM = getInteriorMaterials()
  const S = smallGeo()
  const handleQuat = useMemo(() => faceQuat(d.handle.normal), [d])
  const handlePos = useMemo(() => d.handle.position.clone().addScaledVector(d.handle.normal, 0.009), [d])
  // solidify groups: 0 outer, 1 inner, 2 vMin wall, 3 vMax wall, 4/5 u walls.
  // The belt-side wall is vMax on the left half and vMin on the right half.
  const lowerMats = useMemo(() => {
    const belt = IM.belt
    return d.side > 0 ? [M.paint, M.doorTrim, M.paint, belt, M.paint, M.paint] : [M.paint, M.doorTrim, belt, M.paint, M.paint, M.paint]
  }, [d, M, IM])
  const hinge = d.hinge
  return (
    <group ref={doorRef} name={`door_${k}`} position={hinge}>
      <group position={[-hinge.x, -hinge.y, -hinge.z]}>
        <mesh geometry={d.lower} material={lowerMats} castShadow receiveShadow />
        <mesh geometry={d.sash} material={M.blackGloss} />
        {d.quarter && <mesh geometry={d.quarter} material={M.glassFrit} renderOrder={3} />}
        <group ref={windowRef} name={`window_${k}`}>
          <mesh geometry={d.glass} material={windowMat} renderOrder={4} />
        </group>
        <mesh geometry={d.belt} material={M.blackGloss} />
        {d.archLip && <mesh geometry={d.archLip} material={M.paint} />}
        <mesh geometry={S.handle} material={M.paint} position={handlePos} quaternion={handleQuat} />
        <DoorCard d={d} />
        {d.front && (
          <Mirror
            ref={mirrorRef}
            glassRef={mirrorGlassRef}
            frame={frame}
            side={d.side}
            name={d.side > 0 ? 'mirror_left' : 'mirror_right'}
            glassName={d.side > 0 ? 'mirror_glass_left' : 'mirror_glass_right'}
          />
        )}
      </group>
    </group>
  )
}

// ── Lamps ───────────────────────────────────────────────────────────────────
function LedModule({ frame }) {
  const M = getCarMaterials()
  const S = smallGeo()
  const q = useMemo(() => yQuat(frame.normal), [frame])
  return (
    <group position={frame.position} quaternion={q} scale={frame.size}>
      <mesh geometry={S.ledCup} material={M.darkChrome} />
      <mesh geometry={S.ledLens} material={M.lights.led} />
    </group>
  )
}

function Headlight({ h, name }) {
  const M = getCarMaterials()
  return (
    <group name={name}>
      <mesh geometry={h.housing} material={M.lampHousing} />
      <mesh geometry={h.walls} material={M.lampHousing} />
      <mesh geometry={h.drl} material={M.lights.drl} />
      <mesh geometry={h.turn} material={M.lights.turnF} />
      {h.leds.map((f, i) => <LedModule key={i} frame={f} />)}
      <mesh geometry={h.lens} material={M.lens} renderOrder={5} />
    </group>
  )
}

function Taillight({ t, name, guideMat }) {
  const M = getCarMaterials()
  return (
    <group name={name}>
      <mesh geometry={t.housing} material={M.tailHousing} />
      <mesh geometry={t.walls} material={M.tailHousing} />
      <mesh geometry={t.guide} material={guideMat} />
      <mesh geometry={t.outline} material={M.lights.tailOutline} />
      <mesh geometry={t.lens} material={M.tailLens} renderOrder={5} />
    </group>
  )
}

// Corner air-curtain vent with the slim LED fog lamp at its foot (2026)
function FogLamp({ f, name }) {
  const M = getCarMaterials()
  return (
    <group name={name}>
      <mesh geometry={f.housing} material={M.grilleBack} />
      <mesh geometry={f.walls} material={M.blackPlastic} />
      <mesh geometry={f.fins} material={M.blackGloss} />
      <mesh geometry={f.lamp} material={M.lights.fog} />
    </group>
  )
}

function Badge({ frame, ring, badge, offset = 0.006 }) {
  const M = getCarMaterials()
  const q = useMemo(() => faceQuat(frame.normal), [frame])
  const p = useMemo(() => frame.position.clone().addScaledVector(frame.normal, offset), [frame, offset])
  return (
    <group position={p} quaternion={q}>
      <mesh geometry={ring} material={M.chrome} />
      <mesh geometry={badge} material={M.chrome} scale={[0.82, 0.82, 0.82]} />
    </group>
  )
}

function Plate({ frame, material }) {
  const M = getCarMaterials()
  const S = smallGeo()
  const q = useMemo(() => faceQuat(frame.normal), [frame])
  const p = useMemo(() => frame.position.clone().addScaledVector(frame.normal, 0.008), [frame])
  const mats = useMemo(() => [M.blackPlastic, M.blackPlastic, M.blackPlastic, M.blackPlastic, material, M.blackPlastic], [M, material])
  return <mesh geometry={S.plate} material={mats} position={p} quaternion={q} />
}

// ── Wipers ──────────────────────────────────────────────────────────────────
function WiperArm({ length, blade, name, wiperRef, pivot, normal }) {
  const M = getCarMaterials()
  const q = useMemo(() => {
    // local Z = glass normal, local X = +X along the cowl
    const z = normal.clone().normalize()
    const x = new THREE.Vector3(1, 0, 0).addScaledVector(z, -z.x).normalize()
    const y = new THREE.Vector3().crossVectors(z, x)
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  }, [normal])
  return (
    <group position={pivot} quaternion={q}>
      <mesh material={M.blackGloss} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 0.03, 20]} />
      </mesh>
      <group ref={wiperRef} name={name}>
        <mesh material={M.blackGloss} position={[length / 2, 0, 0.02]} rotation={[0, -0.03, 0]}>
          <boxGeometry args={[length, 0.014, 0.012]} />
        </mesh>
        <mesh material={M.blackPlastic} position={[length * 0.55, 0, 0.008]}>
          <boxGeometry args={[blade, 0.01, 0.014]} />
        </mesh>
      </group>
    </group>
  )
}

// ── Static extras: engine bay, boot well, underbody ─────────────────────────
function Cavities() {
  const IM = getInteriorMaterials()
  const M = getCarMaterials()
  const under = useMemo(() => {
    const s = new THREE.Shape()
    const w = 0.8
    const l0 = -2.08
    const l1 = 2.1
    const r = 0.35
    s.moveTo(-w + r, l0)
    s.lineTo(w - r, l0)
    s.quadraticCurveTo(w, l0, w, l0 + r)
    s.lineTo(w, l1 - r)
    s.quadraticCurveTo(w, l1, w - r, l1)
    s.lineTo(-w + r, l1)
    s.quadraticCurveTo(-w, l1, -w, l1 - r)
    s.lineTo(-w, l0 + r)
    s.quadraticCurveTo(-w, l0, -w + r, l0)
    const g = new THREE.ShapeGeometry(s, 8)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  return (
    <group>
      <mesh geometry={under} material={M.underbody} position={[0, 0.218, 0]} />
      {/* Engine bay — kept well inside the hood/fender skins */}
      <mesh position={[0, 0.5, 1.535]} material={M.underbody}>
        <boxGeometry args={[1.2, 0.4, 0.83]} />
      </mesh>
      <mesh position={[0, 0.66, 1.48]} material={IM.hardPlastic}>
        <boxGeometry args={[0.6, 0.14, 0.42]} />
      </mesh>
      <mesh position={[0, 0.745, 1.48]} material={IM.pianoBlack}>
        <boxGeometry args={[0.48, 0.035, 0.34]} />
      </mesh>
      <mesh position={[0.42, 0.68, 1.78]} material={IM.rubber}>
        <boxGeometry args={[0.2, 0.16, 0.14]} />
      </mesh>
      <mesh position={[-0.46, 0.72, 1.32]} material={IM.softBeige}>
        <boxGeometry args={[0.12, 0.1, 0.15]} />
      </mesh>
      {/* Firewall behind the engine bay (hides the cabin from the bay) */}
      <mesh position={[0, 0.63, 1.0]} material={M.underbody}>
        <boxGeometry args={[1.36, 0.64, 0.03]} />
      </mesh>
      {/* Boot well */}
      <mesh position={[0, 0.66, -1.78]} material={IM.carpet}>
        <boxGeometry args={[1.38, 0.62, 0.7]} />
      </mesh>
    </group>
  )
}

// ── Vehicle ─────────────────────────────────────────────────────────────────
export default function VehicleModel() {
  const car = useMemo(() => buildCar(), [])
  const M = useMemo(() => getCarMaterials(), [])
  const S = smallGeo()

  const selectedColor = useCarState((s) => s.selectedColor)
  const paintFinish = useCarState((s) => s.paintFinish)
  const selectedWheel = useCarState((s) => s.selectedWheel)
  const setActiveHotspot = useCarState((s) => s.setActiveHotspot)

  useEffect(() => applyPaint(M.paint, selectedColor, paintFinish), [M, selectedColor, paintFinish])

  // Per-door window glass with a world-space clip plane at the beltline
  const windowMats = useMemo(() => {
    const out = {}
    for (const k of DOOR_KEYS) {
      const m = M.makeWindowGlass(k[0] === 'f' ? 0.26 : 0.4)
      m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -car.doors[k].glassClipY)]
      out[k] = m
    }
    return out
  }, [M, car])
  useEffect(() => () => Object.values(windowMats).forEach((m) => m.dispose()), [windowMats])

  // Separate tail-guide materials so "sequential" can light each side alone
  const tailMats = useMemo(() => ({ l: M.lights.tail, r: M.lights.tail.clone() }), [M])

  const refs = useMemo(() => ({
    door: Object.fromEntries(DOOR_KEYS.map((k) => [k, createRef()])),
    win: Object.fromEntries(DOOR_KEYS.map((k) => [k, createRef()])),
    mirror: { l: createRef(), r: createRef() },
    mirrorGlass: { l: createRef(), r: createRef() },
    wiper: { a: createRef(), b: createRef(), rear: createRef() },
    hood: createRef(),
    boot: createRef(),
    sun: createRef(),
    spotL: createRef(),
    spotR: createRef(),
  }), [])

  const anim = useRef({
    door: { fl: 0, fr: 0, rl: 0, rr: 0 },
    win: { fl: 0, fr: 0, rl: 0, rr: 0 },
    mirror: { l: 0, r: 0 },
    glass: { lx: 0, ly: 0, rx: 0, ry: 0 },
    hood: 0, boot: 0, tilt: 0, slide: 0, lift: 0,
    wipe: { a: 0, rear: 0 }, phase: 0, rearPhase: 0,
    drl: 0.04, led: 0, spot: 0, fog: 0, rearFog: 0, tailL: 0.25, tailR: 0.25, refl: 0.05,
  })

  const spotTargets = useMemo(() => {
    const l = new THREE.Object3D()
    const r = new THREE.Object3D()
    l.position.set(0.7, 0, 9)
    r.position.set(-0.7, 0, 9)
    return { l, r }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const s = useCarState.getState()
    const A = s.animationStates
    const a = anim.current

    // Doors — hinge about vertical axis at the leading edge
    for (const k of DOOR_KEYS) {
      const left = k.endsWith('l')
      easing.damp(a.door, k, A[`door_${k}`] ? (k[0] === 'f' ? 1.12 : 1.05) : 0, 0.34, dt)
      const g = refs.door[k].current
      if (g) g.rotation.y = left ? -a.door[k] : a.door[k]
      easing.damp(a.win, k, (A[`window_${k}`] || 0) / 100, 0.4, dt)
      const w = refs.win[k].current
      if (w) w.position.y = -car.doors[k].glassDrop * a.win[k]
    }

    // Hood (rear hinge) / boot (front hinge)
    easing.damp(a, 'hood', A.bonnet ? 0.92 : 0, 0.45, dt)
    easing.damp(a, 'boot', A.boot ? 1.02 : 0, 0.45, dt)
    if (refs.hood.current) refs.hood.current.rotation.x = -a.hood
    if (refs.boot.current) refs.boot.current.rotation.x = a.boot

    // Sunroof (inbuilt type): 1 = vent tilt (rear edge up); 2 = drop below the
    // roof skin, then slide back between roof and headliner. It stays dropped
    // until it is fully forward again so it never cuts through the roof.
    const sliding = A.sunroof === 2 || a.slide > 0.015
    easing.damp(a, 'tilt', A.sunroof === 1 ? 0.075 : 0, 0.3, dt)
    easing.damp(a, 'lift', sliding ? -0.026 : 0, 0.12, dt)
    easing.damp(a, 'slide', A.sunroof === 2 && a.lift < -0.02 ? 0.31 : 0, 0.55, dt) // rear edge stops at the roof's end
    const sun = refs.sun.current
    if (sun) {
      // The roof drops ~9 cm toward the rear glass, so a straight slide would
      // poke through it: ride the roof profile, pitching the panel to match.
      const { z0, z1 } = CAR.sunroof
      const yF = GH.yG(z1 - a.slide)
      const yR = GH.yG(z0 - a.slide)
      const pitch = Math.atan2((yR - yF) - (GH.yG(z0) - GH.yG(z1)), z1 - z0)
      sun.rotation.x = a.tilt + pitch
      sun.position.set(0, yF + a.lift, z1 - a.slide)
    }

    // Mirrors: fold rearward, glass tilt
    easing.damp(a.mirror, 'l', A.mirror_left ? 1.25 : 0, 0.35, dt)
    easing.damp(a.mirror, 'r', A.mirror_right ? 1.25 : 0, 0.35, dt)
    if (refs.mirror.l.current) refs.mirror.l.current.rotation.y = a.mirror.l
    if (refs.mirror.r.current) refs.mirror.r.current.rotation.y = a.mirror.r
    const mt = s.mirrorTilt
    easing.damp(a.glass, 'lx', mt.left.x * 0.26, 0.15, dt)
    easing.damp(a.glass, 'ly', mt.left.y * 0.26, 0.15, dt)
    easing.damp(a.glass, 'rx', mt.right.x * 0.26, 0.15, dt)
    easing.damp(a.glass, 'ry', mt.right.y * 0.26, 0.15, dt)
    if (refs.mirrorGlass.l.current) refs.mirrorGlass.l.current.rotation.set(a.glass.lx, a.glass.ly, 0)
    if (refs.mirrorGlass.r.current) refs.mirrorGlass.r.current.rotation.set(a.glass.rx, a.glass.ry, 0)

    // Wipers: smooth back-and-forth sweep, park when switched off
    if (A.wiper_front_left || A.wiper_front_right) {
      a.phase += dt * (FRONT_WIPER_RATES[s.wiperSpeed] ?? 1.9)
      a.wipe.a = (1 - Math.cos(a.phase)) / 2
    } else {
      a.phase = 0
      easing.damp(a.wipe, 'a', 0, 0.25, dt)
    }
    if (A.wiper_rear) {
      a.rearPhase += dt * (REAR_WIPER_RATES[s.rearWiperSpeed] ?? 1.4)
      a.wipe.rear = (1 - Math.cos(a.rearPhase)) / 2
    } else {
      a.rearPhase = 0
      easing.damp(a.wipe, 'rear', 0, 0.25, dt)
    }
    if (refs.wiper.a.current) refs.wiper.a.current.rotation.z = a.wipe.a * 1.36
    if (refs.wiper.b.current) refs.wiper.b.current.rotation.z = a.wipe.a * 1.5
    if (refs.wiper.rear.current) refs.wiper.rear.current.rotation.z = a.wipe.rear * 1.6

    // Lighting
    const night = !s.isDayMode
    const hl = s.headlightMode
    easing.damp(a, 'drl', hl === 'off' ? 0.04 : night ? 9 : 7, 0.12, dt)
    easing.damp(a, 'led', hl === 'high' ? 26 : hl === 'drl' ? (night ? 3 : 1.2) : 0, 0.12, dt)
    easing.damp(a, 'spot', hl === 'high' ? 60 : hl === 'drl' && night ? 14 : 0, 0.15, dt)
    M.lights.drl.emissiveIntensity = a.drl
    M.lights.led.emissiveIntensity = a.led
    if (refs.spotL.current) refs.spotL.current.intensity = a.spot
    if (refs.spotR.current) refs.spotR.current.intensity = a.spot

    const tailOn = A.taillight_l || A.taillight_r
    const idle = night ? 1.4 : 0.3
    let tl = idle
    let tr = idle
    if (tailOn) {
      const t = state.clock.elapsedTime
      if (s.brakeLightMode === 'pulse') {
        tl = tr = 2 + 6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3))
      } else if (s.brakeLightMode === 'sequential') {
        const ph = (t % 0.9) / 0.9
        tl = ph < 0.5 ? 1 + 7 * Math.min(1, ph * 2.4) : 8
        tr = ph < 0.5 ? 1 : 1 + 7 * Math.min(1, (ph - 0.5) * 2.4)
      } else {
        tl = tr = 8
      }
    }
    easing.damp(a, 'tailL', tl, 0.06, dt)
    easing.damp(a, 'tailR', tr, 0.06, dt)
    tailMats.l.emissiveIntensity = a.tailL
    tailMats.r.emissiveIntensity = a.tailR
    M.lights.tailOutline.emissiveIntensity = night ? 0.9 : 0.15

    easing.damp(a, 'fog', A.foglight_l || A.foglight_r ? 7 : 0, 0.1, dt)
    easing.damp(a, 'rearFog', A.foglight_rear ? 9 : 0, 0.1, dt)
    M.lights.fog.emissiveIntensity = a.fog
    M.lights.rearFog.emissiveIntensity = a.rearFog
    M.lights.reflector.emissiveIntensity = night ? 0.35 : 0.04
    M.lights.plateLamp.emissiveIntensity = night ? 1.5 : 0
  })

  // ── Interaction: click (not drag) on any named part → hotspot ────────────
  const hovered = useRef(null)
  const findPart = (o) => {
    while (o && !EXTERIOR_MESH_TO_HOTSPOT[o.name]) o = o.parent
    return o
  }
  const onClick = (e) => {
    if (useCarState.getState().activeView !== 'exterior' || e.delta > 6) return
    const part = findPart(e.object)
    if (!part) return
    e.stopPropagation()
    const key = EXTERIOR_MESH_TO_HOTSPOT[part.name]
    setActiveHotspot(key)
    flyTo(key)
  }
  const onMove = (e) => {
    if (useCarState.getState().activeView !== 'exterior') return
    const part = findPart(e.object)
    const name = part ? part.name : null
    if (name !== hovered.current) {
      hovered.current = name
      document.body.style.cursor = name ? 'pointer' : 'auto'
      useCarState.getState().setHoveredMesh(name)
    }
  }
  const onOut = () => {
    if (hovered.current) {
      hovered.current = null
      document.body.style.cursor = 'auto'
      useCarState.getState().setHoveredMesh(null)
    }
  }

  const shellMats = (names) => names.map((n) => ({ paint: M.paint, black: M.blackPlastic, cowl: M.cowl })[n])
  const hoodMats = useMemo(() => [M.paint, M.panelInner, M.paint, M.paint, M.paint, M.paint], [M])
  const wheelZ = [CAR.axleF, CAR.axleR]

  return (
    <group name="vehicle" onClick={onClick} onPointerMove={onMove} onPointerOut={onOut}>
      <Bvh firstHitOnly>
        {/* Body shell, split into named parts for hotspot picking */}
        {Object.entries(car.shell).map(([part, { geometry, materials }]) => (
          <mesh key={part} name={part} geometry={geometry} material={shellMats(materials)} castShadow receiveShadow />
        ))}
        <mesh geometry={car.ghPaint} material={M.paint} castShadow />
        <mesh geometry={car.archBody} material={M.paint} />
        <mesh geometry={car.roofMould} material={M.blackGloss} />
        <mesh geometry={car.srFrame} material={M.underbody} />
        <mesh geometry={car.windshield} material={M.glassFrit} renderOrder={3} />
        <mesh geometry={car.rearGlass} material={M.glassFrit} renderOrder={3} />

        {/* Doors */}
        {DOOR_KEYS.map((k) => (
          <Door
            key={k}
            k={k}
            d={car.doors[k]}
            doorRef={refs.door[k]}
            windowRef={refs.win[k]}
            windowMat={windowMats[k]}
            mirrorRef={k === 'fl' ? refs.mirror.l : k === 'fr' ? refs.mirror.r : undefined}
            mirrorGlassRef={k === 'fl' ? refs.mirrorGlass.l : k === 'fr' ? refs.mirrorGlass.r : undefined}
            frame={k === 'fl' ? car.mirrors.l : car.mirrors.r}
          />
        ))}

        {/* Hood */}
        <group ref={refs.hood} name="bonnet" position={car.hood.hinge}>
          <group position={car.hood.hinge.clone().negate()}>
            <mesh geometry={car.hood.geometry} material={hoodMats} castShadow receiveShadow />
          </group>
        </group>

        {/* Boot lid */}
        <group ref={refs.boot} name="boot" position={car.boot.hinge}>
          <group position={car.boot.hinge.clone().negate()}>
            <mesh geometry={car.boot.geometry} material={hoodMats} castShadow receiveShadow />
            <mesh geometry={car.spoiler} material={M.paint} castShadow />
          </group>
        </group>

        {/* Sunroof glass panel */}
        <group ref={refs.sun} name="roof" position={car.sunroof.hinge}>
          <group position={car.sunroof.hinge.clone().negate()}>
            <mesh geometry={car.sunroof.geometry} material={M.glassFrit} renderOrder={3} />
          </group>
        </group>

        {/* Front fascia */}
        <Headlight h={car.headlights.l} name="headlight_l" />
        <Headlight h={car.headlights.r} name="headlight_r" />
        {/* Gloss-black Matrix-Mesh grille + lower honeycomb intake */}
        <mesh geometry={car.grille.housing} material={M.grilleBack} />
        <mesh geometry={car.grille.walls} material={M.blackPlastic} />
        <Honeycomb cells={car.grille.cells} material={M.blackGloss} />
        <mesh geometry={car.grille.lowerHousing} material={M.grilleBack} />
        <mesh geometry={car.grille.lowerWalls} material={M.blackPlastic} />
        <Honeycomb cells={car.grille.lowerCells} material={M.blackGloss} />
        {/* Connected "Blade-Eye" LED light bar across the nose */}
        <mesh geometry={car.grille.barChannel} material={M.blackGloss} />
        <mesh geometry={car.grille.bar} material={M.lights.drl} />
        <Badge frame={car.grille.logo} ring={S.logoRing} badge={S.logoBadge} offset={0.01} />
        <mesh geometry={S.radar} material={M.blackGloss} position={car.grille.radar.position} quaternion={faceQuat(car.grille.radar.normal)} />
        <FogLamp f={car.fogs.l} name="foglight_l" />
        <FogLamp f={car.fogs.r} name="foglight_r" />
        <Plate frame={car.plates.front} material={M.plateFront} />

        {/* Rear fascia */}
        <Taillight t={car.taillights.l} name="taillight_l" guideMat={tailMats.l} />
        <Taillight t={car.taillights.r} name="taillight_r" guideMat={tailMats.r} />
        <mesh geometry={car.reflectors} material={M.lights.reflector} />
        <mesh geometry={car.rearFog} material={M.lights.rearFog} name="foglight_rear" />
        <Plate frame={car.plates.rear} material={M.plateRear} />
        <Badge frame={car.rearBadge} ring={S.smallRing} badge={S.smallBadge} offset={0.008} />
        <mesh position={car.cityBadge.position.clone().addScaledVector(car.cityBadge.normal, 0.003)} quaternion={faceQuat(car.cityBadge.normal)}>
          <planeGeometry args={[0.15, 0.0375]} />
          <meshStandardMaterial map={cityTexture()} alphaTest={0.4} transparent metalness={1} roughness={0.12} color="#e8ecf0" />
        </mesh>

        {/* Parking sensors */}
        {car.sensors.map((f, i) => (
          <mesh key={i} geometry={S.sensor} material={M.paint} position={f.position} quaternion={yQuat(f.normal)} />
        ))}

        {/* Shark-fin antenna */}
        <mesh geometry={S.fin} material={M.blackGloss} position={car.fin.position} castShadow />

        {/* ADAS camera module behind the windshield header */}
        <group name="adas_camera" position={car.adas.position.clone().addScaledVector(car.adas.normal, -0.03)} quaternion={faceQuat(car.adas.normal)}>
          <mesh material={M.blackPlastic}>
            <boxGeometry args={[0.15, 0.07, 0.04]} />
          </mesh>
          <mesh material={M.blackGloss} position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.01, 24]} />
          </mesh>
          <mesh material={M.lights.adasLed} position={[0.05, 0, 0.021]}>
            <sphereGeometry args={[0.004, 10, 8]} />
          </mesh>
        </group>

        {/* Wipers */}
        <WiperArm name="wiper_front_right" wiperRef={refs.wiper.a} pivot={car.wipers.a} normal={car.wipers.normal} length={0.5} blade={0.56} />
        <WiperArm name="wiper_front_left" wiperRef={refs.wiper.b} pivot={car.wipers.b} normal={car.wipers.normal} length={0.42} blade={0.42} />
        <WiperArm name="wiper_rear" wiperRef={refs.wiper.rear} pivot={car.wipers.rear} normal={car.wipers.rearNormal} length={0.3} blade={0.32} />

        {/* Wheels */}
        {wheelZ.map((z) => [1, -1].map((side) => (
          <group key={`${z}-${side}`}>
            <Wheel position={[side * CAR.wheelX, CAR.tireR, z]} side={side} style={selectedWheel} />
            <WheelTub z={z} side={side} />
          </group>
        )))}
      </Bvh>

      <Cavities />

      {/* Headlamp beams (no shadows — cheap) */}
      <primitive object={spotTargets.l} />
      <primitive object={spotTargets.r} />
      <spotLight ref={refs.spotL} position={car.headlights.l.centre.position.toArray()} target={spotTargets.l}
        color="#eaf2ff" intensity={0} angle={0.42} penumbra={0.7} distance={18} decay={1.6} />
      <spotLight ref={refs.spotR} position={car.headlights.r.centre.position.toArray()} target={spotTargets.r}
        color="#eaf2ff" intensity={0} angle={0.42} penumbra={0.7} distance={18} decay={1.6} />
    </group>
  )
}
