// Turns an analytic surface fn(u, v) → [x, y, z] into BufferGeometries.
//
// A "lattice" is the surface sampled on a tensor grid of u/v stations with
// analytic (finite-difference) normals, so separately built patches that
// share a boundary also share identical normals — no shading seams between
// a door and the body around it.
import * as THREE from 'three'

/** Sorted stations covering [min,max] at ~step spacing that always include the
 *  feature values exactly; uniform samples too close to a feature are dropped. */
export function stations(min, max, step, features = []) {
  const feats = features.filter((f) => f >= min - 1e-9 && f <= max + 1e-9)
  feats.push(min, max)
  feats.sort((a, b) => a - b)
  const out = [...feats]
  const n = Math.max(1, Math.ceil((max - min) / step))
  const minGap = step * 0.3
  for (let i = 1; i < n; i++) {
    const x = min + ((max - min) * i) / n
    if (feats.every((f) => Math.abs(f - x) > minGap)) out.push(x)
  }
  out.sort((a, b) => a - b)
  const dedup = []
  for (const x of out) if (!dedup.length || x - dedup[dedup.length - 1] > 1e-6) dedup.push(x)
  return dedup
}

/** Subset of stations strictly inside (a,b) plus the exact end values. */
export function clip(st, a, b) {
  const out = [a]
  for (const x of st) if (x > a + 1e-6 && x < b - 1e-6) out.push(x)
  out.push(b)
  return out
}

/** Add extra stations densely spread around given values (crease sharpening). */
export function densify(st, centers, offsets) {
  const extra = []
  for (const c of centers) for (const o of offsets) extra.push(c + o, c - o)
  const all = [...st, ...extra.filter((x) => x > st[0] && x < st[st.length - 1])]
  all.sort((a, b) => a - b)
  const out = []
  for (const x of all) if (!out.length || x - out[out.length - 1] > 1e-6) out.push(x)
  return out
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** Outward unit normal of fn at (u,v), robust to degenerate (zero-height) bands. */
export function surfaceNormal(fn, u, v, dom, sign) {
  for (const h of [2e-4, 2e-3, 1e-2, 4e-2]) {
    const u0 = Math.max(dom.uMin, u - h)
    const u1 = Math.min(dom.uMax, u + h)
    const v0 = Math.max(dom.vMin, v - h)
    const v1 = Math.min(dom.vMax, v + h)
    const su = sub(fn(u1, v), fn(u0, v))
    const sv = sub(fn(u, v1), fn(u, v0))
    const n = cross(sv, su)
    const len = Math.hypot(n[0], n[1], n[2])
    if (len > 1e-12) return [(n[0] / len) * sign, (n[1] / len) * sign, (n[2] / len) * sign]
  }
  return [0, 1, 0]
}

/** Sample fn on the grid us × vs. offset pushes points along the normal. */
export function lattice(fn, us, vs, dom, { offset = 0 } = {}) {
  const nu = us.length
  const nv = vs.length
  const P = new Float32Array(nu * nv * 3)
  const N = new Float32Array(nu * nv * 3)
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p = fn(us[i], vs[j])
      const n = surfaceNormal(fn, us[i], vs[j], dom, dom.sign)
      const o = (i * nv + j) * 3
      P[o] = p[0] + n[0] * offset
      P[o + 1] = p[1] + n[1] * offset
      P[o + 2] = p[2] + n[2] * offset
      N[o] = n[0]
      N[o + 1] = n[1]
      N[o + 2] = n[2]
    }
  }
  return { P, N, us, vs, nu, nv, dom }
}

function cellArea2(P, a, b, c) {
  const ab = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]]
  const ac = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]
  const n = cross(ab, ac)
  return n[0] * n[0] + n[1] * n[1] + n[2] * n[2]
}

/**
 * Emit the cells of a lattice for which pred(uMid, vMid) is true.
 * opts.flip reverses winding + normals (inner/cabin-facing surfaces).
 * opts.color(u,v) → [r,g,b,a] adds a vertex-colour attribute.
 * opts.uvScale scales the (u,v) parameters into texture space.
 */
export function regionGeometry(L, pred = () => true, opts = {}) {
  const { P, N, us, vs, nu, nv } = L
  const { flip = false, color = null, uvScale = [1, 1] } = opts
  const map = new Int32Array(nu * nv).fill(-1)
  const pos = []
  const nor = []
  const uv = []
  const col = []
  const idx = []
  const vert = (i, j) => {
    const k = i * nv + j
    if (map[k] >= 0) return map[k]
    const o = k * 3
    const id = pos.length / 3
    pos.push(P[o], P[o + 1], P[o + 2])
    const s = flip ? -1 : 1
    nor.push(N[o] * s, N[o + 1] * s, N[o + 2] * s)
    uv.push(us[i] * uvScale[0], vs[j] * uvScale[1])
    if (color) col.push(...color(us[i], vs[j]))
    map[k] = id
    return id
  }
  for (let i = 0; i < nu - 1; i++) {
    for (let j = 0; j < nv - 1; j++) {
      if (!pred((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue
      const a = (i * nv + j) * 3
      const b = ((i + 1) * nv + j) * 3
      const c = ((i + 1) * nv + j + 1) * 3
      const d = (i * nv + j + 1) * 3
      const t1 = cellArea2(P, a, b, c) > 1e-14
      const t2 = cellArea2(P, a, c, d) > 1e-14
      if (!t1 && !t2) continue
      const A = vert(i, j)
      const B = vert(i + 1, j)
      const C = vert(i + 1, j + 1)
      const D = vert(i, j + 1)
      // Winding chosen so the face normal agrees with the analytic normal
      const outward = L.dom.sign > 0 ? !flip : flip
      if (outward) {
        if (t1) idx.push(A, C, B)
        if (t2) idx.push(A, D, C)
      } else {
        if (t1) idx.push(A, B, C)
        if (t2) idx.push(A, C, D)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

/**
 * Give a lattice patch real thickness. Groups: 0 outer skin, 1 inner skin
 * (offset along −normal), 2 v-min edge, 3 v-max edge, 4 u-min edge,
 * 5 u-max edge. opts.edges toggles each wall [vMin, vMax, uMin, uMax].
 */
export function solidify(L, thickness, opts = {}) {
  const { P, N, us, vs, nu, nv } = L
  const { uvScale = [1, 1], edges = [true, true, true, true] } = opts
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const groups = [[], [], [], [], [], []]
  const push = (x, y, z, nx, ny, nz, u, v) => {
    pos.push(x, y, z)
    nor.push(nx, ny, nz)
    uv.push(u, v)
    return pos.length / 3 - 1
  }
  const outer = []
  const inner = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const o = (i * nv + j) * 3
      outer.push(push(P[o], P[o + 1], P[o + 2], N[o], N[o + 1], N[o + 2], us[i] * uvScale[0], vs[j] * uvScale[1]))
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const o = (i * nv + j) * 3
      inner.push(push(
        P[o] - N[o] * thickness, P[o + 1] - N[o + 1] * thickness, P[o + 2] - N[o + 2] * thickness,
        -N[o], -N[o + 1], -N[o + 2], us[i] * uvScale[0], vs[j] * uvScale[1],
      ))
    }
  }
  const outward = L.dom.sign > 0
  for (let i = 0; i < nu - 1; i++) {
    for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j
      const b = (i + 1) * nv + j
      const c = (i + 1) * nv + j + 1
      const d = i * nv + j + 1
      if (outward) groups[0].push(outer[a], outer[c], outer[b], outer[a], outer[d], outer[c])
      else groups[0].push(outer[a], outer[b], outer[c], outer[a], outer[c], outer[d])
      if (outward) groups[1].push(inner[a], inner[b], inner[c], inner[a], inner[c], inner[d])
      else groups[1].push(inner[a], inner[c], inner[b], inner[a], inner[d], inner[c])
    }
  }
  // Edge walls — each quad oriented away from the patch interior
  const wall = (ka, kb, kIn, gi) => {
    const pa = [P[ka * 3], P[ka * 3 + 1], P[ka * 3 + 2]]
    const pb = [P[kb * 3], P[kb * 3 + 1], P[kb * 3 + 2]]
    const pi = [P[kIn * 3], P[kIn * 3 + 1], P[kIn * 3 + 2]]
    const na = [N[ka * 3], N[ka * 3 + 1], N[ka * 3 + 2]]
    const qa = [pa[0] - na[0] * thickness, pa[1] - na[1] * thickness, pa[2] - na[2] * thickness]
    const out = sub(pa, pi)
    const len = Math.hypot(...out) || 1
    const on = [out[0] / len, out[1] / len, out[2] / len]
    const nb = [N[kb * 3], N[kb * 3 + 1], N[kb * 3 + 2]]
    const qb = [pb[0] - nb[0] * thickness, pb[1] - nb[1] * thickness, pb[2] - nb[2] * thickness]
    const fn = cross(sub(pb, pa), sub(qa, pa))
    const i0 = push(...pa, ...on, 0, 0)
    const i1 = push(...pb, ...on, 1, 0)
    const i2 = push(...qb, ...on, 1, 1)
    const i3 = push(...qa, ...on, 0, 1)
    if (cross(sub(pb, pa), sub(qa, pa)).every((c) => c === 0)) return
    if (fn[0] * on[0] + fn[1] * on[1] + fn[2] * on[2] >= 0) groups[gi].push(i0, i1, i3, i1, i2, i3)
    else groups[gi].push(i0, i3, i1, i1, i3, i2)
  }
  if (nv > 1) {
    for (let i = 0; i < nu - 1; i++) {
      if (edges[0]) wall(i * nv, (i + 1) * nv, i * nv + 1, 2)
      if (edges[1]) wall(i * nv + nv - 1, (i + 1) * nv + nv - 1, i * nv + nv - 2, 3)
    }
  }
  if (nu > 1) {
    for (let j = 0; j < nv - 1; j++) {
      if (edges[2]) wall(j, j + 1, nv + j, 4)
      if (edges[3]) wall((nu - 1) * nv + j, (nu - 1) * nv + j + 1, (nu - 2) * nv + j, 5)
    }
  }
  let start = 0
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  groups.forEach((list, gi) => {
    idx.push(...list)
    g.addGroup(start, list.length, gi)
    start += list.length
  })
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/**
 * A strip that follows a curve on the surface: v fixed at vc, u from u0→u1,
 * extruded `width` along the surface (in v) and lifted `lift` off it, with
 * rounded section. Useful for chrome trims, DRL light guides, mouldings.
 */
export function surfaceStrip(fn, dom, { u0, u1, vc, halfV, lift = 0.002, segs = 64, radial = 6, bulge = 0.004, uvScale = 1 }) {
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const ring = radial + 1
  for (let i = 0; i <= segs; i++) {
    const u = u0 + ((u1 - u0) * i) / segs
    for (let r = 0; r <= radial; r++) {
      const a = r / radial // 0..1 across the strip
      const v = vc - halfV + 2 * halfV * a
      const p = fn(u, v)
      const n = surfaceNormal(fn, u, v, dom, dom.sign)
      const h = lift + bulge * Math.sin(Math.PI * a)
      pos.push(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)
      nor.push(n[0], n[1], n[2])
      uv.push(((u - u0) / (u1 - u0)) * uvScale, a)
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let r = 0; r < radial; r++) {
      const a = i * ring + r
      const b = (i + 1) * ring + r
      const c = (i + 1) * ring + r + 1
      const d = i * ring + r + 1
      if (dom.sign > 0) idx.push(a, c, b, a, d, c)
      else idx.push(a, b, c, a, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/**
 * Like surfaceStrip but follows an arbitrary polyline in parameter space
 * (points = [[u,v],...]); the strip width is perpendicular to the path.
 * `scale` converts (u,v) to roughly metric units so widths are uniform.
 */
export function surfacePath(fn, dom, { points, halfW, lift = 0.002, bulge = 0.003, segs = 60, radial = 5, scale = [1, 1.35] }) {
  const sp = points.map(([u, v]) => [u * scale[0], v * scale[1]])
  const cum = [0]
  for (let i = 1; i < sp.length; i++) cum.push(cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]))
  const total = cum[cum.length - 1]
  const segDir = (i) => {
    const a = sp[Math.max(0, i - 1)]
    const b = sp[Math.min(sp.length - 1, i)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  }
  const pos = []
  const idx = []
  const ring = radial + 1
  for (let i = 0; i <= segs; i++) {
    const d = (total * i) / segs
    let k = 1
    while (k < cum.length - 1 && cum[k] < d) k++
    const t = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)
    const U = sp[k - 1][0] + (sp[k][0] - sp[k - 1][0]) * t
    const V = sp[k - 1][1] + (sp[k][1] - sp[k - 1][1]) * t
    let [tu, tv] = segDir(k)
    // soften the corner by blending with the neighbouring segment direction
    if (t < 0.15 && k > 1) { const p = segDir(k - 1); tu = (tu + p[0]) / 2; tv = (tv + p[1]) / 2 }
    if (t > 0.85 && k < sp.length - 1) { const n = segDir(k + 1); tu = (tu + n[0]) / 2; tv = (tv + n[1]) / 2 }
    const l = Math.hypot(tu, tv) || 1
    const px = -tv / l
    const py = tu / l
    for (let r = 0; r <= radial; r++) {
      const a = r / radial
      const o = (a * 2 - 1) * halfW
      const u = Math.min(dom.uMax, Math.max(dom.uMin, (U + px * o) / scale[0]))
      const v = Math.min(dom.vMax, Math.max(dom.vMin, (V + py * o) / scale[1]))
      const p = fn(u, v)
      const n = surfaceNormal(fn, u, v, dom, dom.sign)
      const h = lift + bulge * Math.sin(Math.PI * a)
      pos.push(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let r = 0; r < radial; r++) {
      const a = i * ring + r
      const b = (i + 1) * ring + r
      const c = (i + 1) * ring + r + 1
      const d = i * ring + r + 1
      if (dom.sign > 0) idx.push(a, c, b, a, d, c)
      else idx.push(a, b, c, a, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Keep only the edge-wall groups (≥ 2) of a solidified geometry. */
export function wallsOnly(solid) {
  const idx = solid.getIndex().array
  const keep = []
  for (const gr of solid.groups) {
    if (gr.materialIndex < 2) continue
    for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i])
  }
  const g = solid.clone()
  g.clearGroups()
  g.setIndex(keep)
  return g
}

/** Point + outward normal + tangent basis on the surface (for placing parts). */
export function frameAt(fn, dom, u, v) {
  const p = fn(u, v)
  const n = surfaceNormal(fn, u, v, dom, dom.sign)
  const h = 1e-3
  const a = fn(Math.min(dom.uMax, u + h), v)
  const b = fn(Math.max(dom.uMin, u - h), v)
  const tu = sub(a, b)
  const l = Math.hypot(...tu) || 1
  return {
    position: new THREE.Vector3(...p),
    normal: new THREE.Vector3(...n),
    tangent: new THREE.Vector3(tu[0] / l, tu[1] / l, tu[2] / l),
  }
}
