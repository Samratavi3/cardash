import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { useCarState } from '../hooks/useCarState'
import { flyTo } from '../hooks/useCameraRig'
import { useSoundFX } from '../hooks/useSoundFX'
import { INTERIOR_MESH_TO_HOTSPOT as MESH_TO_HOTSPOT } from '../constants/hotspots'
import { getInteriorMaterials } from '../three/interiorMaterials'
import { buildCabinShell } from '../three/buildCar'
import { dashboardGeometry, seatGeometry, benchGeometry, steeringGeometry, ventGeometry, rbox, DASH_HALF_W } from '../three/interiorGeometry'
import { makeClusterTexture, makeInfotainmentTexture, makeClimateTexture } from '../three/screens'
import { hBadgeGeometry } from '../three/wheelGeometry'

// Cabin layout (real-scale metres). RHD: the driver sits on the −X side.
export const CABIN = {
  floorY: 0.3,
  driverX: -0.37,
  frontSeatZ: -0.2,
  rearSeatZ: -0.86,
  wheel: new THREE.Vector3(-0.37, 0.955, 0.37),
}

// ── Click wrapper (interior view only) ──────────────────────────────────────
function InteriorMesh({ name, children, ...props }) {
  const setActiveHotspot = useCarState((s) => s.setActiveHotspot)
  const setPanoramaMode = useCarState((s) => s.setPanoramaMode)
  const activeView = useCarState((s) => s.activeView)
  const { playUIOpen } = useSoundFX()
  const hotspotKey = MESH_TO_HOTSPOT[name]
  const interactive = hotspotKey && activeView === 'interior'
  return (
    <group
      name={name}
      {...props}
      onClick={interactive ? (e) => {
        if (e.delta > 6) return
        e.stopPropagation()
        playUIOpen()
        setPanoramaMode(false)
        setActiveHotspot(hotspotKey)
        flyTo(hotspotKey)
      } : undefined}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'auto' } : undefined}
    >
      {children}
    </group>
  )
}

// ── Air vent ────────────────────────────────────────────────────────────────
function Vent({ name, position, w = 0.11, h = 0.05, rotation }) {
  const IM = getInteriorMaterials()
  const g = useMemo(() => ventGeometry(w, h), [w, h])
  return (
    <InteriorMesh name={name} position={position} rotation={rotation}>
      <mesh geometry={g.frame} material={IM.satin} />
      <mesh geometry={g.recess} material={IM.vent} position={[0, 0, -0.006]} />
      {Array.from({ length: g.count }, (_, i) => (
        <mesh key={i} geometry={g.vane} material={IM.pianoBlack}
          position={[0, -h / 2 + ((i + 0.5) * h) / g.count, -0.012]} rotation={[0.25, 0, 0]} />
      ))}
    </InteriorMesh>
  )
}

// Round eyeball-style side vent with horizontal vanes, facing −Z
function RoundVent({ name, position }) {
  const IM = getInteriorMaterials()
  const g = useMemo(() => {
    const ring = new THREE.TorusGeometry(0.04, 0.007, 12, 40)
    const disc = new THREE.CircleGeometry(0.04, 32)
    disc.rotateY(Math.PI)
    return { ring, disc, vane: rbox(0.07, 0.004, 0.012, 0.0015, 2) }
  }, [])
  return (
    <InteriorMesh name={name} position={position}>
      <mesh geometry={g.ring} material={IM.satin} />
      <mesh geometry={g.disc} material={IM.vent} position={[0, 0, 0.004]} />
      {[-0.018, 0, 0.018].map((y) => (
        <mesh key={y} geometry={g.vane} material={IM.pianoBlack} position={[0, y, -0.002]} scale={[Math.sqrt(1 - (y / 0.04) ** 2), 1, 1]} rotation={[0.25, 0, 0]} />
      ))}
    </InteriorMesh>
  )
}

// ── Front seat ──────────────────────────────────────────────────────────────
// Store slider values → seat pose (shared by the seat and its hotspot pin)
function seatPose({ foreAft = 50, height = 50, recline = 20 } = {}) {
  return {
    z: CABIN.frontSeatZ + (foreAft - 50) * 0.0036,
    y: (height - 50) * 0.0012,
    r: 0.18 + (recline / 100) * 0.42,
  }
}
const BACK_PIVOT = { y: 0.04, z: -0.22 }

/** World position of a seat's hotspot pin: the inboard shoulder of the
 *  backrest (visible from the rear-bench view), following fore/aft, height
 *  and recline. */
const _pin = new THREE.Vector3()
export function seatPinPosition(x, state) {
  const p = seatPose(state)
  const Y = 0.6
  const Z = -0.02
  const cy = Y * Math.cos(p.r) + Z * Math.sin(p.r)
  const cz = -Y * Math.sin(p.r) + Z * Math.cos(p.r)
  return _pin.set(x - Math.sign(x) * 0.15, CABIN.floorY + 0.2 + p.y + BACK_PIVOT.y + cy, p.z + BACK_PIVOT.z + cz)
}

function FrontSeat({ name, x, stateKey }) {
  const IM = getInteriorMaterials()
  const G = seatGeometry()
  const group = useRef()
  const back = useRef()
  const cur = useRef({ y: 0, z: CABIN.frontSeatZ, r: 0.3 })
  useFrame((_, dt) => {
    const t = seatPose(useCarState.getState()[stateKey])
    const c = cur.current
    easing.damp(c, 'z', t.z, 0.25, dt)
    easing.damp(c, 'y', t.y, 0.25, dt)
    easing.damp(c, 'r', t.r, 0.25, dt)
    if (group.current) group.current.position.set(x, CABIN.floorY + 0.2 + c.y, c.z)
    if (back.current) back.current.rotation.x = -c.r
  })
  return (
    <InteriorMesh name={name}>
      <group ref={group} position={[x, CABIN.floorY + 0.2, CABIN.frontSeatZ]}>
        {/* Base & rails */}
        <mesh geometry={G.base} material={IM.hardPlastic} position={[0, -0.09, 0.0]} />
        {[-0.16, 0.16].map((rx) => (
          <mesh key={rx} geometry={G.rail} material={IM.satin} position={[rx, -0.17, 0.02]} />
        ))}
        {/* Cushion */}
        <group rotation={[-0.09, 0, 0]}>
          <mesh geometry={G.cushion} material={IM.leatherDark} position={[0, 0, 0.02]} castShadow />
          <mesh geometry={G.cushionInsert} material={IM.perforated} position={[0, 0.058, 0.03]} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={G.cushionBolster} material={IM.leather} position={[sd * 0.2, 0.05, 0.02]} />
          ))}
        </group>
        {/* Backrest pivots at the rear of the cushion */}
        <group ref={back} position={[0, BACK_PIVOT.y, BACK_PIVOT.z]} rotation={[-0.3, 0, 0]}>
          <mesh geometry={G.back} material={IM.leatherDark} position={[0, 0.33, -0.03]} castShadow />
          <mesh geometry={G.backInsert} material={IM.perforated} position={[0, 0.31, 0.035]} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={G.backBolster} material={IM.leather} position={[sd * 0.205, 0.3, 0.02]} rotation={[0, -sd * 0.28, 0]} />
          ))}
          <mesh geometry={G.shoulder} material={IM.leather} position={[0, 0.6, -0.02]} />
          {[-0.08, 0.08].map((px) => (
            <mesh key={px} geometry={G.post} material={IM.satin} position={[px, 0.68, -0.03]} />
          ))}
          <mesh geometry={G.headrest} material={IM.leather} position={[0, 0.76, -0.02]} castShadow />
        </group>
      </group>
    </InteriorMesh>
  )
}

function RearBench() {
  const IM = getInteriorMaterials()
  const G = benchGeometry()
  return (
    <group position={[0, CABIN.floorY + 0.21, CABIN.rearSeatZ]}>
      <group rotation={[-0.06, 0, 0]}>
        <mesh geometry={G.cushion} material={IM.leatherDark} castShadow />
        {[-0.4, 0, 0.4].map((x) => (
          <mesh key={x} geometry={G.cushionInsert} material={IM.perforated} position={[x, 0.066, 0.01]} />
        ))}
      </group>
      <group position={[0, 0.04, -0.24]} rotation={[-0.2, 0, 0]}>
        <mesh geometry={G.back} material={IM.leatherDark} position={[0, 0.27, -0.04]} castShadow />
        {[-0.4, 0, 0.4].map((x) => (
          <mesh key={x} geometry={G.backInsert} material={IM.perforated} position={[x, 0.26, 0.03]} />
        ))}
        {[-0.4, 0, 0.4].map((x) => (
          <mesh key={x} geometry={G.headrest} material={IM.leather} position={[x, 0.5, -0.04]} />
        ))}
      </group>
    </group>
  )
}

// ── Steering wheel + column ─────────────────────────────────────────────────
function SteeringWheel() {
  const IM = getInteriorMaterials()
  const G = steeringGeometry()
  const badge = useMemo(() => hBadgeGeometry(0.034), [])
  const ref = useRef()
  const cur = useRef({ tilt: 0, reach: 0 })
  useFrame((_, dt) => {
    const p = useCarState.getState().steeringPos
    easing.damp(cur.current, 'tilt', (p.tilt - 50) * 0.0011, 0.2, dt)
    easing.damp(cur.current, 'reach', (p.reach - 50) * 0.0011, 0.2, dt)
    if (ref.current) ref.current.position.set(CABIN.wheel.x, CABIN.wheel.y + cur.current.tilt, CABIN.wheel.z - cur.current.reach)
  })
  return (
    <InteriorMesh name="steering_wheel">
      <group ref={ref} position={CABIN.wheel}>
        <group rotation={[0.43, 0, 0]}>
          <mesh geometry={G.rim} material={IM.leatherDark} castShadow />
          <mesh geometry={G.hub} material={IM.softTouch} position={[0, -0.01, 0.02]} />
          <mesh geometry={badge} material={IM.chrome} position={[0, -0.005, -0.009]} rotation={[0, Math.PI, 0]} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh geometry={G.spoke} material={IM.softTouch} position={[sd * 0.12, -0.012, 0.018]} />
              <mesh geometry={G.paddle} material={IM.hardPlastic} position={[sd * 0.17, 0.045, 0.045]} rotation={[0, 0, sd * 0.2]} />
            </group>
          ))}
          <mesh geometry={G.lowerSpoke} material={IM.satin} position={[0, -0.11, 0.018]} />
          <mesh geometry={G.column} material={IM.softTouch} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={G.stalk} material={IM.hardPlastic} position={[sd * 0.1, -0.02, 0.12]} />
          ))}
        </group>
      </group>
    </InteriorMesh>
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ day }) {
  const IM = getInteriorMaterials()
  const dash = useMemo(() => dashboardGeometry(), [])
  const tex = useMemo(() => ({
    cluster: makeClusterTexture(),
    info: makeInfotainmentTexture(),
    climate: makeClimateTexture(),
  }), [])
  const screenMat = useMemo(() => ({
    cluster: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: tex.cluster, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0 }),
    info: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: tex.info, emissiveIntensity: 1.2, roughness: 0.18, metalness: 0 }),
    climate: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: tex.climate, emissiveIntensity: 1.1, roughness: 0.3 }),
  }), [tex])
  useEffect(() => () => {
    Object.values(tex).forEach((t) => t.dispose())
    Object.values(screenMat).forEach((m) => m.dispose())
  }, [tex, screenMat])
  useEffect(() => {
    screenMat.cluster.emissiveIntensity = day ? 1.35 : 0.95
    screenMat.info.emissiveIntensity = day ? 1.3 : 0.9
  }, [day, screenMat])
  const geo = useMemo(() => ({
    // 10.1" floating touchscreen (2026)
    screenBezel: rbox(0.258, 0.162, 0.022, 0.012),
    screen: new THREE.PlaneGeometry(0.232, 0.136),
    screenChin: rbox(0.12, 0.022, 0.03, 0.008),
    ventBand: rbox(0.52, 0.088, 0.03, 0.016),
    hazard: rbox(0.05, 0.02, 0.012, 0.006),
    clusterHood: rbox(0.36, 0.05, 0.13, 0.024),
    clusterBack: rbox(0.33, 0.13, 0.03, 0.012),
    cluster: new THREE.PlaneGeometry(0.3, 0.1125),
    climatePanel: rbox(0.32, 0.075, 0.02, 0.012),
    climate: new THREE.PlaneGeometry(0.17, 0.026),
    knob: new THREE.CylinderGeometry(0.019, 0.02, 0.02, 32),
    trim: rbox(DASH_HALF_W * 2 - 0.06, 0.012, 0.012, 0.005),
    glovebox: rbox(0.36, 0.008, 0.008, 0.003),
  }), [])
  return (
    <group>
      <mesh geometry={dash.upper} material={IM.softTouch} castShadow receiveShadow />
      <mesh geometry={dash.lower} material={IM.softBeige} receiveShadow />
      {/* Satin trim line splitting the two tones */}
      <mesh geometry={geo.trim} material={IM.satin} position={[0, 0.928, 0.592]} />
      <mesh geometry={geo.glovebox} material={IM.hardPlastic} position={[0.38, 0.8, 0.607]} />

      {/* Instrument cluster (driver side) */}
      <InteriorMesh name="instrument_cluster" position={[CABIN.driverX, 1.022, 0.566]}>
        <mesh geometry={geo.clusterHood} material={IM.softTouch} position={[0, 0.074, 0.01]} />
        <mesh geometry={geo.clusterBack} material={IM.pianoBlack} position={[0, 0, 0.022]} rotation={[0.12, 0, 0]} />
        <mesh geometry={geo.cluster} material={screenMat.cluster} position={[0, 0, 0.005]} rotation={[0.12, Math.PI, 0]} />
      </InteriorMesh>

      {/* Centre stack (2026): piano-black vent band with a horizontal vent each
          side of the floating 10.1" touchscreen, hazard switch underneath */}
      <mesh geometry={geo.ventBand} material={IM.pianoBlack} position={[0.04, 0.975, 0.574]} />
      <Vent name="ac_vent_c" position={[-0.15, 0.975, 0.558]} w={0.092} h={0.05} />
      <Vent name="ac_vent_c" position={[0.23, 0.975, 0.558]} w={0.092} h={0.05} />
      <InteriorMesh name="screen_main" position={[0.04, 1.045, 0.545]}>
        <mesh geometry={geo.screenChin} material={IM.pianoBlack} position={[0, -0.085, 0.012]} />
        <group rotation={[0.12, 0, 0]}>
          <mesh geometry={geo.screenBezel} material={IM.pianoBlack} />
          <mesh geometry={geo.screen} material={screenMat.info} position={[0, 0.002, -0.0115]} rotation={[0, Math.PI, 0]} />
        </group>
      </InteriorMesh>
      <mesh geometry={geo.hazard} material={IM.pianoBlack} position={[0.04, 0.912, 0.572]} />
      <mesh position={[0.04, 0.912, 0.565]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0065, 0.0065, 0.002, 3]} />
        <meshStandardMaterial color="#d61f1f" emissive="#ff2a2a" emissiveIntensity={0.6} />
      </mesh>
      {/* Round side vents at the dash ends */}
      <RoundVent name="ac_vent_l" position={[-0.665, 0.955, 0.585]} />
      <RoundVent name="ac_vent_r" position={[0.665, 0.955, 0.585]} />

      {/* Climate panel: three knobs around a digital strip */}
      <group position={[0.04, 0.84, 0.574]} rotation={[-0.12, 0, 0]}>
        <mesh geometry={geo.climatePanel} material={IM.pianoBlack} />
        <mesh geometry={geo.climate} material={screenMat.climate} position={[0, 0.018, -0.0105]} rotation={[0, Math.PI, 0]} />
        {[-0.11, 0, 0.11].map((kx) => (
          <mesh key={kx} geometry={geo.knob} material={IM.satin} position={[kx, -0.012, -0.016]} rotation={[Math.PI / 2, 0, 0]} />
        ))}
      </group>

      {/* Dash ambient underline (passenger side) — clickable ambient hotspot */}
      <InteriorMesh name="ambient_strip">
        <mesh material={IM.ambient} position={[0.47, 0.925, 0.598]}>
          <boxGeometry args={[0.34, 0.005, 0.005]} />
        </mesh>
      </InteriorMesh>
    </group>
  )
}

// ── Centre console ──────────────────────────────────────────────────────────
function Console() {
  const IM = getInteriorMaterials()
  const g = useMemo(() => ({
    stack: rbox(0.24, 0.3, 0.2, 0.03),
    tunnel: rbox(0.24, 0.2, 0.86, 0.04),
    top: rbox(0.2, 0.012, 0.55, 0.005),
    boot: new THREE.CylinderGeometry(0.025, 0.05, 0.05, 24),
    lever: new THREE.CylinderGeometry(0.012, 0.014, 0.1, 12),
    knob: rbox(0.05, 0.075, 0.07, 0.022),
    cup: new THREE.CylinderGeometry(0.038, 0.034, 0.02, 32),
    arm: rbox(0.2, 0.08, 0.32, 0.035),
    pad: rbox(0.12, 0.004, 0.16, 0.002),
    epb: rbox(0.03, 0.012, 0.04, 0.005),
  }), [])
  const y = CABIN.floorY
  return (
    <group>
      <mesh geometry={g.stack} material={IM.softBeige} position={[0, y + 0.29, 0.6]} />
      <mesh geometry={g.tunnel} material={IM.softTouch} position={[0, y + 0.1, 0.12]} castShadow />
      <mesh geometry={g.top} material={IM.pianoBlack} position={[0, y + 0.205, 0.18]} />
      {/* CVT shifter */}
      <mesh geometry={g.boot} material={IM.leatherDark} position={[0, y + 0.235, 0.33]} />
      <mesh geometry={g.lever} material={IM.satin} position={[0, y + 0.3, 0.33]} />
      <mesh geometry={g.knob} material={IM.leatherDark} position={[0, y + 0.37, 0.335]} rotation={[0.25, 0, 0]} />
      {/* Wireless charger pad + cup holders + EPB */}
      <mesh geometry={g.pad} material={IM.rubber} position={[0, y + 0.213, 0.5]} />
      {[-0.045, 0.045].map((cx) => (
        <mesh key={cx} geometry={g.cup} material={IM.vent} position={[cx, y + 0.206, 0.12]} />
      ))}
      <mesh geometry={g.epb} material={IM.satin} position={[-0.06, y + 0.215, 0.24]} />
      <mesh geometry={g.arm} material={IM.leatherDark} position={[0, y + 0.25, -0.2]} />
      <mesh material={IM.ambient} position={[0, y + 0.012, 0.15]}>
        <boxGeometry args={[0.245, 0.004, 0.8]} />
      </mesh>
    </group>
  )
}

// ── Roof hardware: mirror, visors, overhead console ─────────────────────────
function RoofHardware({ day }) {
  const IM = getInteriorMaterials()
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff7e6', emissive: '#ffe9c2', emissiveIntensity: 0, roughness: 0.4 }), [])
  useEffect(() => { lamp.emissiveIntensity = day ? 0 : 1.6 }, [day, lamp])
  useEffect(() => () => lamp.dispose(), [lamp])
  const g = useMemo(() => ({
    mirror: rbox(0.25, 0.068, 0.035, 0.03),
    mirrorGlass: rbox(0.235, 0.055, 0.004, 0.024),
    stem: new THREE.CylinderGeometry(0.008, 0.01, 0.07, 10),
    visor: rbox(0.36, 0.16, 0.022, 0.02),
    console: rbox(0.28, 0.035, 0.16, 0.015),
    lens: rbox(0.06, 0.006, 0.04, 0.0025),
    button: rbox(0.04, 0.006, 0.022, 0.002),
    handle: rbox(0.18, 0.025, 0.03, 0.012),
  }), [])
  return (
    <group>
      <group position={[0, 1.315, 0.22]}>
        <mesh geometry={g.stem} material={IM.hardPlastic} position={[0, 0.05, 0.03]} rotation={[0.5, 0, 0]} />
        <mesh geometry={g.mirror} material={IM.hardPlastic} />
        <mesh geometry={g.mirrorGlass} material={IM.mirror} position={[0, 0, -0.017]} />
      </group>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} geometry={g.visor} material={IM.headliner} position={[x, 1.39, 0.06]} rotation={[1.35, 0, 0]} />
      ))}
      <InteriorMesh name="overhead_console" position={[0, 1.41, -0.02]}>
        <mesh geometry={g.console} material={IM.softBeige} />
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} geometry={g.lens} material={lamp} position={[x, -0.018, 0.01]} />
        ))}
        <mesh geometry={g.button} material={IM.pianoBlack} position={[0, -0.018, -0.05]} />
      </InteriorMesh>
      {[[0.66, 1.33, 0.0], [0.66, 1.3, -0.82], [-0.66, 1.3, -0.82]].map(([x, y, z], i) => (
        <mesh key={i} geometry={g.handle} material={IM.softBeige} position={[x, y, z]} rotation={[0, Math.PI / 2, Math.sign(x) * 0.5]} />
      ))}
    </group>
  )
}

// ── Floor, firewall, bulkhead, pedals, B-pillars ────────────────────────────
function Structure() {
  const IM = getInteriorMaterials()
  const y = CABIN.floorY
  return (
    <group>
      <mesh material={IM.carpet} position={[0, y - 0.03, -0.15]} receiveShadow>
        <boxGeometry args={[1.56, 0.06, 2.3]} />
      </mesh>
      {/* Toe board / firewall */}
      <mesh material={IM.carpet} position={[0, y + 0.17, 0.97]} rotation={[-0.62, 0, 0]}>
        <boxGeometry args={[1.5, 0.5, 0.03]} />
      </mesh>
      {/* Floor mats */}
      {[[-0.37, 0.52], [0.37, 0.52], [-0.37, -0.52], [0.37, -0.52]].map(([x, z], i) => (
        <mesh key={i} material={IM.rubber} position={[x, y + 0.004, z]} receiveShadow>
          <boxGeometry args={[0.46, 0.006, i < 2 ? 0.55 : 0.4]} />
        </mesh>
      ))}
      {/* Rear bulkhead + parcel shelf */}
      <mesh material={IM.softTouch} position={[0, 0.65, -1.26]}>
        <boxGeometry args={[1.5, 0.7, 0.04]} />
      </mesh>
      <mesh material={IM.softTouch} position={[0, 1.02, -1.36]}>
        <boxGeometry args={[1.5, 0.025, 0.24]} />
      </mesh>
      {/* Rear wheel-house covers */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} material={IM.softTouch} position={[sd * 0.7, 0.48, -1.12]}>
          <boxGeometry args={[0.16, 0.36, 0.3]} />
        </mesh>
      ))}
      {/* B-pillar trims (leaning with the tumblehome) */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh material={IM.softTouch} position={[sd * 0.775, 0.62, -0.235]}>
            <boxGeometry args={[0.05, 0.62, 0.1]} />
          </mesh>
          <mesh material={IM.pillarTrim} position={[sd * 0.7, 1.15, -0.235]} rotation={[0, 0, sd * 0.46]}>
            <boxGeometry args={[0.04, 0.5, 0.1]} />
          </mesh>
        </group>
      ))}
      {/* Pedals (driver side) */}
      <mesh material={IM.satin} position={[CABIN.driverX + 0.07, y + 0.13, 0.84]} rotation={[-0.75, 0, 0]}>
        <boxGeometry args={[0.07, 0.12, 0.012]} />
      </mesh>
      <mesh material={IM.rubber} position={[CABIN.driverX - 0.1, y + 0.14, 0.82]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.1, 0.07, 0.015]} />
      </mesh>
    </group>
  )
}

// ── Interior ────────────────────────────────────────────────────────────────
export default function InteriorModel() {
  const { gl } = useThree()
  const IM = getInteriorMaterials()
  const shell = useMemo(() => buildCabinShell(), [])
  const isDayMode = useCarState((s) => s.isDayMode)
  const ambientColor = useCarState((s) => s.ambientColor)
  const ambientBrightness = useCarState((s) => s.ambientBrightness)
  const footRef = useRef()

  // Ambient LED strips share one emissive material
  useEffect(() => {
    IM.ambient.emissive.set(ambientColor)
    IM.ambient.emissiveIntensity = (ambientBrightness / 100) * (isDayMode ? 2.2 : 4.5)
    if (footRef.current) {
      footRef.current.color.set(ambientColor)
      footRef.current.intensity = (ambientBrightness / 100) * (isDayMode ? 0.15 : 0.6)
    }
  }, [IM, ambientColor, ambientBrightness, isDayMode])

  useEffect(() => {
    const canvas = gl.domElement
    const reset = () => { document.body.style.cursor = 'auto' }
    canvas.addEventListener('pointerleave', reset)
    return () => canvas.removeEventListener('pointerleave', reset)
  }, [gl])

  return (
    <group name="interior">
      <mesh geometry={shell.headliner} material={IM.headliner} />
      <mesh geometry={shell.sideTrim} material={IM.softTouch} />
      <Structure />
      <Dashboard day={isDayMode} />
      <Console />
      <SteeringWheel />
      <FrontSeat name="seat_driver" x={CABIN.driverX} stateKey="seatDriver" />
      <FrontSeat name="seat_passenger" x={-CABIN.driverX} stateKey="seatPassenger" />
      <RearBench />
      <RoofHardware day={isDayMode} />
      {/* Clickable ambient strip on the passenger side of the dash */}
      <InteriorMesh name="ambient_strip" position={[0, 0.925, 0.598]}>
        <mesh material={IM.ambient} position={[-0.42, 0, 0]}>
          <boxGeometry args={[0.5, 0.005, 0.005]} />
        </mesh>
      </InteriorMesh>
      <pointLight ref={footRef} position={[0, 0.42, 0.45]} distance={1.4} decay={2} intensity={0.2} color={ambientColor} />
      <pointLight position={[0, 1.3, -0.3]} distance={2.2} decay={2} intensity={isDayMode ? 0.0 : 0.35} color="#ffe2b8" />
    </group>
  )
}
