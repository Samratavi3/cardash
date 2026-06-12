import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Palette, X, ChevronRight, Check } from 'lucide-react'
import { useCarState } from '../hooks/useCarState'
import { useScreenConfig } from '../hooks/useScreenConfig'
import { PAINT_COLORS } from '../constants/paintColors'
import { HOTSPOT_META } from '../constants/hotspots'

const WHEEL_STYLES = [
  {
    id: 'stock',
    name: '16″ Silver Alloy',
    desc: 'Factory fitment',
    preview: (
      <svg viewBox="0 0 48 48" className="w-12 h-12">
        <circle cx="24" cy="24" r="22" fill="#111" stroke="#666" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="15" fill="#888" stroke="#aaa" strokeWidth="1" />
        <circle cx="24" cy="24" r="4" fill="#555" />
        {[0,72,144,216,288].map(a => (
          <line key={a} x1="24" y1="24"
            x2={24 + 11 * Math.cos((a - 90) * Math.PI / 180)}
            y2={24 + 11 * Math.sin((a - 90) * Math.PI / 180)}
            stroke="#999" strokeWidth="2.5" />
        ))}
      </svg>
    ),
  },
  {
    id: 'sport',
    name: 'Sport 5-Spoke',
    desc: 'Gunmetal finish',
    preview: (
      <svg viewBox="0 0 48 48" className="w-12 h-12">
        <circle cx="24" cy="24" r="22" fill="#0a0a0a" stroke="#444" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="14" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
        <circle cx="24" cy="24" r="4" fill="#333" />
        {[0,72,144,216,288].map(a => (
          <g key={a} transform={`rotate(${a} 24 24)`}>
            <path d="M 24 24 L 21 11 L 27 11 Z" fill="#555" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    id: 'carbon',
    name: 'Forged Carbon',
    desc: 'Carbon black finish',
    preview: (
      <svg viewBox="0 0 48 48" className="w-12 h-12">
        <circle cx="24" cy="24" r="22" fill="#040404" stroke="#222" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="14" fill="#0a0a0a" stroke="#1a1a1a" strokeWidth="1" />
        <circle cx="24" cy="24" r="4" fill="#080808" stroke="#333" strokeWidth="0.5" />
        {[0,72,144,216,288].map(a => (
          <g key={a} transform={`rotate(${a} 24 24)`}>
            <path d="M 24 24 L 20 10 L 28 10 Z" fill="#181818" stroke="#2a2a2a" strokeWidth="0.5" />
          </g>
        ))}
        {/* Carbon fibre texture hint */}
        {[10,14,18,22,26,30].map(y => (
          <line key={y} x1="12" y1={y} x2="36" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}
      </svg>
    ),
  },
]

export default function ConfiguratorPanel() {
  const { selectedColor, setSelectedColor, selectedWheel, setSelectedWheel, paintFinish, setPaintFinish } = useCarState()
  const isIntroComplete = useCarState(s => s.isIntroComplete)
  const activeHotspot   = useCarState(s => s.activeHotspot)
  const config = useScreenConfig()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('color') // 'color' | 'wheel'

  // Auto-collapse when a right-anchored hotspot card opens — they share the same corner
  useEffect(() => {
    if (activeHotspot && HOTSPOT_META[activeHotspot]?.side === 'right') setOpen(false)
  }, [activeHotspot])

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isIntroComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.7, delay: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute bottom-20 right-4 z-20"
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="mb-2 ml-auto flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
          bg-neutral-900/70 backdrop-blur-xl border border-white/10 hover:bg-white/8 transition-all"
      >
        <Palette size={13} color="#00d4ff" />
        <span className="text-white/75">Configurator</span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={13} color="rgba(255,255,255,0.4)" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            style={{ width: config.configuratorWidth, background: 'rgba(10,10,16,0.78)', backdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-b border-white/8">
              {[{ key: 'color', label: 'Paint' }, { key: 'wheel', label: 'Wheels' }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 py-3 text-xs font-semibold transition-all ${
                    tab === t.key ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/40 hover:text-white/70'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Paint tab */}
            {tab === 'color' && (
              <div className="p-4 space-y-4">
                {/* Color grid */}
                <div>
                  <div className="text-[10px] text-white/35 uppercase tracking-widest mb-2">Exterior Paint</div>
                  <div className="grid grid-cols-4 gap-2">
                    {PAINT_COLORS.map((c) => (
                      <button key={c.id} onClick={() => setSelectedColor(c)}
                        className="relative flex flex-col items-center gap-1 group">
                        <div className="w-12 h-12 rounded-xl border-2 transition-all duration-300 overflow-hidden relative"
                          style={{
                            background: c.hex,
                            borderColor: selectedColor.id === c.id ? '#00d4ff' : 'transparent',
                            boxShadow: selectedColor.id === c.id ? `0 0 12px ${c.hex}66, 0 0 0 2px rgba(0,212,255,0.4)` : `0 2px 8px ${c.hex}33`,
                          }}>
                          {/* Metallic sheen overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/20" />
                          {selectedColor.id === c.id && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check size={16} color="#ffffff" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-white/40 group-hover:text-white/70 transition-colors text-center leading-tight max-w-[48px] truncate">
                          {c.name.split(' ').slice(-1)[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected color name */}
                <div className="px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-md flex-shrink-0"
                      style={{ background: selectedColor.hex, boxShadow: `0 0 8px ${selectedColor.hex}66` }} />
                    <div>
                      <div className="text-xs font-semibold text-white">{selectedColor.name}</div>
                      <div className="text-[10px] text-white/40">
                        M:{Math.round(selectedColor.metalness * 100)}% · R:{Math.round(selectedColor.roughness * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paint finish */}
                <div>
                  <div className="text-[10px] text-white/35 uppercase tracking-widest mb-2">Finish</div>
                  <div className="flex gap-2">
                    {['metallic', 'matte'].map(f => (
                      <button key={f} onClick={() => setPaintFinish(f)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all capitalize ${
                          paintFinish === f
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/8'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Wheel tab */}
            {tab === 'wheel' && (
              <div className="p-4 space-y-3">
                <div className="text-[10px] text-white/35 uppercase tracking-widest mb-1">Wheel Style</div>
                {WHEEL_STYLES.map(w => (
                  <button key={w.id} onClick={() => setSelectedWheel(w.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selectedWheel === w.id
                        ? 'bg-cyan-500/15 border-cyan-500/40'
                        : 'bg-white/4 border-white/10 hover:bg-white/7'
                    }`}>
                    <div className={`rounded-xl p-1 ${selectedWheel === w.id ? 'ring-2 ring-cyan-400/40' : ''}`}>
                      {w.preview}
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-semibold ${selectedWheel === w.id ? 'text-cyan-300' : 'text-white/80'}`}>
                        {w.name}
                      </div>
                      <div className="text-[10px] text-white/40">{w.desc}</div>
                    </div>
                    {selectedWheel === w.id && <Check size={15} color="#00d4ff" />}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
