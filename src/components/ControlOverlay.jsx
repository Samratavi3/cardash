import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScreenConfig } from '../hooks/useScreenConfig'
import {
  X, Lightbulb, ShieldCheck, Droplets, Eye, ScanLine, Layers, Sun, DoorOpen,
  Zap, Wind, Gauge, Monitor, Palette, BarChart2, Lamp, Lock, Unlock,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Armchair, Wrench
} from 'lucide-react'
import { useCarState } from '../hooks/useCarState'
import { HOTSPOT_META } from '../constants/hotspots'
import { resetCamera } from '../hooks/useCameraRig'
import { useSoundFX } from '../hooks/useSoundFX'

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Toggle({ label, value, onChange, sub, danger }) {
  const { playToggleOn, playToggleOff } = useSoundFX()
  const handle = () => { onChange(!value); value ? playToggleOff() : playToggleOn() }
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div>
        <div className={`text-xs font-medium ${danger ? 'text-red-400' : 'text-white/85'}`}>{label}</div>
        {sub && <div className="text-[10px] text-white/35 mt-0.5">{sub}</div>}
      </div>
      <button onClick={handle} className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200 ${value ? (danger ? 'bg-red-500' : 'bg-cyan-500') : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function Slider({ label, value, onChange, min = 0, max = 100, unit = '%', color = '#00d4ff' }) {
  return (
    <div className="space-y-1.5 py-2 border-b border-white/5 last:border-0">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-white">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: color }} className="w-full" />
    </div>
  )
}

function ButtonGroup({ label, options, value, onChange }) {
  return (
    <div className="space-y-1.5 py-2 border-b border-white/5 last:border-0">
      {label && <div className="text-xs text-white/60">{label}</div>}
      <div className="flex gap-1">
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              value === opt.value ? 'bg-cyan-500/25 border border-cyan-500/50 text-cyan-300' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ActionBtn({ label, icon: Icon, onClick, variant = 'default' }) {
  const cls = {
    default: 'bg-white/8 hover:bg-white/14 border-white/12 text-white/75',
    primary: 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-300',
    danger:  'bg-red-500/15 hover:bg-red-500/25 border-red-500/35 text-red-400',
    success: 'bg-green-500/15 hover:bg-green-500/25 border-green-500/35 text-green-400',
  }[variant]
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl border text-xs font-medium transition-all ${cls}`}>
      {Icon && <Icon size={13} />}{label}
    </button>
  )
}

function DPad({ onPress }) {
  const { playMirrorServo } = useSoundFX()
  const press = dir => { playMirrorServo(); onPress && onPress(dir) }
  const btnCls = 'w-10 h-10 flex items-center justify-center rounded-xl bg-white/8 hover:bg-cyan-500/20 border border-white/12 hover:border-cyan-500/40 transition-all active:scale-95'
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="text-[10px] text-white/40 mb-1">Mirror Adjust</div>
      <button onClick={() => press('up')} className={btnCls}><ChevronUp size={16} color="#00d4ff" /></button>
      <div className="flex gap-1">
        <button onClick={() => press('left')} className={btnCls}><ChevronLeft size={16} color="#00d4ff" /></button>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8" />
        <button onClick={() => press('right')} className={btnCls}><ChevronRight size={16} color="#00d4ff" /></button>
      </div>
      <button onClick={() => press('down')} className={btnCls}><ChevronDown size={16} color="#00d4ff" /></button>
    </div>
  )
}

function SectionLabel({ text }) {
  return <div className="text-[10px] text-cyan-400/70 uppercase tracking-widest font-semibold mt-3 mb-1 first:mt-0">{text}</div>
}

function SensorDiagram({ frontActive, rearActive }) {
  return (
    <div className="py-2">
      <svg viewBox="0 0 200 140" className="w-full h-24">
        {/* Car body top-down */}
        <rect x="65" y="35" width="70" height="70" rx="8" fill="#1a1a24" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Front sensors */}
        {frontActive && [0.3, 0.5, 0.7].map((x, i) => (
          <ellipse key={i} cx={65 + x * 70} cy="28" rx={12 - i * 2} ry={8 - i * 2}
            fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity={0.9 - i * 0.25}
            style={{ filter: 'drop-shadow(0 0 3px #00d4ff)' }} />
        ))}
        {/* Rear sensors */}
        {rearActive && [0.3, 0.5, 0.7].map((x, i) => (
          <ellipse key={i} cx={65 + x * 70} cy="112" rx={12 - i * 2} ry={8 - i * 2}
            fill="none" stroke="#ffaa00" strokeWidth="1.5" opacity={0.9 - i * 0.25}
            style={{ filter: 'drop-shadow(0 0 3px #ffaa00)' }} />
        ))}
        <text x="100" y="74" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize="10">CITY</text>
        <text x="100" y="20" textAnchor="middle" fill={frontActive ? '#00d4ff' : 'rgba(255,255,255,0.2)'} fontSize="8">FRONT</text>
        <text x="100" y="126" textAnchor="middle" fill={rearActive ? '#ffaa00' : 'rgba(255,255,255,0.2)'} fontSize="8">REAR</text>
      </svg>
    </div>
  )
}

// ── Hotspot card components ───────────────────────────────────────────────────
function HeadlightCard() {
  const { setHeadlightMode } = useCarState()
  const [drl, setDrl] = useState(false)
  const [highBeam, setHigh] = useState(false)
  const [auto, setAuto] = useState(true)
  const [adaptive, setAdaptive] = useState(true)
  const [projector, setProjector] = useState('sport')
  const [brightness, setBrightness] = useState(85)

  const handleDrlToggle = (newState) => {
    setDrl(newState)
    setHigh(false)
    setHeadlightMode(newState ? 'drl' : 'off')
  }

  const handleHighBeamToggle = (newState) => {
    setHigh(newState)
    if (newState) { setDrl(false); setHeadlightMode('high') }
    else setHeadlightMode(drl ? 'drl' : 'off')
  }

  return (
    <div>
      <Toggle label="Daytime Running Lights" value={drl} onChange={handleDrlToggle}
        sub={drl ? 'Active — warm white, low beam' : 'Off'} />
      <Toggle label="High Beam" value={highBeam} onChange={handleHighBeamToggle}
        sub={highBeam ? 'Active — full bright white' : 'Off'} />
      <Toggle label="Auto Headlights" value={auto} onChange={setAuto} sub="Activates below 500 lux" />
      <Toggle label="Adaptive Cornering" value={adaptive} onChange={setAdaptive} />
      <ButtonGroup label="Projector Mode" options={[{label:'Normal',value:'normal'},{label:'Sport',value:'sport'},{label:'Eco',value:'eco'}]} value={projector} onChange={setProjector} />
      <Slider label="Brightness" value={brightness} onChange={setBrightness} />
    </div>
  )
}

function AdasCard() {
  const { adasState, setAdasProp } = useCarState()
  const [accSpeed, setAccSpeed] = useState(80)
  const [fcwSens, setFcwSens] = useState('med')
  const [aeb, setAeb] = useState(true)
  const [tsr, setTsr] = useState(true)
  const [ped, setPed] = useState(true)
  return (
    <div>
      <SectionLabel text="Honda Sensing™" />
      <Toggle label="Lane Keep Assist" value={adasState.lka} onChange={v => setAdasProp('lka', v)} sub="Keeps vehicle in lane" />
      <Toggle label="Adaptive Cruise Control" value={adasState.acc} onChange={v => setAdasProp('acc', v)} />
      {adasState.acc && <Slider label="Set Speed" value={accSpeed} onChange={setAccSpeed} min={30} max={130} unit=" km/h" />}
      <Toggle label="Forward Collision Warning" value={adasState.fcw} onChange={v => setAdasProp('fcw', v)} />
      {adasState.fcw && <ButtonGroup label="FCW Sensitivity" options={[{label:'Low',value:'low'},{label:'Med',value:'med'},{label:'High',value:'high'}]} value={fcwSens} onChange={setFcwSens} />}
      <Toggle label="Auto Emergency Brake" value={aeb} onChange={setAeb} />
      <Toggle label="Traffic Sign Recognition" value={tsr} onChange={setTsr} />
      <Toggle label="Pedestrian Detection" value={ped} onChange={setPed} />
    </div>
  )
}

function WiperCard() {
  const { triggerAnimation, wiperSpeed, setWiperSpeed, rearWiperSpeed, setRearWiperSpeed } = useCarState()
  const [rainSense, setRainSense] = useState(true)
  const [heated, setHeated] = useState(false)
  const [wipersOn, setWipersOn] = useState(false)
  const [rearWiperOn, setRearWiperOn] = useState(false)

  const toggleFrontWipers = () => {
    const newState = !wipersOn
    setWipersOn(newState)
    triggerAnimation('wiper_front_left', newState)
    triggerAnimation('wiper_front_right', newState)
  }

  const toggleRearWiper = () => {
    const newState = !rearWiperOn
    setRearWiperOn(newState)
    triggerAnimation('wiper_rear', newState)
  }

  return (
    <div>
      <Toggle label="Front Wipers" value={wipersOn} onChange={toggleFrontWipers} sub={wipersOn ? 'Actively sweeping' : 'Off'} />
      <Toggle label="Rain-Sensing Wipers" value={rainSense} onChange={setRainSense} sub="Automatic activation" />
      <ButtonGroup label="Front Wiper Speed"
        options={[{label:'Int1',value:'int1'},{label:'Int2',value:'int2'},{label:'Low',value:'low'},{label:'High',value:'high'}]}
        value={wiperSpeed} onChange={setWiperSpeed} />
      <Toggle label="Rear Wiper" value={rearWiperOn} onChange={toggleRearWiper} sub={rearWiperOn ? 'Actively sweeping' : 'Off'} />
      {rearWiperOn && <ButtonGroup label="Rear Speed" options={[{label:'Int',value:'int'},{label:'Low',value:'low'},{label:'High',value:'high'}]} value={rearWiperSpeed} onChange={setRearWiperSpeed} />}
      <Toggle label="Heated Washer Nozzles" value={heated} onChange={setHeated} sub="Prevents freezing" />
      <div className="pt-2">
        <ActionBtn label="Wash & Wipe (front)" variant="primary" onClick={() => {
          setWipersOn(true)
          triggerAnimation('wiper_front_left', true)
          triggerAnimation('wiper_front_right', true)
          setTimeout(() => {
            setWipersOn(false)
            triggerAnimation('wiper_front_left', false)
            triggerAnimation('wiper_front_right', false)
          }, 2000)
        }} />
      </div>
    </div>
  )
}

function MirrorCard({ hotspot }) {
  const { triggerAnimation, nudgeMirrorTilt } = useCarState()
  const [fold, setFold] = useState(false)
  const [heat, setHeat] = useState(true)
  const [autoFold, setAutoFold] = useState(true)
  const [bsm, setBsm] = useState(true)
  const [lca, setLca] = useState(true)
  const [bsmSens, setBsmSens] = useState(50)
  const isLeft = hotspot === 'mirror_left'
  const side = isLeft ? 'left' : 'right'
  const STEP = 0.15

  const handleFoldToggle = (newState) => {
    setFold(newState)
    triggerAnimation(hotspot, newState)
  }

  const handleDPad = (dir) => {
    if (dir === 'up')    nudgeMirrorTilt(side, 'x', -STEP)
    if (dir === 'down')  nudgeMirrorTilt(side, 'x',  STEP)
    if (dir === 'left')  nudgeMirrorTilt(side, 'y', isLeft ? -STEP :  STEP)
    if (dir === 'right') nudgeMirrorTilt(side, 'y', isLeft ?  STEP : -STEP)
  }

  return (
    <div>
      <SectionLabel text={isLeft ? 'Left Mirror' : 'Right Mirror'} />
      <DPad onPress={handleDPad} />
      <Toggle label="Mirror Fold" value={fold} onChange={handleFoldToggle} sub={fold ? 'Folded' : 'Extended'} />
      <Toggle label="Mirror Heating" value={heat} onChange={setHeat} />
      <Toggle label="Auto-Fold on Lock" value={autoFold} onChange={setAutoFold} />
      <SectionLabel text="Blind Spot Monitor" />
      <Toggle label="Blind Spot Monitor (BSM)" value={bsm} onChange={setBsm} />
      <Toggle label="Lane Change Alert" value={lca} onChange={setLca} sub="Warns during lane changes" />
      <Slider label="BSM Sensitivity" value={bsmSens} onChange={setBsmSens} />
    </div>
  )
}

function BumperCard() {
  const [front, setFront] = useState(true)
  const [rear, setRear] = useState(true)
  const [sens, setSens] = useState('med')
  const [autoBrake, setAutoBrake] = useState(false)
  const [tone, setTone] = useState('beep')
  return (
    <div>
      <SensorDiagram frontActive={front} rearActive={rear} />
      <Toggle label="Front Parking Sensors" value={front} onChange={setFront} />
      <Toggle label="Rear Parking Sensors" value={rear} onChange={setRear} />
      <ButtonGroup label="Sensitivity" options={[{label:'Low',value:'low'},{label:'Med',value:'med'},{label:'High',value:'high'}]} value={sens} onChange={setSens} />
      <Toggle label="Auto Park Brake Assist" value={autoBrake} onChange={setAutoBrake} sub="Emergency braking" danger />
      <ButtonGroup label="Alert Tone" options={[{label:'Beep',value:'beep'},{label:'Chime',value:'chime'},{label:'Silent',value:'silent'}]} value={tone} onChange={setTone} />
    </div>
  )
}

function FoglightCard() {
  const { triggerAnimation } = useCarState()
  const [frontFog, setFrontFog] = useState(false)
  const [rearFog, setRearFog] = useState(false)
  const [corner, setCorner] = useState('auto')
  const [autoFog, setAutoFog] = useState(true)
  const [intensity, setIntensity] = useState(80)

  const handleFrontFog = (v) => {
    setFrontFog(v)
    triggerAnimation('foglight_l', v)
    triggerAnimation('foglight_r', v)
  }
  const handleRearFog = (v) => {
    setRearFog(v)
    triggerAnimation('foglight_l', v)
    triggerAnimation('foglight_r', v)
  }

  return (
    <div>
      <Toggle label="Front Fog Lights" value={frontFog} onChange={handleFrontFog} />
      <Toggle label="Rear Fog Light" value={rearFog} onChange={handleRearFog} />
      <ButtonGroup label="Cornering Lights"
        options={[{label:'Auto',value:'auto'},{label:'On',value:'on'},{label:'Off',value:'off'}]}
        value={corner} onChange={setCorner} />
      <Toggle label="Auto Fog Activation" value={autoFog} onChange={setAutoFog} sub="Triggers in rain/fog" />
      <Slider label="Intensity" value={intensity} onChange={setIntensity} />
    </div>
  )
}

function SunroofCard() {
  const { triggerAnimation } = useCarState()
  const [shade, setShade] = useState(false)
  const [deflector, setDeflector] = useState(true)
  const [rainClose, setRainClose] = useState(true)
  const [pos, setPos] = useState(0)

  const handleSunroofPosition = (newPos) => {
    setPos(newPos)
    triggerAnimation('sunroof', newPos) // 0 = closed, 1 = tilted, 2 = open
  }

  return (
    <div>
      <div className="py-2 border-b border-white/5">
        <div className="text-xs text-white/60 mb-2">Sunroof Position</div>
        <div className="flex gap-2">
          <ActionBtn label="Tilt" variant="primary" onClick={() => handleSunroofPosition(1)} />
          <ActionBtn label="Open" variant="primary" onClick={() => handleSunroofPosition(2)} />
          <ActionBtn label="Close" onClick={() => handleSunroofPosition(0)} />
        </div>
        <div className="mt-2">
          <Slider label="Position" value={pos * 50} onChange={v => handleSunroofPosition(Math.round(v / 50))} min={0} max={100} unit="%" />
        </div>
      </div>
      <Toggle label="Sunshade" value={shade} onChange={setShade} sub={shade ? 'Extended' : 'Retracted'} />
      <Toggle label="Wind Deflector" value={deflector} onChange={setDeflector} sub={deflector ? 'Active' : 'Inactive'} />
      <Toggle label="Close on Rain" value={rainClose} onChange={setRainClose} sub={rainClose ? 'Enabled' : 'Disabled'} />
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-white/60">UV Protection</span>
        <span className="text-xs font-mono text-green-400">99%</span>
      </div>
    </div>
  )
}

function DoorCard() {
  const { setDoorsOpen, doorsOpen, triggerAnimation } = useCarState()
  const { playDoorOpen, playDoorClose, playWindowSlide } = useSoundFX()
  const [locked, setLocked] = useState(true)
  const [childLock, setChildLock] = useState(false)
  const [autoLock, setAutoLock] = useState(true)
  const [approach, setApproach] = useState(false)
  const [windows, setWindows] = useState({ fl: 0, fr: 0, rl: 0, rr: 0 })
  const [doorStates, setDoorStates] = useState({ fl: false, fr: false, rl: false, rr: false })

  const toggleDoor = (key) => {
    const next = !doorStates[key]
    const newStates = { ...doorStates, [key]: next }
    setDoorStates(newStates)
    triggerAnimation(`door_${key}`, next)
    // Keep global doorsOpen in sync with the actual per-door state
    const allOpen   = Object.values(newStates).every(Boolean)
    const allClosed = Object.values(newStates).every(v => !v)
    if (allOpen)   setDoorsOpen(true)
    if (allClosed) setDoorsOpen(false)
    next ? playDoorOpen() : playDoorClose()
  }

  const handleOpenAllDoors = () => {
    setDoorsOpen(true)
    setDoorStates({ fl: true, fr: true, rl: true, rr: true })
    ;['fl','fr','rl','rr'].forEach(k => triggerAnimation(`door_${k}`, true))
    playDoorOpen()
  }

  const handleCloseAllDoors = () => {
    setDoorsOpen(false)
    setDoorStates({ fl: false, fr: false, rl: false, rr: false })
    ;['fl','fr','rl','rr'].forEach(k => triggerAnimation(`door_${k}`, false))
    playDoorClose()
  }

  return (
    <div>
      <div className="flex gap-2 py-2 border-b border-white/5">
        <button onClick={() => setLocked(false)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all ${!locked ? 'bg-orange-500/20 border-orange-400/40 text-orange-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
          <Unlock size={13} /> Unlock All
        </button>
        <button onClick={() => setLocked(true)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all ${locked ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
          <Lock size={13} /> Lock All
        </button>
      </div>
      <div className="py-2 border-b border-white/5">
        <button onClick={() => doorsOpen ? handleCloseAllDoors() : handleOpenAllDoors()}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-all ${doorsOpen ? 'bg-orange-500/20 border-orange-400/40 text-orange-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
          <DoorOpen size={13} /> {doorsOpen ? 'Close All Doors' : 'Open All Doors'}
        </button>
      </div>
      <SectionLabel text="Individual Doors" />
      <div className="grid grid-cols-2 gap-1.5 pb-3 border-b border-white/5">
        {[['FL', 'fl'], ['FR', 'fr'], ['RL', 'rl'], ['RR', 'rr']].map(([lbl, key]) => (
          <button key={key} onClick={() => toggleDoor(key)}
            className={`py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
              doorStates[key]
                ? 'bg-orange-500/20 border-orange-400/40 text-orange-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}>
            <DoorOpen size={12} />
            {lbl} {doorStates[key] ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>
      <SectionLabel text="Windows" />
      <div className="py-2 border-b border-white/5 flex gap-2">
        <button
          onClick={() => {
            setWindows({ fl: 0, fr: 0, rl: 0, rr: 0 })
            ;['fl','fr','rl','rr'].forEach(k => triggerAnimation(`window_${k}`, 0))
            playWindowSlide()
          }}
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-all"
        >
          Close All
        </button>
        <button
          onClick={() => {
            setWindows({ fl: 100, fr: 100, rl: 100, rr: 100 })
            ;['fl','fr','rl','rr'].forEach(k => triggerAnimation(`window_${k}`, 100))
            playWindowSlide()
          }}
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 transition-all"
        >
          Open All
        </button>
      </div>
      {Object.entries({ FL: 'fl', FR: 'fr', RL: 'rl', RR: 'rr' }).map(([lbl, key]) => (
        <div key={key} className="space-y-2 py-2 border-b border-white/5 last:border-0">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/60">{lbl} Window</span>
            <span className="text-xs font-mono text-white">{windows[key]}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={windows[key]}
            onChange={e => {
              const v = Number(e.target.value)
              setWindows(p => ({ ...p, [key]: v }))
              triggerAnimation(`window_${key}`, v)
            }}
            onMouseUp={() => playWindowSlide()}
            style={{ accentColor: '#00d4ff' }}
            className="w-full"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setWindows(p => ({ ...p, [key]: 0 })); triggerAnimation(`window_${key}`, 0); playWindowSlide() }}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-all"
            >
              Close
            </button>
            <button
              onClick={() => { setWindows(p => ({ ...p, [key]: 100 })); triggerAnimation(`window_${key}`, 100); playWindowSlide() }}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 transition-all"
            >
              Open
            </button>
          </div>
        </div>
      ))}
      <Toggle label="Child Lock (Rear)" value={childLock} onChange={setChildLock} />
      <Toggle label="Auto-Lock at Speed" value={autoLock} onChange={setAutoLock} sub="Locks above 15 km/h" />
      <Toggle label="Approach Unlock" value={approach} onChange={setApproach} sub="Unlocks on approach" />
    </div>
  )
}

function AcVentCard() {
  const { climateState, setClimateProp } = useCarState()
  const { driverTemp, passengerTemp, fanSpeed, acOn } = climateState
  const [mode, setMode] = useState('face')
  const [recirc, setRecirc] = useState(false)
  const [defrost, setDefrost] = useState(false)
  return (
    <div>
      <SectionLabel text="Dual-Zone Temperature" />
      <Slider label="Driver" value={driverTemp} onChange={v => setClimateProp('driverTemp', v)} min={16} max={30} unit="°C" color="#00d4ff" />
      <Slider label="Passenger" value={passengerTemp} onChange={v => setClimateProp('passengerTemp', v)} min={16} max={30} unit="°C" color="#a78bfa" />
      <div className="py-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/60">Fan Speed</span>
          <span className="text-xs font-mono text-white">{fanSpeed}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <button key={i} onClick={() => setClimateProp('fanSpeed', i + 1)}
              className="flex-1 h-7 rounded-md transition-all"
              style={{ background: i < fanSpeed ? '#00d4ff' : 'rgba(255,255,255,0.08)', boxShadow: i < fanSpeed ? '0 0 6px rgba(0,212,255,0.4)' : 'none' }} />
          ))}
        </div>
      </div>
      <ButtonGroup label="Mode" options={[{label:'Face',value:'face'},{label:'Feet',value:'feet'},{label:'Defr.',value:'defrost'},{label:'Auto',value:'auto'}]} value={mode} onChange={setMode} />
      <Toggle label="Air Recirculation" value={recirc} onChange={setRecirc} />
      <Toggle label="A/C Compressor" value={acOn} onChange={v => setClimateProp('acOn', v)} />
      <Toggle label="Rear Window Defrost" value={defrost} onChange={setDefrost} />
    </div>
  )
}

function SeatCard() {
  const { seatDriver, setSeatDriver } = useCarState()
  const [mem, setMem] = useState(null)
  const [saved, setSaved] = useState(false)
  const [lumbar, setLumbar] = useState(3)
  const [vent, setVent] = useState('off')
  const [heat, setHeat] = useState('off')
  const [massage, setMassage] = useState(false)

  const handleSave = () => {
    if (mem === null) return
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <div className="flex gap-1.5 py-2 border-b border-white/5">
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => setMem(n)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${mem === n ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-white/50'}`}>
            M{n}
          </button>
        ))}
        <button
          onClick={handleSave}
          disabled={mem === null}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            saved ? 'bg-green-500/20 border-green-400/40 text-green-300'
            : mem !== null ? 'bg-white/8 border-white/15 text-white/70 hover:bg-white/12'
            : 'bg-white/3 border-white/8 text-white/25 cursor-not-allowed'
          }`}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      <Slider label="Fore / Aft" value={seatDriver.foreAft} onChange={v => setSeatDriver('foreAft', v)} unit="" />
      <Slider label="Height" value={seatDriver.height} onChange={v => setSeatDriver('height', v)} unit="" />
      <Slider label="Backrest Angle" value={seatDriver.recline} onChange={v => setSeatDriver('recline', v)} unit="°" />
      <Slider label="Lumbar Support" value={lumbar} onChange={setLumbar} min={0} max={6} unit="" />
      <ButtonGroup label="Seat Ventilation" options={[{label:'Off',value:'off'},{label:'Low',value:'low'},{label:'High',value:'high'}]} value={vent} onChange={setVent} />
      <ButtonGroup label="Seat Heating" options={[{label:'Off',value:'off'},{label:'1',value:'1'},{label:'2',value:'2'},{label:'3',value:'3'}]} value={heat} onChange={setHeat} />
      <Toggle label="Massage Mode" value={massage} onChange={setMassage} sub="Lumbar massage cycle" />
    </div>
  )
}

function SteeringCard() {
  const { steeringPos, setSteeringPos } = useCarState()
  const [heatOn, setHeatOn] = useState(false)
  const [heatLevel, setHeatLevel] = useState('1')
  const [cruiseActive, setCruiseActive] = useState(false)
  const [cruiseSpeed, setCruiseSpeed] = useState(null)

  const handleSet = () => { setCruiseActive(true); setCruiseSpeed(65) }
  const handleCancel = () => { setCruiseActive(false); setCruiseSpeed(null) }
  const handleResume = () => { if (cruiseSpeed !== null) setCruiseActive(true) }

  return (
    <div>
      <Slider label="Tilt Adjustment" value={steeringPos.tilt} onChange={v => setSteeringPos('tilt', v)} unit="" />
      <Slider label="Reach Adjustment" value={steeringPos.reach} onChange={v => setSteeringPos('reach', v)} unit="" />
      <Toggle label="Heated Steering" value={heatOn} onChange={setHeatOn} />
      {heatOn && <ButtonGroup label="Heating Level" options={[{label:'Low',value:'1'},{label:'Med',value:'2'},{label:'High',value:'3'}]} value={heatLevel} onChange={setHeatLevel} />}
      <SectionLabel text="Cruise Controls" />
      {cruiseActive && cruiseSpeed !== null && (
        <div className="flex items-center justify-between py-1.5 px-3 mb-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-[11px] text-cyan-400 font-medium">Cruise active</span>
          <span className="text-xs font-mono text-cyan-300 font-bold">{cruiseSpeed} km/h</span>
        </div>
      )}
      <div className="flex gap-2">
        <ActionBtn label="Set" variant="primary" onClick={handleSet} />
        <ActionBtn label="Cancel" onClick={handleCancel} />
        <ActionBtn label="Resume" variant={cruiseSpeed !== null && !cruiseActive ? 'primary' : 'default'} onClick={handleResume} />
      </div>
    </div>
  )
}

function InfotainmentCard() {
  const [carplay, setCarplay] = useState(true)
  const [nav, setNav] = useState(false)
  const [cam, setCam] = useState(true)
  const [brightness, setBrightness] = useState(75)
  const [screenTimeout, setScreenTimeout] = useState('never')
  return (
    <div>
      <Toggle label="Apple CarPlay" value={carplay} onChange={setCarplay} sub="iPhone connected" />
      <Toggle label="Navigation" value={nav} onChange={setNav} />
      <Toggle label="Reverse Camera" value={cam} onChange={setCam} />
      <Slider label="Screen Brightness" value={brightness} onChange={setBrightness} />
      <ButtonGroup label="Screen Timeout" options={[{label:'Off',value:'off'},{label:'30s',value:'30'},{label:'1min',value:'60'},{label:'Never',value:'never'}]} value={screenTimeout} onChange={setScreenTimeout} />
    </div>
  )
}

function AmbientCard() {
  const ambientColor        = useCarState(s => s.ambientColor)
  const ambientBrightness   = useCarState(s => s.ambientBrightness)
  const setAmbientColor     = useCarState(s => s.setAmbientColor)
  const setAmbientBrightness = useCarState(s => s.setAmbientBrightness)
  const COLORS = ['#00d4ff', '#8080ff', '#ff60a0', '#ff8c00', '#44ff88', '#ffffff', '#ff4040', '#c060ff']
  const [zone, setZone] = useState('all')
  return (
    <div>
      <div className="py-2 border-b border-white/5">
        <div className="text-xs text-white/60 mb-2">Colour</div>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c, i) => (
            <button key={i} onClick={() => setAmbientColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${ambientColor === c ? 'scale-110 shadow-lg' : 'border-transparent'}`}
              style={{ background: c, borderColor: ambientColor === c ? '#ffffff' : 'transparent', boxShadow: ambientColor === c ? `0 0 10px ${c}` : 'none' }} />
          ))}
        </div>
      </div>
      <Slider label="Brightness" value={ambientBrightness} onChange={setAmbientBrightness} />
      <ButtonGroup label="Zone" options={[{label:'All',value:'all'},{label:'Dash',value:'dash'},{label:'Door',value:'door'},{label:'Foot',value:'foot'}]} value={zone} onChange={setZone} />
    </div>
  )
}

function InstrumentCard() {
  const [dispMode, setDispMode] = useState('normal')
  const [bright, setBright] = useState(80)
  const [unit, setUnit] = useState('kmh')
  return (
    <div>
      <ButtonGroup label="Display Mode" options={[{label:'Normal',value:'normal'},{label:'Sport',value:'sport'},{label:'Eco',value:'eco'},{label:'Custom',value:'custom'}]} value={dispMode} onChange={setDispMode} />
      <Slider label="Brightness" value={bright} onChange={setBright} />
      <ButtonGroup label="Speed Unit" options={[{label:'km/h',value:'kmh'},{label:'mph',value:'mph'}]} value={unit} onChange={setUnit} />
      <div className="flex gap-2 pt-2">
        <ActionBtn label="Reset Trip A" />
        <ActionBtn label="Reset Trip B" />
      </div>
    </div>
  )
}

function OverheadCard() {
  const { triggerAnimation } = useCarState()
  const { playUIOpen } = useSoundFX()
  const [lights, setLights] = useState('off')
  const [camOn, setCamOn] = useState(false)
  const [garageOpen, setGarageOpen] = useState(false)
  const [sosCalling, setSosCalling] = useState(false)

  const handleOpenSunroof = () => {
    triggerAnimation('sunroof', 2)
    playUIOpen()
  }

  const handleGarage = () => setGarageOpen(o => !o)

  const handleSOS = () => {
    if (sosCalling) return
    setSosCalling(true)
    setTimeout(() => setSosCalling(false), 4000)
  }

  return (
    <div>
      <ButtonGroup label="Map Lights" options={[{label:'Off',value:'off'},{label:'Left',value:'l'},{label:'Both',value:'both'},{label:'Right',value:'r'}]} value={lights} onChange={setLights} />
      <Toggle label="Interior Camera" value={camOn} onChange={setCamOn} sub="Dashcam view" />
      <SectionLabel text="Quick Actions" />
      <div className="space-y-2">
        <ActionBtn label="Open Sunroof" variant="primary" icon={Sun} onClick={handleOpenSunroof} />
        <ActionBtn label={garageOpen ? 'Close Garage Door' : 'Garage Door'} icon={DoorOpen} variant={garageOpen ? 'primary' : 'default'} onClick={handleGarage} />
        <ActionBtn
          label={sosCalling ? 'Connecting Emergency Services…' : 'SOS Emergency Call'}
          variant="danger"
          onClick={handleSOS}
        />
      </div>
      {sosCalling && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] text-red-400 font-medium">Emergency call in progress</span>
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">Stay calm — help is on the way</div>
        </div>
      )}
    </div>
  )
}

function TaillightCard() {
  const { triggerAnimation, setBrakeLightMode } = useCarState()
  const [brake, setBrake] = useState('standard')
  const [ambient, setAmbient] = useState(true)
  const [taillightsOn, setTaillightsOn] = useState(false)

  const handleTaillightsToggle = (newState) => {
    setTaillightsOn(newState)
    triggerAnimation('taillight_l', newState)
    triggerAnimation('taillight_r', newState)
  }

  const handleBrakeMode = (mode) => {
    setBrake(mode)
    setBrakeLightMode(mode === 'seq' ? 'sequential' : mode)
  }

  return (
    <div>
      <Toggle label="Brake Lights" value={taillightsOn} onChange={handleTaillightsToggle} sub={taillightsOn ? 'Active' : 'Off'} />
      <ButtonGroup label="Brake Light Mode" options={[{label:'Standard',value:'standard'},{label:'Sequential',value:'seq'},{label:'Pulse',value:'pulse'}]} value={brake} onChange={handleBrakeMode} />
      <Toggle label="Taillight Ambient Strip" value={ambient} onChange={setAmbient} sub={ambient ? 'Enabled' : 'Disabled'} />
      <div className="mt-2 p-3 rounded-xl bg-white/3 border border-white/8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-[11px] text-green-400 font-medium">All lights operational</span>
        </div>
        <div className="text-[10px] text-white/30">Last checked: 0 km ago</div>
      </div>
    </div>
  )
}

function BootCard() {
  const { triggerAnimation } = useCarState()
  const { playBootOpen, playDoorClose } = useSoundFX()
  const [openMode, setOpenMode] = useState('normal')
  const [autoClose, setAutoClose] = useState(true)
  const [damping, setDamping] = useState(50)
  const [light, setLight] = useState(true)
  const [proximity, setProximity] = useState(true)
  const [bootOpen, setBootOpen] = useState(false)

  return (
    <div>
      <SectionLabel text="Boot Control" />
      <div className="py-2 border-b border-white/5">
        <div className="text-xs text-white/60 mb-2">Boot Position</div>
        <div className="flex gap-2">
          <ActionBtn label="Open" variant="primary" onClick={() => { setBootOpen(true); triggerAnimation('boot', true); playBootOpen() }} />
          <ActionBtn label="Close" onClick={() => { setBootOpen(false); triggerAnimation('boot', false); playDoorClose() }} />
        </div>
      </div>
      <ButtonGroup label="Open Mode" options={[{label:'Normal',value:'normal'},{label:'Soft',value:'soft'},{label:'Maximum',value:'max'}]} value={openMode} onChange={setOpenMode} />
      <Slider label="Opening Damping" value={damping} onChange={setDamping} />
      <Toggle label="Auto-Close on Lock" value={autoClose} onChange={setAutoClose} sub="Closes when vehicle locked" />
      <Toggle label="Boot Light" value={light} onChange={setLight} />
      <Toggle label="Proximity Unlock" value={proximity} onChange={setProximity} sub="Open boot near vehicle" />
      <div className="mt-2 p-3 rounded-xl bg-white/3 border border-white/8">
        <div className="text-[10px] text-white/40">Cargo Space: 506L</div>
        <div className="text-[10px] text-white/40 mt-1">Status: Closed & Locked</div>
      </div>
    </div>
  )
}

function HoodCard() {
  const { triggerAnimation } = useCarState()
  const { playBonnetOpen } = useSoundFX()
  const [openMode, setOpenMode] = useState('normal')
  const [damping, setDamping] = useState(60)
  const [autoClose, setAutoClose] = useState(false)
  const [light, setLight] = useState(true)
  const [hoodOpen, setHoodOpen] = useState(false)

  return (
    <div>
      <SectionLabel text="Hood Control" />
      <div className="py-2 border-b border-white/5">
        <div className="text-xs text-white/60 mb-2">Hood Position</div>
        <div className="flex gap-2">
          <ActionBtn label="Open" variant="primary" onClick={() => { setHoodOpen(true); triggerAnimation('bonnet', true); playBonnetOpen() }} />
          <ActionBtn label="Close" onClick={() => { setHoodOpen(false); triggerAnimation('bonnet', false); playBonnetOpen() }} />
        </div>
      </div>
      <ButtonGroup label="Open Mode" options={[{label:'Normal',value:'normal'},{label:'Soft',value:'soft'},{label:'Service',value:'service'}]} value={openMode} onChange={setOpenMode} />
      <Slider label="Opening Damping" value={damping} onChange={setDamping} />
      <Toggle label="Auto-Close on Ignition Off" value={autoClose} onChange={setAutoClose} />
      <Toggle label="Hood Light" value={light} onChange={setLight} />
      <div className="mt-2 p-3 rounded-xl bg-white/3 border border-white/8">
        <div className="text-[10px] text-white/40">Engine: 1.5L i-VTEC</div>
        <div className="text-[10px] text-white/40 mt-1">Status: Closed & Secure</div>
      </div>
    </div>
  )
}

// ── Icon resolver ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  Lightbulb, ShieldCheck, Droplets, Eye, ScanLine, Layers, Sun, DoorOpen,
  Zap, Wind, Gauge, Monitor, Palette, BarChart2, Lamp, Armchair, Wrench,
}

const CARD_MAP = {
  headlight:     HeadlightCard,
  adas:          AdasCard,
  wiper:         WiperCard,
  mirror_left:   (p) => <MirrorCard {...p} hotspot="mirror_left" />,
  mirror_right:  (p) => <MirrorCard {...p} hotspot="mirror_right" />,
  bumper:        BumperCard,
  foglight:      FoglightCard,
  sunroof:       SunroofCard,
  door:          DoorCard,
  taillight:     TaillightCard,
  boot:          BootCard,
  bonnet:        HoodCard,
  ac_vent:       AcVentCard,
  seat_driver:    SeatCard,
  seat_passenger: SeatCard,
  steering:      SteeringCard,
  infotainment:  InfotainmentCard,
  ambient:       AmbientCard,
  instrument:    InstrumentCard,
  overhead:      OverheadCard,
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function ControlOverlay() {
  const { activeHotspot, clearHotspot } = useCarState()
  const { playUIClose } = useSoundFX()
  const config   = useScreenConfig()
  const meta     = activeHotspot ? HOTSPOT_META[activeHotspot] : null
  const CardComp = activeHotspot ? CARD_MAP[activeHotspot] : null
  const IconComp = meta ? ICON_MAP[meta.icon] : null

  function handleClose() {
    playUIClose()
    clearHotspot()
    resetCamera()
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <AnimatePresence mode="wait">
        {activeHotspot && meta && CardComp && (
          <motion.div
            key={activeHotspot}
            initial={{ opacity: 0, x: meta.side === 'right' ? 40 : -40, y: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: meta.side === 'right' ? 40 : -40 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ width: config.overlayPanelWidth }}
            className={`absolute top-16 max-h-[calc(100%-90px)] flex flex-col pointer-events-auto z-30
              ${meta.side === 'right' ? 'right-4' : 'left-4'}`}
          >
            <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'rgba(10,10,16,0.78)', backdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.09)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/6 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  {IconComp && (
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                      <IconComp size={14} color="#00d4ff" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{meta.label}</div>
                    <div className="text-[10px] text-white/35 uppercase tracking-wider">
                      {meta.view === 'interior' ? 'Interior' : 'Exterior'} Control
                    </div>
                  </div>
                </div>
                <button onClick={handleClose}
                  className="w-7 h-7 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 flex items-center justify-center transition-colors">
                  <X size={13} color="rgba(255,255,255,0.7)" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3">
                <CardComp />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
