// Cabin materials. Interior surfaces get a reduced envMapIntensity: the
// studio IBL has no notion of the roof occluding the cabin, so turning the
// environment down inside fakes that occlusion and keeps the cabin moody.
import * as THREE from 'three'

function leatherGrain(size = 256, seed = 11) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const data = new Uint8Array(size * size * 4)
  // Height noise (2 octaves) → normal
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = r()
  const blur = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) acc += h[((y + dy + size) % size) * size + ((x + dx + size) % size)]
      blur[y * size + x] = acc / 9
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (blur[y * size + ((x + 1) % size)] - blur[y * size + ((x - 1 + size) % size)]) * 2.2
      const dy = (blur[((y + 1) % size) * size + x] - blur[((y - 1 + size) % size) * size + x]) * 2.2
      const l = Math.hypot(dx, dy, 1)
      const o = (y * size + x) * 4
      data[o] = ((-dx / l) * 0.5 + 0.5) * 255
      data[o + 1] = ((-dy / l) * 0.5 + 0.5) * 255
      data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255
      data[o + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, size, size)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.repeat.set(6, 6)
  t.needsUpdate = true
  return t
}

let SET = null
export function getInteriorMaterials() {
  if (SET) return SET
  const grain = leatherGrain()
  const std = (color, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.55, ...extra })
  SET = {
    leather: std('#cdbfa6', 0.58, { normalMap: grain, normalScale: new THREE.Vector2(0.35, 0.35) }),
    leatherDark: std('#1f1d1f', 0.55, { normalMap: grain, normalScale: new THREE.Vector2(0.35, 0.35) }),
    perforated: std('#bfb197', 0.66, { normalMap: grain, normalScale: new THREE.Vector2(0.6, 0.6) }),
    softTouch: std('#1b1a1c', 0.78, { side: THREE.DoubleSide }),
    softBeige: std('#b9ab92', 0.72, { side: THREE.DoubleSide }),
    hardPlastic: std('#121213', 0.62),
    carpet: std('#141315', 0.98),
    headliner: std('#c9c4ba', 0.94, { side: THREE.DoubleSide, envMapIntensity: 0.35 }),
    pillarTrim: std('#b7b1a6', 0.86, { side: THREE.DoubleSide, envMapIntensity: 0.4 }),
    pianoBlack: new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 }),
    satin: new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 1, roughness: 0.28, envMapIntensity: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.06, envMapIntensity: 1 }),
    // Rear-view mirror: reflects the dim cabin, so keep it dark
    mirror: new THREE.MeshStandardMaterial({ color: '#2c3238', metalness: 1, roughness: 0.04, envMapIntensity: 0.6 }),
    wood: std('#4a2f1c', 0.36, { envMapIntensity: 0.8 }),
    stitch: std('#8a7a60', 0.7),
    rubber: std('#0d0d0e', 0.9),
    // Ambient LED strips — one shared emitter recoloured by the store
    ambient: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#00d4ff', emissiveIntensity: 2, roughness: 1, toneMapped: true }),
    screenGlass: new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.25, envMapIntensity: 1.2, depthWrite: false }),
    belt: std('#1b1b1d', 0.8),
    vent: std('#0e0e10', 0.55),
  }
  return SET
}
