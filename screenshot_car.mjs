import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 800 });
await page.goto('http://localhost:5174');
await page.waitForTimeout(2000);

// Click "LAUNCH DASHBOARD"
try {
  await page.click('text=LAUNCH DASHBOARD', { timeout: 4000 });
} catch(e) { console.log('no launch btn'); }

await page.waitForTimeout(2000);

// Force intro complete via Zustand store
await page.evaluate(async () => {
  // Find the zustand store through React fiber
  const root = document.querySelector('#root');
  if (!root) return;
  const key = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
  if (!key) return;
  let fiber = root[key];
  // walk up to find the store
  const walk = (node, depth = 0) => {
    if (depth > 200 || !node) return null;
    if (node.memoizedState) {
      let s = node.memoizedState;
      while (s) {
        if (s.queue && s.memoizedState && typeof s.memoizedState.setIntroComplete === 'function') {
          s.memoizedState.setIntroComplete();
          return true;
        }
        s = s.next;
      }
    }
    return walk(node.child, depth+1) || walk(node.sibling, depth+1);
  };
  walk(fiber);
});

await page.waitForTimeout(3000);
await page.screenshot({ path: 'ss_view_default.png' });
console.log('default done');

// Camera helper
async function setCamera(px,py,pz, tx,ty,tz, label) {
  await page.evaluate(async ([px,py,pz,tx,ty,tz]) => {
    try {
      const mod = await import('/src/hooks/useCameraRig.js');
      const rig = mod.cameraRig;
      if (rig?.controls?.setLookAt) await rig.controls.setLookAt(px,py,pz,tx,ty,tz,true);
    } catch(e) {}
  }, [px,py,pz,tx,ty,tz]);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `ss_view_${label}.png` });
  console.log(label + ' done');
}

await setCamera(0, 1.4, 6.5, 0, 0.9, 0, 'front');
await setCamera(6.5, 1.4, 0, 0, 0.9, 0, 'side_left');
await setCamera(-6.5, 1.4, 0, 0, 0.9, 0, 'side_right');
await setCamera(0, 1.4, -6.5, 0, 0.9, 0, 'rear');
await setCamera(0, 7.0, 0.1, 0, 0.9, 0, 'top');
await setCamera(4.0, 2.5, 4.5, 0, 0.9, 0, 'front_quarter');
await setCamera(-4.0, 2.5, -4.5, 0, 0.9, 0, 'rear_quarter');

await browser.close();
console.log('all done');
