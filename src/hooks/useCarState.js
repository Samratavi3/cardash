import { create } from 'zustand'
import { PAINT_COLORS } from '../constants/paintColors'

const INITIAL_ANIMATION_STATES = {
  door_fl: false,
  door_fr: false,
  door_rl: false,
  door_rr: false,
  bonnet: false,
  boot: false,
  headlight_l: false,
  headlight_r: false,
  taillight_l: false,
  taillight_r: false,
  foglight_l: false,
  foglight_r: false,
  foglight_rear: false,
  wiper_front_left: false,
  wiper_front_right: false,
  wiper_rear: false,
  sunroof: 0,
  window_fl: 0,
  window_fr: 0,
  window_rl: 0,
  window_rr: 0,
  mirror_left: false,
  mirror_right: false,
}

export const useCarState = create((set) => ({
  // Display size — null means "not yet chosen" (shows picker before intro)
  screenMode: null,
  setScreenMode: (mode) => set({ screenMode: mode }),

  // View
  activeView: 'exterior',
  isDayMode: true,
  isAutoRotate: true,
  isIntroComplete: false,
  isSpecSheetOpen: false,

  // Hotspots
  activeHotspot: null,
  hoveredMesh: null,

  // 360° cabin panorama mode — locks camera in place for first-person look-around
  panoramaMode: false,

  // Configurator
  selectedColor: PAINT_COLORS[0],
  selectedWheel: 'stock',
  paintFinish: 'metallic',

  // Door state
  doorsOpen: false,

  // Animation states for parts (0 = closed/off, true/false for booleans)
  // sunroof: 0 = closed, 1 = tilted, 2 = open  |  windows: 0 = closed, 100 = fully open
  animationStates: { ...INITIAL_ANIMATION_STATES },

  // Wiper speed — shared between WiperCard UI and VehicleModel animation
  wiperSpeed: 'int2',
  rearWiperSpeed: 'int',

  // Ambient lighting — shared between AmbientCard controls and InteriorModel strips
  ambientColor: '#00d4ff',
  ambientBrightness: 70,

  // Seat positions — both front seats animatable in 3D
  seatDriver: { foreAft: 50, height: 50, recline: 20 },
  setSeatDriver: (key, val) =>
    set((s) => ({ seatDriver: { ...s.seatDriver, [key]: val } })),
  seatPassenger: { foreAft: 50, height: 50, recline: 20 },
  setSeatPassenger: (key, val) =>
    set((s) => ({ seatPassenger: { ...s.seatPassenger, [key]: val } })),

  // Steering wheel position — tilt and reach animatable in 3D
  steeringPos: { tilt: 50, reach: 50 },
  setSteeringPos: (key, val) =>
    set((s) => ({ steeringPos: { ...s.steeringPos, [key]: val } })),

  // Headlight mode — 'off' | 'drl' | 'high'
  headlightMode: 'off',
  setHeadlightMode: (mode) => set({ headlightMode: mode }),

  // Brake light mode — 'standard' | 'sequential' | 'pulse'
  brakeLightMode: 'standard',
  setBrakeLightMode: (mode) => set({ brakeLightMode: mode }),

  // Cluster speed unit — 'kmh' | 'mph' (wired to InstrumentCard switch)
  speedUnit: 'kmh',
  setSpeedUnit: (unit) => set({ speedUnit: unit }),

  // Mirror glass tilt — x = up/down (-1 to 1), y = left/right (-1 to 1)
  mirrorTilt: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } },
  nudgeMirrorTilt: (side, axis, delta) =>
    set((s) => {
      const cur = s.mirrorTilt[side];
      const clamped = Math.max(-1, Math.min(1, cur[axis] + delta));
      return { mirrorTilt: { ...s.mirrorTilt, [side]: { ...cur, [axis]: clamped } } };
    }),

  // ADAS system — shared between DriverCluster display and AdasCard controls
  adasState: { lka: true, acc: true, fcw: true, bsm: false },

  // Climate — shared between BottomDock and AcVentCard
  climateState: { driverTemp: 22, passengerTemp: 22, fanSpeed: 3, acOn: true },

  // Actions
  setActiveHotspot: (hotspot) => set({ activeHotspot: hotspot }),
  clearHotspot: () => set({ activeHotspot: null }),
  setHoveredMesh: (mesh) => set({ hoveredMesh: mesh }),
  setActiveView: (view) => set({ activeView: view }),
  setPanoramaMode: (val) => set({ panoramaMode: val }),
  toggleDayMode: () => set((s) => ({ isDayMode: !s.isDayMode })),
  setAutoRotate: (val) => set({ isAutoRotate: val }),
  setIntroComplete: () => set({ isIntroComplete: true }),
  setSpecSheetOpen: (val) => set({ isSpecSheetOpen: val }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSelectedWheel: (wheel) => set({ selectedWheel: wheel }),
  setPaintFinish: (finish) => set({ paintFinish: finish }),
  setDoorsOpen: (val) => set({ doorsOpen: val }),

  setWiperSpeed: (speed) => set({ wiperSpeed: speed }),
  setRearWiperSpeed: (speed) => set({ rearWiperSpeed: speed }),

  setAmbientColor: (color) => set({ ambientColor: color }),
  setAmbientBrightness: (val) => set({ ambientBrightness: val }),

  setAdasProp: (key, value) =>
    set((s) => ({ adasState: { ...s.adasState, [key]: value } })),

  setClimateProp: (key, value) =>
    set((s) => ({ climateState: { ...s.climateState, [key]: value } })),

  triggerAnimation: (partName, value) =>
    set((state) => ({
      animationStates: { ...state.animationStates, [partName]: value },
    })),

  resetAnimationStates: () =>
    set(() => ({ animationStates: { ...INITIAL_ANIMATION_STATES } })),
}))
