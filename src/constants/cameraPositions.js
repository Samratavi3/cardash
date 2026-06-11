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
  // Car axes: +z = nose, +x = LEFT side. Targets = actual mesh world positions.
  headlight: {
    position: [2.6, 1.4, 3.4],
    target: [0.69, 1.0, 1.95],       // headlight_l cluster
    fov: 35,
  },
  adas: {
    position: [1.2, 2.4, 2.6],
    target: [0, 1.54, 0.62],         // ADAS camera at windshield top
    fov: 32,
  },
  wiper: {
    position: [1.6, 2.2, 2.6],
    target: [0, 1.25, 0.85],         // wiper pivots on windshield base
    fov: 36,
  },
  mirror_left: {
    position: [2.4, 1.5, 2.1],
    target: [0.93, 1.23, 0.46],      // left mirror pod at window line
    fov: 30,
  },
  mirror_right: {
    position: [-2.4, 1.5, 2.1],
    target: [-0.93, 1.23, 0.46],     // right mirror pod
    fov: 30,
  },
  // Driver's-eye views for D-pad glass adjustment — over the shoulder at the
  // window line, looking forward at the rear-facing glass so tilt is visible.
  // NOTE: CameraControls minDistance=1.8 clamps anything closer; keep dist ≥ 1.8.
  mirror_left_adjust: {
    position: [1.7, 1.45, -1.2],
    target: [0.95, 1.23, 0.46],
    fov: 35,
  },
  mirror_right_adjust: {
    position: [-1.7, 1.45, -1.2],
    target: [-0.95, 1.23, 0.46],
    fov: 35,
  },
  bumper: {
    position: [0, 1.0, 4.6],
    target: [0, 0.80, 2.0],          // front bumper face
    fov: 38,
  },
  foglight: {
    position: [2.2, 0.9, 3.4],
    target: [0.62, 0.70, 1.96],      // foglight_l in lower bumper
    fov: 32,
  },
  sunroof: {
    position: [0.1, 4.8, 1.8],
    target: [0.1, 1.62, -0.2],       // panoramic roof centre
    fov: 40,
  },
  door: {
    position: [3.8, 1.6, 3.2],
    target: [0.84, 0.95, 0.2],       // left door pair
    fov: 45,
  },
  taillight: {
    position: [-2.6, 1.4, -3.4],
    target:   [-0.66, 0.98, -1.96],  // taillight_r cluster
    fov: 35,
  },
  bonnet: {
    position: [0, 2.4, 3.8],
    target: [0, 1.14, 1.3],          // hood deck (raised to shoulder line)
    fov: 38,
  },
  boot: {
    position: [0, 2.4, -3.8],
    target: [0, 1.1, -1.4],          // trunk deck
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
  // 360° cabin panorama — camera at 