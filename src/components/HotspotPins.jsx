import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useCarState } from '../hooks/useCarState'
import { flyTo } from '../hooks/useCameraRig'
import { HOTSPOT_META } from '../constants/hotspots'
import { CABIN, seatPinPosition } from './InteriorModel'

// Pin anchors: [hotspot, position | (state) => position, outward normal].
// The normal hides a pin when its surface faces away from the camera.
const EXTERIOR_PINS = [
  ['headlight', [0.66, 0.765, 2.1], [0.45, 0.1, 1]],
  ['foglight', [-0.7, 0.37, 2.18], [-0.4, 0, 1]],
  ['bumper', [0.0, 0.47, 2.29], [0, 0, 1]],
  ['bonnet', [0.0, 0.94, 1.55], [0, 1, 0.25]],
  ['wiper', [-0.15, 1.05, 0.93], [0, 1, 0.5]],
  ['adas', [0.0, 1.43, 0.16], [0, 1, 0.6]],
  ['mirror_left', [1.0, 1.0, 0.62], [1, 0.2, 0]],
  ['mirror_right', [-1.0, 1.0, 0.62], [-1, 0.2, 0]],
  ['door', [0.88, 0.78, 0.2], [1, 0, 0]],
  ['sunroof', [0.0, 1.5, -0.24], [0, 1, 0]],
  ['boot', [0.0, 1.09, -1.85], [0, 1, -0.3]],
  ['rear_wiper', [0.12, 1.16, -1.32], [0, 0.76, -0.65]],
  ['taillight', [-0.64, 0.94, -2.2], [-0.4, 0, -1]],
]

const INTERIOR_PINS = [
  ['steering', [CABIN.driverX, 1.0, 0.33], [0, 0.4, -1]],
  ['instrument', [CABIN.driverX, 1.075, 0.56], [0, 0.3, -1]],
  ['infotainment', [0.04, 1.128, 0.533], [0, 0.3, -1]],
  ['ac_vent', [0.23, 0.975, 0.548], [0, 0.1, -1]],
  ['ambient', [0.45, 0.925, 0.59], [0, 0.2, -1]],
  ['overhead', [0, 1.38, -0.02], [0, -1, -0.4]],
  ['seat_driver', (s) => seatPinPosition(CABIN.driverX, s.seatDriver), [0, 0.5, -1]],
  ['seat_passenger', (s) => seatPinPosition(-CABIN.driverX, s.seatPassenger), [0, 0.5, -1]],
]

function Pin({ hotspot, position, normal }) {
  const el = useRef()
  const group = useRef()
  const dynamic = typeof position === 'function'
  const pos = useMemo(() => new THREE.Vector3(), [])
  const nrm = useMemo(() => new THREE.Vector3(...normal).normalize(), [normal])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  if (!dynamic) pos.set(...position)

  useFrame(({ camera }) => {
    if (dynamic) {
      pos.copy(position(useCarState.getState()))
      group.current?.position.copy(pos)
    }
    if (!el.current) return
    // Fade pins whose surface faces away from the camera (cheap occlusion)
    const facing = tmp.copy(camera.position).sub(pos).normalize().dot(nrm)
    const o = THREE.MathUtils.clamp((facing - 0.05) * 4, 0, 1)
    el.current.style.opacity = o.toFixed(2)
    el.current.style.pointerEvents = o > 0.3 ? 'auto' : 'none'
  })

  const label = HOTSPOT_META[hotspot]?.label ?? hotspot
  return (
    <group ref={group} position={dynamic ? undefined : pos}>
      <Html center zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
        <button
          ref={el}
          onClick={(e) => {
            e.stopPropagation()
            const s = useCarState.getState()
            s.setPanoramaMode(false)
            s.setActiveHotspot(hotspot)
            flyTo(hotspot)
          }}
          className="group relative flex items-center justify-center w-6 h-6 transition-opacity duration-300"
          aria-label={label}
        >
          <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" />
          <span className="relative w-3 h-3 rounded-full bg-white border-2 border-cyan-400 shadow-[0_0_10px_rgba(0,212,255,0.9)]" />
          <span className="absolute left-7 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide text-white/90
            bg-black/70 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {label}
          </span>
        </button>
      </Html>
    </group>
  )
}

export default function HotspotPins() {
  const view = useCarState((s) =>
    s.isIntroComplete && !s.activeHotspot && s.showHotspotPins ? s.activeView : null,
  )
  if (!view) return null
  const pins = view === 'interior' ? INTERIOR_PINS : EXTERIOR_PINS
  return pins.map(([h, p, n]) => <Pin key={`${view}-${h}`} hotspot={h} position={p} normal={n} />)
}
