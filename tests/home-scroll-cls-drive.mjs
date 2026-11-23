// Run against the production build, including its postbuild CSS delivery.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

function observeAndScroll() {
  if (window !== window.top) return;
  const shifts = [];
  const record = (entries) => {
    for (const entry of entries) {
      if (entry.hadRecentInput) continue;
      shifts.push({
        time: entry.startTime,
        value: entry.value,
        sources: entry.sources.map(({ node }) => node?.id || node?.className || node?.nodeName),
      });
    }
  };
  const observer = new PerformanceObserver((list) => record(list.getEntries()));
  observer.observe({ type: 'layout-shift', buffered: true });

  window.addEventListener('load', async () => {
    const grid = document.querySelector('.home-today__grid');
    const initialHeight = grid.getBoundingClientRect().height;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let sawGrid = false;
    do {
      window.scrollBy({ top: 0.8 * innerHeight, behavior: 'instant' });
      const box = grid.getBoundingClientRect();
      sawGrid ||= box.top < innerHeight && box.bottom > 0;
      await wait(150);
    } while (Math.ceil(scrollY + innerHeight) < document.documentElement.scrollHeight);
    await wait(2500);
    record(observer.takeRecords());
    observer.disconnect();
    window.homeScrollResult = {
      shifts, sawGrid, initialHeight, finalHeight: grid.getBoundingClientRect().height,
    };
  }, { once: true });
}

// CLS is the largest session total, with a one second gap or five second
// duration starting a new session.
function cumulativeLayoutShift(shifts) {
  let first = 0;
  let last = 0;
  let session = 0;
  let maximum = 0;
  for (const { time, value } of shifts) {
    if (!session || time - last >= 1000 || time - first >= 5000) {
      first = time;
      session = 0;
    }
    last = time;
    session += value;
    maximum = Math.max(maximum, session);
  }
  return maximum;
}

await withPreview({ port: 0 }, async (baseURL) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  const failures = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      for (let run = 1; run <= 5; run++) {
        const page = await browser.newPage({ viewport });
        await page.addInitScript(observeAndScroll);
        const response = await page.goto(baseURL, { waitUntil: 'load' });
        assert.equal(response.status(), 200);
        assert.ok(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift')));
        await page.waitForFunction(() => window.homeScrollResult);
        const { shifts, sawGrid, initialHeight, finalHeight } = await page.evaluate(() => window.homeScrollResult);
        const cls = cumulativeLayoutShift(shifts);
        const label = `${viewport.width}x${viewport.height} run ${run}`;
        console.log(`${label}: CLS ${cls}, grid ${initialHeight} -> ${finalHeight} px`);
        if (!sawGrid || initialHeight !== finalHeight || cls !== 0) {
          failures.push({ label, sawGrid, initialHeight, finalHeight, cls, shifts });
        }
        await page.close();
      }
    }
    assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  } finally {
    await browser.close();
  }
});
