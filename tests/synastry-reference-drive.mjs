import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { withPreview } from './visual/preview-server.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { synastryPublished } from '../scripts/synastry-reference-policy.mjs';

const routes = ['', 'sun-moon/', 'moon-venus/', 'moon-mars/'];
const root = 'tests/visual/artifacts/synastry-reference';
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
const results = [];
try {
  await withPreview({ port: 4347 }, async (baseURL) => {
    const sitemap = await (await fetch(`${baseURL}/sitemap.xml`)).text();
    assert.equal(sitemap.includes('/compatibility/aspects/'), synastryPublished, 'Only published editions enter the public sitemap');
    const search = await (await fetch(`${baseURL}/search-index.json`)).text();
    assert.equal(search.includes('/compatibility/aspects/'), synastryPublished, 'Search also withholds review editions');
    for (const suffix of routes) {
      const path = `/compatibility/aspects/${suffix}`;
      for (const javascriptEnabled of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 320, height: 900 }, javaScriptEnabled: javascriptEnabled, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        if (javascriptEnabled) await page.addInitScript(() => {
          globalThis.__referenceShifts = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__referenceShifts.push(entry.value);
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        const serverHtml = await response.text();
        assert(!/\b(?:crypto|tokens?|wallet|blockchain|investment)\b/i.test(serverHtml), 'Consumer language throughout server HTML');
        assert(!/[\u2013\u2014]/u.test(serverHtml), 'No long dash characters throughout server HTML');
        assert.equal(await page.locator('h1').count(), 1);
        assert.match(await page.locator('h1').innerText(), /synastry/i);
        assert.match(await page.locator('h1').innerText(), /between two charts/i);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://zodiacs.org${path}`);
        const robots = await page.locator('meta[name="robots"]').getAttribute('content');
        assert.equal(/noindex/.test(robots), !synastryPublished);
        assert.equal(await page.locator('link[hreflang]').count(), synastryPublished ? 2 : 0, 'No unpublished or unavailable alternate');
        assert.equal(await page.locator('.zfooter').count(), 1);
        assert.equal(await page.locator('button a, a button').count(), 0);
        assert.equal(await page.locator('.reference svg[role="img"] title').count(), 1);
        assert.equal(await page.locator('.reference svg[role="img"] desc').count(), 1);
        assert.equal(await page.locator('astro-island').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits 320px`);
        const text = await page.locator('.reference').innerText();
        assert(!/[\u2013\u2014]/u.test(text), 'No long dash characters in article copy');
        assert(!/\b(?:crypto|token|wallet|blockchain|investment)\b/i.test(text), 'Consumer content boundary');
        const navigation = await page.locator('.nav-wrap, #mobile-menu').evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join(' '));
        assert(!/\b(?:crypto|tokens?|wallet|blockchain|investment)\b/i.test(navigation), 'Consumer navigation copy and accessible descriptions');
        if (suffix) {
          for (const id of ['conjunction', 'sextile', 'square', 'trine', 'opposition']) assert.equal(await page.locator(`h2#${id}`).count(), 1);
          assert.equal(await page.locator('.reference__examples article').count(), 2);
          assert.equal(await page.locator('.reference__table caption').count(), 1);
          assert.equal(await page.locator('.reference__table th[scope="col"]').count(), 4);
          const faq = page.locator('.faq details').first();
          if (await faq.count()) {
            await faq.locator('summary').focus();
            await page.keyboard.press('Enter');
            assert.equal(await faq.getAttribute('open'), '');
          }
        }
        await page.locator('.reference__task a').first().focus();
        assert(await page.locator('.reference__task a').first().evaluate((node) => node === document.activeElement));
        if (javascriptEnabled) {
          await page.locator('.reference').scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
          const cls = await page.evaluate(() => globalThis.__referenceShifts.reduce((sum, value) => sum + value, 0));
          assert.equal(cls, 0, `${path} raw CLS`);
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits with 200% text`);
          await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          await page.screenshot({ path: `${root}/${suffix.replace('/', '') || 'hub'}-320.png`, fullPage: true });
          results.push({ path, javascriptEnabled, cls, viewport: 320, textZoom: '200%', errors });
        } else results.push({ path, javascriptEnabled, viewport: 320, errors });
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
    for (const path of ['/', '/learn/', '/tools/', '/compatibility/', '/gemini/', '/compatibility/gemini-gemini/']) {
      const html = await (await fetch(`${baseURL}${path}`)).text();
      assert(html.includes('href="/compatibility/aspects/"'), `${path} has server-rendered discovery`);
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      globalThis.__referenceEvents = [];
      const capture = { track: (name, props) => globalThis.__referenceEvents.push({ name, props }) };
      Object.defineProperty(window, 'zodiacsAnalytics', { configurable: true, get: () => capture, set: () => {} });
    });
    await page.goto(`${baseURL}/compatibility/aspects/sun-moon/`, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => globalThis.__referenceEvents.filter((event) => event.name === 'reference_opened').length), 1);
    await page.locator('.reference__task [data-reference-task]').click();
    await page.waitForURL('**/compatibility/');
    const marker = await page.evaluate(() => JSON.parse(sessionStorage.getItem('zodiacs:reference-task')));
    assert.equal(marker.page, 'sun-moon');
    assert.deepEqual(Object.keys(marker).sort(), ['expires', 'page']);
    assert.equal(await page.evaluate(() => globalThis.__referenceEvents.filter((event) => event.name === 'reference_task_completed').length), 0, 'Navigation is not completion');

    const chart = (id, utc) => ({
      id, name: id, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
      birth: { date: utc.slice(0, 10), time: '12:00', timeKnown: true, place: { name: 'Synthetic Greenwich', admin1: '', country: 'GB', lat: 51.48, lon: 0, tz: 'Etc/UTC' } },
      summary: { engineVersion: '0-stale', utcISO: utc, houseSystem: 'whole', bodies: [], angles: { asc: 0, mc: 0 }, flags: [] },
    });
    const fixture = JSON.parse(await readFile('src/data/aspect-reference-examples.json', 'utf8')).examples[0];
    await page.evaluate((profile) => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile)), { version: 1, settings: { houseSystem: 'whole' }, charts: [chart('synthetic-a', fixture.chartA.utc), chart('synthetic-b', fixture.chartB.utc)] });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#syn-a-source').selectOption('synthetic-a');
    await page.locator('#syn-b-source').selectOption('synthetic-b');
    await page.locator('.calc__submit').click();
    await page.locator('.rwheel').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => globalThis.__referenceEvents.some((event) => event.name === 'reference_task_completed'));
    const event = await page.evaluate(() => globalThis.__referenceEvents.find((event) => event.name === 'reference_task_completed'));
    assert.deepEqual(event.props, { topic: 'synastry', page: 'sun-moon', locale: 'en', task: 'comparison', destination: 'compatibility' });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('zodiacs:reference-task')), null);
    const link = page.locator('.syn__reference[href="/compatibility/aspects/sun-moon/#conjunction"]').first();
    await link.waitFor();
    assert.match(await link.getAttribute('aria-label'), /Sun in chart A conjunction Moon in chart B/);
    const row = link.locator('..').locator('button').first();
    await row.focus();
    await page.keyboard.press('Enter');
    assert((await row.getAttribute('class')).includes('is-focus'));
    await link.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/compatibility/aspects/sun-moon/#conjunction');
    assert.equal(await page.locator('h2#conjunction').count(), 1);
    results.push({ journey: 'synthetic comparison', completion: event.props, keyboard: 'separate row selection and reference anchor passed' });
    await context.close();
  });
} finally { await browser.close(); }
await writeFile(`${root}/results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(`Synastry reference browser checks passed: ${results.length} scenarios, 4 pages, zero CLS, static delivery, 320px, 200% text, keyboard and nonpersonal completion.`);
