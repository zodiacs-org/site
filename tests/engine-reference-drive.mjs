import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const output = resolve(process.env.ENGINE_REFERENCE_EVIDENCE ?? 'tests/visual/artifacts/engine-reference');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
const checks = [];
try {
  await withPreview({ port: 4338 }, async (baseURL) => {
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseURL}/developers/engine/`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'Read the 0.1.1-rc.17 API reference', exact: true }).click();
      await page.waitForURL('**/developers/engine/reference/');
      await page.getByRole('link', { name: 'module index', exact: true }).click();
      await page.waitForURL('**/modules.html');
      for (const path of ['', 'modules.html', 'modules/calc.html', 'functions/calc.calc.html']) {
        const response = await page.goto(`${baseURL}/developers/engine/reference/${path}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://zodiacs.org/developers/engine/reference/${path}`);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,follow');
        assert.match(await page.locator('footer').innerText(), /MIT AND CC-BY-4.0/);
        const layout = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(layout.scrollWidth <= width + 1, `${width}/${path}: horizontal overflow ${layout.scrollWidth}`);
        const filename = `${width}-${path ? path.replaceAll('/', '-').replace('.html', '') : 'index'}.png`;
        await page.screenshot({ path: resolve(output, filename), fullPage: true });
        checks.push({ width, path: `/developers/engine/reference/${path}`, ...layout });
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  });
} finally { await browser.close(); }
await writeFile(resolve(output, 'checks.json'), JSON.stringify(checks, null, 2) + '\n');
console.log(`Engine reference browser: PASS (${checks.length} route/viewport checks; landing link, canonicals, licences, no horizontal overflow or browser errors)`);
