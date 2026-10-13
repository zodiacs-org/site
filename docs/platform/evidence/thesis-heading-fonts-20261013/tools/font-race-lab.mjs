// F-93 lab: load /thesis/ in Lighthouse's mobile viewport with chosen web
// fonts held back, and record the first heading row and every layout shift.
//
// Run from the repository root against a running preview of a build:
//   BASE=http://127.0.0.1:4400 node docs/platform/evidence/thesis-heading-fonts-20261013/tools/font-race-lab.mjs
// Environment:
//   HTML      serve this file as /thesis/ instead of the preview's page
//             (to compare another build's page against the same assets)
//   HOLD      faces to hold back: medium, italic, regular (default medium,italic)
//   HOLD_MS   how long to hold them (default 400)
//   FALLBACK  native (default): the page as served. times: Georgia and Cambria
//             removed from the page's serif stacks, so the fallback is Times New
//             Roman, which has Liberation Serif's metrics, as on CI's runner
//   MOTION    no-preference (default) or reduce. With reduce, the essay is
//             visible from the first paint, as when that paint comes before
//             the reveal script
//   CPU       CPU slowdown factor (default 1)
//   LOADS     fresh loads (default 3)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { findChromium } from '../../../../../tests/visual/browser.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4400';
const html = process.env.HTML ? readFileSync(process.env.HTML, 'utf8') : null;
const files = {
  medium: 'eb-garamond-latin-500-normal.woff2',
  italic: 'eb-garamond-latin-400-italic.woff2',
  regular: 'eb-garamond-latin-400-normal.woff2',
};
const held = (process.env.HOLD ?? 'medium,italic').split(',').map((name) => files[name.trim()]);
if (held.some((file) => !file)) throw new Error('HOLD names medium, italic or regular');
const holdMs = Number(process.env.HOLD_MS ?? 400);
const fallback = process.env.FALLBACK ?? 'native';
const motion = process.env.MOTION ?? 'no-preference';
const cpu = Number(process.env.CPU ?? 1);
const loads = Number(process.env.LOADS ?? 3);

function withFallback(page) {
  if (fallback === 'native') return page;
  if (fallback !== 'times') throw new Error('FALLBACK is native or times');
  const out = page
    .replace(/(--serif:\s*"EB Garamond",\s*(?:"EB Garamond Metrics",\s*)?)Georgia,\s*Cambria,\s*/, '$1')
    .replace(/(--display:\s*"EB Garamond",\s*(?:"EB Garamond Metrics",\s*)?)Georgia,\s*/, '$1"Times New Roman", ')
    .replaceAll('local("Georgia"),', '')
    .replaceAll('local("Georgia Italic"),', '');
  if (out === page) throw new Error('serif stacks not found');
  return out;
}

const observe = () => {
  const box = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100);
  };
  const row = () => ({
    numeral: box('#everyone-has-a-sign .mov__no'),
    accent: box('#everyone-has-a-sign .mov__title .it'),
    label: box('.essay__rail .label'),
  });
  window.__f93 = { row, shifts: [], paints: [], held: null };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__f93.shifts.push({
        value: entry.value,
        at: Math.round(entry.startTime),
        sources: (entry.sources ?? []).map((source) => {
          const node = source.node?.nodeType === 3 ? source.node.parentElement : source.node;
          const rect = (r) => [r.x, r.y, r.width, r.height].map((value) => Math.round(value * 100) / 100);
          return {
            node: node ? `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}` : null,
            from: rect(source.previousRect),
            to: rect(source.currentRect),
          };
        }),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__f93.paints.push([entry.name, Math.round(entry.startTime)]);
  }).observe({ type: 'paint', buffered: true });
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
    window.__f93.held = {
      ...row(),
      loaded: [document.fonts.check('500 9.5px "EB Garamond"'), document.fonts.check('italic 400 25px "EB Garamond"')],
    };
  }));
};

const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: ['--headless=new', '--disable-gpu'] });
let shifted = 0;
try {
  for (let load = 1; load <= loads; load += 1) {
    // Lighthouse's default mobile emulation: 412 × 823 at DPR 1.75.
    const context = await browser.newContext({
      viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, reducedMotion: motion,
    });
    const page = await context.newPage();
    if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.addInitScript(observe);
    await page.route('**/thesis/', async (route) => {
      const response = await route.fetch();
      const body = withFallback(html ?? await response.text());
      await route.fulfill({ response, body, headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(body)) } });
    });
    await page.route((url) => held.some((file) => url.pathname === `/fonts/${file}`), async (route) => {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      await route.continue();
    });
    await page.goto(`${base}/thesis/`, { waitUntil: 'load' });
    await page.waitForTimeout(holdMs + 1000);
    const result = await page.evaluate(() => ({
      shifts: window.__f93.shifts, paints: window.__f93.paints, held: window.__f93.held, loaded: window.__f93.row(),
    }));
    if (result.shifts.length > 0) shifted += 1;
    console.log(JSON.stringify({ load, firstPaint: result.paints[0]?.[1] ?? null, held: result.held, loaded: result.loaded, shifts: result.shifts }));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`held ${held.join(' + ')} for ${holdMs} ms; fallback ${fallback}; motion ${motion}; CPU ×${cpu}: layout shifts in ${shifted} of ${loads} loads`);
