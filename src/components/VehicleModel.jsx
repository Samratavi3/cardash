import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCarState } from "../hooks/useCarState";
import { flyTo } from "../hooks/useCameraRig";
import { EXTERIOR_MESH_TO_HOTSPOT } from "../constants/hotspots";

// Y position of window glass when fully closed — LOCAL to the door group (door group y=0.90, world y=1.34)
const WINDOW_BASE_Y = 0.44;

// Sourced from constants/hotspots.js — single-source for all exterior mesh→hotspot mapping
const HOTSPOT_MAP = EXTERIOR_MESH_TO_HOTSPOT;

// Rim material per wheel style
const RIM_PROPS = {
  stock:  { color: "#a0a0a0", metalness: 0.90, roughness: 0.10 },
  sport:  { color: "#3a3a3a", metalness: 0.80, roughness: 0.20 },
  carbon: { color: "#181818", metalness: 0.25, roughness: 0.55 },
};

export default function VehicleModel() {
  const groupRef   = useRef();
  const meshCache  = useRef({});   // populated once after mount
  const doorGeoFL  = useRef();
  const doorGeoFR  = useRef();
  const doorGeoRL  = useRef();
  const doorGeoRR  = useRef();
  const bonnetGeo  = useRef();
  const bootGeo    = useRef();

  const pivotApplied = useRef(false);   // guard against StrictMode double-invoke
  const wiperPhase     = useRef(0);     // continuous phase for front wiper oscillation
  const rearWiperPhase = useRef(0);     // continuous phase for rear wiper oscillation

  const { camera, gl } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef     = useRef(new THREE.Vector2());

  // Animation lerp targets — initialised to resting positions
  const animTargets = useRef({
    door_fl: 0, door_fr: 0, door_rl: 0, door_rr: 0,
    bonnet: 0,  boot: 0,
    wiper_front_left: -Math.PI / 6, wiper_front_right: Math.PI / 6, wiper_rear: -Math.PI / 6,
    sunroof: 0, sunroof_slide: 0,
    window_fl: WINDOW_BASE_Y, window_fr: WINDOW_BASE_Y,
    window_rl: WINDOW_BASE_Y, window_rr: WINDOW_BASE_Y,
    mirror_left: 0, mirror_right: 0,
    headlight_l_intensity: 0, headlight_r_intensity: 0,
    taillight_l_intensity: 0, taillight_r_intensity: 0,
    foglight_l_intensity: 0, foglight_r_intensity: 0,
    foglight_rear_intensity: 0,
  });

  const selectedColor    = useCarState(s => s.selectedColor);
  const animationStates  = useCarState(s => s.animationStates);
  const setActiveHotspot = useCarState(s => s.setActiveHotspot);
  const selectedWheel    = useCarState(s => s.selectedWheel);
  const paintFinish      = useCarState(s => s.paintFinish);
  const activeView       = useCarState(s => s.activeView);
  const wiperSpeed       = useCarState(s => s.wiperSpeed);
  const rearWiperSpeed   = useCarState(s => s.rearWiperSpeed);
  const ambientColor     = useCarState(s => s.ambientColor);
  const ambientBrightness = useCarState(s => s.ambientBrightness);
  const mirrorTilt       = useCarState(s => s.mirrorTilt);
  const headlightMode    = useCarState(s => s.headlightMode);
  const brakeLightMode   = useCarState(s => s.brakeLightMode);

  const rim        = RIM_PROPS[selectedWheel] || RIM_PROPS.stock;
  const bodyMetal  = paintFinish === "matte" ? 0    : selectedColor.metalness;
  const bodyRough  = paintFinish === "matte" ? 0.85 : selectedColor.roughness;
  const bodyClearcoat = paintFinish === "matte" ? 0 : 0.9;

  // ── Cache named mesh references once after first render ────────────────────
  useEffect(() => {
    if (!groupRef.current) return;
    [
      "adas_camera", "bumper_front", "bumper_rear",
      "door_fl", "door_fr", "door_rl", "door_rr",
      "bonnet", "boot",
      "wiper_front_left", "wiper_front_right", "wiper_rear",
      "roof",
      "window_fl", "window_fr", "window_rl", "window_rr",
      "mirror_left", "mirror_right",
      "headlight_l", "headlight_r",
      "taillight_l", "taillight_r",
      "foglight_l", "foglight_r", "foglight_rear",
      "ambient_dash", "ambient_footwell_fl", "ambient_footwell_fr",
      "ambient_door_fl", "ambient_door_fr", "ambient_door_rl", "ambient_door_rr",
      "mirror_glass_left", "mirror_glass_right",
    ].forEach((n) => {
      meshCache.current[n] = groupRef.current.getObjectByName(n);
    });
  }, []);

  // ── Translate geometries once to place each pivot at its hinge edge ───────
  // Guard with a ref so StrictMode's double-invoke doesn't apply the offset twice.
  useEffect(() => {
    if (pivotApplied.current) return;
    pivotApplied.current = true;
    // Doors: shift so local z=0 is the front-edge hinge (minimal x-nudge to avoid z-fighting with body panels)
    if (doorGeoFL.current) doorGeoFL.current.translate( 0.002, 0, -0.30);
    if (doorGeoFR.current) doorGeoFR.current.translate(-0.002, 0, -0.30);
    if (doorGeoRL.current) doorGeoRL.current.translate( 0.002, 0, -0.25);
    if (doorGeoRR.current) doorGeoRR.current.translate(-0.002, 0, -0.25);
    // Bonnet: shift so local z=0 is the rear edge (cowl hinge); body extends forward to local z=[0,+1.33]
    if (bonnetGeo.current)  bonnetGeo.current.translate(0, 0, 0.665);
    // Boot: shift so local z=0 is the FRONT edge (hinge near rear window); lid extends rearward to local z=-1.03
    if (bootGeo.current)    bootGeo.current.translate(0, 0, -0.515);
  }, []);

  // ── Click handling via manual raycaster on the raw canvas ─────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const CLICKABLE = new Set(Object.keys(HOTSPOT_MAP));

    function handlePointerDown(event) {
      if (!groupRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width)  *  2 - 1;
      mouseRef.current.y = ((event.clientY - rect.top)  / rect.height) * -2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Use pre-cached refs — avoids O(n) traverse on every click
      const targets = Object.values(meshCache.current).filter(
        (m) => m && CLICKABLE.has(m.name)
      );

      // recursive=true so child meshes inside named groups (mirrors, wipers) are hit
      const hits = raycasterRef.current.intersectObjects(targets, true);
      if (!hits.length) return;

      // hits[0].object may be an unnamed child — walk up to find the named clickable ancestor
      let hitObj = hits[0].object;
      while (hitObj && !CLICKABLE.has(hitObj.name)) hitObj = hitObj.parent;
      if (!hitObj) return;

      const partName    = hitObj.name;
      const hotspotType = HOTSPOT_MAP[partName];
      if (!hotspotType) return;

      setActiveHotspot(hotspotType);
      flyTo(hotspotType);
    }

    if (activeView !== 'exterior') return;
    canvas.addEventListener("pointerdown", handlePointerDown);
    return () => canvas.removeEventListener("pointerdown", handlePointerDown);
  }, [camera, gl, setActiveHotspot, activeView]);

  // Phase advance rates (rad/s) for each speed mode — abs(sin(phase)) oscillates wipers
  const FRONT_WIPER_RATES = { int1: 0.8, int2: 1.5, low: 3.0, high: 5.5 };
  const REAR_WIPER_RATES  = { int: 1.2, low: 2.5, high: 5.0 };

  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const c     = meshCache.current;
    const s     = animationStates;
    const t     = animTargets.current;
    const SPEED = 0.1;

    // Doors (Y-axis rotation, pivot at hinge edge set by geometry translate)
    ["door_fl", "door_fr", "door_rl", "door_rr"].forEach((name) => {
      if (!c[name]) return;
      const isLeft = name.endsWith("_fl") || name.endsWith("_rl");
      const target = s[name] ? (isLeft ? -Math.PI / 3 : Math.PI / 3) : 0;
      t[name] += (target - t[name]) * SPEED;
      c[name].rotation.y = t[name];
    });

    // Hood — pivots from rear hinge (cowl); negative rotation lifts front edge up
    if (c.bonnet) {
      const target = s.bonnet ? -Math.PI / 2.8 : 0;
      t.bonnet += (target - t.bonnet) * SPEED;
      c.bonnet.rotation.x = t.bonnet;
    }

    // Boot — pivots from front hinge (near rear window); positive rotation lifts rear/license-plate end up
    if (c.boot) {
      const target = s.boot ? Math.PI / 2.8 : 0;
      t.boot += (target - t.boot) * SPEED;
      c.boot.rotation.x = t.boot;
    }

    // Front wipers — arm lies on windshield surface, sweeps across glass via local Z rotation
    // rest=-PI/6 (slightly right of up), swept=+PI/3 (pointing upper-left); right wiper mirrors
    if (s.wiper_front_left) {
      wiperPhase.current += delta * (FRONT_WIPER_RATES[wiperSpeed] ?? 1.5);
      const swing = Math.abs(Math.sin(wiperPhase.current));
      const leftAngle  = -Math.PI / 6 + swing * (Math.PI / 2);
      const rightAngle =  Math.PI / 6 - swing * (Math.PI / 2);
      if (c.wiper_front_left)  { t.wiper_front_left  = leftAngle;  c.wiper_front_left.rotation.z  = leftAngle;  }
      if (c.wiper_front_right) { t.wiper_front_right = rightAngle; c.wiper_front_right.rotation.z = rightAngle; }
    } else {
      wiperPhase.current = 0;
      if (c.wiper_front_left)  { t.wiper_front_left  += (-Math.PI / 6 - t.wiper_front_left)  * SPEED; c.wiper_front_left.rotation.z  = t.wiper_front_left;  }
      if (c.wiper_front_right) { t.wiper_front_right += ( Math.PI / 6 - t.wiper_front_right) * SPEED; c.wiper_front_right.rotation.z = t.wiper_front_right; }
    }

    // Rear wiper — same principle: rest=-PI/6, sweeps +PI/2 range
    if (s.wiper_rear) {
      rearWiperPhase.current += delta * (REAR_WIPER_RATES[rearWiperSpeed] ?? 1.2);
      const rearSwing = Math.abs(Math.sin(rearWiperPhase.current));
      const rearAngle = -Math.PI / 6 + rearSwing * (Math.PI / 2);
      if (c.wiper_rear) { t.wiper_rear = rearAngle; c.wiper_rear.rotation.z = rearAngle; }
    } else {
      rearWiperPhase.current = 0;
      if (c.wiper_rear) { t.wiper_rear += (-Math.PI / 6 - t.wiper_rear) * SPEED; c.wiper_rear.rotation.z = t.wiper_rear; }
    }

    // Sunroof: state 1 = vent tilt (rear edge lifts), state 2 = slide back + slight tilt
    if (c.roof) {
      const tiltTarget  = s.sunroof >= 1 ? Math.PI / 22 : 0; // ~8° tilt for vent and open
      const slideTarget = s.sunroof === 2 ? -0.9 : 0;        // slide -0.9 units for open
      t.sunroof       += (tiltTarget  - t.sunroof)       * SPEED;
      t.sunroof_slide += (slideTarget - t.sunroof_slide) * SPEED;
      c.roof.rotation.x = t.sunroof;
      c.roof.position.z = -0.195 + t.sunroof_slide;
    }

    // Windows (0 = closed at WINDOW_BASE_Y, 100 = open, retracts into glass channel)
    ["window_fl", "window_fr", "window_rl", "window_rr"].forEach((name) => {
      const mesh = c[name];
      if (!mesh) return;
      const targetY = WINDOW_BASE_Y - (s[name] / 100) * 0.40;
      t[name] += (targetY - t[name]) * SPEED;
      mesh.position.y = t[name];
      if (mesh.material) mesh.material.opacity = 0.38 * (1 - s[name] / 100);
    });

    // Mirrors — Y-axis rotation: deployed=0 (stalk straight out, max extension).
    // Fold sweeps the pod REARWARD against the door: for a +x (left) pod that is
    // +rotation.y (x→−z); for the −x (right) pod it is −rotation.y. 75° (π/2.4)
    // keeps the pod proud of the door skin instead of sinking into it at 90°.
    if (c.mirror_left) {
      const target = s.mirror_left ? Math.PI / 2.4 : 0;
      t.mirror_left += (target - t.mirror_left) * SPEED;
      c.mirror_left.rotation.y = t.mirror_left;
    }
    if (c.mirror_right) {
      const target = s.mirror_right ? -Math.PI / 2.4 : 0;
      t.mirror_right += (target - t.mirror_right) * SPEED;
      c.mirror_right.rotation.y = t.mirror_right;
    }

    // Mirror glass tilt — X axis = up/down, Y axis = left/right, max 25° each way
    if (c.mirror_glass_left) {
      c.mirror_glass_left.rotation.x = mirrorTilt.left.x * 0.44;
      c.mirror_glass_left.rotation.y = mirrorTilt.left.y * 0.44;
    }
    if (c.mirror_glass_right) {
      c.mirror_glass_right.rotation.x = mirrorTilt.right.x * 0.44;
      c.mirror_glass_right.rotation.y = mirrorTilt.right.y * 0.44;
    }

    // Ambient interior strips — update emissive color + intensity from store every frame
    const ambientI = (ambientBrightness / 100) * 1.4;
    ["ambient_dash","ambient_footwell_fl","ambient_footwell_fr",
     "ambient_door_fl","ambient_door_fr","ambient_door_rl","ambient_door_rr"].forEach(n => {
      const m = c[n];
      if (!m?.material) return;
      m.material.emissive.set(ambientColor);
      m.material.emissiveIntensity = ambientI;
    });

    // Headlights — DRL is warm white at low intensity; High Beam is bright cool white
    const hlTarget = headlightMode === 'high' ? 2.0 : headlightMode === 'drl' ? 0.5 : 0;
    const hlColor  = headlightMode === 'high' ? '#ffffff' : '#ffff88';
    [c.headlight_l, c.headlight_r].forEach((mesh, ki) => {
      if (!mesh?.material) return;
      const key = ki === 0 ? 'headlight_l_intensity' : 'headlight_r_intensity';
      const diff = hlTarget - t[key];
      if (Math.abs(diff) > 0.001) {
        t[key] += diff * SPEED;
        mesh.material.emissiveIntensity = t[key];
        mesh.material.emissive.set(hlColor);
      }
    });

    // Taillights — mode-aware
    if (s.taillight_l || s.taillight_r) {
      const now = performance.now() / 1000;
      if (brakeLightMode === 'pulse') {
        const pulse = 0.5 + 0.5 * Math.sin(now * Math.PI * 3); // ~1.5 Hz
        [c.taillight_l, c.taillight_r].forEach(m => { if (m?.material) m.material.emissiveIntensity = pulse * 1.2; });
      } else if (brakeLightMode === 'sequential') {
        const phase = (now % 0.6) / 0.6; // 0→1 every 0.6 s
        const iL = phase < 0.5 ? phase * 2 : 1;   // left fills first half
        const iR = phase < 0.5 ? 0 : (phase - 0.5) * 2; // right fills second half
        if (c.taillight_l?.material) c.taillight_l.material.emissiveIntensity = iL * 1.2;
        if (c.taillight_r?.material) c.taillight_r.material.emissiveIntensity = iR * 1.2;
      } else {
        [c.taillight_l, c.taillight_r].forEach(m => {
          if (m?.material && Math.abs(m.material.emissiveIntensity - 1.2) > 0.01)
            m.material.emissiveIntensity += (1.2 - m.material.emissiveIntensity) * SPEED;
        });
      }
    } else {
      [c.taillight_l, c.taillight_r].forEach(m => {
        if (m?.material && m.material.emissiveIntensity > 0.001)
          m.material.emissiveIntensity *= (1 - SPEED);
      });
    }

    // Fog lights
    [
      { mesh: c.foglight_l,    key: "foglight_l_intensity",    on: s.foglight_l,    maxI: 1.0 },
      { mesh: c.foglight_r,    key: "foglight_r_intensity",    on: s.foglight_r,    maxI: 1.0 },
      { mesh: c.foglight_rear, key: "foglight_rear_intensity", on: s.foglight_rear, maxI: 1.3 },
    ].forEach(({ mesh, key, on, maxI }) => {
      if (!mesh?.material) return;
      const diff = (on ? maxI : 0) - t[key];
      if (Math.abs(diff) > 0.001) {
        t[key] += diff * SPEED;
        mesh.material.emissiveIntensity = t[key];
      }
    });
  });

  // ── JSX — geometry unchanged, material props now derived from state ─────────
  return (
    <group ref={groupRef}>
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHASSIS FRAME */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="chassis" position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.1, 3.85]} />
        <meshPhysicalMaterial
          color={selectedColor.hex}
          metalness={bodyMetal}
          roughness={bodyRough}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT BONNET */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* position = rear hinge (cowl edge z=0.605); translate shifts body to local z=[0,+1.33].
          y=1.14 → deck top 1.20 flush with fender shoulder line */}
      <mesh name="bonnet" position={[0, 1.14, 0.605]} castShadow receiveShadow>
        <boxGeometry ref={bonnetGeo} args={[1.68, 0.12, 1.33]} />
        <meshPhysicalMaterial
          color={selectedColor.hex}
          metalness={bodyMetal}
          roughness={bodyRough}
          clearcoat={bodyClearcoat}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WINDSHIELD — raked ~25° from vertical (bottom z≈0.79, top z≈0.56) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="windshield" position={[0, 1.43, 0.675]} rotation={[-0.435, 0, 0]} castShadow>
        <boxGeometry args={[1.58, 0.54, 0.06]} />
        <meshPhysicalMaterial
          color="#7799bb"
          transmission={0.93}
          roughness={0.01}
          ior={1.52}
          thickness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ADAS CAMERA */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ADAS camera mount — on interior face of windshield near top (~z≈0.59 at y=1.54) */}
      <mesh position={[0, 1.47, 0.62]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh name="adas_camera" position={[0, 1.54, 0.60]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 0.09, 0.12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.75} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.56, 0.64]} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 16]} />
        <meshPhysicalMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} clearcoat={0.9} />
      </mesh>
      <mesh position={[0, 1.56, 0.67]} castShadow receiveShadow>
        <cylinderGeometry args={[0.042, 0.042, 0.02, 16]} />
        <meshPhysicalMaterial color="#4444ff" metalness={0.98} roughness={0.02} clearcoat={1.0} transmission={0.5} />
      </mesh>
      <mesh position={[0.06, 1.54, 0.60]} castShadow>
        <sphereGeometry args={[0.01, 10, 10]} />
        <meshPhysicalMaterial color="#00ff00" emissive="#00cc00" emissiveIntensity={1.2} metalness={0.4} roughness={0.2} />
      </mesh>
      <mesh position={[-0.06, 1.54, 0.60]} castShadow>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial color="#555" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT BUMPER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="bumper_front" position={[0, 0.825, 1.93]} castShadow>
        <boxGeometry args={[1.68, 0.35, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT HEADLIGHTS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Slim LED clusters at hood line — flush with bumper face (z=2.005), not proud */}
      <mesh name="headlight_l" position={[0.69, 1.0, 1.95]} castShadow>
        <boxGeometry args={[0.34, 0.13, 0.10]} />
        <meshPhysicalMaterial
          color="#ffffff" emissive="#ffff88" emissiveIntensity={0}
          metalness={0.2} roughness={0.1} toneMapped={false}
        />
      </mesh>
      <mesh name="headlight_r" position={[-0.69, 1.0, 1.95]} castShadow>
        <boxGeometry args={[0.34, 0.13, 0.10]} />
        <meshPhysicalMaterial
          color="#ffffff" emissive="#ffff88" emissiveIntensity={0}
          metalness={0.2} roughness={0.1} toneMapped={false}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT FOG LIGHTS — lower bumper corners */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="foglight_l" position={[0.62, 0.70, 1.96]} castShadow>
        <boxGeometry args={[0.18, 0.10, 0.10]} />
        <meshPhysicalMaterial
          color="#ffffcc" emissive="#ffee44" emissiveIntensity={0}
          metalness={0.1} roughness={0.15} toneMapped={false}
        />
      </mesh>
      <mesh name="foglight_r" position={[-0.62, 0.70, 1.96]} castShadow>
        <boxGeometry args={[0.18, 0.10, 0.10]} />
        <meshPhysicalMaterial
          color="#ffffcc" emissive="#ffee44" emissiveIntensity={0}
          metalness={0.1} roughness={0.15} toneMapped={false}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REAR BUMPER */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="bumper_rear" position={[0, 0.825, -1.93]} castShadow>
        <boxGeometry args={[1.68, 0.35, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REAR TAILLIGHTS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Slim wrap clusters at deck height — flush with bumper face (z=−2.005), not proud */}
      <mesh name="taillight_l" position={[0.66, 0.975, -1.96]} castShadow>
        <boxGeometry args={[0.36, 0.11, 0.09]} />
        <meshPhysicalMaterial
          color="#ff3333" emissive="#cc0000" emissiveIntensity={0}
          metalness={0.2} roughness={0.1} toneMapped={false}
        />
      </mesh>
      <mesh name="taillight_r" position={[-0.66, 0.975, -1.96]} castShadow>
        <boxGeometry args={[0.36, 0.11, 0.09]} />
        <meshPhysicalMaterial
          color="#ff3333" emissive="#cc0000" emissiveIntensity={0}
          metalness={0.2} roughness={0.1} toneMapped={false}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PANORAMIC ROOF */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="roof" position={[0, 1.64, -0.195]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.08, 1.61]} />
        <meshPhysicalMaterial
          color="#7799bb" transmission={0.90}
          roughness={0.02} ior={1.52} thickness={0.04} clearcoat={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[ 0.84, 1.64, -0.195]} castShadow>
        <boxGeometry args={[0.12, 0.08, 1.61]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.84, 1.64, -0.195]} castShadow>
        <boxGeometry args={[0.12, 0.08, 1.61]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.64,  0.615]} castShadow>
        <boxGeometry args={[1.68, 0.08, 0.12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.64, -1.005]} castShadow>
        <boxGeometry args={[1.68, 0.08, 0.12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REAR WINDOW — angled ~12° from vertical (bottom z≈-0.90, top z≈-1.00) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="rear_window" position={[0, 1.42, -0.95]} rotation={[0.20, 0, 0]} castShadow>
        <boxGeometry args={[1.58, 0.50, 0.06]} />
        <meshPhysicalMaterial
          color="#7799bb" transmission={0.93}
          roughness={0.01} ior={1.52} thickness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* C-pillar frames — match rear window angle */}
      <mesh position={[ 0.84, 1.42, -0.95]} rotation={[0.20, 0, 0]} castShadow>
        <boxGeometry args={[0.10, 0.50, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.84, 1.42, -0.95]} rotation={[0.20, 0, 0]} castShadow>
        <boxGeometry args={[0.10, 0.50, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BOOT (TRUNK) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* position = front hinge (near rear window); translate shifts lid to local z=[0, -1.03].
          y=1.14 → deck top 1.20 flush with quarter-panel shoulder line */}
      <mesh name="boot" position={[0, 1.14, -0.90]} castShadow receiveShadow>
        <boxGeometry ref={bootGeo} args={[1.68, 0.12, 1.03]} />
        <meshPhysicalMaterial
          color={selectedColor.hex}
          metalness={bodyMetal}
          roughness={bodyRough}
          clearcoat={bodyClearcoat}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MAIN BODY PANELS — Honda City 3-box sedan profile                   */}
      {/* Cabin zone: full greenhouse height. Fender/quarter: drop to hood /   */}
      {/* trunk-deck level. Single mesh per zone eliminates z-fighting bands.  */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Cabin side corner fillers — ONLY outside the door apertures so the
          interior is visible when doors open. Front: door hinge edge (z=0.50)
          to fender (z=0.61). Rear: rear-door edge (z=−0.80) to quarter (z=−0.90).
          The door-gap zone (z −0.32→−0.04) is closed by the lower B-pillar. */}
      {[0.825, -0.825].map((x) => (
        <group key={`sidefill-${x}`}>
          <mesh position={[x, 0.90, 0.555]} castShadow receiveShadow>
            <boxGeometry args={[0.05, 0.60, 0.11]} />
            <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
          </mesh>
          <mesh position={[x, 0.90, -0.85]} castShadow receiveShadow>
            <boxGeometry args={[0.05, 0.60, 0.10]} />
            <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
          </mesh>
        </group>
      ))}

      {/* Side sills */}
      <mesh position={[ 0.75, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.12, 3.85]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.75, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.12, 3.85]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Front fenders — top y=1.20 matches door tops: one continuous shoulder line */}
      <mesh position={[ 0.84, 0.90, 1.273]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.60, 1.325]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>
      <mesh position={[-0.84, 0.90, 1.273]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.60, 1.325]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>

      {/* Rear quarter panels — top y=1.20 matching boot deck and door tops */}
      <mesh position={[ 0.84, 0.90, -1.415]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.60, 1.03]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>
      <mesh position={[-0.84, 0.90, -1.415]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.60, 1.03]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>

      {/* A-pillar body-colour shoulder — bridges shoulder line (y=1.20) to greenhouse rail (y=1.47);
          z 0.51→0.67 closes the slit ahead of the front-door glass edge (z=0.48) */}
      <mesh position={[ 0.84, 1.335, 0.59]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.27, 0.16]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>
      <mesh position={[-0.84, 1.335, 0.59]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.27, 0.16]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>

      {/* A-pillar dark cap — greenhouse rail to roof (y=1.47→1.60) */}
      <mesh position={[ 0.84, 1.535, 0.61]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.13, 0.12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.84, 1.535, 0.61]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.13, 0.12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* C-pillar dark post — upper rear cabin corner, y=1.20→1.47, gives sedan C-pillar appearance */}
      <mesh position={[ 0.845, 1.335, -0.83]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.27, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.845, 1.335, -0.83]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.27, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REAR CABIN BULKHEAD — closes trunk front / prevents hollow interior  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Main bulkhead wall — from chassis top to boot lid bottom (1.08) */}
      <mesh position={[0, 0.85, -0.90]} castShadow receiveShadow>
        <boxGeometry args={[1.60, 0.46, 0.06]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.2} roughness={0.7} />
      </mesh>
      {/* Parcel shelf — horizontal ledge visible through rear window */}
      <mesh position={[0, 1.16, -0.96]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.04, 0.14]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TRUNK ENCLOSURE                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Trunk floor */}
      <mesh position={[0, 0.695, -1.415]} castShadow receiveShadow>
        <boxGeometry args={[1.52, 0.05, 1.03]} />
        <meshStandardMaterial color="#252525" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Rear body fascia — body-colour centre panel between taillights (narrowed to clear clusters) */}
      <mesh position={[0, 0.925, -1.935]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.55, 0.06]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT GRILLE / FASCIA                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Centre grille panel between headlights (narrowed so headlight clusters clear it) */}
      <mesh position={[0, 0.875, 1.955]} castShadow>
        <boxGeometry args={[1.00, 0.26, 0.09]} />
        <meshStandardMaterial color="#111111" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Upper front face — body-colour strip above grille, below hood (top y=1.20 meets raised hood) */}
      <mesh position={[0, 1.10, 1.940]} castShadow receiveShadow>
        <boxGeometry args={[1.68, 0.20, 0.06]} />
        <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
      </mesh>

      {/* Underbody */}
      <mesh position={[0, 0.64, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 3.5]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DOORS — geometry translate applied once via useEffect refs          */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* FRONT LEFT DOOR — mirror is a child so it swings with the door */}
      <group name="door_fl" position={[0.84, 0.90, 0.50]}>
        <mesh castShadow receiveShadow>
          <boxGeometry ref={doorGeoFL} args={[0.08, 0.60, 0.60]} />
          <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
        </mesh>
        {/* Glass channel — dark pocket where window retracts into */}
        <mesh position={[0, 0.20, -0.30]}>
          <boxGeometry args={[0.074, 0.38, 0.58]} />
          <meshStandardMaterial color="#111" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh name="window_fl" position={[0, 0.44, -0.30]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.28, 0.56]} />
          <meshPhysicalMaterial color="#87ceeb" metalness={0} roughness={0.1} clearcoat={0.9} opacity={0.38} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.57, -0.30]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.06, 0.60]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Ambient strip — inner face, swings with the door */}
        <mesh name="ambient_door_fl" position={[-0.046, 0.10, -0.32]}>
          <boxGeometry args={[0.012, 0.04, 0.50]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
        </mesh>
        {/* Chrome handle — outer face, swings with the door */}
        <mesh position={[0.046, 0.15, -0.38]} castShadow>
          <boxGeometry args={[0.012, 0.04, 0.16]} />
          <meshStandardMaterial color="#cccccc" metalness={0.92} roughness={0.08} />
        </mesh>
        {/* LEFT MIRROR — at window line (world y≈1.23); rotation.y=0 deployed, +75° folded rearward */}
        <group name="mirror_left" position={[0.042, 0.33, -0.03]}>
          {/* Stalk arm — body colour, 9 cm long outward */}
          <mesh position={[0.048, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.09, 0.06, 0.06]} />
            <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={0.7} />
          </mesh>
          {/* Housing pod — compact: 8 cm wide × 16 cm tall × 18 cm deep
              When folded at -PI/2: 18 cm Z-length becomes X-extent → only 9 cm past body face */}
          <mesh position={[0.11, 0.01, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.16, 0.18]} />
            <meshPhysicalMaterial color="#111111" metalness={0.45} roughness={0.25} clearcoat={0.95} />
          </mesh>
          {/* Glass — rear face of pod, faces rearward when deployed */}
          <mesh name="mirror_glass_left" position={[0.12, 0.02, -0.088]} castShadow receiveShadow>
            <boxGeometry args={[0.062, 0.132, 0.012]} />
            <meshPhysicalMaterial color="#b0c8d8" metalness={0.98} roughness={0.02} clearcoat={1.0} />
          </mesh>
          {/* Turn-signal strip — front face of pod, faces forward when deployed */}
          <mesh position={[0.11, -0.05, 0.088]}>
            <boxGeometry args={[0.06, 0.030, 0.010]} />
            <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
              roughness={0.3} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* FRONT RIGHT DOOR — mirror is a child so it swings with the door */}
      <group name="door_fr" position={[-0.84, 0.90, 0.50]}>
        <mesh castShadow receiveShadow>
          <boxGeometry ref={doorGeoFR} args={[0.08, 0.60, 0.60]} />
          <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
        </mesh>
        {/* Glass channel */}
        <mesh position={[0, 0.20, -0.30]}>
          <boxGeometry args={[0.074, 0.38, 0.58]} />
          <meshStandardMaterial color="#111" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh name="window_fr" position={[0, 0.44, -0.30]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.28, 0.56]} />
          <meshPhysicalMaterial color="#87ceeb" metalness={0} roughness={0.1} clearcoat={0.9} opacity={0.38} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.57, -0.30]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.06, 0.60]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Ambient strip — inner face, swings with the door */}
        <mesh name="ambient_door_fr" position={[0.046, 0.10, -0.32]}>
          <boxGeometry args={[0.012, 0.04, 0.50]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
        </mesh>
        {/* Chrome handle — outer face, swings with the door */}
        <mesh position={[-0.046, 0.15, -0.38]} castShadow>
          <boxGeometry args={[0.012, 0.04, 0.16]} />
          <meshStandardMaterial color="#cccccc" metalness={0.92} roughness={0.08} />
        </mesh>
        {/* RIGHT MIRROR — at window line (world y≈1.23); rotation.y=0 deployed, −75° folded rearward */}
        <group name="mirror_right" position={[-0.042, 0.33, -0.03]}>
          {/* Stalk arm */}
          <mesh position={[-0.048, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.09, 0.06, 0.06]} />
            <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={0.7} />
          </mesh>
          {/* Housing pod */}
          <mesh position={[-0.11, 0.01, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.16, 0.18]} />
            <meshPhysicalMaterial color="#111111" metalness={0.45} roughness={0.25} clearcoat={0.95} />
          </mesh>
          {/* Glass — rear face */}
          <mesh name="mirror_glass_right" position={[-0.12, 0.02, -0.088]} castShadow receiveShadow>
            <boxGeometry args={[0.062, 0.132, 0.012]} />
            <meshPhysicalMaterial color="#b0c8d8" metalness={0.98} roughness={0.02} clearcoat={1.0} />
          </mesh>
          {/* Turn-signal strip — front face */}
          <mesh position={[-0.11, -0.05, 0.088]}>
            <boxGeometry args={[0.06, 0.030, 0.010]} />
            <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
              roughness={0.3} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* REAR LEFT DOOR */}
      <group name="door_rl" position={[0.84, 0.90, -0.30]}>
        <mesh castShadow receiveShadow>
          <boxGeometry ref={doorGeoRL} args={[0.08, 0.60, 0.50]} />
          <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
        </mesh>
        {/* Glass channel */}
        <mesh position={[0, 0.20, -0.25]}>
          <boxGeometry args={[0.074, 0.38, 0.48]} />
          <meshStandardMaterial color="#111" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh name="window_rl" position={[0, 0.44, -0.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.28, 0.46]} />
          <meshPhysicalMaterial color="#87ceeb" metalness={0} roughness={0.1} clearcoat={0.9} opacity={0.38} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.57, -0.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.06, 0.50]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Ambient strip — inner face, swings with the door */}
        <mesh name="ambient_door_rl" position={[-0.046, 0.10, -0.12]}>
          <boxGeometry args={[0.012, 0.04, 0.42]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
        </mesh>
        {/* Chrome handle — outer face, swings with the door */}
        <mesh position={[0.046, 0.15, -0.22]} castShadow>
          <boxGeometry args={[0.012, 0.04, 0.16]} />
          <meshStandardMaterial color="#cccccc" metalness={0.92} roughness={0.08} />
        </mesh>
      </group>

      {/* REAR RIGHT DOOR */}
      <group name="door_rr" position={[-0.84, 0.90, -0.30]}>
        <mesh castShadow receiveShadow>
          <boxGeometry ref={doorGeoRR} args={[0.08, 0.60, 0.50]} />
          <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
        </mesh>
        {/* Glass channel */}
        <mesh position={[0, 0.20, -0.25]}>
          <boxGeometry args={[0.074, 0.38, 0.48]} />
          <meshStandardMaterial color="#111" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh name="window_rr" position={[0, 0.44, -0.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.28, 0.46]} />
          <meshPhysicalMaterial color="#87ceeb" metalness={0} roughness={0.1} clearcoat={0.9} opacity={0.38} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.57, -0.25]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.06, 0.50]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Ambient strip — inner face, swings with the door */}
        <mesh name="ambient_door_rr" position={[0.046, 0.10, -0.12]}>
          <boxGeometry args={[0.012, 0.04, 0.42]} />
          <meshStandardMaterial color={ambientColor} emissive={ambientColor}
            emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
        </mesh>
        {/* Chrome handle — outer face, swings with the door */}
        <mesh position={[-0.046, 0.15, -0.22]} castShadow>
          <boxGeometry args={[0.012, 0.04, 0.16]} />
          <meshStandardMaterial color="#cccccc" metalness={0.92} roughness={0.08} />
        </mesh>
      </group>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* UPPER GREENHOUSE — rails above windows (y≈1.47 → 1.60) + B-pillar  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Left greenhouse rail — spans full cabin width z=−0.90→0.61 (matches cabin side panel) */}
      <mesh position={[ 0.84, 1.535, -0.145]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.13, 1.51]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Right greenhouse rail */}
      <mesh position={[-0.84, 1.535, -0.145]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.13, 1.51]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* B-pillars, two-part: body-colour below beltline (fills the door gap),
          dark only in the glass zone — no more floor-to-roof black slab.
          Depth 0.28 closes the slit between door glass edges (z −0.32→−0.04) */}
      {[0.845, -0.845].map((x) => (
        <group key={`bpillar-${x}`}>
          <mesh position={[x, 0.90, -0.18]} castShadow>
            <boxGeometry args={[0.09, 0.60, 0.28]} />
            <meshPhysicalMaterial color={selectedColor.hex} metalness={bodyMetal} roughness={bodyRough} clearcoat={bodyClearcoat} />
          </mesh>
          <mesh position={[x, 1.38, -0.18]} castShadow>
            <boxGeometry args={[0.09, 0.36, 0.28]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Side mirrors are now children of door_fl / door_fr above */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WIPERS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Wipers — pivot at windshield base, tilted with glass, arm extends up local Y, sweeps around local Z */}
      {/* Front left: pivot at x=+0.30, bottom of windshield (y=1.095, z=0.795), tilted to match -0.435 glass rake */}
      <group name="wiper_front_left" position={[0.30, 1.175, 0.795]} rotation={[-0.435, 0, -Math.PI / 6]}>
        {/* arm — extends up the glass along local Y */}
        <mesh position={[0, 0.18, 0.018]} castShadow receiveShadow>
          <boxGeometry args={[0.030, 0.36, 0.022]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.75} roughness={0.2} />
        </mesh>
        {/* rubber blade — flush with glass, slightly longer than arm */}
        <mesh position={[0, 0.21, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[0.016, 0.42, 0.010]} />
          <meshStandardMaterial color="#111" metalness={0.05} roughness={0.95} />
        </mesh>
      </group>

      {/* Front right: mirror of left */}
      <group name="wiper_front_right" position={[-0.30, 1.175, 0.795]} rotation={[-0.435, 0, Math.PI / 6]}>
        <mesh position={[0, 0.18, 0.018]} castShadow receiveShadow>
          <boxGeometry args={[0.030, 0.36, 0.022]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.75} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.21, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[0.016, 0.42, 0.010]} />
          <meshStandardMaterial color="#111" metalness={0.05} roughness={0.95} />
        </mesh>
      </group>

      {/* Rear wiper — pivot at bottom centre of rear window (y=1.10, z=-0.90), tilted with glass (+0.20 rad) */}
      <group name="wiper_rear" position={[0, 1.18, -0.90]} rotation={[0.20, 0, -Math.PI / 6]}>
        <mesh position={[0, 0.15, 0.018]} castShadow receiveShadow>
          <boxGeometry args={[0.030, 0.30, 0.022]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.75} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.17, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[0.016, 0.34, 0.010]} />
          <meshStandardMaterial color="#111" metalness={0.05} roughness={0.95} />
        </mesh>
      </group>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* A-PILLAR FRAMES — angled to match windshield rake                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh position={[ 0.84, 1.43, 0.675]} rotation={[-0.435, 0, 0]} castShadow>
        <boxGeometry args={[0.10, 0.54, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.84, 1.43, 0.675]} rotation={[-0.435, 0, 0]} castShadow>
        <boxGeometry args={[0.10, 0.54, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WHEELS — rim material driven by selectedWheel                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Tire r=0.34, centre y=0.51 → bottom at 0.17 = ground plane, flush footprint.
          x=±0.795 tucks the tire face (0.885) flush with the body side (0.88).
          Group local axes after Rz(90°): Y = wheel axle (world X), X-Z = wheel disc plane. */}
      {[
        [ 0.795, 0.51,  1.2],
        [-0.795, 0.51,  1.2],
        [ 0.795, 0.51, -1.2],
        [-0.795, 0.51, -1.2],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          {/* Tire */}
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.19, 32]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.85} />
          </mesh>
          {/* Brake disc — visible between spokes */}
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.03, 24]} />
            <meshStandardMaterial color="#8a8a8a" metalness={0.9} roughness={0.35} />
          </mesh>
          {/* Rim outer lip — torus rotated into the wheel-disc (local X-Z) plane */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.20, 0.025, 12, 32]} />
            <meshStandardMaterial
              color={rim.color}
              metalness={rim.metalness}
              roughness={rim.roughness}
            />
          </mesh>
          {/* 5 spokes — radiate in the wheel-disc plane */}
          {[0, 1, 2, 3, 4].map((s) => (
            <group key={s} rotation={[0, (s * 2 * Math.PI) / 5, 0]}>
              <mesh position={[0, 0, 0.105]} castShadow>
                <boxGeometry args={[0.05, 0.20, 0.17]} />
                <meshStandardMaterial
                  color={rim.color}
                  metalness={rim.metalness}
                  roughness={rim.roughness}
                />
              </mesh>
            </group>
          ))}
          {/* Centre hub */}
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.21, 16]} />
            <meshStandardMaterial
              color={rim.color}
              metalness={rim.metalness}
              roughness={rim.roughness}
            />
          </mesh>
        </group>
      ))}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WHEEL ARCH RINGS — dark torus on each outer body face, radius > tyre */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {[
        [ 0.885, 0.51,  1.2],
        [-0.885, 0.51,  1.2],
        [ 0.885, 0.51, -1.2],
        [-0.885, 0.51, -1.2],
      ].map(([x, y, z], i) => (
        <mesh key={`arch-${i}`} position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.375, 0.026, 8, 40]} />
          <meshStandardMaterial color="#111111" metalness={0.25} roughness={0.70} />
        </mesh>
      ))}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT LOWER LIP / AIR DAM + LOWER GRILLE */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, 0.65, 1.944]} castShadow>
        <boxGeometry args={[1.38, 0.08, 0.09]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.74, 1.944]} castShadow>
        <boxGeometry args={[1.10, 0.12, 0.06]} />
        <meshStandardMaterial color="#0d0d0d" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REAR DIFFUSER STRIP */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, 0.66, -1.944]} castShadow>
        <boxGeometry args={[1.20, 0.06, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.25} roughness={0.6} />
      </mesh>

      {/* REAR FOG LAMP — single bright red unit, low in the bumper (driver side) */}
      <mesh name="foglight_rear" position={[-0.35, 0.72, -1.99]} castShadow>
        <boxGeometry args={[0.16, 0.07, 0.05]} />
        <meshPhysicalMaterial
          color="#aa2222" emissive="#ff2200" emissiveIntensity={0}
          metalness={0.1} roughness={0.2} toneMapped={false}
        />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* COCKPIT — steering wheel & seats live in InteriorModel (RHD).        */}
      {/* The duplicate LHD set that used to render here was removed: two      */}
      {/* steering wheels on opposite sides were visible through the glass.    */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* INTERIOR AMBIENT LIGHT STRIPS — emissive driven by ambientColor/Brightness */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Dash underglow strip */}
      <mesh name="ambient_dash" position={[0, 1.08, 0.62]}>
        <boxGeometry args={[1.30, 0.012, 0.02]} />
        <meshStandardMaterial color={ambientColor} emissive={ambientColor}
          emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
      </mesh>
      {/* Front footwell: driver left, passenger right */}
      <mesh name="ambient_footwell_fl" position={[0.35, 0.70, 0.35]}>
        <boxGeometry args={[0.30, 0.012, 0.20]} />
        <meshStandardMaterial color={ambientColor} emissive={ambientColor}
          emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
      </mesh>
      <mesh name="ambient_footwell_fr" position={[-0.35, 0.70, 0.35]}>
        <boxGeometry args={[0.30, 0.012, 0.20]} />
        <meshStandardMaterial color={ambientColor} emissive={ambientColor}
          emissiveIntensity={(ambientBrightness / 100) * 1.4} toneMapped={false} />
      </mesh>
      {/* Door ambient strips moved into the door groups below — they must swing with the doors */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PARKING SENSORS — 4 front, 4 rear                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {[-0.55, -0.18, 0.18, 0.55].map((x, i) => (
        <mesh key={`ps-front-${i}`} position={[x, 0.82, 1.945]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.04, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {[-0.50, -0.16, 0.16, 0.50].map((x, i) => (
        <mesh key={`ps-rear-${i}`} position={[x, 0.82, -1.945]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.04, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* EXHAUST PIPE — rear underside, slightly left of centre               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh position={[0.25, 0.66, -1.96]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.12, 16]} />
        <meshStandardMaterial color="#444" metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0.25, 0.66, -1.92]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.045, 0.006, 8, 24]} />
        <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* LICENSE PLATES — front and rear                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Plates sit ON the bumper faces (±2.005), not buried inside them */}
      <mesh position={[0, 0.80, 2.012]} castShadow>
        <boxGeometry args={[0.38, 0.13, 0.01]} />
        <meshStandardMaterial color="#f5f5f0" metalness={0.05} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.80, -2.012]} castShadow>
        <boxGeometry args={[0.38, 0.13, 0.01]} />
        <meshStandardMaterial color="#f5f5f0" metalness={0.05} roughness={0.7} />
      </mesh>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DOOR HANDLES — slim recessed chrome strip on each door               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Door handles moved into the door groups — they must swing with the doors */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FRONT TURN SIGNALS — amber strip inside headlight cluster             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <mesh name="turnsignal_fl" position={[0.69, 0.91, 1.955]} castShadow>
        <boxGeometry args={[0.30, 0.04, 0.09]} />
        <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
          metalness={0.1} roughness={0.2} toneMapped={false} />
      </mesh>
      <mesh name="turnsignal_fr" position={[-0.69, 0.91, 1.955]} castShadow>
        <boxGeometry args={[0.30, 0.04, 0.09]} />
        <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
          metalness={0.1} roughness={0.2} toneMapped={false} />
      </mesh>
      {/* Rear turn signals — amber strip directly below taillight cluster */}
      <mesh name="turnsignal_rl" position={[0.66, 0.89, -1.955]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.08]} />
        <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
          metalness={0.1} roughness={0.2} toneMapped={false} />
      </mesh>
      <mesh name="turnsignal_rr" position={[-0.66, 0.89, -1.955]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.08]} />
        <meshPhysicalMaterial color="#ff8c00" emissive="#ff6000" emissiveIntensity={0}
          metalness={0.1} roughness={0.2} toneMapped={false} />
      </mesh>

    </group>
  );
}
