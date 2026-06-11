import { useMemo } from 'react'
import * as THREE from 'three'
import { useCarState } from '../hooks/useCarState'
import { flyTo } from '../hooks/useCameraRig'
import { useSoundFX } from '../hooks/useSoundFX'
import { INTERIOR_MESH_TO_HOTSPOT as MESH_TO_HOTSPOT } from '../constants/hotspots'

// Coordinate system: +X = right (passenger), +Y = up, +Z = front (dashboard)

// ── Material palette ───────────────────────────────────────────────────────────
const C = {
  headliner:     '#6a6878',
  soft_touch:    '#28263c',
  armrest:       '#201e2e',
  door_body:     '#1a1828',
  dash_body:     '#111118',
  seat_body:     '#1e1c2a',
  rear_wall:     '#141220',
  lower_trim:    '#0a0a14',
  pillar:        '#0d0c18',
  floor_base:    '#0e0c12',
  carpet:        '#1a1620',
  rear_mat:      '#130f1a',
  wood:          '#3c2810',
  chrome:        '#c8c8c8',
  dark_chrome:   '#303038',
  piano_black:   '#08080e',
  switch_panel:  '#0c0c18',
  seat_bolster:  '#15131e',
  seat_cushion:  '#252130',
  stitch:        '#5a50cc',
  stitch_e:      '#2c28aa',
}

// ── InteriorMesh ──────────────────────────────────────────────────────────────
function InteriorMesh({ name, children, position, rotation, scale }) {
  const setActiveHotspot = useCarState(s => s.setActiveHotspot)
  const setPanoramaMode  = useCarState(s => s.setPanoramaMode)
  const activeView       = useCarState(s => s.activeView)
  const { playUIOpen }   = useSoundFX()
  const hotspotKey  = MESH_TO_HOTSPOT[name]
  const interactive = hotspotKey && activeView === 'interior'

  function handleClick(e) {
    if (!interactive) return
    e.stopPropagation()
    playUIOpen()
    setPanoramaMode(false)
    setActiveHotspot(hotspotKey)
    flyTo(hotspotKey)
  }

  return (
    <group
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={interactive ? handleClick : undefined}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'auto' } : undefined}
    >
      {children}
    </group>
  )
}

// ── AC Vent ───────────────────────────────────────────────────────────────────
function AcVentGroup({ name, position }) {
  return (
    <InteriorMesh name={name} position={position}>
      <mesh>
        <boxGeometry args={[0.10, 0.055, 0.11]} />
        <meshStandardMaterial color={C.dash_body} metalness={0.45} roughness={0.5} />
      </mesh>
      {[-0.016, 0, 0.016].map((y, i) => (
        <mesh key={i} position={[0, y, 0.01]}>
          <boxGeometry args={[0.08, 0.008, 0.09]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.3} roughness={0.55} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.102, 0.057, 0.113]} />
        <meshStandardMaterial color="#00aaff" emissive="#004488"
          emissiveIntensity={0.35} transparent opacity={0.05} />
      </mesh>
    </InteriorMesh>
  )
}

// ── Grab handle (ceiling-mounted) ─────────────────────────────────────────────
function GrabHandle({ position }) {
  return (
    <group position={position}>
      {/* Horizontal bar */}
      <mesh>
        <boxGeometry args={[0.095, 0.016, 0.018]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.32} />
      </mesh>
      {/* Mount bracket tabs */}
      {[-0.042, 0.042].map((x, i) => (
        <mesh key={i} position={[x, 0.028, 0]}>
          <boxGeometry args={[0.014, 0.042, 0.018]} />
          <meshStandardMaterial color={C.soft_touch} roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ── Seat ──────────────────────────────────────────────────────────────────────
function Seat({ name, position }) {
  return (
    <InteriorMesh name={name} position={position}>
      {/* Base cushion */}
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.10, 0.52]} />
        <meshStandardMaterial color={C.seat_body} roughness={0.86} metalness={0} />
      </mesh>
      {/* Cushion top pad */}
      <mesh position={[0, 0.056, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.46]} />
        <meshStandardMaterial color={C.seat_cushion} roughness={0.90} metalness={0} />
      </mesh>
      {/* Seat back */}
      <mesh position={[0, 0.36, -0.23]} rotation={[-0.14, 0, 0]} castShadow>
        <boxGeometry args={[0.50, 0.70, 0.09]} />
        <meshStandardMaterial color={C.seat_body} roughness={0.86} metalness={0} />
      </mesh>
      {/* Back bolsters */}
      <mesh position={[ 0.23, 0.36, -0.23]} rotation={[-0.14, 0, 0]}>
        <boxGeometry args={[0.07, 0.52, 0.10]} />
        <meshStandardMaterial color={C.seat_bolster} roughness={0.86} />
      </mesh>
      <mesh position={[-0.23, 0.36, -0.23]} rotation={[-0.14, 0, 0]}>
        <boxGeometry args={[0.07, 0.52, 0.10]} />
        <meshStandardMaterial color={C.seat_bolster} roughness={0.86} />
      </mesh>
      {/* Base bolsters */}
      <mesh position={[ 0.26, 0.02, 0]} castShadow>
        <boxGeometry args={[0.04, 0.14, 0.44]} />
        <meshStandardMaterial color={C.seat_bolster} roughness={0.86} />
      </mesh>
      <mesh position={[-0.26, 0.02, 0]} castShadow>
        <boxGeometry args={[0.04, 0.14, 0.44]} />
        <meshStandardMaterial color={C.seat_bolster} roughness={0.86} />
      </mesh>
      {/* Headrest */}
      <mesh position={[0, 0.76, -0.25]} castShadow>
        <boxGeometry args={[0.30, 0.19, 0.11]} />
        <meshStandardMaterial color={C.seat_body} roughness={0.86} />
      </mesh>
      {/* Headrest posts */}
      {[-0.085, 0.085].map((x, i) => (
        <mesh key={i} position={[x, 0.58, -0.23]}>
          <cylinderGeometry args={[0.007, 0.007, 0.19, 6]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Stitching — back */}
      <mesh position={[0, 0.36, -0.183]}>
        <boxGeometry args={[0.005, 0.60, 0.004]} />
        <meshStandardMaterial color={C.stitch} emissive={C.stitch_e} emissiveIntensity={0.35} />
      </mesh>
      {/* Stitching — cushion */}
      <mesh position={[0, 0.063, 0.06]}>
        <boxGeometry args={[0.44, 0.003, 0.005]} />
        <meshStandardMaterial color={C.stitch} emissive={C.stitch_e} emissiveIntensity={0.35} />
      </mesh>
    </InteriorMesh>
  )
}

// ── Door panel (shared left/right via xSign) ──────────────────────────────────
function DoorPanel({ xSign, ambientColor, ambientEI, glassM }) {
  const x  = xSign * 0.83
  const xi = xSign
  return (
    <group>
      {/* Main body — Zone 3 */}
      <mesh position={[x, 0.86, 0.22]} castShadow>
        <boxGeometry args={[0.06, 1.36, 1.68]} />
        <meshStandardMaterial color={C.door_body} roughness={0.65} metalness={0.12} />
      </mesh>
      {/* Upper shelf — Zone 2 */}
      <mesh position={[x - xi * 0.002, 1.18, 0.22]}>
        <boxGeometry args={[0.056, 0.44, 1.40]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.42} metalness={0.08} />
      </mesh>
      {/* Walnut divider strip */}
      <mesh position={[x - xi * 0.002, 0.962, 0.22]}>
        <boxGeometry args={[0.056, 0.025, 1.45]} />
        <meshStandardMaterial color={C.wood} roughness={0.50} metalness={0.06} />
      </mesh>
      {/* Chrome accent line */}
      <mesh position={[xSign * 0.822, 0.90, 0.22]}>
        <boxGeometry args={[0.008, 0.014, 1.52]} />
        <meshStandardMaterial color={C.chrome} metalness={1} roughness={0.08} />
      </mesh>
      {/* Armrest */}
      <mesh position={[xSign * 0.800, 0.77, 0.40]}>
        <boxGeometry args={[0.08, 0.055, 0.44]} />
        <meshStandardMaterial color={C.armrest} roughness={0.48} metalness={0.16} />
      </mesh>
      {/* Pull handle */}
      <mesh position={[xSign * 0.798, 0.83, 0.56]}>
        <boxGeometry args={[0.058, 0.038, 0.13]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.72} roughness={0.20} />
      </mesh>
      {/* Window switch panel */}
      <mesh position={[xSign * 0.810, 0.705, 0.19]}>
        <boxGeometry args={[0.048, 0.038, 0.20]} />
        <meshStandardMaterial color={C.switch_panel} roughness={0.40} metalness={0.42} />
      </mesh>
      {[0, 0.065].map((dz, i) => (
        <mesh key={i} position={[xSign * 0.792, 0.705, 0.12 + dz]}>
          <boxGeometry args={[0.018, 0.016, 0.036]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.40} />
        </mesh>
      ))}
      {/* Speaker grille backing — lower front of door */}
      <mesh position={[x - xi * 0.002, 0.56, 0.72]}>
        <boxGeometry args={[0.046, 0.085, 0.22]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.40} />
      </mesh>
      {/* Grille louvres */}
      {[0, 0.022, 0.044, 0.066].map((dy, i) => (
        <mesh key={i} position={[x - xi * 0.001, 0.525 + dy, 0.72]}>
          <boxGeometry args={[0.044, 0.008, 0.18]} />
          <meshStandardMaterial color={C.piano_black} roughness={0.60} />
        </mesh>
      ))}
      {/* Ambient strip */}
      <InteriorMesh name="ambient_strip" position={[xSign * 0.802, 0.625, 0.22]}>
        <mesh>
          <boxGeometry args={[0.016, 0.020, 1.12]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={ambientEI} toneMapped={false} />
        </mesh>
      </InteriorMesh>
      {/* Window glass */}
      <mesh position={[xSign * 0.832, 1.23, 0.30]}>
        <boxGeometry args={[0.016, 0.50, 0.90]} />
        <primitive object={glassM} attach="material" />
      </mesh>
    </group>
  )
}

// ── InteriorModel ─────────────────────────────────────────────────────────────
export default function InteriorModel() {
  const isDayMode         = useCarState(s => s.isDayMode)
  const ambientColor      = useCarState(s => s.ambientColor)
  const ambientBrightness = useCarState(s => s.ambientBrightness)

  const glassM = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#8ab0c8', metalness: 0, roughness: 0.04,
    transmission: 0.88, thickness: 0.4, ior: 1.5,
    envMapIntensity: 2.0, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide,
  }), [])

  const ambientEI = (isDayMode ? 0.45 : 1.6) * (ambientBrightness / 100)

  // Transform aligns the interior to the exterior shell in world space:
  //   Y: scale 0.682 + offset 0.587 → floor at y≈0.70, headliner at y≈1.62
  //   Z: scale 0.583 + offset -0.404 → dash at z≈0.54, windshield at z≈0.675, rear wall at z≈-0.88
  return (
    <group scale={[1, 0.682, 0.583]} position={[0, 0.587, -0.404]}>

      {/* ── FLOOR ─────────────────────────────────────────────────────────── */}
      <mesh position={[0, 0.16, 0.40]} receiveShadow>
        <boxGeometry args={[1.68, 0.04, 2.52]} />
        <meshStandardMaterial color={C.floor_base} roughness={0.90} metalness={0} />
      </mesh>
      <mesh position={[0, 0.185, 0.40]}>
        <boxGeometry args={[1.62, 0.01, 2.46]} />
        <meshStandardMaterial color={C.carpet} roughness={1.0} metalness={0} />
      </mesh>
      <mesh position={[0, 0.187, -0.20]}>
        <boxGeometry args={[1.28, 0.005, 0.52]} />
        <meshStandardMaterial color={C.rear_mat} roughness={1.0} metalness={0} />
      </mesh>

      {/* ── HEADLINER — Zone 1 ────────────────────────────────────────────── */}
      <mesh position={[0, 1.52, 0.40]}>
        <boxGeometry args={[1.68, 0.04, 2.62]} />
        <meshStandardMaterial color={C.headliner} roughness={0.88} metalness={0} />
      </mesh>
      <mesh position={[0, 1.504, 0.40]}>
        <boxGeometry args={[0.055, 0.012, 2.42]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.55} metalness={0.25} />
      </mesh>

      {/* ── GRAB HANDLES ──────────────────────────────────────────────────── */}
      <GrabHandle position={[-0.72, 1.468, 0.85]} />
      <GrabHandle position={[ 0.72, 1.468, 0.85]} />
      <GrabHandle position={[-0.72, 1.468, -0.20]} />
      <GrabHandle position={[ 0.72, 1.468, -0.20]} />

      {/* ── SUN VISORS ────────────────────────────────────────────────────── */}
      <mesh position={[-0.52, 1.488, 1.63]} rotation={[0.20, 0, 0]}>
        <boxGeometry args={[0.42, 0.012, 0.24]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[ 0.52, 1.488, 1.63]} rotation={[0.20, 0, 0]}>
        <boxGeometry args={[0.42, 0.012, 0.24]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.55} metalness={0.08} />
      </mesh>

      {/* ── REAR WALL ─────────────────────────────────────────────────────── */}
      <mesh position={[0, 0.86, -0.82]} castShadow>
        <boxGeometry args={[1.68, 1.36, 0.06]} />
        <meshStandardMaterial color={C.rear_wall} roughness={0.80} metalness={0.06} />
      </mesh>
      <mesh position={[0, 1.11, -0.70]}>
        <boxGeometry args={[1.56, 0.03, 0.24]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.50} metalness={0.10} />
      </mesh>

      {/* ── REAR WINDOW GLASS ─────────────────────────────────────────────── */}
      <mesh position={[0, 1.12, -0.77]} rotation={[-0.40, 0, 0]}>
        <boxGeometry args={[1.45, 0.44, 0.016]} />
        <primitive object={glassM} attach="material" />
      </mesh>

      {/* ── DOOR PANELS ───────────────────────────────────────────────────── */}
      <DoorPanel xSign={-1} ambientColor={ambientColor} ambientEI={ambientEI} glassM={glassM} />
      <DoorPanel xSign={+1} ambientColor={ambientColor} ambientEI={ambientEI} glassM={glassM} />

      {/* ── B-PILLARS ─────────────────────────────────────────────────────── */}
      <mesh position={[-0.825, 0.86, -0.08]}>
        <boxGeometry args={[0.055, 1.36, 0.10]} />
        <meshStandardMaterial color={C.pillar} roughness={0.70} metalness={0.15} />
      </mesh>
      <mesh position={[0.825, 0.86, -0.08]}>
        <boxGeometry args={[0.055, 1.36, 0.10]} />
        <meshStandardMaterial color={C.pillar} roughness={0.70} metalness={0.15} />
      </mesh>

      {/* ── SEAT BELT ANCHORS at B-pillar bases ───────────────────────────── */}
      {[[-0.822, 0.42, -0.05], [0.822, 0.42, -0.05]].map(([bx, by, bz], i) => (
        <group key={i} position={[bx, by, bz]}>
          <mesh>
            <boxGeometry args={[0.018, 0.055, 0.022]} />
            <meshStandardMaterial color={C.chrome} metalness={1} roughness={0.06} />
          </mesh>
          <mesh position={[0, -0.036, 0]}>
            <boxGeometry args={[0.010, 0.010, 0.016]} />
            <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.40} />
          </mesh>
        </group>
      ))}

      {/* ── A-PILLARS ─────────────────────────────────────────────────────── */}
      <mesh position={[-0.81, 1.26, 1.52]} rotation={[0.38, 0, 0.10]}>
        <boxGeometry args={[0.055, 0.64, 0.09]} />
        <meshStandardMaterial color={C.pillar} roughness={0.70} metalness={0.10} />
      </mesh>
      <mesh position={[0.81, 1.26, 1.52]} rotation={[0.38, 0, -0.10]}>
        <boxGeometry args={[0.055, 0.64, 0.09]} />
        <meshStandardMaterial color={C.pillar} roughness={0.70} metalness={0.10} />
      </mesh>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      <mesh position={[0, 1.10, 1.62]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.30, 0.40]} />
        <meshStandardMaterial color={C.dash_body} roughness={0.60} metalness={0.22} />
      </mesh>
      <mesh position={[0, 1.24, 1.55]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[1.62, 0.06, 0.30]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.89, 1.61]}>
        <boxGeometry args={[1.65, 0.15, 0.08]} />
        <meshStandardMaterial color={C.lower_trim} roughness={0.75} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.002, 1.638]}>
        <boxGeometry args={[1.62, 0.026, 0.012]} />
        <meshStandardMaterial color={C.wood} roughness={0.48} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.988, 1.638]}>
        <boxGeometry args={[1.62, 0.008, 0.010]} />
        <meshStandardMaterial color={C.chrome} metalness={1} roughness={0.08} />
      </mesh>
      {/* Ambient underline strip */}
      <mesh position={[0.10, 0.99, 1.645]}>
        <boxGeometry args={[0.88, 0.007, 0.007]} />
        <meshStandardMaterial color={ambientColor} emissive={ambientColor}
          emissiveIntensity={ambientEI * 0.65} toneMapped={false} />
      </mesh>

      {/* ── INSTRUMENT CLUSTER HOOD / COWL ────────────────────────────────── */}
      <mesh position={[-0.365, 1.252, 1.572]} rotation={[-0.20, 0, 0]}>
        <boxGeometry args={[0.47, 0.062, 0.19]} />
        <meshStandardMaterial color={C.dash_body} roughness={0.55} metalness={0.22} />
      </mesh>
      <mesh position={[-0.365, 1.276, 1.558]}>
        <boxGeometry args={[0.44, 0.014, 0.14]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.42} metalness={0.08} />
      </mesh>

      {/* ── HVAC CONTROLS ─────────────────────────────────────────────────── */}
      <mesh position={[0.10, 0.972, 1.645]}>
        <boxGeometry args={[0.62, 0.052, 0.038]} />
        <meshStandardMaterial color={C.switch_panel} roughness={0.40} metalness={0.50} />
      </mesh>
      {[-0.18, 0.38].map((hx, i) => (
        <mesh key={i} position={[hx, 0.972, 1.662]}>
          <cylinderGeometry args={[0.020, 0.020, 0.014, 12]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.62} roughness={0.30} />
        </mesh>
      ))}

      {/* ── INSTRUMENT CLUSTER ────────────────────────────────────────────── */}
      <InteriorMesh name="instrument_cluster" position={[-0.365, 1.17, 1.610]}>
        {/* Bezel */}
        <mesh>
          <boxGeometry args={[0.44, 0.22, 0.04]} />
          <meshStandardMaterial color={C.piano_black} roughness={0.30} metalness={0.65} />
        </mesh>
        {/* Display surface */}
        <mesh position={[0, 0, 0.022]}>
          <boxGeometry args={[0.40, 0.18, 0.01]} />
          <meshStandardMaterial color="#001040" emissive="#0030a0"
            emissiveIntensity={isDayMode ? 0.6 : 1.0} toneMapped={false} />
        </mesh>
        {/* ── Cluster screen content ── */}
        {/* Speedometer arc — ~240° partial torus */}
        <mesh position={[-0.06, -0.008, 0.030]} rotation={[0, 0, Math.PI * 0.85]}>
          <torusGeometry args={[0.058, 0.004, 6, 36, Math.PI * 1.33]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        {/* Speed needle */}
        <mesh position={[-0.025, 0.012, 0.031]} rotation={[0, 0, -0.50]}>
          <boxGeometry args={[0.052, 0.0024, 0.002]} />
          <meshStandardMaterial color="#ff5050" emissive="#cc2020"
            emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        {/* Center pivot dot */}
        <mesh position={[-0.060, -0.008, 0.031]}>
          <cylinderGeometry args={[0.006, 0.006, 0.003, 10]} />
          <meshStandardMaterial color="#ccccdd" emissive="#666688" emissiveIntensity={0.5} />
        </mesh>
        {/* Digital readout patch */}
        <mesh position={[-0.060, -0.008, 0.031]}>
          <boxGeometry args={[0.040, 0.024, 0.001]} />
          <meshStandardMaterial color="#001844" roughness={0.4} />
        </mesh>
        {/* Right info panel — power bars */}
        <mesh position={[0.115, 0.00, 0.029]}>
          <boxGeometry args={[0.11, 0.13, 0.001]} />
          <meshStandardMaterial color="#020a1a" roughness={0.4} />
        </mesh>
        {[0.045, 0.020, -0.005, -0.030].map((py, i) => (
          <mesh key={i} position={[0.110, py, 0.030]}>
            <boxGeometry args={[0.055 + i * 0.008, 0.010, 0.001]} />
            <meshStandardMaterial
              color={i < 2 ? '#00cc44' : '#2244aa'}
              emissive={i < 2 ? '#004422' : '#111a44'}
              emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        ))}
        {/* Anti-glare coat */}
        <mesh position={[0, 0, 0.028]}>
          <boxGeometry args={[0.40, 0.18, 0.002]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.03}
            metalness={0.1} roughness={0} />
        </mesh>
      </InteriorMesh>

      {/* ── INFOTAINMENT SCREEN ───────────────────────────────────────────── */}
      <InteriorMesh name="screen_main" position={[0.10, 1.15, 1.630]}>
        {/* Bezel */}
        <mesh>
          <boxGeometry args={[0.46, 0.30, 0.032]} />
          <meshStandardMaterial color={C.piano_black} roughness={0.30} metalness={0.65} />
        </mesh>
        {/* Display surface */}
        <mesh position={[0, 0, 0.018]}>
          <boxGeometry args={[0.42, 0.26, 0.01]} />
          <meshStandardMaterial color="#030818" emissive="#001060"
            emissiveIntensity={isDayMode ? 0.8 : 1.3} toneMapped={false} />
        </mesh>
        {/* ── Infotainment screen content ── */}
        {/* Map background */}
        <mesh position={[0, 0.022, 0.021]}>
          <boxGeometry args={[0.40, 0.195, 0.001]} />
          <meshStandardMaterial color="#0a1830" roughness={0.4} />
        </mesh>
        {/* Road lanes */}
        {[[-0.08, 0.130], [0.00, 0.165], [0.07, 0.125]].map(([rx, rlen], i) => (
          <mesh key={i} position={[rx, 0.018, 0.022]} rotation={[0, 0, rx * 1.4]}>
            <boxGeometry args={[0.007, rlen, 0.001]} />
            <meshStandardMaterial color="#ccaa33" emissive="#886622"
              emissiveIntensity={0.55} toneMapped={false} />
          </mesh>
        ))}
        {/* Destination pin */}
        <mesh position={[0.055, 0.055, 0.022]}>
          <cylinderGeometry args={[0.007, 0.007, 0.014, 8]} />
          <meshStandardMaterial color="#ff3030" emissive="#aa0000"
            emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        {/* Bottom dock */}
        <mesh position={[0, -0.109, 0.021]}>
          <boxGeometry args={[0.40, 0.038, 0.001]} />
          <meshStandardMaterial color="#030c1c" roughness={0.3} />
        </mesh>
        {/* Dock app icons */}
        {[-0.12, -0.04, 0.04, 0.12].map((ix, i) => (
          <mesh key={i} position={[ix, -0.109, 0.022]}>
            <boxGeometry args={[0.028, 0.026, 0.001]} />
            <meshStandardMaterial
              color={['#0055cc', '#00aa33', '#cc3300', '#7722cc'][i]}
              emissive={['#001166', '#004411', '#661100', '#330066'][i]}
              emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        ))}
        {/* Anti-glare coat */}
        <mesh position={[0, 0, 0.024]}>
          <boxGeometry args={[0.42, 0.26, 0.002]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.04}
            metalness={0.1} roughness={0} />
        </mesh>
      </InteriorMesh>

      {/* ── AC VENTS ──────────────────────────────────────────────────────── */}
      <AcVentGroup name="ac_vent_l" position={[-0.365, 1.068, 1.640]} />
      <AcVentGroup name="ac_vent_c" position={[ 0.100, 1.068, 1.640]} />
      <AcVentGroup name="ac_vent_r" position={[ 0.440, 1.068, 1.640]} />

      {/* ── STEERING WHEEL ────────────────────────────────────────────────── */}
      <InteriorMesh name="steering_wheel" position={[-0.37, 1.12, 1.22]}>
        {/* Rim */}
        <mesh rotation={[Math.PI / 2 - 0.28, 0, 0]}>
          <torusGeometry args={[0.185, 0.023, 10, 40]} />
          <meshStandardMaterial color="#1a1824" roughness={0.55} metalness={0.18} />
        </mesh>
        {/* Spokes */}
        {[-0.072, 0.072].map((sx, i) => (
          <mesh key={i} position={[sx, -0.01, 0]} rotation={[Math.PI / 2 - 0.28, 0, 0]}>
            <boxGeometry args={[0.022, 0.155, 0.025]} />
            <meshStandardMaterial color={C.pillar} roughness={0.45} metalness={0.30} />
          </mesh>
        ))}
        {/* Center hub */}
        <mesh rotation={[Math.PI / 2 - 0.28, 0, 0]}>
          <cylinderGeometry args={[0.056, 0.056, 0.022, 16]} />
          <meshStandardMaterial color={C.piano_black} roughness={0.35} metalness={0.65} />
        </mesh>
        {/* H badge */}
        <mesh rotation={[Math.PI / 2 - 0.28, 0, 0]} position={[0, 0, 0.013]}>
          <boxGeometry args={[0.034, 0.026, 0.005]} />
          <meshStandardMaterial color={C.chrome} metalness={1} roughness={0.08} />
        </mesh>
        {/* Paddle shifters */}
        <mesh position={[-0.21, 0.01, 0.01]} rotation={[Math.PI / 2 - 0.28, 0, 0]}>
          <boxGeometry args={[0.050, 0.080, 0.015]} />
          <meshStandardMaterial color={C.soft_touch} metalness={0.35} roughness={0.45} />
        </mesh>
        <mesh position={[0.21, 0.01, 0.01]} rotation={[Math.PI / 2 - 0.28, 0, 0]}>
          <boxGeometry args={[0.050, 0.080, 0.015]} />
          <meshStandardMaterial color={C.soft_touch} metalness={0.35} roughness={0.45} />
        </mesh>
        {/* Column shroud — lower clamshell body */}
        <mesh position={[0, -0.12, 0.14]} rotation={[0.28, 0, 0]}>
          <cylinderGeometry args={[0.044, 0.048, 0.28, 14]} />
          <meshStandardMaterial color={C.dash_body} roughness={0.55} metalness={0.22} />
        </mesh>
        {/* Upper shroud cap — soft-touch */}
        <mesh position={[0, -0.045, 0.112]} rotation={[0.28, 0, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.10, 14]} />
          <meshStandardMaterial color={C.soft_touch} roughness={0.42} metalness={0.08} />
        </mesh>
        {/* Stalks — wiper left, light right */}
        {[-1, 1].map((ss, i) => (
          <mesh key={i} position={[ss * 0.088, -0.10, 0.14]} rotation={[0.28, 0, 0]}>
            <boxGeometry args={[0.078, 0.011, 0.012]} />
            <meshStandardMaterial color={C.dark_chrome} metalness={0.60} roughness={0.30} />
          </mesh>
        ))}
      </InteriorMesh>

      {/* ── CENTER CONSOLE ────────────────────────────────────────────────── */}
      <mesh position={[0, 0.58, 0.68]} castShadow>
        <boxGeometry args={[0.30, 0.64, 0.96]} />
        <meshStandardMaterial color={C.lower_trim} roughness={0.60} metalness={0.20} />
      </mesh>
      <mesh position={[0, 0.88, 0.165]}>
        <boxGeometry args={[0.28, 0.025, 0.012]} />
        <meshStandardMaterial color={C.wood} roughness={0.48} metalness={0.06} />
      </mesh>
      {/* Armrest lid */}
      <mesh position={[0, 0.922, 0.42]}>
        <boxGeometry args={[0.28, 0.050, 0.46]} />
        <meshStandardMaterial color={C.armrest} roughness={0.48} metalness={0.10} />
      </mesh>
      <mesh position={[0, 0.948, 0.42]}>
        <boxGeometry args={[0.004, 0.004, 0.40]} />
        <meshStandardMaterial color={C.stitch} emissive={C.stitch_e} emissiveIntensity={0.35} />
      </mesh>
      {/* Gear stalk */}
      <mesh position={[0, 0.924, 0.81]}>
        <cylinderGeometry args={[0.022, 0.022, 0.13, 10]} />
        <meshStandardMaterial color={C.dark_chrome} roughness={0.40} metalness={0.55} />
      </mesh>
      {/* Knob */}
      <mesh position={[0, 0.993, 0.81]}>
        <sphereGeometry args={[0.042, 14, 14]} />
        <meshStandardMaterial color="#1c1a28" roughness={0.28} metalness={0.36} />
      </mesh>
      {/* Gear indicator */}
      <mesh position={[0, 0.914, 0.91]}>
        <boxGeometry args={[0.08, 0.018, 0.10]} />
        <meshStandardMaterial color={C.switch_panel} roughness={0.30} metalness={0.50} />
      </mesh>
      {/* EPB button */}
      <mesh position={[-0.065, 0.914, 0.77]}>
        <boxGeometry args={[0.030, 0.015, 0.030]} />
        <meshStandardMaterial color="#dd1a1a" emissive="#880000"
          emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
      {/* Wireless charger */}
      <mesh position={[0, 0.896, 0.52]}>
        <boxGeometry args={[0.22, 0.010, 0.28]} />
        <meshStandardMaterial color={C.piano_black} roughness={0.40} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.902, 0.52]}>
        <boxGeometry args={[0.20, 0.005, 0.26]} />
        <meshStandardMaterial color="#00ff88" emissive="#004422"
          emissiveIntensity={0.72} toneMapped={false} />
      </mesh>
      {/* USB-C ports */}
      {[-0.042, 0.042].map((ux, i) => (
        <mesh key={i} position={[ux, 0.896, 0.32]}>
          <boxGeometry args={[0.020, 0.012, 0.015]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.70} roughness={0.30} />
        </mesh>
      ))}
      {/* Console ambient underline */}
      <mesh position={[0, 0.275, 0.68]}>
        <boxGeometry args={[0.296, 0.007, 0.88]} />
        <meshStandardMaterial color={ambientColor} emissive={ambientColor}
          emissiveIntensity={ambientEI * 0.45} toneMapped={false} />
      </mesh>

      {/* ── FRONT SEATS ───────────────────────────────────────────────────── */}
      <Seat name="seat_driver"    position={[-0.38, 0.30, 0.45]} />
      <Seat name="seat_passenger" position={[ 0.38, 0.30, 0.45]} />

      {/* ── REAR SEATS ────────────────────────────────────────────────────── */}
      <mesh position={[0, 0.34, -0.52]} castShadow>
        <boxGeometry args={[1.30, 0.11, 0.50]} />
        <meshStandardMaterial color={C.seat_body} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.396, -0.52]}>
        <boxGeometry args={[1.22, 0.06, 0.44]} />
        <meshStandardMaterial color={C.seat_cushion} roughness={0.90} />
      </mesh>
      <mesh position={[0, 0.72, -0.74]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.30, 0.65, 0.09]} />
        <meshStandardMaterial color={C.seat_body} roughness={0.86} />
      </mesh>
      {/* Rear headrests */}
      {[-0.40, 0, 0.40].map((rx, i) => (
        <mesh key={i} position={[rx, 1.07, -0.74]} castShadow>
          <boxGeometry args={[0.27, 0.18, 0.10]} />
          <meshStandardMaterial color={C.seat_body} roughness={0.86} />
        </mesh>
      ))}

      {/* ── REAR SEAT FOLD-DOWN CENTRE ARMREST ────────────────────────────── */}
      <mesh position={[0, 0.61, -0.56]}>
        <boxGeometry args={[0.24, 0.052, 0.30]} />
        <meshStandardMaterial color={C.armrest} roughness={0.48} metalness={0.10} />
      </mesh>
      <mesh position={[0, 0.638, -0.56]}>
        <boxGeometry args={[0.004, 0.004, 0.26]} />
        <meshStandardMaterial color={C.stitch} emissive={C.stitch_e} emissiveIntensity={0.25} />
      </mesh>

      {/* ── DRIVER PEDALS ─────────────────────────────────────────────────── */}
      {/* Brake pedal */}
      <mesh position={[-0.47, 0.225, 1.26]}>
        <boxGeometry args={[0.095, 0.012, 0.115]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.38} />
      </mesh>
      <mesh position={[-0.47, 0.220, 1.22]}>
        <boxGeometry args={[0.075, 0.008, 0.058]} />
        <meshStandardMaterial color="#181820" roughness={0.80} metalness={0.10} />
      </mesh>
      {/* Accelerator pedal */}
      <mesh position={[-0.27, 0.222, 1.30]}>
        <boxGeometry args={[0.070, 0.010, 0.150]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.55} roughness={0.38} />
      </mesh>

      {/* ── REARVIEW MIRROR ───────────────────────────────────────────────── */}
      <mesh position={[0.04, 1.44, 1.49]}>
        <boxGeometry args={[0.21, 0.072, 0.024]} />
        <meshStandardMaterial color={C.soft_touch} roughness={0.50} metalness={0.30} />
      </mesh>
      <mesh position={[0.04, 1.44, 1.478]}>
        <boxGeometry args={[0.185, 0.055, 0.005]} />
        <meshStandardMaterial color="#aabbcc" metalness={0.92} roughness={0.02} />
      </mesh>
      <mesh position={[0.04, 1.498, 1.515]} rotation={[0.28, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.11, 8]} />
        <meshStandardMaterial color={C.dark_chrome} metalness={0.60} roughness={0.30} />
      </mesh>

      {/* ── OVERHEAD CONSOLE ──────────────────────────────────────────────── */}
      <InteriorMesh name="overhead_console" position={[0, 1.500, 0.38]}>
        <mesh>
          <boxGeometry args={[0.44, 0.040, 0.28]} />
          <meshStandardMaterial color={C.soft_touch} roughness={0.60} metalness={0.18} />
        </mesh>
        {[-0.13, 0.13].map((ox, i) => (
          <mesh key={i} position={[ox, -0.025, 0.02]}>
            <cylinderGeometry args={[0.022, 0.022, 0.012, 10]} />
            <meshStandardMaterial color="#ffeecc" emissive="#aa8844"
              emissiveIntensity={isDayMode ? 0.0 : 0.75} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, -0.025, -0.06]}>
          <boxGeometry args={[0.060, 0.012, 0.040]} />
          <meshStandardMaterial color={C.switch_panel} metalness={0.50} roughness={0.40} />
        </mesh>
        <mesh position={[0.17, -0.025, -0.06]}>
          <cylinderGeometry args={[0.015, 0.015, 0.012, 8]} />
          <meshStandardMaterial color="#ff2020" emissive="#aa0000"
            emissiveIntensity={0.55} toneMapped={false} />
        </mesh>
        <mesh position={[-0.17, -0.025, -0.06]}>
          <cylinderGeometry args={[0.015, 0.015, 0.012, 8]} />
          <meshStandardMaterial color={C.dark_chrome} metalness={0.50} roughness={0.40} />
        </mesh>
      </InteriorMesh>

      {/* ── WINDSHIELD ────────────────────────────────────────────────────── */}
      <mesh position={[0, 1.27, 1.85]}>
        <boxGeometry args={[1.55, 0.54, 0.016]} />
        <primitive object={glassM} attach="material" />
      </mesh>

      {/* ── LIGHTING ──────────────────────────────────────────────────────── */}
      <pointLight color={ambientColor}
        intensity={isDayMode ? 0.22 : 0.65}
        position={[0, 0.30, 0.56]} distance={1.6} decay={2} />
      <pointLight color={ambientColor}
        intensity={isDayMode ? 0.08 : 0.32}
        position={[-0.46, 0.27, 0.86]} distance={1.0} decay={2} />
      <pointLight color={ambientColor}
        intensity={isDayMode ? 0.08 : 0.32}
        position={[0.46, 0.27, 0.86]} distance={1.0} decay={2} />
      <pointLight color="#fff8f0"
        intensity={isDayMode ? 0.0 : 0.50}
        position={[0, 1.46, 0.38]} distance={2.2} decay={2} />
      <pointLight color="#0040ff"
        intensity={isDayMode ? 0.06 : 0.20}
        position={[0.10, 1.15, 1.52]} distance={0.75} decay={2} />
    </group>
  )
}
