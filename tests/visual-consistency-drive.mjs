/** Regression coverage for the owner-reported mobile spacing and changing buy bar. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import { EXCHANGE_POOLS } from '../src/exchange/pools.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const out = process.env.OUT_DIR ?? 'tests/visual/artifacts/visual-consistency';
const registry = JSON.parse(await readFile(new URL('../public/registry/zodiacs.registry.json', import.meta.url), 'utf8'));
const results = [];
const profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [{
  id: '11111111-1111-4111-8111-111111111111', name: 'Maya', relationship: 'self',
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
  birth: { date: '1990-01-01', time: '12:00', timeKnown: true,
    place: { name: 'London', admin1: '', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
  summary: { engineVersion: '0.1.0', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 280, retrograde: false }, { body: 'Moon', lon: 330, retrograde: false }],
    angles: { asc: 10, mc: 280 }, flags: [] },
}] };
const pairs = registry.assets.map((asset, index) => ({
  chainId: 'solana', pairAddress: EXCHANGE_POOLS[asset.sign],
  baseToken: { address: asset.native.address },
  quoteToken: { address: 'So11111111111111111111111111111111111111112' },
  // Deliberately exercise different string lengths and both movement directions.
  priceUsd: String(index === 0 ? 1234.5 : (index + 1) * 0.000000001),
  priceChange: { h24: index % 2 ? -123.45 : 9.2 },
  liquidity: { usd: 10000 }, marketCap: 10000, volume: { h24: 100 },
}));
await mkdir(out, { recursive: true });

async function settleFooter(page) {
  // content-visibility can replace its intrinsic placeholder after the first
  // scroll. Reposition against the real brand bounds once it has rendered.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('.zfooter__brand').evaluate(el => window.scrollTo({
      top: scrollY + el.getBoundingClientRect().top - 100, behavior: 'instant',
    }));
    await page.waitForTimeout(100);
  }
}

await withPreview({ port: 8787 }, async baseURL => {
  for (const engine of ['chromium', 'webkit']) {
    const browser = engine === 'chromium'
      ? await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS })
      : await webkit.launch();
    try {
      const widths = engine === 'chromium' ? [320, 360, 390, 430, 768, 1440] : [390];
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
        // No authentication, emails, purchases, or backend mutations.
        await context.route('https://*.supabase.co/**', route => route.abort());
        let state = 'unavailable';
        let release = [];
        await context.route('https://api.dexscreener.com/**', async route => {
          if (state === 'pending') await new Promise(resolve => release.push(resolve));
          try {
            if (state === 'unavailable') return await route.fulfill({ status: 503, body: 'Fixture unavailable' });
            const isPairs = route.request().url().includes('/latest/dex/pairs/solana/');
            const payload = state === 'partial' ? pairs.filter(pair => pair.pairAddress !== EXCHANGE_POOLS.sagittarius) : pairs;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isPairs ? { pairs: payload } : payload) });
          } catch { /* the pending document was closed after measurement */ }
        });
        const page = await context.newPage();
        await page.goto(`${baseURL}/profile/`, { waitUntil: 'load' });
        const empty = page.locator('.living-chart__empty-state');
        await empty.waitFor();
        const gap = await empty.evaluate(el => el.querySelector('.btn').getBoundingClientRect().top - el.querySelector('p').getBoundingClientRect().bottom);
        assert.ok(gap >= 20, `${engine}/${width}: Open Today needs a clear paragraph gap (${gap})`);
        if (width === 390) await empty.screenshot({ path: `${out}/${engine}-living-chart.png` });
        await settleFooter(page);
        await page.evaluate(() => document.fonts.ready);
        const brand = await page.locator('.zfooter__brand').evaluate(el => {
          const mark = el.querySelector('.zfooter__brand-mark').getBoundingClientRect();
          const name = el.querySelector('.zfooter__brand-name').getBoundingClientRect();
          return { offset: Math.abs(mark.y + mark.height / 2 - name.y - name.height / 2), width: el.getBoundingClientRect().width };
        });
        assert.ok(brand.offset <= 3, `${engine}/${width}: brand mark and wordmark drifted`);
        assert.ok(brand.width <= width - 24);
        if (width === 390) await page.locator('.zfooter__brand').screenshot({ path: `${out}/${engine}-wordmark.png` });
        for (const phase of ['pending', 'unavailable', 'quoted', 'partial']) {
          state = phase;
          let first;
          for (const asset of registry.assets) {
            await page.goto(`${baseURL}/astrofolio/?sign=${asset.sign}`, { waitUntil: 'domcontentloaded' });
            const bag = page.locator('.campaign-bag:not(.is-hidden)');
            await bag.waitFor();
            await page.evaluate(() => document.fonts.ready);
            if (phase === 'partial' && asset.sign === 'sagittarius') await bag.locator('small').filter({ hasText: 'Price not indexed' }).waitFor();
            else if (phase === 'quoted' || phase === 'partial') await bag.locator('.campaign-bag__move').waitFor();
            const geometry = await bag.evaluate(el => {
              const box = el.getBoundingClientRect();
              const cta = el.querySelector('.btn--fomo').getBoundingClientRect();
              const who = el.querySelector('.campaign-bag__who').getBoundingClientRect();
              const name = el.querySelector('strong');
              const caret = el.querySelector('.campaign-bag__caret')?.getBoundingClientRect();
              return { width: box.width, height: box.height, x: box.x, right: box.right,
                ctaWidth: cta.width, gap: cta.left - who.right,
                nameClipped: name.scrollWidth > name.clientWidth + 1,
                caretVisible: !caret || caret.right <= who.right + 1 && caret.bottom <= who.bottom + 1 };
            });
            first ??= geometry;
            assert.ok(geometry.x >= 10 && geometry.right <= width - 10);
            assert.ok(geometry.gap >= 8, `${engine}/${width}/${asset.sign}: touching purchase controls`);
            assert.ok(!geometry.nameClipped && geometry.caretVisible, `${engine}/${width}/${asset.sign}: clipped name or picker`);
            assert.ok(Math.abs(geometry.width - first.width) < 1 && Math.abs(geometry.height - first.height) < 1, `${engine}/${width}/${phase}/${asset.sign}: sign selection resized the bar ${JSON.stringify({ first, geometry })}`);
            assert.ok(Math.abs(geometry.ctaWidth - first.ctaWidth) < 1);
            results.push({ engine, viewportWidth: width, phase, sign: asset.sign, ...geometry });
            if (width === 390 && phase === 'quoted' && ['leo', 'sagittarius'].includes(asset.sign)) await bag.screenshot({ path: `${out}/${engine}-bag-${asset.sign}.png` });
            release.forEach(resolve => resolve()); release = [];
          }
          const reference = results.find(row => row.engine === engine && row.viewportWidth === width);
          assert.ok(Math.abs(first.height - reference.height) < 1, `${engine}/${width}: market loading changed bar height`);
        }
        if (width === 390) {
          let reference;
          for (const sign of ['leo', 'sagittarius', 'capricorn']) {
            await page.locator('.campaign-bag__pick').click();
            await page.locator(`[data-sheet-sign="${sign}"]`).click();
            const bag = page.locator(`.campaign-bag[data-campaign-bag="${sign}"]:not(.is-hidden)`);
            await bag.waitFor();
            const box = await bag.boundingBox();
            reference ??= box;
            assert.equal(box.width, reference.width, `${engine}: picker changes bar width`);
            assert.equal(box.height, reference.height, `${engine}: picker changes bar height`);
            const guide = await page.locator('.zguide-launcher').boundingBox();
            assert.ok(guide && box.y - guide.y - guide.height >= 12, `${engine}: Guide overlaps the purchase bar`);
          }
        }
        await context.close();
      }
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(profile => localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile)), profile);
      await context.route('https://*.supabase.co/**', route => route.abort());
      const page = await context.newPage();
      for (const path of ['/gemini/', '/ru/', '/ru/profile/']) {
        await page.goto(`${baseURL}${path}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const selector = path === '/gemini/' ? '.guide-main, .guide-main h2'
          : path === '/ru/' ? '.home-tool-ru h3'
          : '.pf-chart__action, .pf-foot .btn, .pf-sync__form input, .pf-sync__form .btn';
        if (path === '/ru/profile/') await page.locator('.pf-chart__actions').waitFor();
        const elements = page.locator(selector);
        for (let index = 0; index < await elements.count(); index += 1) {
          const element = elements.nth(index);
          await element.scrollIntoViewIfNeeded();
          const bounds = await element.evaluate(el => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, width: r.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
          });
          assert.ok(bounds.left >= -1 && bounds.right <= 321, `${engine}${path}: narrow-phone content escaped ${JSON.stringify(bounds)}`);
          if (path === '/ru/') assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1, `${engine}: translated tool title clips`);
        }
        if (path === '/ru/profile/') {
          const card = page.locator('.pf-chart').first();
          await card.evaluate(el => window.scrollTo({ top: scrollY + el.getBoundingClientRect().top - 90, behavior: 'instant' }));
          await card.screenshot({ path: `${out}/${engine}-translated-profile.png` });
        }
      }
      await context.close();
    } finally { await browser.close(); }
  }
});
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(`PASS ${results.length} purchase-bar measurements, clear Open Today spacing, and brand alignment in Chromium and WebKit.`);
