import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Gauge, Fuel, Shield, Star } from 'lucide-react'
import { useCarState } from '../hooks/useCarState'

const specs = [
  { category: 'Engine',   icon: Zap,    items: [
    { label: 'Engine', value: '1.5L i-VTEC Turbo' },
    { label: 'Displacement', value: '1,498 cc' },
    { label: 'Max Power', value: '121 PS @ 6,600 rpm' },
    { label: 'Max Torque', value: '145 Nm @ 4,300 rpm' },
    { label: 'Transmission', value: 'CVT (7-speed simulated)' },
  ]},
  { category: 'Performance', icon: Gauge, items: [
    { label: '0–100 km/h', value: '9.5 sec' },
    { label: 'Top Speed', value: '195 km/h' },
    { label: 'Drive', value: 'Front-Wheel Drive' },
  ]},
  { category: 'Efficiency', icon: Fuel, items: [
    { label: 'City Fuel Economy', value: '6.2 L/100km' },
    { label: 'Highway', value: '4.8 L/100km' },
    { label: 'Combined', value: '5.4 L/100km' },
    { label: 'Tank Capacity', value: '48 L' },
    { label: 'Range (combined)', value: '~888 km' },
  ]},
  { category: 'Safety', icon: Shield, items: [
    { label: 'NCAP Rating', value: '★★★★★' },
    { label: 'Honda Sensing™', value: 'Standard' },
    { label: 'Airbags', value: '6 (SRS + side curtain)' },
    { label: 'ABS + EBD', value: 'Standard' },
    { label: 'VSA / TCS', value: 'Standard' },
  ]},
  { category: 'Dimensions', icon: Star, items: [
    { label: 'Length × Width × Height', value: '4,549 × 1,748 × 1,467 mm' },
    { label: 'Wheelbase', value: '2,600 mm' },
    { label: 'Ground Clearance', value: '165 mm' },
    { label: 'Boot Volume', value: '506 L' },
    { label: 'Kerb Weight', value: '1,147 kg' },
  ]},
]

export default function SpecSheet() {
  const { isSpecSheetOpen, setSpecSheetOpen } = useCarState()

  return (
    <AnimatePresence>
      {isSpecSheetOpen && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute left-0 top-0 bottom-0 w-full glass-lighter border-r border-white/8
            overflow-y-auto scrollbar-none z-40 flex flex-col"
        >
          <div className="sticky top-0 glass border-b border-white/5 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">Honda City ZX</div>
              <div className="text-[10px] text-white/40">Technical Specifications</div>
            </div>
            <button
              onClick={() => setSpecSheetOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={14} color="rgba(255,255,255,0.6)" />
            </button>
          </div>

          <div className="flex-1 p-4 space-y-5">
            {specs.map(({ category, icon: Icon, items }) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} color="#00d4ff" />
                  <span className="text-[11px] text-cyan-400 uppercase tracking-widest font-semibold">
                    {category}
                  </span>
                </div>
                <div className="space-y-1.5 ml-5">
                  {items.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <span className="text-[11px] text-white/40 flex-shrink-0">{label}</span>
                      <span className="text-[11px] text-white/80 text-right font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="text-[10px] text-white/20 text-center">
              Specifications for Honda City ZX Turbo CVT 2024
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
