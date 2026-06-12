import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Wifi, Navigation, ShieldCheck, Thermometer, Fuel } from 'lucide-react'
import { useCarState } from '../hooks/useCarState'
import { useScreenConfig } from '../hooks/useScreenConfig'

// ── SVG gauge constants (shared viewBox = 200×200) ────────────────────────────
const R = 78, CX = 100, CY = 100
const CIRC = 2 * Math.PI * R
const SWEEP_LEN = (240 / 360) * CIRC

function polarToXY(angleDeg, radius = R) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

// ── Arc gauge (RPM, shared with ArcGauge wrapper) ────────────────────────────
function ArcGauge({ value, max, color, startAngle = 150, size = 200, children }) {
  const fillLen = Math.min(value / max, 1) * SWEEP_LEN
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className="select-none">
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="6"
        strokeDasharray={`${SWEEP_LEN} ${CIRC}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${CX} ${CY})`} />
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${fillLen} ${CIRC}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${CX} ${CY})`}
        style={{ transition: 'stroke-dasharray 0.4s cubic-bezier(.34,1.56,.64,1)' }}
        filter={`drop-shadow(0 0 6px ${color}80)`} />
      {children}
    </svg>
  )
}

// ── Speedometer (same on all sizes, just SVG scaled) ─────────────────────────
function Speedometer({ speed, size = 220, unit = 'kmh' }) {
  // speed arrives in km/h; convert for display + gauge when mph selected
  const displaySpeed = unit === 'mph' ? Math.round(speed * 0.621371) : speed
  const pct = Math.min(displaySpeed / 120, 1)
  const fillLen = pct * SWEEP_LEN
  const needleDeg = 150 + pct * 240

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox="0 0 200 200" className="select-none">
        <circle cx={CX} cy={CY} r="90" fill="none"
          stroke="rgba(255,255,255,0.03)" strokeWidth="2" />
        {Array.from({ length: 13 }, (_, i) => {
          const angle = 150 + i * 20
          const outer = polarToXY(angle, 85)
          const inner = polarToXY(angle, i % 2 === 0 ? 76 : 80)
          return (
            <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
              stroke={i % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
              strokeWidth={i % 2 === 0 ? 1.5 : 0.8} />
          )
        })}
        {[0, 20, 40, 60, 80, 100, 120].map((s) => {
          const { x, y } = polarToXY(150 + (s / 120) * 240, 66)
          return (
            <text key={s} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.45)" fontSize="7" fontFamily="Inter, sans-serif">{s}</text>
          )
        })}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="5"
          strokeDasharray={`${SWEEP_LEN} ${CIRC}`}
          strokeLinecap="round"
          transform={`rotate(150 ${CX} ${CY})`} />
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke={speed > 100 ? '#ff4040' : speed > 80 ? '#ffaa00' : '#00d4ff'}
          strokeWidth="5"
          strokeDasharray={`${fillLen} ${CIRC}`}
          strokeLinecap="round"
          transform={`rotate(150 ${CX} ${CY})`}
          style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.5s ease' }}
          filter="drop-shadow(0 0 8px rgba(0,212,255,0.7))" />
        {/* Needle — rotated group, since SVG x2/y2 attributes are not CSS-transitionable */}
        <g style={{
          transform: `rotate(${needleDeg}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 0.3s cubic-bezier(.34,1.2,.64,1)',
        }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - 62}
            stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
        </g>
        <circle cx={CX} cy={CY} r="4" fill="#00d4ff" filter="drop-shadow(0 0 6px #00d4ff)" />
        <text x={CX} y={CY + 22} textAnchor="middle" fill="white"
          fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif"
          style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }}>{displaySpeed}</text>
        <text x={CX} y={CY + 34} textAnchor="middle"
          fill="rgba(255,255,255,0.5)" fontSize="7" fontFamily="Inter, sans-serif">
          {unit === 'mph' ? 'MPH' : 'km/h'}
        </text>
      </svg>
    </div>
  )
}

// ── Full-size sub-gauges (12.3" and 15.6") ────────────────────────────────────
function FuelGauge({ fuel }) {
  const color = fuel < 0.2 ? '#ff4040' : fuel < 0.4 ? '#ffaa00' : '#44ff88'
  return (
    <div className="flex flex-col items-center gap-1">
      <Fuel size={13} color={color} />
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${fuel * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="text-[10px] text-white/40 font-mono">{Math.round(fuel * 48)}L / 48L</span>
    </div>
  )
}

function RpmGauge({ rpm, size = 120 }) {
  const color = rpm > 5500 ? '#ff4040' : rpm > 4000 ? '#ffaa00' : '#44ff88'
  return (
    <div className="flex flex-col items-center">
      <ArcGauge value={rpm} max={7000} size={size} color={color}>
        <text x={CX} y={CY + 12} textAnchor="middle" fill="white"
          fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif">
          {(rpm / 1000).toFixed(1)}
        </text>
        <text x={CX} y={CY + 26} textAnchor="middle"
          fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="Inter, sans-serif">
          ×1000 RPM
        </text>
      </ArcGauge>
    </div>
  )
}

function TempGauge({ temp }) {
  const pct = (temp - 60) / 50
  const color = temp > 100 ? '#ff4040' : temp > 90 ? '#ffaa00' : '#00d4ff'
  return (
    <div className="flex flex-col items-center gap-1">
      <Thermometer size={13} color={color} />
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <span className="text-[10px] text-white/40 font-mono">{temp}°C</span>
    </div>
  )
}

// ── Compact bar gauges (10" only) — horizontal labeled bars ──────────────────
function CompactGaugeRow({ rpm, temp, fuel }) {
  const rpmColor  = rpm  > 5500 ? '#ff4040' : rpm  > 4000 ? '#ffaa00' : '#44ff88'
  const tempColor = temp > 100  ? '#ff4040' : temp >   90 ? '#ffaa00' : '#00d4ff'
  const fuelColor = fuel < 0.2  ? '#ff4040' : fuel <  0.4 ? '#ffaa00' : '#44ff88'

  const rows = [
    { icon: '◎', label: 'RPM',  pct: rpm / 7000,  value: `${(rpm / 1000).toFixed(1)}k`, color: rpmColor  },
    { icon: '⊙', label: 'TEMP', pct: (temp - 60) / 50, value: `${temp}°`,          color: tempColor },
    { icon: '▮', label: 'FUEL', pct: fuel,         value: `${Math.round(fuel * 48)}L`, color: fuelColor },
  ]

  return (
    <div className="glass rounded-xl p-2.5 space-y-2.5">
      {rows.map(({ label, pct, value, color }) => (
        <div key={label} className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] text-white/35 w-7 flex-shrink-0 font-bold tracking-wider">{label}</span>
          <div className="flex-1 min-w-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(Math.max(pct, 0), 1) * 100}%`,
                background: color,
                boxShadow: `0 0 6px ${color}80`,
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-white/65 w-7 text-right flex-shrink-0">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ── ADAS badges ───────────────────────────────────────────────────────────────
const ADAS_KEYS = [
  { key: 'lka', label: 'LKA', icon: Navigation },
  { key: 'acc', label: 'ACC', icon: ShieldCheck },
  { key: 'fcw', label: 'FCW', icon: Activity    },
  { key: 'bsm', label: 'BSM', icon: Wifi        },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function DriverCluster() {
  const adasState       = useCarState(s => s.adasState)
  const speedUnit       = useCarState(s => s.speedUnit)
  const isIntroComplete = useCarState(s => s.isIntroComplete)
  const config          = useScreenConfig()

  const [speed, setSpeed] = useState(65)
  const [rpm,   setRpm  ] = useState(2400)
  const [gear]            = useState('D')
  const [fuel]            = useState(0.72)
  const [engineTemp]      = useState(88)
  const [time,  setTime ] = useState(new Date())

  useEffect(() => {
    let dir = 1
    const id = setInterval(() => {
      setSpeed(s => {
        const next = s + dir * (Math.random() * 0.08)
        if (next > 68) dir = -1
        if (next < 62) dir = 1
        return Math.round(next * 10) / 10
      })
      setRpm(r => {
        const target = Math.round(2200 + Math.random() * 400)
        return Math.round(r + (target - r) * 0.08)
      })
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  // ── 10" compact layout ─────────────────────────────────────────────────────
  if (config.compactCluster) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={isIntroComplete ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="h-full flex flex-col gap-2 overflow-y-auto scrollbar-none py-3 px-2"
      >
        {/* Compact header — single row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[8px] text-white/25 tracking-widest uppercase">Honda City</div>
            <div className="text-[10px] text-white/55 font-semibold leading-tight">ZX Turbo</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-white text-glow-white">{timeStr}</div>
            <div className="text-[8px] text-white/25">22°C</div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-shrink-0" />

        {/* Speedometer — centered, sized to fit */}
        <div className="flex items-center justify-center flex-shrink-0">
          <Speedometer speed={Math.round(speed)} size={config.speedometerSize} unit={speedUnit} />
        </div>

        {/* Gear + ODO — tight row */}
        <div className="flex items-center justify-between">
          <div className="glass rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <span className="text-[8px] text-white/35 uppercase tracking-wide">Gear</span>
            <span className="text-lg font-black text-cyan-400 text-glow-cyan leading-none">{gear}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-white/30">ODO</span>
            <span className="text-[11px] font-mono text-white/75">18,432 km</span>
          </div>
        </div>

        {/* Compact bar gauges — replaces arc + w-24/w-20 bars */}
        <CompactGaugeRow rpm={rpm} temp={engineTemp} fuel={fuel} />
      </motion.div>
    )
  }

  // ── 12.3" and 15.6" full layout ───────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={isIntroComplete ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col gap-3 overflow-y-auto scrollbar-none py-4 px-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/30 tracking-widest uppercase font-medium">Honda City</div>
          <div className="text-xs text-white/60 font-semibold">ZX·Turbo CVT</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-white text-glow-white">{timeStr}</div>
          <div className="text-[10px] text-white/30">22°C Outside</div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Speedometer */}
      <div className="flex items-center justify-center">
        <Speedometer speed={Math.round(speed)} size={config.speedometerSize} unit={speedUnit} />
      </div>

      {/* Gear + ODO */}
      <div className="flex items-center justify-between px-2">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Gear</span>
          <span className="text-2xl font-black text-cyan-400 text-glow-cyan">{gear}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-white/40">ODO</span>
          <span className="text-sm font-mono text-white/80">18,432 km</span>
        </div>
      </div>

      {/* RPM + Temp + Fuel — 3-col arc+bar row */}
      <div className="glass rounded-2xl p-3">
        <div className="grid grid-cols-3 gap-2 items-center min-w-0">
          <RpmGauge rpm={rpm} size={config.rpmGaugeSize} />
          <TempGauge temp={engineTemp} />
          <FuelGauge fuel={fuel} />
        </div>
      </div>

      {/* ADAS status */}
      {config.showAdasCluster && (
        <div className="glass rounded-2xl p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Honda Sensing™</div>
          <div className="grid grid-cols-4 gap-1">
            {ADAS_KEYS.map(({ key, label, icon: Icon }) => {
              const active = adasState[key]
              return (
                <div key={key}
                  className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-300 ${
                    active ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-white/5 border border-white/5'
                  }`}>
                  <Icon size={14} color={active ? '#00d4ff' : 'rgba(255,255,255,0.3)'}
                    style={active ? { filter: 'drop-shadow(0 0 4px #00d4ff)' } : {}} />
                  <span className={`text-[9px] font-semibold tracking-wider ${
                    active ? 'text-cyan-400' : 'text-white/25'
                  }`}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trip computer */}
      {config.showTripComputer && (
        <div className="glass rounded-2xl p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Trip A</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-mono font-bold text-white">124.3</div>
              <div className="text-[9px] text-white/30">km</div>
            </div>
            <div>
              <div className="text-base font-mono font-bold text-white">4.8</div>
              <div className="text-[9px] text-white/30">L/100km</div>
            </div>
            <div>
              <div className="text-base font-mono font-bold text-white">52</div>
              <div className="text-[9px] text-white/30">km/h avg</div>
            </div>
          </div>
        </div>
      )}

      {/* Alert */}
      {config.showAlerts && (
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="glass rounded-2xl p-3 border border-green-500/20 bg-green-500/5"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[11px] text-green-400 font-medium">All systems nominal</span>
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">Next service in 2,568 km</div>
        </motion.div>
      )}
    </motion.div>
  )
}
