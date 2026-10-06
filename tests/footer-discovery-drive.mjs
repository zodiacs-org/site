/** Layout and interaction checks for the shared discovery directory and Guide introduction. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
const out = process.env.OUT_DIR || '/tmp/zodiacs-footer-discovery';
await mkdir(out, { recursive: true });
await withPreview({ port: 8912 }, async base => {
  for (const engine of ['chromium', 'webkit']) {
    const browser = engine === 'chromium'
      ? await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS })
      : await webkit.launch();
    try {
      const locales = engine === 'chromium' ? ['', 'es', 'pt', 'fr', 'it', 'ru'] : [''];
      for (const locale of locales) for (const width of [320, 390, 611, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1149 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        await page.goto(base + (locale ? `/${locale}` : '') + '/profile/', { waitUntil: 'networkidle' });
        const discovery = page.locator('.return-discovery');
        await discovery.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        const links = discovery.locator('a');
        assert.equal(await links.count(), 5);
        for (const link of await links.all()) {
          const box = await link.boundingBox();
          assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1);
          const label = await link.locator('span').first().boundingBox();
          const arrow = await link.locator('.return-discovery__arrow').boundingBox();
          assert(arrow.x - label.x - label.width >= 18, 'Arrow must be separate from the label');
          assert.equal(await link.evaluate(el => getComputedStyle(el).textDecorationLine), 'none');
          const url = new URL(await link.getAttribute('href'), base);
          assert.equal((await page.request.get(url.href)).status(), 200);
        }
        const help = page.locator('.zfooter__help');
        await help.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.zfooter__help')).paddingTop === '24px' || getComputedStyle(document.querySelector('.zfooter__help')).paddingInlineStart === '28px');
        assert((await help.locator('.zfooter__help-description').innerText()).length > 35);
        assert.equal(await page.locator('#footer-guide-description').count(), 1);
        const open = help.locator('[data-footer-guide]');
        assert.equal(await open.getAttribute('aria-describedby'), 'footer-guide-description');
        assert((await open.boundingBox()).height >= 44);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (!locale && engine === 'chromium') {
          await discovery.screenshot({ path: `${out}/discovery-${width}.png` });
          await page.locator('.zfooter__lead').screenshot({ path: `${out}/guide-${width}.png` });
        }
        await open.click();
        await page.locator('.zassistant__panel').waitFor({ state: 'visible' });
        await page.locator('.zassistant__close').click();
        await page.locator('.zassistant__panel').waitFor({ state: 'hidden' });
        console.log(`PASS ${engine} ${locale || 'en'} ${width}: layout, destinations, Guide open/close`);
        await page.close();
      }
      if (engine === 'chromium') for (const route of ['/registry/virgo/', '/registry/', '/thesis/', '/sky-calendar/']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
        await page.goto(base + route, { waitUntil: 'networkidle' });
        const help = page.locator('.zfooter__help');
        await help.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.zfooter__help-description')?.innerText.includes('AI assistant'));
        await help.locator('[data-footer-guide]').click();
        await page.locator('.zassistant__panel').waitFor({ state: 'visible' });
        await page.locator('.zassistant__close').click();
        await page.locator('.zassistant__panel').waitFor({ state: 'hidden' });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        console.log(`PASS static/shared ${route}`); await page.close();
      }
    } finally { await browser.close(); }
  }
});
