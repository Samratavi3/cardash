export const CAMERA_POSITIONS = {
  // Front-quarter view — matches Three.js Ferrari example angle exactly
  default: {
    position: [4.25, 1.55, -4.8],
    target: [0, 0.62, 0],
    fov: 40,
  },
  // Intro starts from the opposite front quarter, sweeps round
  intro_start: {
    position: [-4.8, 1.55, -4.5],
    target: [0, 0.62, 0],
    fov: 40,
  },

  // --- Exterior hotspots ---
  headlight: {
    position: [3.0, 1.1, 2.6],
    target: [2.1, 0.75, 0.75],
    fov: 35,
  },
  adas: {
    position: [1.2, 2.6, 2.8],
    target: [0.3, 1.55, 1.6],
    fov: 32,
  },
  wiper: {
    position: [1.8, 2.4, 2.4],
    target: [0.2, 1.35, 1.5],
    fov: 36,
  },
  mirror_left: {
    position: [-1.0, 1.5, 3.8],
    target: [-1.1, 1.05, 0.88],
    fov: 28,
  },
  mirror_right: {
    position: [3.5, 1.5, 0.5],
    target: [1.1, 1.05, -0.88],
    fov: 28,
  },
  bumper: {
    position: [0, 0.75, 4.8],
    target: [0, 0.44, 2.5],
    fov: 38,
  },
  foglight: {
    position: [3.5, 0.75, 2.5],
    target: [2.0, 0.38, 0.7],
    fov: 32,
  },
  sunroof: {
    position: [0.1, 4.8, 1.8],
    target: [0.1, 1.52, 0],
    fov: 40,
  },
  door: {
    position: [3.8, 1.6, 3.2],
    target: [0.2, 0.75, 0.6],
    fov: 45,
  },
  taillight: {
    position: [-3.2, 1.1, -2.5],
    target:   [-2.1, 0.72, -0.7],
    fov: 35,
  },
  bonnet: {
    position: [0, 2.4, 3.8],
    target: [0, 0.95, 1.3],
    fov: 38,
  },
  boot: {
    position: [0, 2.4, -3.8],
    target: [0, 0.95, -1.4],
    fov: 38,
  },

  // --- Interior hotspots ---
  // All interior world coords after InteriorModel scale=[1,0.682,0.583] pos=[0,0.587,-0.404]:
  //   floor y≈0.70, headliner y≈1.62, dashboard z≈0.54, windshield z≈0.675, rear wall z≈-0.88
  interior: {
    position: [0, 1.33, -0.55],
    target: [0, 1.26, 0.48],
    fov: 75,
  },
  // 360° cabin panorama — camera at eye height near cabin centre
  cabin_360: {
    position: [0, 1.30, -0.12],
    target:   [0, 1.30, -0.11],
    fov: 90,
  },
  ac_vent: {
    position: [-0.15, 1.22, 0.10],
    target: [0.10, 1.24, 0.54],
    fov: 55,
  },
  seat_driver: {
    position: [0.80, 1.20, -0.55],
    target: [-0.38, 0.83, -0.14],
    fov: 52,
  },
  seat_passenger: {
    position: [-0.80, 1.20, -0.55],
    target: [0.38, 0.83, -0.14],
    fov: 52,
  },
  steering: {
    position: [-0.15, 1.30, -0.38],
    target: [-0.37, 1.28, 0.31],
    fov: 48,
  },
  infotainment: {
    position: [0.10, 1.30, -0.20],
    target: [0.10, 1.20, 0.54],
    fov: 45,
  },
  ambient: {
    position: [0.50, 1.12, -0.35],
    target: [0.10, 0.98, 0.10],
    fov: 60,
  },
  instrument: {
    position: [-0.35, 1.42, -0.50],
    target: [-0.365, 1.28, 0.43],
    fov: 42,
  },
  overhead: {
    position: [0, 1.68, -0.45],
    target: [0, 1.47, -0.18],
    fov: 55,
  },
}
