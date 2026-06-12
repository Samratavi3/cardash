import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCarState } from '../hooks/useCarState'
import { cameraRig } from '../hooks/useCameraRig'
import { CAMERA_POSITIONS } from '../constants/cameraPositions'

// Drives the cinematic intro orbit via CameraControls
// Called once when the Canvas is ready
export function useIntroSequence() {
  const setIntroComplete = useCarState(s => s.setIntroComplete)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    // Small delay to let the scene settle after first render
    const timers = []
    const startedAt = performance.now()

    const runIntro = async () => {
      // Controls may not exist yet on slow scene/HDRI loads — retry every 250 ms.
      // After 15 s give up gracefully so the app never hangs on the overlay.
      if (!cameraRig.controls) {
        if (performance.now() - startedAt < 15000) {
          timers.push(setTimeout(runIntro, 250))
        } else {
          setIntroComplete()
        }
        return
      }

      const intro = CAMERA_POSITIONS.intro_start
      const def   = CAMERA_POSITIONS.default

      // Snap to intro start without animation
      cameraRig.controls.setLookAt(
        intro.position[0], intro.position[1], intro.position[2],
        intro.target[0],   intro.target[1],   intro.target[2],
        false
      )

      // Wait one frame
      await new Promise(r => requestAnimationFrame(r))

      // Fly to default over ~2.8 s (the "orbit" feel)
      if (cameraRig.controls.setLookAt) {
        cameraRig.controls.setLookAt(
          def.position[0], def.position[1], def.position[2],
          def.target[0],   def.target[1],   def.target[2],
          true
        )
      }

      // Signal panels to appear after orbit
      timers.push(setTimeout(() => setIntroComplete(), 2400))
    }

    timers.push(setTimeout(runIntro, 600))

    return () => timers.forEach(clearTimeout)
  }, [setIntroComplete])
}

// Pulse overlay that shows while intro is running
export default function IntroOverlay() {
  const isIntroComplete = useCarState(s => s.isIntroComplete)

  return (
    <AnimatePresence>
      {!isIntroComplete && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(8,8,12,0.85) 0%, rgba(8,8,12,0.95) 100%)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Brand wordmark */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-black tracking-[0.15em] text-white uppercase"
                style={{ textShadow: '0 0 40px rgba(0,212,255,0.5)' }}>
                HONDA
              </span>
              <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              <span className="text-sm font-light tracking-[0.4em] text-white/50 uppercase">City ZX Turbo</span>
            </div>

            {/* Loading spinner */}
            <div className="relative w-12 h-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-t-2 border-r-2 border-cyan-400"
                style={{ filter: 'drop-shadow(0 0 6px #00d4ff)' }}
              />
              <div className="absolute inset-2 rounded-full border border-white/10" />
            </div>

            <span className="text-[11px] text-white/30 tracking-widest uppercase animate-pulse">
              Initialising systems
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
