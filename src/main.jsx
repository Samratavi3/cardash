import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { cameraRig } from './hooks/useCameraRig'
import { useCarState } from './hooks/useCarState'
import { CAMERA_POSITIONS } from './constants/cameraPositions'

// Dev-only handles for automated screenshots / debugging in the console
if (import.meta.env.DEV) {
  window.__cardash = { cameraRig, useCarState }
  window.__presets = CAMERA_POSITIONS
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
