import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Check } from 'lucide-react'
import { useCarState } from '../hooks/useCarState'
import { SCREEN_CONFIGS } from '../constants/screenSizes'

const SIZES = ['10', '12.3', '15.6']

// The cards themselves are sized proportionally to the display inch size —
// so 15.6" card is visibly larger than 10" card.
const CARD_DIMS = {
  '10':   { w: 200, h: 128 },
  '12.3': { w: 256, h: 164 },
  '15.6': { w: 320, h: 204 },
}

// Mini dashboard preview rendered inside each card
function DashPreview({ id, selected }) {
  const accent  = selected ? '#00d4ff' : 'rgba(255,255,255,0.22)'
  const leftPct = { '10': 0.24, '12.3': 0.30, '15.6': 0.33 }[id]
  const W = 120, H = 72          // fixed viewBox — card CSS scales it
  const leftW = Math.round(W * leftPct)
  const rightW = W - leftW

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Bezel */}
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3"
        fill="#050510" stroke={accent} strokeWidth={selected ? 1.4 : 0.7} />

      {/* Left cluster panel */}
      <rect x="1" y="1" width={leftW - 1} height={H - 2} rx="2"
        fill="rgba(255,255,255,0.04)" />
      {/* Speedometer arc */}
      <circle cx={1 + (leftW - 1) / 2} cy={H * 0.38} r={leftW * 0.32}
        fill="none" stroke={accent} strokeWidth="1"
        strokeDasharray={`${leftW * 0.9} 999`}
        opacity={selected ? 0.85 : 0.28} />
      <circle cx={1 + (leftW - 1) / 2} cy={H * 0.38} r={leftW * 0.1}
        fill={accent} opacity={selected ? 0.55 : 0.18} />
      {/* Cluster bars */}
      {[0.64, 0.76, 0.88].map((yPct, i) => (
        <rect key={i} x="3" y={H * yPct} width={leftW - 6} height="2" rx="1"
          fill="rgba(255,255,255,0.1)" />
      ))}

      {/* Canvas area */}
      <rect x={leftW + 1} y="1" width={rightW - 2} height={H - 10} rx="2"
        fill="rgba(0,0,0,0.45)" />
      {/* Car silhouette */}
      <ellipse cx={leftW + rightW * 0.5} cy={H * 0.45} rx={rightW * 0.28} ry={H * 0.18}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

      {/* Dock strip */}
      <rect x={leftW + 1} y={H - 8} width={rightW - 2} height="7" rx="1.5"
        fill="rgba(255,255,255,0.05)" />
      {[0.15, 0.35, 0.55, 0.75].map((xPct, i) => (
        <rect key={i}
          x={leftW + rightW * xPct} y={H - 6} width={rightW * 0.12} height="3" rx="1"
          fill={accent} opacity={selected ? 0.3 : 0.09} />
      ))}

      {/* Left dock strip */}
      <rect x="1" y={H - 8} width={leftW - 2} height="7" rx="1.5"
        fill="rgba(255,255,255,0.03)" />
    </svg>
  )
}

// Horizontal dimension arrow for showing inch width
function DimensionLine({ label, selected }) {
  const color = selected ? 'rgba(0,212,255,0.7)' : 'rgba(255,255,255,0.18)'
  return (
    <div className="flex items-center gap-1.5 mt-2" style={{ color }}>
      {/* Left tick */}
      <div style={{ width: 1, height: 8, background: 'currentColor', flexShrink: 0 }} />
      {/* Line */}
      <div style={{ flex: 1, height: 1, background: 'currentColor' }} />
      {/* Label */}
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {label}
      </span>
      {/* Line */}
      <div style={{ flex: 1, height: 1, background: 'currentColor' }} />
      {/* Right tick */}
      <div style={{ width: 1, height: 8, background: 'currentColor', flexShrink: 0 }} />
    </div>
  )
}

export default function ScreenSizePicker() {
  const setScreenMode = useCarState(s => s.setScreenMode)
  const [selected, setSelected] = useState('12.3')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 45%, #0a0d1a 0%, #030306 100%)',
        backgroundImage: `
          radial-gradient(ellipse at 50% 45%, #0a0d1a 0%, #030306 100%),
          linear-gradient(rgba(0,212,255,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.022) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      {/* Brand header */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.6 }}
        className="flex flex-col items-center gap-2 mb-14"
      >
        <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-1">
          <Monitor size={22} color="#00d4ff" />
        </div>
        <h1
          className="text-3xl font-black tracking-[0.12em] text-white uppercase"
          style={{ textShadow: '0 0 48px rgba(0,212,255,0.45)' }}
        >
          Honda City
        </h1>
        <div className="h-px w-28 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <p className="text-sm text-white/35 tracking-[0.3em] uppercase mt-1">
          Select your display size
        </p>
      </motion.div>

      {/* Size cards — bottom-aligned so they share a common baseline */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.6 }}
        className="flex items-end gap-8 mb-12"
      >
        {SIZES.map((id) => {
          const cfg  = SCREEN_CONFIGS[id]
          const dims = CARD_DIMS[id]
          const isSelected = selected === id

          return (
            <motion.button
              key={id}
              onClick={() => setSelected(id)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative flex flex-col focus:outline-none"
              style={{ width: dims.w }}
            >
              {/* Selection glow behind the card */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="absolute -inset-3 rounded-2xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.10) 0%, transparent 70%)',
                    }}
                  />
                )}
              </AnimatePresence>

              {/* The card — height varies with screen size */}
              <motion.div
                animate={{
                  borderColor: isSelected
                    ? 'rgba(0,212,255,0.55)'
                    : 'rgba(255,255,255,0.09)',
                  boxShadow: isSelected
                    ? '0 0 28px rgba(0,212,255,0.18), inset 0 0 0 1px rgba(0,212,255,0.12)'
                    : '0 8px 32px rgba(0,0,0,0.5)',
                }}
                transition={{ duration: 0.25 }}
                className="relative rounded-xl overflow-hidden"
                style={{
                  height: dims.h,
                  background: isSelected
                    ? 'rgba(0,212,255,0.05)'
                    : 'rgba(255,255,255,0.025)',
                  border: '1.5px solid',
                }}
              >
                {/* Dashboard preview fills the card */}
                <DashPreview id={id} selected={isSelected} />

                {/* Selected checkmark */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-500/30 border border-cyan-400/60
                                 flex items-center justify-center"
                    >
                      <Check size={10} color="#00d4ff" strokeWidth={3} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Dimension ruler beneath each card */}
              <DimensionLine label={cfg.label} selected={isSelected} />

              {/* Subtitle */}
              <div className="mt-2 text-center">
                <span
                  className="text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors duration-200"
                  style={{ color: isSelected ? 'rgba(0,212,255,0.85)' : 'rgba(255,255,255,0.28)' }}
                >
                  {cfg.subtitle}
                </span>
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      {/* Selected size detail */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.42 }}
        className="mb-8 text-center"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] text-white/30 tracking-widest"
          >
            {SCREEN_CONFIGS[selected].dockCompact
              ? 'Compact cluster · Mini dock · Essential controls'
              : SCREEN_CONFIGS[selected].id === '12.3'
                ? 'Full cluster · Expanded dock · Honda Sensing panel'
                : 'Full cluster · Wide dock · All panels & trip computer'
            }
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Launch button */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44, duration: 0.5 }}
        onClick={() => setScreenMode(selected)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="px-12 py-3.5 rounded-2xl text-sm font-bold tracking-widest uppercase"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.22) 0%, rgba(0,140,255,0.22) 100%)',
          border: '1px solid rgba(0,212,255,0.55)',
          color: '#00d4ff',
          boxShadow: '0 0 28px rgba(0,212,255,0.22)',
        }}
      >
        Launch Dashboard →
      </motion.button>

      <p className="mt-5 text-[10px] text-white/18 tracking-widest uppercase">
        Switch anytime from the toolbar
      </p>
    </motion.div>
  )
}
