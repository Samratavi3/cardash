import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun, Moon, RotateCcw, Camera, FileText, ArrowLeftRight, Monitor, Scan
} from 'lucide-react'
import { useCarState } from './hooks/useCarState'
import { useScreenConfig } from './hooks/useScreenConfig'
import { flyTo, cameraRig } from './hooks/useCameraRig'
import { useSoundFX } from './hooks/useSoundFX'
import DriverCluster from './components/DriverCluster'
import BottomDock from './components/BottomDock'
import CarCanvas from './components/CarCanvas'
import ControlOverlay from './components/ControlOverlay'
import ConfiguratorPanel from './components/ConfiguratorPanel'
import SpecSheet from './components/SpecSheet'
import IntroOverlay from './components/IntroSequence'
import ScreenSizePicker from './components/ScreenSizePicker'

const SCREEN_SIZES = ['10', '12.3', '15.6']

// Frame dimensions per mode — vw/vh strings so Framer Motion interpolates them
const FRAME_DIMS = {
  '10':   { width: '58vw', height: '74vh' },
  '12.3': { width: '80vw', height: '88vh' },
  '15.6': { width: '95vw', height: '95vh' },
}

// Spring config shared across all size-change animations
const SIZE_SPRING = { type: 'spring', stiffness: 80, damping: 18, mass: 1.1 }

// ── Corner bracket markers ────────────────────────────────────────────────────
function CornerBrackets() {
  const cls = 'absolute w-5 h-5 pointer-events-none z-50'
  const style = { borderColor: 'rgba(0,212,255,0.55)' }
  return (
    <>
      <div className={`${cls} top-0 left-0 border-t-2 border-l-2 rounded-tl-xl`} style={style} />
      <div className={`${cls} top-0 right-0 border-t-2 border-r-2 rounded-tr-xl`} style={style} />
      <div className={`${cls} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl`} style={style} />
      <div className={`${cls} bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl`} style={style} />
    </>
  )
}

// ── Size badge — sits on the bottom border of the frame ───────────────────────
function SizeBadge({ screenMode }) {
  const isIntroComplete = useCarState(s => s.isIntroComplete)
  return (
    <AnimatePresence mode="wait">
      {isIntroComplete && (
        <motion.div
          key={screenMode}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute left-1/2 -translate-x-1/2 -bottom-6 z-50
                     flex items-center gap-2 px-5 py-2 rounded-full
                     text-sm font-bold tracking-[0.12em] uppercase whitespace-nowrap pointer-events-none"
          style={{
            background: 'rgba(4,4,14,0.97)',
            border: '1px solid rgba(0,212,255,0.5)',
            color: '#00d4ff',
            boxShadow: '0 0 20px rgba(0,212,255,0.3), 0 4px 24px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Monitor size={13} />
          {screenMode}" Display
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Screen-size toggle (segmented control in toolbar) ─────────────────────────
function ScreenSizeToggle() {
  const screenMode    = useCarState(s => s.screenMode)
  const setScreenMode = useCarState(s => s.setScreenMode)

  return (
    <div
      className="flex items-center rounded-xl overflow-hidden border border-white/15"
      style={{ backdropFilter: 'blur(20px)' }}
      title="Display size"
    >
      {SCREEN_SIZES.map((size) => (
        <button
          key={size}
          onClick={() => setScreenMode(size)}
          className={`px-2.5 py-2 text-[11px] font-semibold transition-all leading-none
            ${screenMode === size
              ? 'bg-cyan-500/25 text-cyan-300'
              : 'bg-white/8 text-white/55 hover:bg-white/14 hover:text-white/80'
            }`}
        >
          {size}"
        </button>
      ))}
    </div>
  )
}

// ── Canvas toolbar ────────────────────────────────────────────────────────────
function CanvasToolbar() {
  const {
    activeView, setActiveView, isDayMode, toggleDayMode,
    isAutoRotate, setAutoRotate, setSpecSheetOpen, isSpecSheetOpen,
    isIntroComplete, clearHotspot, panoramaMode, setPanoramaMode,
  } = useCarState()
  const { playCameraMove, playUIOpen } = useSoundFX()

  function handleViewToggle() {
    playCameraMove()
    clearHotspot()
    setPanoramaMode(false)
    const next = activeView === 'exterior' ? 'interior' : 'exterior'
    setActiveView(next)
    if (next === 'interior') flyTo('interior')
    else flyTo('default')
  }

  function handle360Toggle() {
    if (panoramaMode) {
      setPanoramaMode(false)
      flyTo('interior')
    } else {
      clearHotspot()
      // Constraints relax only AFTER camera reaches the centre position
      flyTo('cabin_360', () => setPanoramaMode(true))
    }
  }

  function handleScreenshot() {
    const canvas = cameraRig.gl?.domElement ?? document.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'honda-city-config.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (!isIntroComplete) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-auto"
    >
      <button
        onClick={handleViewToggle}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all
          ${activeView === 'interior'
            ? 'bg-violet-500/25 border-violet-400/40 text-violet-300'
            : 'bg-white/8 border-white/15 text-white/75 hover:bg-white/14'
          }`}
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <ArrowLeftRight size={13} />
        {activeView === 'exterior' ? 'Exterior' : 'Interior'}
      </button>

      {activeView === 'interior' && (
        <button
          onClick={handle360Toggle}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
            ${panoramaMode
              ? 'bg-violet-500/25 border-violet-400/40 text-violet-300'
              : 'bg-white/8 border-white/15 text-white/75 hover:bg-white/14'
            }`}
          style={{ backdropFilter: 'blur(20px)' }}
          title="360° cabin view"
        >
          <Scan size={13} />
          360°
        </button>
      )}

      <button
        onClick={() => { toggleDayMode(); playUIOpen() }}
        className="w-9 h-9 rounded-xl bg-white/8 border border-white/15 hover:bg-white/14 transition-all flex items-center justify-center"
        style={{ backdropFilter: 'blur(20px)' }}
        title={isDayMode ? 'Switch to Night' : 'Switch to Day'}
        aria-label={isDayMode ? 'Switch to Night mode' : 'Switch to Day mode'}
      >
        {isDayMode
          ? <Moon size={14} color="rgba(255,255,255,0.7)" />
          : <Sun size={14} color="#ffd700" style={{ filter: 'drop-shadow(0 0 4px #ffd700)' }} />
        }
      </button>

      <button
        onClick={() => setAutoRotate(!isAutoRotate)}
        className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center
          ${isAutoRotate ? 'bg-cyan-500/20 border-cyan-400/40' : 'bg-white/8 border-white/15 hover:bg-white/14'}`}
        style={{ backdropFilter: 'blur(20px)' }}
        title="Auto-rotate"
        aria-label={isAutoRotate ? 'Disable auto-rotate' : 'Enable auto-rotate'}
        aria-pressed={isAutoRotate}
      >
        <RotateCcw size={14} color={isAutoRotate ? '#00d4ff' : 'rgba(255,255,255,0.6)'}
          style={isAutoRotate ? { filter: 'drop-shadow(0 0 4px #00d4ff)', animation: 'spin 2s linear infinite' } : {}} />
      </button>

      <button
        onClick={() => { setSpecSheetOpen(!isSpecSheetOpen); playUIOpen() }}
        className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center
          ${isSpecSheetOpen ? 'bg-cyan-500/20 border-cyan-400/40' : 'bg-white/8 border-white/15 hover:bg-white/14'}`}
        style={{ backdropFilter: 'blur(20px)' }}
        title="Car Specifications"
        aria-label="Toggle car specifications"
        aria-pressed={isSpecSheetOpen}
      >
        <FileText size={14} color={isSpecSheetOpen ? '#00d4ff' : 'rgba(255,255,255,0.6)'} />
      </button>

      <button
        onClick={handleScreenshot}
        className="w-9 h-9 rounded-xl bg-white/8 border border-white/15 hover:bg-white/14 transition-all flex items-center justify-center"
        style={{ backdropFilter: 'blur(20px)' }}
        title="Save screenshot"
        aria-label="Save screenshot"
      >
        <Camera size={14} color="rgba(255,255,255,0.7)" />
      </button>

      <div className="w-px h-5 bg-white/15" />
      <ScreenSizeToggle />
    </motion.div>
  )
}

// ── Hotspot hint ──────────────────────────────────────────────────────────────
function HotspotHint() {
  const isIntroComplete = useCarState(s => s.isIntroComplete)
  const activeHotspot   = useCarState(s => s.activeHotspot)
  const panoramaMode    = useCarState(s => s.panoramaMode)
  return (
    <AnimatePresence>
      {isIntroComplete && !activeHotspot && !panoramaMode && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        >
          <div className="text-[11px] text-white/25 tracking-widest text-center animate-pulse">
            Click any part of the vehicle to interact
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const screenMode = useCarState(s => s.screenMode)
  const config     = useScreenConfig()

  // Picker gates the Canvas — nothing 3D mounts until a size is chosen
  if (!screenMode) {
    return (
      <AnimatePresence>
        <ScreenSizePicker key="picker" />
      </AnimatePresence>
    )
  }

  return (
    // ── Full-viewport stage — always dark, always shows grid around frame ─────
    <motion.div
      key="stage"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: '#030306',
        backgroundImage: `
          radial-gradient(ellipse at center, rgba(6,6,24,0.0) 30%, #030306 80%),
          linear-gradient(rgba(0,212,255,0.028) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.028) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 36px 36px, 36px 36px',
      }}
    >
      {/* ── Animated screen frame — all three sizes share identical styling ── */}
      {/*
          overflow:visible so SizeBadge & CornerBrackets can bleed outside.
          The inner .inset-0 div carries overflow:hidden for dashboard content.
      */}
      <motion.div
        animate={FRAME_DIMS[screenMode]}
        transition={SIZE_SPRING}
        className="relative flex-shrink-0"
        style={{
          borderRadius: 14,
          border: '1.5px solid rgba(255,255,255,0.13)',
          boxShadow: [
            '0 0 0 1px rgba(0,212,255,0.09)',
            '0 30px 100px rgba(0,0,0,0.88)',
            'inset 0 0 0 1px rgba(255,255,255,0.04)',
          ].join(', '),
        }}
      >
        {/* Corner brackets on every mode */}
        <CornerBrackets />

        {/* ── Dashboard — clipped to frame ─────────────────────────────────── */}
        <div
          className="absolute inset-0 overflow-hidden bg-neutral-950 text-white font-sans select-none flex flex-col"
          style={{ borderRadius: 12 }}
        >
          {/* Main content row */}
          <div className="flex flex-1 min-h-0">

            {/* LEFT PANEL — spring-animated width */}
            <motion.div
              animate={{ width: config.leftPanelWidth }}
              transition={SIZE_SPRING}
              className="flex-shrink-0 h-full border-r border-white/5 relative overflow-hidden flex flex-col"
              style={{ background: 'linear-gradient(180deg, rgba(8,8,14,0.98) 0%, rgba(6,6,10,0.99) 100%)' }}
            >
              <SpecSheet />
              <DriverCluster />
            </motion.div>

            {/* 3D Canvas */}
            <div className="flex-1 min-w-0 h-full relative">
              <CarCanvas />
              <CanvasToolbar />
              <ControlOverlay />
              <ConfiguratorPanel />
              <HotspotHint />
              <IntroOverlay />
            </div>
          </div>

          {/* BOTTOM DOCK — spring-animated height */}
          <motion.div
            animate={{ height: config.dockHeight }}
            transition={SIZE_SPRING}
            className="flex-shrink-0 border-t border-white/5 relative z-10 overflow-hidden"
            style={{ background: 'rgba(6,6,10,0.92)', backdropFilter: 'blur(24px)' }}
          >
            <BottomDock />
          </motion.div>
        </div>

        {/* Size badge on bottom border — every mode */}
        <SizeBadge screenMode={screenMode} />
      </motion.div>
    </motion.div>
  )
}
