import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Environment,
  Grid,
  ContactShadows,
  useProgress,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useCarState } from "../hooks/useCarState";
import { cameraRig } from "../hooks/useCameraRig";
import { useIntroSequence } from "./IntroSequence";
import VehicleModel from "./VehicleModel";
import InteriorModel from "./InteriorModel";

// ── Loader ────────────────────────────────────────────────────────────────────
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <svg
            viewBox="0 0 50 50"
            style={{
              width: "100%",
              height: "100%",
              transform: "rotate(-90deg)",
            }}
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="3"
            />
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="3"
              strokeDasharray={`${(progress / 100) * 125.6} 125.6`}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 5px #00d4ff)" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "white",
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Loading
        </span>
      </div>
    </Html>
  );
}

// ── Ground  (dark metallic plane + soft contact shadow + subtle grid) ─────────
function Ground({ groundColor, gridColor, isDayMode }) {
  return (
    <group>
      {/* Dark reflective floor — raised to y=0.17 so tires (radius 0.31, centre 0.48) sit flush */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.17, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color={new THREE.Color(groundColor || "#050508")}
          metalness={0.75}
          roughness={0.28}
          envMapIntensity={0.6}
        />
      </mesh>

      {/* Baked-style contact shadow directly under the car */}
      <ContactShadows
        position={[0, 0.172, 0]}
        opacity={isDayMode ? 0.72 : 0.55}
        scale={14}
        blur={3.8}
        far={3.2}
        resolution={512}
        color="#000016"
      />

      {/* Sci-fi grid overlay */}
      <Grid
        position={[0, 0.174, 0]}
        infiniteGrid
        cellSize={0.75}
        cellThickness={0.3}
        sectionSize={3.75}
        sectionThickness={0.8}
        sectionColor={new THREE.Color(gridColor || "#0a1530")}
        cellColor={new THREE.Color(gridColor || "#0a1530").multiplyScalar(0.4)}
        fadeDistance={26}
        fadeStrength={2.0}
      />
    </group>
  );
}

// ── Lights  (minimal — the HDRI carries the load, just 1 sun for shadows) ────
function Lights({ isDayMode, rimColor }) {
  return (
    <>
      {/*
        Almost-zero ambient.  Environment (sunset HDRI) provides all indirect
        lighting and reflections.  We only add a directional to cast the
        hard ground shadow and a gentle rim to separate the car from bg.
      */}
      <ambientLight intensity={isDayMode ? 0.04 : 0.02} />

      {/* Primary sun — exists only to cast the shadow map */}
      <directionalLight
        color="#fff8f0"
        intensity={isDayMode ? 0.65 : 0.12}
        position={[6, 9, -5]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={22}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />

      {/* Night mode: replace sunset warmth with neon accent */}
      {!isDayMode && (
        <>
          <spotLight
            color={rimColor || "#00d4ff"}
            intensity={2.8}
            position={[-3, 6, -8]}
            angle={0.45}
            penumbra={0.9}
            decay={1.6}
            distance={20}
          />
          <pointLight
            color={rimColor || "#00d4ff"}
            intensity={0.5}
            position={[0, 0.4, 0]}
            distance={4}
            decay={2}
          />
        </>
      )}
    </>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function SceneContent() {
  const controlsRef = useRef();
  const { camera } = useThree();
  const isDayMode       = useCarState(s => s.isDayMode);
  const selectedColor   = useCarState(s => s.selectedColor);
  const isAutoRotate    = useCarState(s => s.isAutoRotate);
  const activeHotspot   = useCarState(s => s.activeHotspot);
  const activeView      = useCarState(s => s.activeView);
  const isIntroComplete = useCarState(s => s.isIntroComplete);
  const panoramaMode    = useCarState(s => s.panoramaMode);

  useEffect(() => {
    cameraRig.controls = controlsRef.current;
    cameraRig.camera = camera;
  }, [camera]);

  useIntroSequence();

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.autoRotate =
      isAutoRotate && !activeHotspot && isIntroComplete;
    controlsRef.current.autoRotateSpeed = 0.2;
  }, [isAutoRotate, activeHotspot, isIntroComplete]);

  const sc = selectedColor.scene;

  return (
    <>
      {/* Background & fog */}
      <color attach="background" args={[sc.background]} />
      <fog attach="fog" args={[sc.fogColor || sc.background, 22, 55]} />

      {/*
        In panorama mode the camera sits at the cabin centre with the
        target 1 cm ahead. Locking min/maxDistance to that tiny radius
        converts the orbital camera into a first-person rotator.
        maxPolarAngle opens to full π so you can look at floor + ceiling.
      */}
      <CameraControls
        ref={controlsRef}
        minDistance={panoramaMode ? 0.005 : 1.8}
        maxDistance={panoramaMode ? 0.02  : 14}
        minPolarAngle={0.05}
        maxPolarAngle={panoramaMode ? Math.PI - 0.05 : Math.PI / 2.1}
        smoothTime={0.05}
        draggingSmoothTime={0.1}
        truckSpeed={0}
      />

      <Lights isDayMode={isDayMode} rimColor={sc.rimLightColor} />

      {/*
        THREE.js Ferrari example uses venice_sunset_1k.hdr  ←→  drei "sunset" preset.
        background=false keeps our per-colour dark bg.
        The HDRI alone delivers all the premium automotive reflections.
      */}
      <Environment
        preset={isDayMode ? "sunset" : "city"}
        background={false}
        environmentIntensity={isDayMode ? selectedColor.envIntensity : selectedColor.envIntensity * 0.5}
      />

      <Ground
        groundColor={sc.groundColor}
        gridColor={sc.gridColor}
        isDayMode={isDayMode}
      />

      {/* Both models always rendered — activeView only moves the camera.
          Glass materials are DoubleSide so interior/exterior see each other. */}
      <VehicleModel />
      <InteriorModel />

      {/*
        Bloom — luminanceThreshold 0.96 means ONLY toneMapped:false emissives
        (headlights, DRLs, taillights) glow.  The clearcoat body reflections
        stay crisp and white, not bloomed.
      */}
      <EffectComposer>
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.96}
          luminanceSmoothing={0.45}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────
export default function CarCanvas() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      camera={{
        // Three.js example: position (4.25, 1.4, −4.5), fov 40
        // We mirror Z so front of car faces camera (front-quarter view)
        position: [4.25, 1.55, -4.8],
        fov: 40,
        near: 0.05,
        far: 200,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.85,
        outputColorSpace: THREE.SRGBColorSpace,
        preserveDrawingBuffer: true, // required for canvas.toDataURL() screenshots
      }}
      dpr={[1, 1.5]}
      className="w-full h-full"
    >
      <Suspense fallback={<Loader />}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
