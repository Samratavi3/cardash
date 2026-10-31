import { useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping, Vignette, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { N8AOPostPass } from 'n8ao'

// Standalone n8ao (1.10) — the copy vendored inside @react-three/postprocessing
// 2.19 issues an invalid depth blit every frame on ANGLE/D3D11.
function AmbientOcclusion({ radius = 0.55, intensity = 2.4, falloff = 0.7 }) {
  const { scene, camera, size } = useThree()
  const pass = useMemo(() => new N8AOPostPass(scene, camera, size.width, size.height), [scene, camera]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    Object.assign(pass.configuration, {
      aoRadius: radius,
      distanceFalloff: falloff,
      intensity,
      aoSamples: 12,
      denoiseSamples: 4,
      denoiseRadius: 8,
      halfRes: true,
      depthAwareUpsampling: true,
      gammaCorrection: false, // we tone-map + encode at the end of the chain
    })
  }, [pass, radius, intensity, falloff])
  useLayoutEffect(() => () => pass.dispose?.(), [pass])
  return <primitive object={pass} />
}

/**
 * Post stack, in HDR (half-float) until the final tone-map:
 *  N8AO   — contact occlusion in panel gaps, wheel wells, cabin
 *  Bloom  — only emitters above 1.0 (lamps, LEDs, ambient strips) glow
 *  ToneMapping NEUTRAL — Khronos PBR Neutral keeps paint swatches true-to-colour
 * The composer forces renderer.toneMapping = NoToneMapping, so the tone-map
 * MUST live here — setting it on the <Canvas> has no effect.
 */
export default function Effects({ quality = 'high' }) {
  const high = quality === 'high'
  return (
    <EffectComposer multisampling={high ? 4 : 0}>
      {high && <AmbientOcclusion />}
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.85} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {!high && <SMAA />}
      <Vignette offset={0.24} darkness={0.58} />
    </EffectComposer>
  )
}
