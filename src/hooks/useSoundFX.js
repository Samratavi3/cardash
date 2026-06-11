import { useCallback } from 'react'

// Minimal sound system using Web Audio API (no external assets needed)
let audioCtx = null

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function playTone(frequency, duration, type = 'sine', volume = 0.08, attack = 0.01, release = 0.15) {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration + release)
  } catch (_) {}
}

function playNoise(duration, volume = 0.06, attack = 0.005, hiFreq = 3000, loFreq = 100) {
  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const bufSize = ctx.sampleRate * duration
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const hi = ctx.createBiquadFilter()
    hi.type = 'bandpass'
    hi.frequency.value = (hiFreq + loFreq) / 2
    hi.Q.value = 0.5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    src.connect(hi)
    hi.connect(gain)
    gain.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + duration + 0.05)
  } catch (_) {}
}

export function useSoundFX() {
  const playUIOpen = useCallback(() => {
    playTone(880, 0.12, 'sine', 0.06)
    setTimeout(() => playTone(1100, 0.10, 'sine', 0.04), 80)
  }, [])

  const playUIClose = useCallback(() => {
    playTone(660, 0.10, 'sine', 0.05)
    setTimeout(() => playTone(440, 0.12, 'sine', 0.03), 70)
  }, [])

  // Heavy mechanical thud when door unlatches and swings open
  const playDoorOpen = useCallback(() => {
    playTone(90, 0.18, 'sine', 0.18, 0.003, 0.25)       // low body thud
    playTone(180, 0.06, 'sawtooth', 0.08, 0.002, 0.08)  // latch click
    setTimeout(() => playNoise(0.12, 0.04, 0.01, 800, 200), 30) // air whoosh
  }, [])

  // Metallic click-thud of door closing
  const playDoorClose = useCallback(() => {
    playTone(140, 0.05, 'sawtooth', 0.14, 0.001, 0.12)  // metal click
    setTimeout(() => playTone(70, 0.20, 'sine', 0.16, 0.003, 0.20), 15) // body thud
  }, [])

  // Gas-strut whoosh for bonnet/boot
  const playBonnetOpen = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => playTone(500 + i * 80, 0.06, 'sawtooth', 0.025, 0.005, 0.06), i * 80)
    }
    setTimeout(() => playTone(100, 0.18, 'sine', 0.12, 0.005, 0.2), 450)
  }, [])

  // Electric motor hum for boot (motorised trunk)
  const playBootOpen = useCallback(() => {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(160 + i * 12, 0.05, 'sawtooth', 0.03, 0.004, 0.05), i * 70)
    }
    setTimeout(() => playTone(90, 0.15, 'sine', 0.10, 0.005, 0.18), 620)
  }, [])

  // Window motor hum
  const playWindowSlide = useCallback(() => {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => playTone(280 + i * 10, 0.05, 'sawtooth', 0.025, 0.004, 0.05), i * 55)
    }
  }, [])

  const playDoorClick = useCallback(() => {
    playTone(120, 0.08, 'sawtooth', 0.12)
    playTone(80, 0.15, 'sine', 0.08)
  }, [])

  const playMirrorServo = useCallback(() => {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(200 + i * 30, 0.04, 'sawtooth', 0.04), i * 50)
    }
  }, [])

  const playToggleOn = useCallback(() => {
    playTone(1200, 0.08, 'sine', 0.05)
  }, [])

  const playToggleOff = useCallback(() => {
    playTone(800, 0.08, 'sine', 0.04)
  }, [])

  const playHotspotHover = useCallback(() => {
    playTone(1400, 0.05, 'sine', 0.03)
  }, [])

  const playCameraMove = useCallback(() => {
    playTone(300, 0.20, 'sine', 0.04)
  }, [])

  return {
    playUIOpen,
    playUIClose,
    playDoorOpen,
    playDoorClose,
    playBonnetOpen,
    playBootOpen,
    playWindowSlide,
    playDoorClick,
    playMirrorServo,
    playToggleOn,
    playToggleOff,
    playHotspotHover,
    playCameraMove,
  }
}
