// Shared PBR materials for the procedural car. Created once and mutated in
// place (colour, finish, emissive levels) so React re-renders never
// recompile shaders.
import * as THREE from 'three'
import { CAR } from './carSurface'

// ── Procedural textures ─────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Metallic-flake normal map: each texel is a randomly tilted micro-facet. */
export function makeFlakeNormalMap(size = 256, seed = 7) {
  const r = rng(seed)
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const x = (r() * 2 - 1) * 0.55
    const y = (r() * 2 - 1) * 0.55
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y))
    data[i * 4] = (x * 0.5 + 0.5) * 255
    data[i * 4 + 1] = (y * 0.5 + 0.5) * 255
    data[i * 4 + 2] = (z * 0.5 + 0.5) * 255
    data[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.repeat.set(10, 10)
  t.needsUpdate = true
  return t
}

/** Tyre tread + sidewall normal map drawn on a canvas (u = around, v = across). */
export function makeTyreNormalMap() {
  const w = 1024
  const h = 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  // Height field: white = raised. Tread band is the middle ~55 % of v.
  g.fillStyle = '#808080'
  g.fillRect(0, 0, w, h)
  const t0 = h * 0.22
  const t1 = h * 0.78
  g.fillStyle = '#b0b0b0'
  g.fillRect(0, t0, w, t1 - t0)
  // circumferential grooves
  g.fillStyle = '#303030'
  for (const f of [0.36, 0.5, 0.64]) g.fillRect(0, h * f - 2, w, 4)
  // lateral sipes / blocks
  const blocks = 72
  for (let i = 0; i < blocks; i++) {
    const x = (i / blocks) * w
    g.save()
    g.translate(x, 0)
    g.fillStyle = '#3a3a3a'
    g.beginPath()
    g.moveTo(0, t0)
    g.lineTo(3, t0)
    g.lineTo(9, h * 0.36)
    g.lineTo(6, h * 0.36)
    g.closePath()
    g.fill()
    g.beginPath()
    g.moveTo(4, h * 0.64)
    g.lineTo(7, h * 0.64)
    g.lineTo(1, t1)
    g.lineTo(-2, t1)
    g.closePath()
    g.fill()
    g.fillRect(2, h * 0.5 - 6, 2, 12)
    g.restore()
  }
  // sidewall rings
  g.fillStyle = '#9a9a9a'
  g.fillRect(0, h * 0.08, w, 2)
  g.fillRect(0, h * 0.92 - 2, w, 2)
  // Convert height → normal (Sobel)
  const src = g.getImageData(0, 0, w, h).data
  const out = g.createImageData(w, h)
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 3.0
      const dy = (H(x, y + 1) - H(x, y - 1)) * 3.0
      const l = Math.hypot(dx, dy, 1)
      const o = (y * w + x) * 4
      out.data[o] = ((-dx / l) * 0.5 + 0.5) * 255
      out.data[o + 1] = ((-dy / l) * 0.5 + 0.5) * 255
      out.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255
      out.data[o + 3] = 255
    }
  }
  g.putImageData(out, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = 8
  return t
}

/** Indian-style number plate (white, black text, blue IND strip). */
export function makePlateTexture(text) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 232
  const g = c.getContext('2d')
  g.fillStyle = '#f4f4f0'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#111'
  g.lineWidth = 10
  g.strokeRect(12, 12, c.width - 24, c.height - 24)
  g.fillStyle = '#1d3f9a'
  g.fillRect(24, 24, 92, c.height - 48)
  g.fillStyle = '#fff'
  g.font = 'bold 34px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.fillText('IND', 70, c.height - 46)
  g.fillStyle = '#111'
  g.font = 'bold 140px "Arial Narrow", Arial, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(text, 570, c.height / 2 + 6)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ── Shader hooks ────────────────────────────────────────────────────────────
// Wheel-arch cut-outs are done per-pixel: any body fragment whose closed-pose
// (object-space) position falls inside an arch circle seen from the side is
// discarded. Pixel-perfect round arches on any panel (incl. the rear door
// skin and its inner trim) with no geometry booleans.
const ARCH_Y = 0.335
const ARCH_R = 0.372
const ARCH_UNIFORMS = {
  uArchF: { value: new THREE.Vector3(CAR.axleF, ARCH_Y, ARCH_R) },
  uArchR: { value: new THREE.Vector3(CAR.axleR, ARCH_Y, ARCH_R) },
}

function patchShader(material, { arch = false, darkBack = false } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, ARCH_UNIFORMS)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;')
    let pre = 'varying vec3 vObjPos;\nuniform vec3 uArchF;\nuniform vec3 uArchR;\n'
    let body = ''
    if (arch) {
      body += `
        if (abs(vObjPos.x) > 0.5) {
          vec2 a = vObjPos.zy - uArchF.xy;
          vec2 b = vObjPos.zy - uArchR.xy;
          if (dot(a, a) < uArchF.z * uArchF.z || dot(b, b) < uArchR.z * uArchR.z) discard;
        }`
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${pre}`)
      .replace('void main() {', `void main() {${body}`)
    if (darkBack) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor.rgb *= 0.08;',
      )
    }
  }
  material.customProgramCacheKey = () => `car-${arch ? 'a' : ''}${darkBack ? 'b' : ''}`
  return material
}

/** Physically-plausible glass blending: reflections are added at full
 *  strength while the scene behind is attenuated by (1 − alpha). */
function glassBlend(m) {
  m.transparent = true
  m.depthWrite = false
  m.blending = THREE.CustomBlending
  m.blendEquation = THREE.AddEquation
  m.blendSrc = THREE.OneFactor
  m.blendDst = THREE.OneMinusSrcAlphaFactor
  m.premultipliedAlpha = false
  return m
}

// ── Material set ────────────────────────────────────────────────────────────
let SET = null
export function getCarMaterials() {
  if (SET) return SET
  const flakes = makeFlakeNormalMap()

  const paint = patchShader(new THREE.MeshPhysicalMaterial({
    color: '#f0eee9',
    metalness: 0.3,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    normalMap: flakes,
    normalScale: new THREE.Vector2(0.09, 0.09),
    side: THREE.DoubleSide,
    envMapIntensity: 1.1,
  }), { arch: true, darkBack: true })

  const doorTrim = patchShader(new THREE.MeshStandardMaterial({
    color: '#1d1c1f', roughness: 0.62, metalness: 0.0, envMapIntensity: 0.5, side: THREE.DoubleSide,
  }), { arch: true })

  const blackPlastic = patchShader(new THREE.MeshStandardMaterial({
    color: '#0c0c0d', roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide,
  }), { arch: true, darkBack: true })

  const cowl = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.8, metalness: 0 })
  // Deep matte recess behind the Matrix-Mesh grille tiles / vents
  const grilleBack = new THREE.MeshStandardMaterial({ color: '#020203', roughness: 0.9, metalness: 0, side: THREE.DoubleSide })

  const blackGloss = new THREE.MeshPhysicalMaterial({
    color: '#040405', metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide,
  })

  const chrome = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.055, envMapIntensity: 1.25 })
  const satinChrome = new THREE.MeshStandardMaterial({ color: '#d8dbe0', metalness: 1, roughness: 0.22 })
  const darkChrome = new THREE.MeshStandardMaterial({ color: '#4a4f57', metalness: 1, roughness: 0.16, side: THREE.DoubleSide })
  const lampHousing = new THREE.MeshStandardMaterial({ color: '#0b0c0e', metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide })
  const tailHousing = new THREE.MeshStandardMaterial({ color: '#160405', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })

  const glassBase = {
    metalness: 0, roughness: 0.02, ior: 1.52, specularIntensity: 1, envMapIntensity: 1.6, side: THREE.DoubleSide,
  }
  const glassFrit = glassBlend(new THREE.MeshPhysicalMaterial({ ...glassBase, color: '#20282e', vertexColors: true }))
  // 2026 facelift: smoked headlamp & tail-lamp lenses
  const lens = glassBlend(new THREE.MeshPhysicalMaterial({ ...glassBase, color: '#1b2026', opacity: 0.2, envMapIntensity: 2.4 }))
  const tailLens = glassBlend(new THREE.MeshPhysicalMaterial({ ...glassBase, color: '#24070a', opacity: 0.66, roughness: 0.04 }))
  const mirrorGlass = new THREE.MeshStandardMaterial({ color: '#c9d2da', metalness: 1, roughness: 0.02, envMapIntensity: 1.4 })

  /** Each door window gets its own material (own clipping plane). */
  const makeWindowGlass = (opacity) => glassBlend(new THREE.MeshPhysicalMaterial({
    ...glassBase, color: '#1c252b', opacity, clipShadows: true,
  }))

  const emit = (color, emissive, intensity = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.3, metalness: 0, side: THREE.DoubleSide, ...extra })

  const lights = {
    drl: emit('#dfe6ee', '#eaf4ff', 0.05),
    led: emit('#b9c4d0', '#f2f8ff', 0.0, { metalness: 0.4, roughness: 0.1 }),
    turnF: emit('#5a3a10', '#ff9a1f', 0.0),
    turnR: emit('#5a3a10', '#ff9a1f', 0.0),
    tail: emit('#3a0306', '#ff1020', 0.35),
    tailOutline: emit('#2a0204', '#ff2030', 0.2),
    fog: emit('#e9e4d2', '#fff1c8', 0.0, { metalness: 0.3, roughness: 0.08 }),
    rearFog: emit('#3a0306', '#ff1a12', 0.0),
    reflector: emit('#4a0508', '#ff2a10', 0.05, { roughness: 0.2 }),
    plateLamp: emit('#ffffff', '#ffffff', 0.0),
    mirrorTurn: emit('#4a2f10', '#ff9a1f', 0.0),
    adasLed: emit('#0a2a10', '#34ff6a', 1.6),
  }

  const rubber = new THREE.MeshStandardMaterial({
    color: '#151515', roughness: 0.9, metalness: 0, normalMap: makeTyreNormalMap(), normalScale: new THREE.Vector2(0.9, 0.9),
  })
  const wheelArch = new THREE.MeshStandardMaterial({ color: '#070707', roughness: 0.92, metalness: 0, side: THREE.DoubleSide })
  const underbody = new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  // Underside of hood / boot lid: grey insulation pad
  const panelInner = new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.95, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 })
  const disc = new THREE.MeshStandardMaterial({ color: '#8d8f93', metalness: 1, roughness: 0.38 })
  const discHat = new THREE.MeshStandardMaterial({ color: '#3a3b3e', metalness: 0.7, roughness: 0.55 })
  const caliper = new THREE.MeshPhysicalMaterial({ color: '#b3121a', metalness: 0.1, roughness: 0.35, clearcoat: 0.8 })
  const caliperGrey = new THREE.MeshStandardMaterial({ color: '#5a5d63', metalness: 0.6, roughness: 0.45 })
  const lug = new THREE.MeshStandardMaterial({ color: '#c8cbd0', metalness: 1, roughness: 0.2 })

  const rims = {
    // 2026 City ZX: diamond-cut machined faces over gloss-black pockets
    stock: {
      face: new THREE.MeshPhysicalMaterial({ color: '#d4d8dd', metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06 }),
      pocket: new THREE.MeshPhysicalMaterial({ color: '#0c0d0f', metalness: 0.5, roughness: 0.25, clearcoat: 1 }),
      barrel: new THREE.MeshStandardMaterial({ color: '#1c1d20', metalness: 0.9, roughness: 0.35 }),
    },
    // V grade: multi-spoke painted gunmetal grey
    sport: {
      face: new THREE.MeshPhysicalMaterial({ color: '#7c8189', metalness: 0.9, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
      pocket: new THREE.MeshStandardMaterial({ color: '#4a4e55', metalness: 0.85, roughness: 0.38 }),
      barrel: new THREE.MeshStandardMaterial({ color: '#5a5e65', metalness: 0.9, roughness: 0.35 }),
    },
    carbon: {
      face: new THREE.MeshPhysicalMaterial({ color: '#141416', metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03 }),
      pocket: new THREE.MeshStandardMaterial({ color: '#0b0b0c', metalness: 0.4, roughness: 0.5 }),
      barrel: new THREE.MeshStandardMaterial({ color: '#1a1b1d', metalness: 0.8, roughness: 0.4 }),
    },
  }

  const plateFront = new THREE.MeshStandardMaterial({ map: makePlateTexture('MH 12 HC 2026'), roughness: 0.35, metalness: 0.1 })
  const plateRear = new THREE.MeshStandardMaterial({ map: makePlateTexture('MH 12 HC 2026'), roughness: 0.35, metalness: 0.1 })

  SET = {
    paint, doorTrim, blackPlastic, cowl, grilleBack, blackGloss, chrome, satinChrome, darkChrome, lampHousing, tailHousing,
    glassFrit, lens, tailLens, mirrorGlass, makeWindowGlass, lights, rubber, wheelArch, underbody, panelInner,
    disc, discHat, caliper, caliperGrey, lug, rims, plateFront, plateRear, flakes,
  }
  return SET
}

/** Apply a paint swatch + finish to the shared paint material. */
export function applyPaint(m, swatch, finish) {
  m.color.set(swatch.hex)
  if (finish === 'matte') {
    m.metalness = Math.min(0.55, swatch.metalness)
    m.roughness = 0.58
    m.clearcoat = 0.0
    m.normalScale.set(0.02, 0.02)
    m.iridescence = 0
  } else {
    m.metalness = swatch.metalness
    m.roughness = swatch.roughness
    m.clearcoat = 1
    m.clearcoatRoughness = swatch.clearcoatRoughness ?? 0.03
    m.normalScale.set(swatch.flake ?? 0.09, swatch.flake ?? 0.09)
    m.iridescence = swatch.pearl ?? 0
    m.iridescenceIOR = 1.35
    m.iridescenceThicknessRange = [180, 420]
  }
  m.needsUpdate = false
}
