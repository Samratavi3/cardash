// Automotive paint swatches for the MeshPhysicalMaterial car-paint model:
//   base layer  = color · metalness · roughness (+ flake normal strength)
//   clear coat  = clearcoat 1 with clearcoatRoughness (mirror-like top layer)
//   pearl       = thin-film iridescence weight for pearlescent paints
// Metallics sit around 0.6–0.85 metalness: pure 1.0 makes paint read as
// tinted chrome, while < 0.4 loses the metallic flop between light and shade.
// Official 2026 Honda City (facelift, May 2026) colour line-up.
export const PAINT_COLORS = [
  {
    id: 'platinum-white',
    name: 'Platinum White Pearl',
    hex: '#ECEAE4',
    metalness: 0.18,
    roughness: 0.3,
    clearcoatRoughness: 0.025,
    flake: 0.05,
    pearl: 0.35,
    envIntensity: 1.0,
    scene: { background: '#0d1017', fogColor: '#0a0d13', groundColor: '#0b0d12', gridColor: '#182038', rimLightColor: '#a0c4ff' },
  },
  {
    id: 'crystal-black',
    name: 'Crystal Black Pearl',
    hex: '#111215',
    metalness: 0.58,
    roughness: 0.26,
    clearcoatRoughness: 0.02,
    flake: 0.13,
    pearl: 0.14,
    envIntensity: 1.0,
    scene: { background: '#06070a', fogColor: '#05060a', groundColor: '#08090c', gridColor: '#0a1828', rimLightColor: '#00d4ff' },
  },
  {
    id: 'radiant-red',
    name: 'Radiant Red Metallic',
    hex: '#A3121C',
    metalness: 0.62,
    roughness: 0.34,
    clearcoatRoughness: 0.03,
    flake: 0.1,
    envIntensity: 1.0,
    scene: { background: '#100709', fogColor: '#0c0507', groundColor: '#0c0708', gridColor: '#280a0a', rimLightColor: '#ff7050' },
  },
  {
    id: 'obsidian-blue',
    name: 'Obsidian Blue Pearl',
    hex: '#1A2846',
    metalness: 0.62,
    roughness: 0.3,
    clearcoatRoughness: 0.025,
    flake: 0.12,
    pearl: 0.18,
    envIntensity: 1.0,
    scene: { background: '#05070f', fogColor: '#04060c', groundColor: '#06080e', gridColor: '#081428', rimLightColor: '#40a8ff' },
  },
  {
    id: 'lunar-silver',
    name: 'Lunar Silver Metallic',
    hex: '#A4A9B0',
    metalness: 0.82,
    roughness: 0.36,
    clearcoatRoughness: 0.03,
    flake: 0.12,
    envIntensity: 1.0,
    scene: { background: '#0b0d11', fogColor: '#090a0e', groundColor: '#0a0c10', gridColor: '#182030', rimLightColor: '#c0d8ff' },
  },
  {
    id: 'meteoroid-grey',
    name: 'Meteoroid Grey Metallic',
    hex: '#54585E',
    metalness: 0.74,
    roughness: 0.35,
    clearcoatRoughness: 0.03,
    flake: 0.11,
    envIntensity: 1.0,
    scene: { background: '#09090a', fogColor: '#070708', groundColor: '#0a0a0b', gridColor: '#161618', rimLightColor: '#90b0c8' },
  },
]
