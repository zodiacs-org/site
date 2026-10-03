import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const registry = JSON.parse(await readFile(new URL('../public/registry/zodiacs.registry.json', import.meta.url), 'utf8'));
const recordFor = (slug) => {
  const asset = registry.assets.find((candidate) => candidate.sign === slug);
  const solana = asset?.representations.find((representation) => representation.chain === 'solana');
  assert.ok(asset && solana?.address, `canonical ${slug} Solana record exists`);
  return { name: asset.displayName, mint: solana.address };
};
if (OUT) await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
try {
  await withPreview({ port: 4386 }, async (baseURL) => {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: 'dark' });
      const forbidden = []; const errors = [];
      await context.addInitScript(() => {
        globalThis.__walletCalls = [];
        const reject = name => { globalThis.__walletCalls.push(name); throw new Error('wallet access forbidden'); };
        Object.defineProperty(globalThis, 'solana', { get: () => reject('solana') });
        Object.defineProperty(globalThis, 'ethereum', { get: () => reject('ethereum') });
      });
      await context.route(/api\.jup\.ag|api\.dexscreener\.com|walletconnect|phantom|solflare/i, async route => {
        forbidden.push(route.request().url()); await route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseURL}/astrofolio/how-to-buy/leo/`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('h1').innerText(), 'How to buy a Zodiac');
      assert.equal(await page.locator('.buy-signs a').count(), 12);
      for (const slug of ['leo', 'virgo']) {
        if (slug === 'virgo') await page.locator('.buy-signs a[href$="/virgo/"]').click();
        const record = recordFor(slug);
        assert.equal(await page.locator('.buy-signs a[aria-current="page"]').innerText(), record.name);
        assert.equal(await page.locator('.buy-record code').innerText(), record.mint);
        const purchase = page.getByRole('link', { name: /Buy with Fomo/ });
        const url = new URL(await purchase.getAttribute('href'));
        assert.equal(url.hostname, 'fomo.family');
        assert.equal(url.searchParams.get('address'), record.mint);
        assert.match(await purchase.getAttribute('rel'), /noopener.*external.*nofollow/);
        assert.match(await page.locator('article').innerText(), /Zodiacs\.org also operates Astrofolio/);
        assert.ok(await page.locator('article a[href="/disclosure/"]').count() > 0);
        assert.equal(await page.locator('[data-load-jupiter], [data-eligibility-confirm], [data-trade-panel], script[data-zodiac-trade-runtime]').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(await page.evaluate(() => globalThis.__walletCalls), []);
      }
      assert.deepEqual(forbidden, [], 'read-only address guide must not contact providers');
      assert.deepEqual(errors, []);
      if (OUT) await page.screenshot({ path: `${OUT}/how-to-buy-${width}.png`, fullPage: true });
      await context.close();
    }
  });
} finally { await browser.close(); }
console.log('how-to-buy browser: PASS — mobile and desktop canonical addresses, independent purchase links, disclosure, no wallet access or provider requests');
