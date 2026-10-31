// Canvas-drawn UI for the in-cabin displays (instrument cluster, 8" touch
// screen, climate panel). Drawn once into CanvasTextures used as emissive maps.
import * as THREE from 'three'

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.generateMipmaps = true
  return t
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

const FONT = 'Inter, "Segoe UI", Arial, sans-serif'

/** Semi-digital cluster as in the 2026 City: 7" TFT on the left, analog
 *  speedometer on the right. */
export function makeClusterTexture(accent = '#00d4ff') {
  const [c, g] = canvas(1024, 384)
  const bg = g.createLinearGradient(0, 0, 0, 384)
  bg.addColorStop(0, '#05070c')
  bg.addColorStop(1, '#010204')
  g.fillStyle = bg
  g.fillRect(0, 0, 1024, 384)

  // Analog speedometer (right)
  const cx = 784
  const cy = 200
  const R = 160
  const a0 = Math.PI * 0.75
  const a1 = Math.PI * 2.25
  g.lineCap = 'round'
  g.strokeStyle = 'rgba(255,255,255,0.08)'
  g.lineWidth = 14
  g.beginPath()
  g.arc(cx, cy, R, a0, a1)
  g.stroke()
  const speed = 67 / 200
  const grd = g.createLinearGradient(cx - R, 0, cx + R, 0)
  grd.addColorStop(0, '#0a6cff')
  grd.addColorStop(1, accent)
  g.strokeStyle = grd
  g.shadowColor = accent
  g.shadowBlur = 18
  g.beginPath()
  g.arc(cx, cy, R, a0, a0 + (a1 - a0) * speed)
  g.stroke()
  g.shadowBlur = 0
  // ticks + numerals
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.font = `600 22px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i <= 10; i++) {
    const a = a0 + ((a1 - a0) * i) / 10
    const cs = Math.cos(a)
    const sn = Math.sin(a)
    g.strokeStyle = 'rgba(255,255,255,0.55)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx + cs * (R - 26), cy + sn * (R - 26))
    g.lineTo(cx + cs * (R - 12), cy + sn * (R - 12))
    g.stroke()
    g.fillText(String(i * 20), cx + cs * (R - 52), cy + sn * (R - 52))
  }
  // needle
  const na = a0 + (a1 - a0) * speed
  g.strokeStyle = '#ff3b3b'
  g.lineWidth = 5
  g.shadowColor = '#ff3b3b'
  g.shadowBlur = 10
  g.beginPath()
  g.moveTo(cx, cy)
  g.lineTo(cx + Math.cos(na) * (R - 30), cy + Math.sin(na) * (R - 30))
  g.stroke()
  g.shadowBlur = 0
  g.fillStyle = '#1a1d24'
  g.beginPath()
  g.arc(cx, cy, 46, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#fff'
  g.font = `700 40px ${FONT}`
  g.fillText('67', cx, cy - 4)
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.font = `500 15px ${FONT}`
  g.fillText('km/h', cx, cy + 26)

  // TFT panel (left) — authored at x 470…990, shifted into the left half
  g.save()
  g.translate(-436, 0)
  roundRect(g, 470, 40, 520, 304, 22)
  g.fillStyle = 'rgba(14,20,30,0.95)'
  g.fill()
  g.strokeStyle = 'rgba(0,212,255,0.25)'
  g.lineWidth = 2
  g.stroke()
  g.textAlign = 'left'
  g.fillStyle = accent
  g.font = `800 64px ${FONT}`
  g.fillText('D', 500, 100)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.font = `600 22px ${FONT}`
  g.fillText('ECON', 560, 92)
  g.fillStyle = 'rgba(255,255,255,0.45)'
  g.font = `500 18px ${FONT}`
  g.fillText('Range 512 km', 560, 118)
  // lane-keep graphic
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = 4
  g.setLineDash([16, 12])
  for (const x of [700, 900]) {
    g.beginPath()
    g.moveTo(x, 300)
    g.lineTo(x + (x < 800 ? 50 : -50), 150)
    g.stroke()
  }
  g.setLineDash([])
  g.fillStyle = accent
  roundRect(g, 770, 230, 60, 70, 12)
  g.fill()
  g.fillStyle = 'rgba(0,212,255,0.25)'
  roundRect(g, 782, 160, 36, 40, 8)
  g.fill()
  // fuel bar
  g.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(g, 500, 300, 160, 12, 6)
  g.fill()
  g.fillStyle = '#34d399'
  roundRect(g, 500, 300, 115, 12, 6)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.font = `500 16px ${FONT}`
  g.fillText('ODO 18,432 km', 500, 280)
  g.textAlign = 'right'
  g.fillText('22°C', 970, 280)
  g.fillText('09:41', 970, 80)
  g.restore()
  return toTexture(c)
}

/** 8" touchscreen home: navigation map + media card + app dock. */
export function makeInfotainmentTexture(accent = '#00d4ff') {
  const [c, g] = canvas(1024, 600)
  g.fillStyle = '#0b1220'
  g.fillRect(0, 0, 1024, 600)
  // Map — soft blocks and roads
  g.save()
  roundRect(g, 16, 64, 640, 452, 18)
  g.clip()
  g.fillStyle = '#0f1a2c'
  g.fillRect(16, 64, 640, 452)
  g.fillStyle = '#132238'
  for (let i = 0; i < 26; i++) {
    const x = 16 + ((i * 97) % 600)
    const y = 64 + ((i * 53) % 420)
    roundRect(g, x, y, 60 + (i % 3) * 30, 40 + (i % 4) * 16, 6)
    g.fill()
  }
  g.fillStyle = '#0d2a26'
  roundRect(g, 420, 90, 200, 120, 30)
  g.fill()
  g.strokeStyle = '#2b3b55'
  g.lineWidth = 14
  g.beginPath()
  g.moveTo(16, 380)
  g.bezierCurveTo(200, 360, 260, 200, 660, 180)
  g.moveTo(240, 64)
  g.lineTo(300, 520)
  g.moveTo(16, 160)
  g.lineTo(660, 300)
  g.stroke()
  g.strokeStyle = accent
  g.lineWidth = 8
  g.shadowColor = accent
  g.shadowBlur = 14
  g.beginPath()
  g.moveTo(150, 500)
  g.bezierCurveTo(200, 420, 240, 380, 280, 330)
  g.bezierCurveTo(330, 270, 460, 230, 600, 196)
  g.stroke()
  g.shadowBlur = 0
  // car arrow
  g.fillStyle = '#fff'
  g.beginPath()
  g.moveTo(150, 470)
  g.lineTo(168, 512)
  g.lineTo(150, 502)
  g.lineTo(132, 512)
  g.closePath()
  g.fill()
  g.restore()
  // next-turn card
  roundRect(g, 32, 80, 230, 74, 14)
  g.fillStyle = 'rgba(5,10,20,0.85)'
  g.fill()
  g.fillStyle = accent
  g.font = `800 34px ${FONT}`
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText('↱', 48, 117)
  g.fillStyle = '#fff'
  g.font = `700 26px ${FONT}`
  g.fillText('400 m', 92, 104)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.font = `500 17px ${FONT}`
  g.fillText('MG Road', 92, 132)

  // Status bar
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.font = `600 24px ${FONT}`
  g.fillText('09:41', 24, 34)
  g.textAlign = 'right'
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.font = `500 20px ${FONT}`
  g.fillText('22°C   ⦿ CarPlay   ▂▄▆', 1000, 34)

  // Media card
  g.textAlign = 'left'
  roundRect(g, 676, 64, 332, 220, 18)
  const mg = g.createLinearGradient(676, 64, 1008, 284)
  mg.addColorStop(0, '#3b1d6e')
  mg.addColorStop(1, '#0e3a5a')
  g.fillStyle = mg
  g.fill()
  roundRect(g, 696, 84, 96, 96, 14)
  const ag = g.createLinearGradient(696, 84, 792, 180)
  ag.addColorStop(0, '#ff4fd8')
  ag.addColorStop(1, accent)
  g.fillStyle = ag
  g.fill()
  g.fillStyle = '#fff'
  g.font = `700 24px ${FONT}`
  g.fillText('Cyberdrive', 808, 112)
  g.fillStyle = 'rgba(255,255,255,0.65)'
  g.font = `500 18px ${FONT}`
  g.fillText('Synthwave 2026', 808, 142)
  g.fillStyle = 'rgba(255,255,255,0.2)'
  roundRect(g, 696, 206, 292, 6, 3)
  g.fill()
  g.fillStyle = '#fff'
  roundRect(g, 696, 206, 120, 6, 3)
  g.fill()
  g.font = `700 30px ${FONT}`
  g.textAlign = 'center'
  g.fillText('⏮     ⏸     ⏭', 842, 250)

  // Climate / vehicle card
  roundRect(g, 676, 300, 332, 216, 18)
  g.fillStyle = '#121c2e'
  g.fill()
  g.textAlign = 'left'
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.font = `600 17px ${FONT}`
  g.fillText('HONDA SENSING', 700, 334)
  const chips = ['LKA', 'ACC', 'FCW', 'RDM']
  chips.forEach((t, i) => {
    roundRect(g, 700 + i * 76, 356, 66, 40, 10)
    g.fillStyle = i < 3 ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.06)'
    g.fill()
    g.fillStyle = i < 3 ? accent : 'rgba(255,255,255,0.4)'
    g.font = `700 16px ${FONT}`
    g.textAlign = 'center'
    g.fillText(t, 733 + i * 76, 377)
  })
  g.textAlign = 'left'
  g.fillStyle = '#fff'
  g.font = `700 44px ${FONT}`
  g.fillText('88%', 700, 452)
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.font = `500 17px ${FONT}`
  g.fillText('Fuel · 512 km range', 700, 490)

  // App dock
  const apps = [['⌂', '#334155'], ['➤', accent], ['♫', '#a855f7'], ['☏', '#22c55e'], ['❄', '#0ea5e9'], ['⚙', '#64748b']]
  apps.forEach(([ic, col], i) => {
    const x = 40 + i * 160
    roundRect(g, x, 530, 120, 56, 14)
    g.fillStyle = 'rgba(255,255,255,0.06)'
    g.fill()
    g.fillStyle = col
    g.font = `700 30px ${FONT}`
    g.textAlign = 'center'
    g.fillText(ic, x + 60, 559)
  })
  return toTexture(c)
}

/** Digital climate strip below the centre vents. */
export function makeClimateTexture() {
  const [c, g] = canvas(512, 96)
  g.fillStyle = '#05070b'
  g.fillRect(0, 0, 512, 96)
  g.textBaseline = 'middle'
  g.fillStyle = '#e5f6ff'
  g.font = `700 40px ${FONT}`
  g.textAlign = 'left'
  g.fillText('22.0°', 24, 50)
  g.textAlign = 'right'
  g.fillText('22.0°', 488, 50)
  g.textAlign = 'center'
  g.fillStyle = '#00d4ff'
  g.font = `600 24px ${FONT}`
  g.fillText('AUTO  ✻ ▮▮▮▯▯', 256, 50)
  return toTexture(c)
}
