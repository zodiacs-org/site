/**
 * The good day finder in Chromium, against the built site (npm run build first):
 * - zero layout shift on first load, on a shared link (#g=…&f=…&t=…) that opens on its results, and when the
 *   person submits the form, at 360px and 1280px;
 * - privacy: with a birth date entered, no request carries it, nothing is written to storage, and the address bar
 *   keeps no detail; the share link carries the goal and dates only;
 * - no horizontal scroll at 360px;
 * - the page is listed on the tools hub, and linked from the occasions and void-of-course pages.
 * With --screenshots it writes the PR evidence to docs/platform/zodiacs-ai/evidence/good-days/.
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { projectRoot, withPreview } from './visual/preview-server.mjs';

const SCREENSHOTS = process.argv.includes('--screenshots');
const evidence = resolve(projectRoot, 'docs/platform/zodiacs-ai/evidence/good-days');
const BIRTH = '1990-05-03';
if (SCREENSHOTS) await mkdir(evidence, { recursive: true });
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failures.push(name);
};

const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 2 },
];

async function page(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: SCREENSHOTS ? viewport.deviceScaleFactor : 1, isMobile: !!viewport.isMobile, hasTouch: !!viewport.hasTouch, timezoneId: 'Europe/London', locale: 'en-GB' });
  await context.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        window.__shifts.push({ value: entry.value, sources: entry.sources?.map((source) => source.node?.outerHTML?.slice(0, 160)) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const tab = await context.newPage();
  const requests = [];
  tab.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`));
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  return { context, tab, requests, errors };
}
const settle = (tab) => tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 300)))));
const cls = (tab) => tab.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));

await withPreview({ port: 4371 }, async (base) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    for (const viewport of VIEWPORTS) {
      // First load, then a search with a birth date.
      {
        const { context, tab, requests, errors } = await page(browser, viewport);
        await tab.goto(`${base}/good-days/`, { waitUntil: 'networkidle' });
        await settle(tab);
        const load = await cls(tab);
        check(`${viewport.name}: first load has zero CLS`, load.cls === 0, JSON.stringify(load));
        if (SCREENSHOTS) await tab.screenshot({ path: `${evidence}/${viewport.name}-form.png` });
        await tab.selectOption('#gd-goal', 'contract');
        await tab.fill('#gd-from', '2027-01-01');
        await tab.fill('#gd-to', '2027-06-30');
        await tab.check('.good-days__check input');
        await tab.fill('#gd-birth', BIRTH);
        const urlBefore = tab.url();
        await tab.click('.calc__submit');
        await tab.waitForSelector('.good-days__result', { timeout: 60_000 });
        await settle(tab);
        const after = await cls(tab);
        check(`${viewport.name}: results arrive with zero CLS`, after.cls === 0, JSON.stringify(after));
        check(`${viewport.name}: no request carries the birth date`, !requests.some((line) => line.includes(BIRTH) || line.includes('1990')), requests.filter((line) => line.includes('1990')).join('\n'));
        const stored = await tab.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
        check(`${viewport.name}: nothing written to storage or cookies`, !stored.includes('1990') && !stored.includes('good'), stored);
        check(`${viewport.name}: the address bar is unchanged`, tab.url() === urlBefore, tab.url());
        const link = await tab.textContent('.good-days__link code');
        check(`${viewport.name}: the share link carries only the goal and dates`, /^http:\/\/127\.0\.0\.1:\d+\/good-days\/#g=contract&f=2027-01-01&t=2027-06-30$/u.test(link ?? ''), link ?? '');
        const card = await tab.textContent('.good-days-card');
        check(`${viewport.name}: the share card holds no birth detail`, !/1990|05-03|3 May 1990/u.test(card ?? ''), card ?? '');
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        check(`${viewport.name}: no horizontal scroll`, !overflow);
        check(`${viewport.name}: no page errors`, errors.length === 0, errors.join('\n'));
        if (SCREENSHOTS) {
          await tab.locator('.good-days__result').screenshot({ path: `${evidence}/${viewport.name}-results.png` });
          await tab.locator('.good-days-card').screenshot({ path: `${evidence}/${viewport.name}-share-card.png` });
        }
        await context.close();
      }
      // A shared link opens on its results with no shift.
      {
        const { context, tab, errors } = await page(browser, viewport);
        await tab.goto(`${base}/good-days/#g=wedding&f=2027-04-01&t=2027-09-30`, { waitUntil: 'networkidle' });
        await tab.waitForSelector('.good-days__result', { timeout: 60_000 });
        await settle(tab);
        const shared = await cls(tab);
        check(`${viewport.name}: a shared link opens on its results with zero CLS`, shared.cls === 0, JSON.stringify(shared));
        check(`${viewport.name}: the shared link reads the general sky`, (await tab.textContent('.good-days__title'))?.startsWith('Wedding: the best days') === true);
        check(`${viewport.name}: shared link has no page errors`, errors.length === 0, errors.join('\n'));
        await context.close();
      }
    }
    // Where it is linked from.
    const { context, tab } = await page(browser, VIEWPORTS[1]);
    for (const path of ['/tools/', '/occasions/', '/void-of-course-moon/']) {
      await tab.goto(`${base}${path}`);
      check(`${path} links to /good-days/`, (await tab.locator('a[href="/good-days/"]').count()) > 0);
    }
    if (SCREENSHOTS) {
      await tab.goto(`${base}/tools/`);
      await tab.locator('a[href="/good-days/"]').first().scrollIntoViewIfNeeded();
      await tab.locator('a[href="/good-days/"]').first().screenshot({ path: `${evidence}/desktop-tools-hub-card.png` });
    }
    await context.close();
  } finally {
    await browser.close();
  }
});

console.log(failures.length ? `good-days drive: ${failures.length} failure(s)` : 'good-days drive: PASS');
process.exit(failures.length ? 1 : 0);
