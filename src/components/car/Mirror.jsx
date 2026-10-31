import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { getCarMaterials } from '../../three/materials'

// Mirror geometry is authored for the LEFT (+X) side in a local frame:
//   X = outboard, Y = up, Z = forward.  The right mirror reuses it under a
//   scale.x = −1 parent (three.js flips face culling for mirrored matrices).
let GEO = null
function mirrorGeo() {
  if (GEO) return GEO
  // Housing: ellipsoid, flattened at the back (glass face) and tapered inboard
  const housing = new THREE.SphereGeometry(1, 48, 32)
  const p = housing.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    let y = p.getY(i)
    let z = p.getZ(i)
    const taper = 0.78 + 0.22 * ((x + 1) / 2) // narrower toward the door
    y *= taper
    if (z < -0.25) z = -0.25 - (z + 0.25) * 0.12 // flat glass face
    if (z > 0) z *= 1.15 - 0.35 * Math.max(0, y) // swept top-front
    p.setXYZ(i, x * 0.118, y * 0.058, z * 0.054)
  }
  housing.computeVertexNormals()
  housing.translate(0.15, 0.03, 0)

  const glassShape = new THREE.Shape()
  const w = 0.192
  const h = 0.104
  const r = 0.03
  glassShape.moveTo(-w / 2 + r, -h / 2)
  glassShape.lineTo(w / 2 - r, -h / 2)
  glassShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  glassShape.lineTo(w / 2, h / 2 - r * 0.6)
  glassShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  glassShape.lineTo(-w / 2 + r * 1.6, h / 2 - 0.006)
  glassShape.quadraticCurveTo(-w / 2, h / 2 - 0.012, -w / 2, h / 2 - r * 1.4)
  glassShape.lineTo(-w / 2, -h / 2 + r)
  glassShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  const glass = new THREE.ShapeGeometry(glassShape, 12)
  glass.rotateY(Math.PI) // face −Z (rearward)

  // Base / arm: tapered block from the door sail to the housing
  const arm = new THREE.BoxGeometry(0.09, 0.03, 0.06, 4, 1, 2)
  const ap = arm.attributes.position
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i)
    const t = (x + 0.045) / 0.09
    ap.setY(i, ap.getY(i) * (1.4 - 0.6 * t))
    ap.setZ(i, ap.getZ(i) * (1.3 - 0.5 * t))
  }
  arm.computeVertexNormals()
  arm.translate(0.05, 0, 0.0)

  const base = new THREE.BoxGeometry(0.03, 0.07, 0.13)
  base.translate(0.012, 0.015, 0.0)

  // LED repeater: thin sweep along the lower front edge of the housing
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.07, 0.0, 0.035),
    new THREE.Vector3(0.15, -0.012, 0.05),
    new THREE.Vector3(0.24, -0.006, 0.04),
    new THREE.Vector3(0.258, 0.01, 0.022),
  ])
  const repeater = new THREE.TubeGeometry(curve, 32, 0.0045, 6, false)
  GEO = { housing, glass, arm, base, repeater }
  return GEO
}

/**
 * Exterior mirror. `foldRef` rotates the pod about the mount's vertical axis;
 * `glassRef` tilts the glass (x = up/down, y = left/right).
 */
const Mirror = forwardRef(function Mirror({ frame, side, name, glassName, glassRef }, foldRef) {
  const G = mirrorGeo()
  const M = getCarMaterials()
  // Orient: local X = outboard (horizontal part of the surface normal)
  const quat = useMemo(() => {
    const out = new THREE.Vector3(frame.normal.x, 0, frame.normal.z).normalize()
    if (side < 0) out.x = -out.x // authored for +X; parent mirrors it back
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), out)
    return q
  }, [frame, side])
  const pos = useMemo(() => {
    const p = frame.position.clone().addScaledVector(frame.normal, -0.004)
    if (side < 0) p.x = -p.x
    return p
  }, [frame, side])

  return (
    <group scale={[side, 1, 1]}>
      <group position={pos} quaternion={quat}>
        <mesh geometry={G.base} material={M.blackGloss} />
        <group ref={foldRef} name={name}>
          <mesh geometry={G.arm} material={M.blackGloss} castShadow />
          <mesh geometry={G.housing} material={M.paint} castShadow />
          <mesh geometry={G.repeater} material={M.lights.mirrorTurn} />
          <group position={[0.15, 0.03, -0.0148]}>
            <group ref={glassRef} name={glassName}>
              <mesh geometry={G.glass} material={M.mirrorGlass} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
})

export default Mirror
