import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { PNG } from 'pngjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { withSecurePreview } from './visual/secure-preview.mjs';
const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/return-visits');
await mkdir(out, { recursive: true }); const observations = [];
const record = (name, data = {}) => { observations.push({ name, ...data }); console.log(`PASS: ${name}`); };
const locales = ['', 'es/', 'pt/', 'fr/', 'it/', 'ru/'];
const canary = '1990-01-01';
const sitePolicy = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).headers.find((rule) => rule.source === '/(.*)').headers.find((header) => header.key === 'Content-Security-Policy').value;
const drivers = [{ name: 'chromium', type: chromium, options: { executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS } }, ...(process.env.RETURN_VISITS_BROWSERS === 'chromium' ? [] : [{ name: 'webkit', type: webkit, options: {} }])];
async function applyProductionPolicy(context) {
  await context.addInitScript(() => { window.__cspViolations = []; document.addEventListener('securitypolicyviolation', (event) => window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`)); });
  await context.route('**/*', async (route) => {
    if (!route.request().isNavigationRequest() || route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': sitePolicy } });
  });
}
async function hydrate(page) { await page.locator('astro-island:not([ssr])').first().waitFor(); }
async function fill(page, known = true, locale = '') {
  await hydrate(page);
  await page.locator('#share-person-3-date').fill(canary);
  await page.locator('#share-person-3-name').fill(locale === 'ru/' ? 'Тестовый клиент' : 'Synthetic client');
  if (known) await page.locator('#share-person-3-time').fill('12:00');
  else await page.locator('#share-person-3-time').locator('..').getByRole('checkbox').check();
  await page.locator('#share-person-3-place').fill('London');
  await page.getByRole('option').filter({ hasText: /London/ }).first().click();
}
const overflow = async (page) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
async function screenshot(page, path) {
  const previous = await page.evaluate(() => scrollY);
  await page.locator('.zfooter').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.zfooter__brand')).display === 'inline-flex');
  await page.evaluate(() => document.fonts.ready); await overflow(page);
  await page.evaluate((top) => scrollTo(0, top), previous);
  await page.screenshot({ path, fullPage: true });
}
async function seed(page, known = true) {
  await page.evaluate(({ known }) => {
    const stamp = '2026-10-03T00:00:00.000Z';
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic saved chart', relationship: 'self', createdAt: stamp, updatedAt: stamp,
      birth: { date: '1990-01-01', time: known ? '12:00' : null, timeKnown: known, place: { name: 'London', admin1: 'England', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
      summary: { engineVersion: 'synthetic-old-cache', utcISO: '1990-01-01T12:00:00.000Z', houseSystem: 'whole', bodies: [], angles: null, flags: [] } }] }));
    window.dispatchEvent(new Event('zodiacs:profile'));
  }, { known });
}
await withPreview({ port: 8791 }, async (plainBase) => {
  for (const locale of locales) {
    const response = await fetch(`${plainBase}/${locale}sky-calendar.ics`); assert.equal(response.status, 200); const calendar = await response.text();
    assert.equal(calendar.match(/BEGIN:VEVENT/g)?.length, 195); assert.match(calendar, /DTSTART:\d{8}T\d{6}Z/); assert(!/birth|natal|wallet|astrofolio/i.test(calendar));
    for (const route of ['sky-calendar', 'astrologer-kit', 'your-sky-wrapped', 'chart-of-the-day', 'saturn-return']) {
      const html = await (await fetch(`${plainBase}/${locale}${route}/`)).text(); assert.match(html, /rel="canonical"/);
      const primaryNav = html.match(/<nav\b[^>]*data-nav[^>]*>[\s\S]*?<\/nav>/)?.[0];
      assert(primaryNav && /href="\/astrofolio\/"/.test(primaryNav), `${locale}${route}: consistent collection navigation`);
      const content = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];
      assert(content && !/href="\/astrofolio\//.test(content), `${locale}${route}: no collection promotion in tool content`);
      if (['astrologer-kit','your-sky-wrapped','saturn-return'].includes(route)) assert(!/remoteScript\.src\s*=|insights\.src\s*=/.test(html));
    }
  }
  record('all six languages have public feeds, tool pages and private birth forms');
  await withSecurePreview(plainBase, async (base, localTls) => {
  for (const driver of drivers) {
    const browser = await driver.type.launch({ ...driver.options, headless: true });
    try {
      for (const width of [360,390,1280]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce', ignoreHTTPSErrors: localTls });
        await applyProductionPolicy(context);
        await context.addInitScript(() => {
          window.__shares = []; window.__holdWorkers = false; window.__heldWorkers = 0; window.__terminatedWorkers = 0;
          const NativeWorker = Worker;
          window.Worker = class extends NativeWorker {
            postMessage(...args) { if (window.__holdWorkers) { window.__heldWorkers++; return; } return super.postMessage(...args); }
            terminate() { window.__terminatedWorkers++; return super.terminate(); }
          };
          Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); Object.defineProperty(navigator, 'share', { configurable: true, value: (data) => { window.__shares.push({ active: navigator.userActivation?.isActive, count: data.files?.length }); return Promise.resolve(); } });
        });
        const page = await context.newPage(); const errors = [], requests = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() ?? '' }));
        await page.goto(`${base}/astrologer-kit/`); await fill(page);
        await page.locator('[data-return-submit]').click(); await page.locator('[data-download-client-pdf]').waitFor({ timeout: 30000 });
        assert.equal(await page.locator('[data-check-our-math]').getAttribute('data-instant-basis'), 'birth');
        const download = page.waitForEvent('download'); await page.locator('[data-download-client-pdf]').click(); const file = await download; const pdfPath = resolve(out, `${driver.name}-${width}-client.pdf`); await file.saveAs(pdfPath);
        const pdf = await readFile(pdfPath); assert.equal(pdf.subarray(0,8).toString(), '%PDF-1.4'); assert(pdf.includes(Buffer.from('/URI (https://zodiacs.org/methodology/)'))); assert(!pdf.includes(Buffer.from('http://')));
        assert.equal(new Set(requests.map((request) => request.url.match(/\/assets\/zodiac-icons\/128\/([a-z]+)\.webp/)?.[1]).filter(Boolean)).size, 12, 'PDF fetches all twelve signs, independent of the chart');
        await overflow(page); await screenshot(page, resolve(out, `${driver.name}-${width}-kit.png`));
        record(`${driver.name} ${width}: browser PDF and actual UTC receipt`, { bytes: pdf.length });
        await page.locator('#share-person-3-name').fill('Changed'); assert.equal(await page.locator('[data-return-result]').count(), 0);
        await page.goto(`${base}/your-sky-wrapped/`); await hydrate(page);
        // With nothing saved, Wrapped takes birth details directly instead of dead-ending.
        assert.equal(await page.locator('#wrapped-chart').count(), 0); assert.equal(await page.locator('[data-return-submit]').isDisabled(), false);
        await page.locator('#share-person-3-date').fill(canary); await page.locator('#share-person-3-time').fill('12:00');
        await page.locator('#share-person-3-place').fill('London'); await page.getByRole('option').filter({ hasText: /London/ }).first().click();
        await page.locator('[data-return-submit]').click(); await page.locator('[data-share-wrapped]').waitFor({ timeout: 30000 });
        assert((await page.locator('.return-contact-list li').count()) > 0);
        record(`${driver.name} ${width}: Wrapped works from typed birth details with no saved chart`);
        await seed(page); await page.locator('#wrapped-chart').selectOption('00000000-0000-4000-8000-000000000001');
        await page.locator('[data-return-submit]').click(); await page.locator('[data-share-wrapped]').waitFor({ timeout: 30000 });
        assert((await page.locator('.return-contact-list li').count()) > 0);
        await page.locator('[data-share-wrapped]').click(); const shares = await page.evaluate(() => window.__shares); assert.equal(shares.length,1); assert.equal(shares[0].active,true); assert.equal(shares[0].count,1);
        await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
        const imageDownload = page.waitForEvent('download'); await page.locator('[data-share-wrapped]').click(); const imageFile = await imageDownload; const imagePath = resolve(out, `${driver.name}-${width}-wrapped.png`); await imageFile.saveAs(imagePath);
        const image = PNG.sync.read(await readFile(imagePath)); assert.equal(image.width,1080); assert.equal(image.height,1920); await overflow(page);
        await screenshot(page, resolve(out, `${driver.name}-${width}-wrapped-page.png`));
        record(`${driver.name} ${width}: saved-chart recomputation, worker scan, active share tap and portrait export`);
        await seed(page, false); assert.equal(await page.locator('[data-return-result]').count(),0); await page.locator('#wrapped-chart').selectOption('00000000-0000-4000-8000-000000000001'); await page.locator('[data-return-submit]').click(); await page.locator('[data-share-wrapped]').waitFor({ timeout: 30000 });
        assert.equal(await page.locator('[data-check-our-math]').getAttribute('data-instant-basis'),'reference'); assert(!/Moon|Rising/.test(await page.locator('.return-contact-list').innerText()));
        await page.evaluate(() => { localStorage.removeItem('zodiacs.profile.v1'); window.dispatchEvent(new Event('zodiacs:profile')); }); assert.equal(await page.locator('[data-return-result]').count(),0); assert.equal(await page.locator('#wrapped-chart').count(),0);
        record(`${driver.name} ${width}: unknown time omits Moon and rising; deletion clears prepared exports`);
        if (width === 360) {
          await seed(page); await page.locator('#wrapped-chart').selectOption('00000000-0000-4000-8000-000000000001');
          await page.evaluate(() => { window.__holdWorkers = true; }); await page.locator('[data-return-submit]').click();
          await page.waitForFunction(() => window.__heldWorkers === 1); const before = await page.evaluate(() => window.__terminatedWorkers);
          await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await page.locator('[data-return-result]').count(), 0); assert.equal(await page.locator('[data-return-submit]').isDisabled(), false);
          assert.equal(await page.evaluate(() => window.__terminatedWorkers), before + 1);
          await page.locator('[data-return-submit]').click(); await page.waitForFunction(() => window.__heldWorkers === 2);
          const previousYear = String(new Date().getUTCFullYear() - 1); await page.locator('#wrapped-year').selectOption(previousYear);
          assert.equal(await page.locator('[data-return-result]').count(), 0); assert.equal(await page.evaluate(() => window.__terminatedWorkers), before + 2);
          await page.evaluate(() => { window.__holdWorkers = false; }); await page.locator('[data-return-submit]').click(); await page.locator('[data-share-wrapped]').waitFor({ timeout: 30000 });
          assert((await page.locator('[data-return-result] h2').innerText()).includes(previousYear));
          record(`${driver.name}: cancellation and year changes terminate pending workers and reject stale results`);
        }
        await page.goto(`${base}/saturn-return/`); await hydrate(page); await page.locator('#sr-date').fill('2000-01-01'); await page.locator('.calc__submit').click(); await page.locator('[data-saturn-countdown]').waitFor({ timeout: 30000 }); assert.match(await page.locator('[data-saturn-countdown]').innerText(), /days|today/); assert.equal(await page.locator('[data-check-our-math]').getAttribute('data-instant-basis'), 'reference'); await overflow(page);
        await screenshot(page, resolve(out, `${driver.name}-${width}-saturn.png`));
        record(`${driver.name} ${width}: Saturn countdown with reference-time warning`);
        assert.equal(errors.length,0,errors.join('\n'));
        assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
        for (const request of requests) for (const date of [canary, '2000-01-01']) assert(!decodeURIComponent(request.url).includes(date) && !request.body.includes(date), `birth canary leaked: ${request.url}`);
        record(`${driver.name} ${width}: no browser errors, horizontal overflow, or birth-data request under production CSP`);
        await context.close();
      }
      if (driver.name === 'chromium') for (const locale of locales) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, ignoreHTTPSErrors: localTls }); const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
        await applyProductionPolicy(context);
        await page.goto(`${base}/${locale}astrologer-kit/`); await fill(page,false,locale); await page.locator('[data-return-submit]').click(); await page.locator('[data-download-client-pdf]').waitFor({ timeout: 30000 });
        assert.equal(await page.locator('[data-check-our-math]').getAttribute('data-instant-basis'),'reference'); const download=page.waitForEvent('download'); await page.locator('[data-download-client-pdf]').click(); const file=await download; await file.saveAs(resolve(out, `${locale.replace('/','')||'en'}-unknown-client.pdf`)); await overflow(page);
        await screenshot(page, resolve(out, `${locale.replace('/','')||'en'}-unknown-kit.png`)); assert.equal(errors.length,0,errors.join('\n')); record(`${locale||'en/'}: localized unknown-time PDF export`);
        await context.addInitScript(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
        await page.goto(`${base}/${locale}your-sky-wrapped/`); await hydrate(page); await seed(page,false); await page.locator('#wrapped-chart').selectOption('00000000-0000-4000-8000-000000000001');
        await page.locator('[data-return-submit]').click(); await page.locator('[data-share-wrapped]').waitFor({ timeout: 30000 });
        const imageDownload=page.waitForEvent('download'); await page.locator('[data-share-wrapped]').click(); const imageFile=await imageDownload; await imageFile.saveAs(resolve(out, `${locale.replace('/','')||'en'}-unknown-wrapped.png`)); await overflow(page);
        assert.equal(errors.length,0,errors.join('\n')); assert.deepEqual(await page.evaluate(() => window.__cspViolations), []); record(`${locale||'en/'}: localized unknown-time portrait card`);
        await page.goto(`${base}/${locale}saturn-return/`); await hydrate(page); await page.locator('#sr-date').fill('2000-01-01'); await page.locator('.calc__submit').click(); await page.locator('[data-saturn-countdown]').waitFor({ timeout: 30000 }); await overflow(page);
        await screenshot(page, resolve(out, `${locale.replace('/','')||'en'}-saturn.png`));
        await page.goto(`${base}/${locale}sky-calendar/`); await page.locator('.return-panel').waitFor(); await page.evaluate(() => document.fonts.ready); await overflow(page); assert.equal(await page.locator('.return-actions a[href^="webcal://"]').count(),1);
        await screenshot(page, resolve(out, `${locale.replace('/','')||'en'}-calendar.png`));
        assert.equal(errors.length,0,errors.join('\n')); assert.deepEqual(await page.evaluate(() => window.__cspViolations), []); record(`${locale||'en/'}: calendar subscription and localized Saturn countdown fit on mobile`); await context.close();
      }
    } finally { await browser.close(); }
  }
  });
});
await writeFile(resolve(out,'observations.json'), JSON.stringify(observations,null,2)+'\n');
