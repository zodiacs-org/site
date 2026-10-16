// Drives the personal calendar on /sky-calendar/ in a built preview: birth
// details in, dates found in the worker, a .ics file downloaded, and no
// request carrying the birth date. Run after `npm run build`.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { withSecurePreview } from './visual/secure-preview.mjs';

const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/personal-calendar');
await mkdir(out, { recursive: true });
const observations = [];
const record = (name, data = {}) => { observations.push({ name, ...data }); console.log(`PASS: ${name}`); };
const canary = '1998-03-20';
const sitePolicy = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).headers
  .find((rule) => rule.source === '/(.*)').headers.find((header) => header.key === 'Content-Security-Policy').value;
const drivers = [
  { name: 'chromium', type: chromium, options: { executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS } },
  ...(process.env.PERSONAL_CALENDAR_BROWSERS === 'chromium' ? [] : [{ name: 'webkit', type: webkit, options: {} }]),
];
const cases = [
  { locale: '', width: 360, known: true },
  { locale: '', width: 1280, known: true },
  { locale: '', width: 390, known: false },
  { locale: 'es/', width: 360, known: true },
  { locale: 'ru/', width: 360, known: false },
];

async function applyProductionPolicy(context) {
  await context.addInitScript(() => { window.__cspViolations = []; document.addEventListener('securitypolicyviolation', (event) => window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`)); });
  await context.route('**/*', async (route) => {
    if (!route.request().isNavigationRequest() || route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': sitePolicy } });
  });
}
const overflow = async (page) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);

await withPreview({ port: 8793 }, async (plainBase) => {
  await withSecurePreview(plainBase, async (base, localTls) => {
    for (const driver of drivers) {
      const browser = await driver.type.launch({ ...driver.options, headless: true });
      try {
        for (const { locale, width, known } of driver.name === 'chromium' ? cases : cases.slice(0, 1)) {
          const label = `${driver.name} ${locale || 'en/'} ${width} ${known ? 'known' : 'unknown'}`;
          const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce', ignoreHTTPSErrors: localTls, timezoneId: 'Europe/London' });
          await applyProductionPolicy(context);
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() ?? '' }));
          await page.goto(`${base}/${locale}sky-calendar/`);
          const panel = page.locator('[data-personal-calendar]');
          await panel.scrollIntoViewIfNeeded();
          await panel.locator('astro-island:not([ssr])').waitFor();
          await page.locator('#share-person-4-date').fill(canary);
          if (known) await page.locator('#share-person-4-time').fill('06:00');
          else await page.locator('#share-person-4-time').locator('..').getByRole('checkbox').check();
          await page.locator('#share-person-4-place').fill('London');
          await page.getByRole('option').filter({ hasText: /London/ }).first().click();
          await page.locator('[data-personal-calendar-submit]').click();
          await page.locator('[data-personal-calendar-download]').waitFor({ timeout: 60000 });
          const items = await page.locator('[data-personal-calendar-result] li').count();
          assert(items >= 2, `${label}: at least the two solar returns`);
          const download = page.waitForEvent('download');
          await page.locator('[data-personal-calendar-download]').click();
          const file = await download;
          assert.equal(file.suggestedFilename(), 'zodiacs-my-sky.ics');
          const path = resolve(out, `${driver.name}-${(locale || 'en/').replace('/', '')}-${width}-${known ? 'known' : 'unknown'}.ics`);
          await file.saveAs(path);
          const calendar = await readFile(path, 'utf8');
          assert(calendar.startsWith('BEGIN:VCALENDAR\r\n') && calendar.endsWith('END:VCALENDAR\r\n'));
          assert.equal(calendar.match(/BEGIN:VEVENT/g)?.length, items);
          assert(calendar.includes('BEGIN:VALARM'));
          if (!known) assert(!/Moon|Luna|Лун/.test(calendar), `${label}: no Moon events without a birth time`);
          await overflow(page);
          await page.evaluate(() => document.fonts.ready);
          await page.locator('[data-personal-calendar]').screenshot({ path: resolve(out, `${driver.name}-${(locale || 'en/').replace('/', '')}-${width}-${known ? 'known' : 'unknown'}.png`) });
          assert.equal(errors.length, 0, errors.join('\n'));
          assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
          for (const request of requests) {
            assert(!decodeURIComponent(request.url).includes(canary) && !request.body.includes(canary), `birth date sent: ${request.url}`);
            assert(!/\/api\//.test(new URL(request.url).pathname), `api request: ${request.url}`);
          }
          record(`${label}: ${items} events downloaded, no birth-data request, no overflow`, { items, bytes: calendar.length });
          await context.close();
        }
      } finally { await browser.close(); }
    }
  });
});
await writeFile(resolve(out, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
