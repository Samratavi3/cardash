// Dev helper: renders the car from a set of angles to ss_view_*.png.
// Usage:  npm run dev   (in another terminal)
//         node screenshot_car.mjs [url]        default http://localhost:5173
// Relies on the dev-only window.__cardash handles exposed in src/main.jsx.
import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.setViewportSize({ width: 1600, height: 900 })
await page.goto(url)
await page.waitForTimeout(1500)
try {
  await page.click('text=Launch Dashboard', { timeout: 4000 })
} catch {
  console.log('no launch button (size already chosen?)')
}
await page.waitForTimeout(6000)

// Stop the turntable spin so each shot is framed exactly
await page.evaluate(() => window.__cardash?.useCarState.getState().setAutoRotate(false))
await page.screenshot({ path: 'ss_view_default.png' })
console.log('default done')

async function shot(label, pos, target) {
  await page.evaluate(([p, t]) => window.__cardash.cameraRig.controls.setLookAt(...p, ...t, false), [pos, target])
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `ss_view_${label}.png` })
  console.log(label + ' done')
}

// Real-scale metres: +Z = nose, +X = car's left, ground at y = 0
await shot('front', [0.3, 1.2, 7.4], [0, 0.7, 0])
await shot('side_left', [7.6, 1.15, 0], [0, 0.72, 0])
await shot('side_right', [-7.6, 1.15, 0], [0, 0.72, 0])
await shot('rear', [0, 1.4, -7.4], [0, 0.8, 0])
await shot('top', [0, 9, 0.1], [0, 0.6, 0])
await shot('front_quarter', [4.8, 1.5, 5.4], [0, 0.7, 0.1])
await shot('rear_quarter', [-4.8, 2.0, -5.6], [0, 0.7, 0])

await browser.close()
console.log('all done')
