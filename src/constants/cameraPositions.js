// Camera presets. World frame is real-scale metres, ground at y = 0,
// +Z = nose, +X = car's LEFT (passenger side — the car is RHD).
// Targets are the actual part locations on the procedural model.
export const CAMERA_POSITIONS = {
  // Hero front-three-quarter
  default: { position: [5.0, 1.75, 7.9], target: [0, 0.62, 0.05], fov: 32 },
  // Intro starts from the opposite front quarter and sweeps round
  intro_start: { position: [-7.6, 2.9, 5.9], target: [0, 0.7, 0], fov: 32 },

  // ── Exterior hotspots ──────────────────────────────────────────────────────
  headlight: { position: [2.5, 1.05, 4.3], target: [0.62, 0.7, 2.12], fov: 28 },
  adas: { position: [0.7, 1.95, 2.5], target: [0, 1.4, 0.14], fov: 26 },
  wiper: { position: [1.5, 2.5, 3.3], target: [-0.1, 1.06, 0.88], fov: 32 },
  mirror_left: { position: [2.9, 1.4, 2.6], target: [0.98, 1.0, 0.6], fov: 26 },
  mirror_right: { position: [-2.9, 1.4, 2.6], target: [-0.98, 1.0, 0.6], fov: 26 },
  // Behind-the-mirror views so glass tilt is visible while using the D-pad
  mirror_left_adjust: { position: [2.15, 1.32, -1.85], target: [0.98, 1.0, 0.62], fov: 30 },
  mirror_right_adjust: { position: [-2.15, 1.32, -1.85], target: [-0.98, 1.0, 0.62], fov: 30 },
  bumper: { position: [0.9, 1.05, 5.5], target: [0, 0.45, 2.15], fov: 30 },
  foglight: { position: [2.1, 0.7, 4.3], target: [0.68, 0.37, 2.15], fov: 26 },
  sunroof: { position: [1.6, 4.5, 2.4], target: [0, 1.45, -0.24], fov: 32 },
  door: { position: [4.5, 1.7, 1.4], target: [0.85, 0.82, -0.2], fov: 38 },
  taillight: { position: [-2.7, 1.35, -4.6], target: [-0.62, 0.94, -2.1], fov: 28 },
  bonnet: { position: [1.7, 2.75, 4.7], target: [0, 0.9, 1.55], fov: 34 },
  boot: { position: [1.6, 2.6, -5.1], target: [0, 1.0, -1.8], fov: 34 },

  // ── Interior hotspots (driver sits on the −X side) ────────────────────────
  // Rear-bench viewpoint: front seats, dash and both screens in one frame
  interior: { position: [0, 1.24, -1.0], target: [0, 0.94, 0.6], fov: 66 },
  cabin_360: { position: [0, 1.16, -0.32], target: [0, 1.16, -0.31], fov: 85 },
  ac_vent: { position: [0.16, 1.1, -0.12], target: [0.0, 0.97, 0.62], fov: 48 },
  seat_driver: { position: [0.32, 1.3, -1.05], target: [-0.37, 0.78, -0.3], fov: 50 },
  seat_passenger: { position: [-0.32, 1.3, -1.05], target: [0.37, 0.78, -0.3], fov: 50 },
  steering: { position: [-0.26, 1.2, -0.34], target: [-0.37, 0.97, 0.37], fov: 46 },
  infotainment: { position: [0.0, 1.2, -0.2], target: [0.03, 1.02, 0.6], fov: 40 },
  ambient: { position: [0.42, 1.12, -0.75], target: [0, 0.86, 0.3], fov: 62 },
  instrument: { position: [-0.37, 1.2, -0.3], target: [-0.37, 1.01, 0.57], fov: 34 },
  overhead: { position: [0, 1.15, -0.4], target: [0, 1.4, 0.36], fov: 55 },
}
