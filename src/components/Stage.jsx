import { useMemo } from 'react'
import * as THREE from 'three'
import { Environment, Lightformer, MeshReflectorMaterial, ContactShadows } from '@react-three/drei'

/**
 * Photo-studio lighting rig rendered into the environment map in code —
 * no HDRI download, so the scene can never stall on a CDN. Long softbox
 * strips give the crisp horizontal highlights that make car paint read.
 */
function StudioEnvironment({ night, accent }) {
  return (
    <Environment key={night ? 'night' : 'day'} resolution={512} frames={1} background={false}>
      <color attach="background" args={[night ? '#020306' : '#08090c']} />
      {/* Overhead key — large softbox */}
      <Lightformer form="rect" intensity={night ? 0.7 : 2.6} color={night ? '#b8c8ff' : '#ffffff'}
        position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[9, 5.5, 1]} />
      <Lightformer form="rect" intensity={night ? 0.4 : 1.4} color="#ffffff"
        position={[0, 6, -3.5]} rotation-x={Math.PI / 2} scale={[9, 1.2, 1]} />
      {/* Side strip lights — the long reflection lines along the doors */}
      <Lightformer form="rect" intensity={night ? 3.2 : 3.4} color={night ? accent : '#ffffff'}
        position={[-7, 1.7, 0]} rotation-y={Math.PI / 2} scale={[16, 0.55, 1]} />
      <Lightformer form="rect" intensity={night ? 2.4 : 3.0} color={night ? '#8b5cf6' : '#ffffff'}
        position={[7, 1.7, 0]} rotation-y={-Math.PI / 2} scale={[16, 0.55, 1]} />
      <Lightformer form="rect" intensity={night ? 0.5 : 1.2} color="#ffffff"
        position={[-7, 3.6, 0]} rotation-y={Math.PI / 2} scale={[16, 1.6, 1]} />
      <Lightformer form="rect" intensity={night ? 0.5 : 1.2} color="#ffffff"
        position={[7, 3.6, 0]} rotation-y={-Math.PI / 2} scale={[16, 1.6, 1]} />
      {/* Front / rear fill panels */}
      <Lightformer form="rect" intensity={night ? 0.35 : 1.1} color="#ffffff"
        position={[0, 2.2, 8]} rotation-y={Math.PI} scale={[9, 2.6, 1]} />
      <Lightformer form="rect" intensity={night ? 0.8 : 0.9} color={night ? accent : '#ffffff'}
        position={[0, 2.2, -8]} scale={[9, 2.6, 1]} />
      {/* Ring light for a signature round highlight */}
      <Lightformer form="ring" intensity={night ? 1.6 : 1.8} color={night ? accent : '#ffffff'}
        position={[5, 5, 5]} scale={1.6} target={[0, 0.6, 0]} />
      {/* Floor bounce */}
      <Lightformer form="rect" intensity={night ? 0.05 : 0.25} color="#9aa3b0"
        position={[0, -0.5, 0]} rotation-x={-Math.PI / 2} scale={[24, 24, 1]} />
    </Environment>
  )
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, outer)
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Stage({ night, accent = '#00d4ff', floorColor = '#0c0d10', quality = 'high' }) {
  const glow = useMemo(() => radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), [])
  const res = quality === 'high' ? 1024 : 512
  return (
    <>
      <StudioEnvironment night={night} accent={accent} />

      {/* A gentle directional key for form definition (env does the rest) */}
      <directionalLight position={[3, 7, 4]} intensity={night ? 0.25 : 0.9} color="#ffffff" />
      <hemisphereLight args={['#c9d4ff', '#0b0b0e', night ? 0.08 : 0.25]} />

      {/* Showroom floor: blurred real-time reflections fading into fog */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 96]} />
        <MeshReflectorMaterial
          resolution={res}
          blur={[500, 140]}
          mixBlur={1.6}
          mixStrength={night ? 2.4 : 1.6}
          mixContrast={1.15}
          mirror={0.65}
          depthScale={1.2}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.4}
          depthToBlurRatioBias={0.25}
          roughness={0.82}
          metalness={0.55}
          color={floorColor}
          envMapIntensity={night ? 0.15 : 0.35}
        />
      </mesh>

      {/* Turntable ring + soft light pool */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.55, 3.58, 160]} />
        <meshBasicMaterial color={night ? accent : '#9aa7b8'} transparent opacity={night ? 0.55 : 0.18} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0015, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={glow} color={night ? accent : '#ffffff'} transparent opacity={night ? 0.05 : 0.04}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <ContactShadows
        position={[0, 0.003, 0]}
        scale={[6.5, 8.5]}
        resolution={quality === 'high' ? 1024 : 512}
        far={1.6}
        blur={2.6}
        opacity={night ? 0.9 : 0.82}
        color="#000000"
      />
    </>
  )
}
