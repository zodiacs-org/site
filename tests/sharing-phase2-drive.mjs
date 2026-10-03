import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { PNG } from 'pngjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/sharing-phase2');
await mkdir(out, { recursive: true });
const observations = [];
const record = (name, data = {}) => { observations.push({ name, ...data }); console.log(`PASS: ${name}`); };
const routes = ['big-three', 'compatibility/invite', 'group-charts', 'chart-twins'];
const locales = ['', 'es/', 'pt/', 'fr/', 'it/', 'ru/'];
const canary = '1990-01-01';
async function fillPerson(page, prefix, { date = canary, known = true, name } = {}) {
  await page.locator('astro-island:not([ssr])').first().waitFor();
  await page.locator(`#${prefix}-date`).fill(date);
  if (name) await page.locator(`#${prefix}-name`).fill(name);
  if (known) await page.locator(`#${prefix}-time`).fill('12:00');
  else await page.locator(`#${prefix}-time`).locator('..').getByRole('checkbox').check();
  await page.locator(`#${prefix}-place`).fill('London');
  await page.getByRole('option').filter({ hasText: /London/ }).first().click();
}
async function overflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
async function downloadedCard(page, button, filename) {
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  const download = page.waitForEvent('download');
  await button.click();
  const file = await download;
  await file.saveAs(resolve(out, filename));
  const bytes = await (await import('node:fs/promises')).readFile(resolve(out, filename));
  const png = PNG.sync.read(bytes);
  assert.equal(png.width, 1080); assert.equal(png.height, 1920);
  record(`${filename} is a 1080×1920 browser export`, { bytes: bytes.length });
}
await withPreview({ port: 8791 }, async (base) => {
  for (const locale of locales) for (const route of routes) {
    const response = await fetch(`${base}/${locale}${route}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /rel="canonical"/);
    assert(!/href="\/astrofolio\//.test(html), `${locale}${route}: collection navigation`);
    assert.match(html, /hreflang="ru"/);
  }
  record('all 24 localized tools resolve with reciprocating locale metadata and no collection navigation');
  const engines = [{ name: 'chromium', type: chromium, options: { executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS } }, { name: 'webkit', type: webkit, options: {} }];
  for (const engine of engines) {
    const browser = await engine.type.launch({ ...engine.options, headless: true });
    try {
      for (const width of [360, 390, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
        await context.addInitScript(() => {
          window.__shareCalls = [];
          Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
          Object.defineProperty(navigator, 'share', { configurable: true, value: (data) => { window.__shareCalls.push({ active: navigator.userActivation?.isActive, files: data.files?.length, name: data.files?.[0]?.name }); return Promise.resolve(); } });
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text) => { window.__copied = text; return Promise.resolve(); } } });
        });
        const page = await context.newPage();
        const errors = [], requests = [];
        page.on('pageerror', (error) => { errors.push(error.message); console.log('Browser error at', page.url(), error.message, error.stack); });
        page.on('request', (request) => requests.push({ url: request.url().split('#')[0], body: request.postData() ?? '' }));
        await page.waitForLoadState('networkidle');
        await page.goto(`${base}/big-three/`);
        await fillPerson(page, 'bt');
        await page.locator('[data-big-three-submit]').click();
        const bigShare = page.locator('[data-big-three-share]');
        await page.waitForFunction(() => { const button = document.querySelector('[data-big-three-share]'); return button && !button.disabled; });
        await bigShare.click();
        const calls = await page.evaluate(() => window.__shareCalls);
        assert.equal(calls[0].files, 1); assert.equal(calls[0].active, true);
        await overflow(page);
        if (width === 390 && engine.name === 'chromium') await downloadedCard(page, bigShare, 'big-three.png');
        await page.locator('#bt-date').fill('1990-01-02');
        assert.equal(await page.locator('[data-big-three-result]').count(), 0);
        record(`${engine.name} ${width}: big three native share keeps tap activation; editing removes stale results`);

        await page.waitForLoadState('networkidle');
        await page.goto(`${base}/compatibility/invite/`);
        await fillPerson(page, 'share-person-1');
        await page.locator('[data-private-invite-create]').click();
        await page.locator('[data-private-invite-result]').waitFor();
        await page.locator('[data-private-invite-copy]').click();
        const invite = await page.evaluate(() => window.__copied);
        assert.match(invite, /\/compatibility\/#p=2\./);
        const payload = JSON.parse(Buffer.from(invite.split('#p=2.')[1], 'base64url').toString());
        assert.deepEqual(Object.keys(payload).sort(), ['a','b','h','v']);
        assert(!JSON.stringify(payload).match(/date|time|place|name|email|lat|lon/i));
        await page.waitForLoadState('networkidle');
        await page.goto(invite);
        await page.locator('[data-private-invite-arrival]').waitFor();
        assert.equal(await page.locator('#syn-a-date').count(), 0);
        assert.equal(await page.locator('#syn-b-date').count(), 1);
        assert.equal(new URL(page.url()).hash, '');
        await fillPerson(page, 'syn-b', { date: '1992-02-02' });
        await page.getByRole('button', { name: 'Compare the charts', exact: false }).click();
        await page.locator('.calc__result').waitFor();
        assert.match(await page.locator('[data-check-our-math]').first().innerText(), /original UTC instant was not shared/i);
        await overflow(page);
        await page.screenshot({ path: resolve(out, `invite-${engine.name}-${width}.png`), fullPage: true });
        record(`${engine.name} ${width}: friend opens positions-only invitation and adds their chart without signup`);

        await page.waitForLoadState('networkidle');
        await page.goto(`${base}/group-charts/`);
        for (let n=1; n<=3; n++) await fillPerson(page, `share-person-${n}`, { date: `1990-01-0${n}`, known: n !== 3, name: `Friend ${n}` });
        await page.locator('[data-group-submit]').click();
        await page.locator('[data-group-result]').waitFor();
        assert.equal(await page.locator('.group-reading').count(), 3);
        assert.equal(await page.locator('[data-check-our-math][data-instant-basis="reference"]').count(), 1);
        const unknown = page.locator('.group-reading').last();
        await unknown.locator('summary').click();
        assert(!/Moon:|Rising:/.test(await unknown.locator('.group-basis').innerText()));
        const groupShare = page.locator('[data-group-share]');
        await page.waitForFunction(() => { const button = document.querySelector('[data-group-share]'); return button && !button.disabled; });
        await groupShare.click();
        const groupCalls = await page.evaluate(() => window.__shareCalls);
        assert.equal(groupCalls.at(-1).active, true);
        await overflow(page);
        await page.screenshot({ path: resolve(out, `group-${engine.name}-${width}.png`), fullPage: true });
        if (width === 390 && engine.name === 'chromium') await downloadedCard(page, groupShare, 'group-three.png');
        await page.locator('#share-person-1-name').fill('Changed');
        assert.equal(await page.locator('[data-group-result]').count(), 0);
        record(`${engine.name} ${width}: group results have honest reference receipts and no unknown-time Moon or rising`);

        await page.waitForLoadState('networkidle');
        await page.goto(`${base}/chart-twins/`);
        await fillPerson(page, 'share-person-1');
        await page.locator('[data-twins-submit]').click();
        await page.locator('[data-twins-result]').waitFor();
        assert.match(await page.locator('.sharing-tool > .notice').innerText(), /cannot.*rising|cannot.*three-sign/i);
        await overflow(page);
        await page.screenshot({ path: resolve(out, `twins-${engine.name}-${width}.png`), fullPage: true });
        await page.locator('#share-person-1-time').locator('..').getByRole('checkbox').check();
        await page.locator('[data-twins-submit]').click();
        await page.locator('[data-twins-result]').waitFor();
        assert.equal(await page.locator('[data-twin-match="2"]').count(), 0);
        assert.match(await page.locator('[data-twins-result]').innerText(), /only your Sun/);
        assert.deepEqual(errors, []);
        assert(!requests.some((request) => request.url.includes(canary) || request.body.includes(canary)), 'birth data in outgoing requests');
        assert(!requests.some((request) => /\/api\/compatibility\//.test(request.url)), 'new private invite contacted account invitation service');
        record(`${engine.name} ${width}: twins omit unverified Moon, and no birth inputs or invite API requests leave the browser`);
        await context.close();
      }
      // Unknown-time invites contain no angles and never compare an unverified Moon.
      {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.goto(`${base}/compatibility/invite/`);
        await fillPerson(page, 'share-person-1', { known: false });
        await page.locator('[data-private-invite-create]').click();
        await page.locator('[data-private-invite-result]').waitFor();
        const url = await page.locator('#private-invite-link').inputValue();
        const payload = JSON.parse(Buffer.from(url.split('#p=2.')[1], 'base64url').toString());
        assert.equal(payload.a, undefined);
        await page.goto(url);
        await page.locator('[data-private-invite-arrival]').waitFor();
        await fillPerson(page, 'syn-b', { date: '1992-02-02' });
        await page.getByRole('button', { name: 'Compare the charts', exact: false }).click();
        await page.locator('.calc__result').waitFor();
        const moonGlyph = await page.locator('.tring__wheelbox .wheel__transit[data-transit="transit:Moon"] path').first().getAttribute('d');
        assert(moonGlyph, 'friend’s known-time Moon appears on the outer ring');
        const innerGlyphs = await page.locator('.tring__wheelbox .wheel__body:not(.wheel__transit) path').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
        assert(!innerGlyphs.includes(moonGlyph), 'received unknown-time chart excludes its Moon glyph');
        await page.waitForLoadState('networkidle');
        await page.goto(`${base}/compatibility/#p=bad`);
        await page.getByRole('alert').filter({ hasText: 'This invitation could not be read' }).waitFor();
        assert.equal(new URL(page.url()).hash, '');
        await page.close();
        record(`${engine.name}: unknown-time and invalid invitations never fabricate angles or a verified Moon`);
      }
      if (engine.name === 'chromium') for (const locale of ['', 'es/', 'pt/', 'fr/', 'it/', 'ru/']) {
        const page = await browser.newPage({ viewport: { width: 360, height: 844 }, acceptDownloads: true });
        await page.goto(`${base}/${locale}group-charts/`);
        await page.locator('astro-island:not([ssr])').first().waitFor();
        for (let n=0; n<5; n++) await page.locator('[data-group-add]').click();
        assert.equal(await page.locator('.group-entry').count(), 8);
        assert.equal(await page.locator('[data-group-add]').isDisabled(), true);
        for (let n=1; n<=8; n++) await fillPerson(page, `share-person-${n}`, { date: `1990-01-0${n}`, known: n % 2 === 0, name: `A long friend nickname ${n}` });
        await page.locator('[data-group-submit]').click();
        await page.locator('[data-group-result]').waitFor();
        assert.equal(await page.locator('.group-reading').count(), 8);
        await page.waitForFunction(() => { const button = document.querySelector('[data-group-share]'); return button && !button.disabled; });
        await downloadedCard(page, page.locator('[data-group-share]'), `group-eight-${locale.replace('/', '') || 'en'}.png`);
        await overflow(page);
        for (let n=0; n<5; n++) await page.locator('.group-remove').last().click();
        assert.equal(await page.locator('.group-entry').count(), 3);
        assert.equal(await page.locator('.group-remove').count(), 0);
        assert.equal(await page.locator('[data-group-result]').count(), 0);
        await page.close();
        record(`eight-person ${locale || 'English'} group exports fit and preserve the three-person minimum`);
      }
      // Exercise translated hydration, including long Russian labels.
      for (const locale of ['es','pt','fr','it','ru']) {
        const page = await browser.newPage({ viewport: { width: 360, height: 844 } });
        const errors = []; page.on('pageerror', (error) => { errors.push(error.message); console.log('Browser error at', page.url(), error.message, error.stack); });
        for (const route of routes) { await page.waitForLoadState('networkidle'); await page.goto(`${base}/${locale}/${route}/`); await page.locator('astro-island:not([ssr])').first().waitFor(); await overflow(page); }
        await page.waitForLoadState('networkidle');
        assert.deepEqual(errors, []); await page.close();
        record(`${engine.name}: ${locale} tools hydrate and fit 360px`);
      }
    } finally { await browser.close(); }
  }
});
await writeFile(resolve(out, 'observations.json'), JSON.stringify(observations, null, 2));
console.log(`All ${observations.length} sharing browser groups passed.`);
