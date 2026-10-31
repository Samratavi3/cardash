import { useMemo } from 'react'
import * as THREE from 'three'
import { CAR } from '../../three/carSurface'
import { getCarMaterials } from '../../three/materials'
import {
  tyreGeometry, rimBarrelGeometry, rimFaceGeometry, centreCapGeometry, hBadgeGeometry,
  lugGeometry, discGeometry, discHatGeometry, caliperGeometry,
} from '../../three/wheelGeometry'

// Geometry shared by all four wheels (built once per style)
let GEO = null
function wheelGeo() {
  if (GEO) return GEO
  GEO = {
    tyre: tyreGeometry(),
    barrel: rimBarrelGeometry(),
    faces: { stock: rimFaceGeometry('stock'), sport: rimFaceGeometry('sport'), carbon: rimFaceGeometry('carbon') },
    cap: centreCapGeometry(),
    badge: hBadgeGeometry(0.03),
    lug: lugGeometry(),
    disc: discGeometry(),
    hat: discHatGeometry(),
    caliper: caliperGeometry(),
  }
  return GEO
}

const LUG_PCD = 0.05
const LUGS = 4

/**
 * One wheel corner. side = +1 (left, +X) or −1 (right, −X).
 * Local frame: axle along +Y (outboard), rotated onto the car's X axis.
 */
export default function Wheel({ position, side, style = 'stock' }) {
  const G = wheelGeo()
  const M = getCarMaterials()
  const rim = M.rims[style] || M.rims.stock
  const caliperMat = style === 'sport' ? M.caliper : M.caliperGrey
  const lugs = useMemo(
    () => Array.from({ length: LUGS }, (_, i) => {
      const a = (i / LUGS) * Math.PI * 2 + Math.PI / 4
      return [Math.cos(a) * LUG_PCD, CAR.tireW / 2 - 0.035, Math.sin(a) * LUG_PCD]
    }),
    [],
  )
  // Caliper sits at the trailing-top of the disc in world space
  const caliperRot = side > 0 ? (3 * Math.PI) / 4 : Math.PI / 4

  return (
    <group position={position} rotation={[0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2]}>
      <mesh geometry={G.tyre} material={M.rubber} castShadow receiveShadow />
      <mesh geometry={G.barrel} material={rim.barrel} />
      <mesh geometry={G.faces[style] || G.faces.stock} material={[rim.face, rim.pocket]} castShadow />
      <mesh geometry={G.cap} material={rim.pocket} />
      <mesh geometry={G.badge} material={M.chrome} position={[0, CAR.tireW / 2 - 0.004, 0]} rotation={[-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2]} />
      {lugs.map((p, i) => <mesh key={i} geometry={G.lug} material={M.lug} position={p} />)}
      <mesh geometry={G.disc} material={M.disc} />
      <mesh geometry={G.hat} material={M.discHat} />
      <group rotation={[0, caliperRot, 0]}>
        <mesh geometry={G.caliper} material={caliperMat} />
      </group>
    </group>
  )
}

/** Dark wheel-well liner visible through the arch cut-out. */
export function WheelTub({ z, side }) {
  const geo = useMemo(() => {
    // theta centred on +Y after the Z-rotation → covers the top of the well
    const g = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 40, 1, true, -Math.PI * 0.07, Math.PI * 1.14)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])
  const cap = useMemo(() => {
    const g = new THREE.CircleGeometry(0.4, 40, -Math.PI * 0.07, Math.PI * 1.14)
    g.rotateY(Math.PI / 2)
    return g
  }, [])
  const M = getCarMaterials()
  return (
    <group position={[side * 0.69, 0.335, z]}>
      <mesh geometry={geo} material={M.wheelArch} />
      <mesh geometry={cap} material={M.wheelArch} position={[-side * 0.17, 0, 0]} />
    </group>
  )
}
