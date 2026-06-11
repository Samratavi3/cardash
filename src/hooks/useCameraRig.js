import { CAMERA_POSITIONS } from '../constants/cameraPositions'

// Singleton populated by CarCanvas; any module can call flyTo / resetCamera
export const cameraRig = {
  controls: null,
  camera: null,
  _fovRafId: null, // tracks active FOV tween so repeated calls cancel the previous one
}

export function flyTo(key, onComplete) {
  if (!cameraRig.controls) return
  const pos = CAMERA_POSITIONS[key] || CAMERA_POSITIONS.default

  cameraRig.controls.setLookAt(
    pos.position[0], pos.position[1], pos.position[2],
    pos.target[0],   pos.target[1],   pos.target[2],
    true
  )

  if (cameraRig.camera && pos.fov) {
    // Cancel any in-flight FOV tween before starting a new one
    if (cameraRig._fovRafId !== null) {
      cancelAnimationFrame(cameraRig._fovRafId)
      cameraRig._fovRafId = null
    }

    const startFov   = cameraRig.camera.fov
    const endFov     = pos.fov
    const startTime  = performance.now()
    const DURATION   = 650  // ms — consistent across all frame rates

    const step = (now) => {
      const elapsed = now - startTime
      const t       = Math.min(elapsed / DURATION, 1)
      const ease    = 1 - Math.pow(1 - t, 3)  // cubic ease-out
      cameraRig.camera.fov = startFov + (endFov - startFov) * ease
      cameraRig.camera.updateProjectionMatrix()
      if (t < 1) {
        cameraRig._fovRafId = requestAnimationFrame(step)
      } else {
        cameraRig._fovRafId = null
        if (onComplete) onComplete()
      }
    }
    cameraRig._fovRafId = requestAnimationFrame(step)
  } else {
    setTimeout(() => { if (onComplete) onComplete() }, 600)
  }
}

export function resetCamera() {
  flyTo('default')
}
