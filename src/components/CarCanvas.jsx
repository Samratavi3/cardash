import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Html, PerformanceMonitor, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { useCarState } from '../hooks/useCarState'
import { cameraRig } from '../hooks/useCameraRig'
import { CAMERA_POSITIONS } from '../constants/cameraPositions'
import { useIntroSequence } from './IntroSequence'
import { HOTSPOT_META } from '../constants/hotspots'
import { useScreenConfig } from '../hooks/useScreenConfig'
import VehicleModel from './VehicleModel'
import InteriorModel from './InteriorModel'
import Stage from './Stage'
import Effects from './Effects'
import HotspotPins from './HotspotPins'

// ── Loader ────────────────────────────────────────────────────────────────────
function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <svg viewBox="0 0 50 50" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="25" cy="25" r="20" fill="none" stroke="#00d4ff" strokeWidth="3"
              strokeDasharray={`${(progress / 100) * 125.6} 125.6`} strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 5px #00d4ff)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    </Html>
  )
}

// Orbit limits per mode. Interior hotspots sit < 1 m from their target, so
// the exterior minDistance must not apply inside the cabin.
const LIMITS = {
  exterior: { minDistance: 2.0, maxDistance: 13, minPolarAngle: 0.12, maxPolarAngle: 1.5 },
  interior: { minDistance: 0.05, maxDistance: 2.0, minPolarAngle: 0.15, maxPolarAngle: Math.PI - 0.25 },
  panorama: { minDistance: 0.005, maxDistance: 0.02, minPolarAngle: 0.05, maxPolarAngle: Math.PI - 0.05 },
}

// camera-controls has no autoRotate: spin the azimuth ourselves and pause
// for a few seconds after any user interaction.
function AutoRotate({ controlsRef }) {
  const idleUntil = useRef(0)
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const pause = () => { idleUntil.current = performance.now() + 4000 }
    c.addEventListener('controlstart', pause)
    c.addEventListener('control', pause)
    return () => {
      c.removeEventListener('controlstart', pause)
      c.removeEventListener('control', pause)
    }
  }, [controlsRef])
  useFrame((_, dt) => {
    const c = controlsRef.current
    const s = useCarState.getState()
    if (!c || !s.isAutoRotate || !s.isIntroComplete || s.activeHotspot || s.activeView !== 'exterior') return
    if (performance.now() < idleUntil.current || c.active) return
    c.rotate(dt * 0.07, 0, false)
  })
  return null
}

// Off-axis "lens shift": when a side panel covers part of the canvas, shift
// the projection window so the car stays centred in the visible area. Unlike
// moving the camera this keeps orbit/perspective untouched.
function LensShift() {
  const { camera, size } = useThree()
  const cfg = useScreenConfig()
  const cur = useRef(0)
  const last = useRef({ x: NaN, w: 0, h: 0 })
  useFrame((_, dt) => {
    const s = useCarState.getState()
    const meta = s.activeHotspot ? HOTSPOT_META[s.activeHotspot] : null
    let target = 0
    if (s.panoramaMode) target = 0
    else if (meta) target = ((meta.side === 'right' ? 1 : -1) * (cfg.overlayPanelWidth + 16)) / 2
    else if (s.isConfiguratorOpen && s.isIntroComplete && s.activeView === 'exterior') target = (cfg.configuratorWidth + 16) * 0.36
    cur.current = THREE.MathUtils.damp(cur.current, target, 4, dt)
    const x = Math.round(cur.current * 10) / 10
    const l = last.current
    if (x !== l.x || size.width !== l.w || size.height !== l.h) {
      camera.setViewOffset(size.width, size.height, x, 0, size.width, size.height)
      last.current = { x, w: size.width, h: size.height }
    }
  })
  return null
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function SceneContent({ quality }) {
  const controlsRef = useRef()
  const { camera, gl } = useThree()
  const isDayMode = useCarState((s) => s.isDayMode)
  const selectedColor = useCarState((s) => s.selectedColor)
  const activeView = useCarState((s) => s.activeView)
  const panoramaMode = useCarState((s) => s.panoramaMode)

  useEffect(() => {
    cameraRig.controls = controlsRef.current
    cameraRig.camera = camera
    cameraRig.gl = gl
  }, [camera, gl])

  useIntroSequence()

  const sc = selectedColor.scene
  const bg = isDayMode ? sc.background : '#020306'
  const limits = panoramaMode ? LIMITS.panorama : LIMITS[activeView] || LIMITS.exterior

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 14, 36]} />

      <CameraControls
        ref={controlsRef}
        makeDefault
        {...limits}
        smoothTime={0.55}
        draggingSmoothTime={0.12}
        truckSpeed={0}
        dollySpeed={0.7}
        azimuthRotateSpeed={0.8}
        polarRotateSpeed={0.8}
      />
      <AutoRotate controlsRef={controlsRef} />
      <LensShift />

      <Stage night={!isDayMode} accent={sc.rimLightColor} floorColor={isDayMode ? sc.groundColor : '#05060a'} quality={quality} />

      <VehicleModel />
      <InteriorModel />
      <HotspotPins />

      <Effects quality={quality} />
    </>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────
export default function CarCanvas() {
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio || 1))
  const [quality, setQuality] = useState('high')
  const start = CAMERA_POSITIONS.intro_start

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: start.position, fov: start.fov, near: 0.03, far: 120 }}
      gl={{
        antialias: false, // MSAA happens in the composer
        powerPreference: 'high-performance',
        stencil: false,
        preserveDrawingBuffer: true, // required for canvas.toDataURL() screenshots
      }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true // door glass is clipped at the beltline
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
      className="w-full h-full"
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => { setDpr(1); setQuality('low') }}
        onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio || 1))}
        onFallback={() => { setDpr(1); setQuality('low') }}
      />
      <Suspense fallback={<Loader />}>
        <SceneContent quality={quality} />
      </Suspense>
    </Canvas>
  )
}
