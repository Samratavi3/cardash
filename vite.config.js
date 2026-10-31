import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  build: {
    // three.js + the R3F ecosystem are large; split them into long-lived
    // vendor chunks so app updates don't invalidate the 3D runtime cache.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['postprocessing', '@react-three/postprocessing', 'n8ao'],
          ui: ['framer-motion', 'lucide-react'],
        },
      },
    },
  },
})
