import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Wind, Snowflake, User, Settings, Music2, Radio
} from 'lucide-react'
import { useCarState } from '../hooks/useCarState'
import { useScreenConfig } from '../hooks/useScreenConfig'

function ClimateSlider({ label, value, onChange, icon: Icon, color = '#00d4ff', min = 16, max = 30 }) {
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon size={11} color={color} />
          <span className="text-[10px] text-white/50">{label}</span>
        </div>
        <span className="text-sm font-mono font-bold text-white">{value}°</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: color }}
      />
    </div>
  )
}

export default function BottomDock() {
  const { climateState, setClimateProp } = useCarState()
  const { driverTemp, passengerTemp, fanSpeed, acOn } = climateState
  const config = useScreenConfig()

  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(65)

  // ── Compact layout for 10" ────────────────────────────────────────────────
  if (config.dockCompact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 4.9 }}
        className="h-full glass flex items-center px-4 gap-4 overflow-hidden"
      >
        {/* Minimal media */}
        <div className="flex items-center gap-2">
          <Music2 size={14} color="#00d4ff" />
          <span className="text-[10px] text-white/60 truncate max-w-[80px]">Cyberdrive</span>
          <button
            onClick={() => setPlaying(p => !p)}
            className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30"
          >
            {playing ? <Pause size={12} color="#00d4ff" /> : <Play size={12} color="#00d4ff" />}
          </button>
        </div>

        <div className="h-6 w-px bg-white/10 flex-shrink-0" />

        {/* Minimal climate */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setClimateProp('acOn', !acOn)}
            className={`p-1.5 rounded-lg border transition-all ${acOn ? 'bg-blue-500/15 border-blue-400/30' : 'bg-white/5 border-white/10'}`}
          >
            <Snowflake size={12} color={acOn ? '#60a5fa' : 'rgba(255,255,255,0.3)'} />
          </button>
          <span className="text-xs font-mono text-white">{driverTemp}°</span>
          <span className="text-[10px] text-white/30">/</span>
          <span className="text-xs font-mono text-white/60">{passengerTemp}°</span>
        </div>

        <div className="h-6 w-px bg-white/10 flex-shrink-0" />

        {/* Profile */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[9px] font-bold text-white">S</div>
          <Settings size={12} color="rgba(255,255,255,0.4)" />
        </div>
      </motion.div>
    )
  }

  // ── Full layout for 12.3" and 15.6" ──────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 4.9, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full glass flex items-center px-5 gap-6 overflow-hidden"
    >
      {/* Media section */}
      <div className="flex items-center gap-4 min-w-fit">
        {/* Album art placeholder */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/30
          border border-cyan-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Music2 size={18} color="#00d4ff" />
        </div>

        {/* Track info */}
        <div className="flex flex-col gap-0.5 min-w-[120px]">
          <div className="text-xs font-semibold text-white truncate max-w-[130px]">
            Cyberdrive
          </div>
          <div className="text-[10px] text-white/40 truncate">Synthwave 2026</div>
          {/* Progress bar — loops 0→100% cleanly with no jump-back */}
          <div className="w-full h-0.5 bg-white/10 rounded-full mt-0.5 overflow-hidden">
            <motion.div
              className="h-full bg-cyan-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 30, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors border border-cyan-500/30"
          >
            {playing
              ? <Pause size={16} color="#00d4ff" />
              : <Play size={16} color="#00d4ff" />
            }
          </button>
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
            <SkipForward size={14} />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-20">
          <Volume2 size={12} color="rgba(255,255,255,0.4)" />
          <input type="range" min={0} max={100} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-full" />
        </div>
      </div>

      {/* Vertical divider */}
      <div className="h-8 w-px bg-white/10 flex-shrink-0" />

      {/* Climate section — reads/writes shared Zustand climateState */}
      <div className="flex items-center gap-5 flex-1">
        {/* A/C toggle */}
        <button
          onClick={() => setClimateProp('acOn', !acOn)}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${
            acOn
              ? 'bg-blue-500/15 border border-blue-400/30'
              : 'bg-white/5 border border-white/10'
          }`}
        >
          <Snowflake size={15} color={acOn ? '#60a5fa' : 'rgba(255,255,255,0.3)'}
            style={acOn ? { filter: 'drop-shadow(0 0 4px #60a5fa)' } : {}} />
          <span className="text-[9px] text-white/50">A/C</span>
        </button>

        {/* Fan speed */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <Wind size={11} color="rgba(255,255,255,0.4)" />
            <span className="text-[10px] text-white/50 ml-1">Fan {fanSpeed}</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 7 }, (_, i) => (
              <button key={i}
                onClick={() => setClimateProp('fanSpeed', i + 1)}
                className="w-3 h-3 rounded-sm transition-all"
                style={{
                  background: i < fanSpeed ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                  boxShadow: i < fanSpeed ? '0 0 4px rgba(0,212,255,0.5)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Driver temp */}
        <ClimateSlider
          label="Driver"
          value={driverTemp}
          onChange={v => setClimateProp('driverTemp', v)}
          icon={User}
          color="#00d4ff"
        />

        {/* Passenger temp */}
        <ClimateSlider
          label="Passenger"
          value={passengerTemp}
          onChange={v => setClimateProp('passengerTemp', v)}
          icon={User}
          color="#a78bfa"
        />
      </div>

      {/* Vertical divider */}
      <div className="h-8 w-px bg-white/10 flex-shrink-0" />

      {/* Profile */}
      <div className="flex items-center gap-3 min-w-fit">
        <button className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-white/5 transition-colors">
          <Radio size={14} color="rgba(255,255,255,0.5)" />
          <span className="text-[9px] text-white/40">Radio</span>
        </button>
        <button className="flex items-center gap-2 glass rounded-xl px-3 py-2 hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600
            flex items-center justify-center text-xs font-bold text-white">S</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-white">Samrat</span>
            <span className="text-[9px] text-white/40">Profile 1</span>
          </div>
        </button>
        <button className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <Settings size={15} color="rgba(255,255,255,0.4)" />
        </button>
      </div>
    </motion.div>
  )
}
