import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('captures', { recursive: true });
const pages = (process.env.CAPTURE_PATHS || '/numerology/').split(',');
const sizes = [['phone', 390, 844], ['desktop', 1280, 900]];
const browser = await chromium.launch();
for (const path of pages) {
  const slug = path.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home';
  for (const [name, width, height] of sizes) {
    for (const [origin, tag] of [['https://zodiacs.org', 'before'], ['http://localhost:4400', 'after']]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      if (tag === 'after') {
        await page.waitForTimeout(450);
        await page.screenshot({ path: `captures/${slug}-${name}-after-mid.png` });
      }
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `captures/${slug}-${name}-${tag}.png` });
      // The life path tiles and the letter key, scrolled into view.
      const tiles = page.locator('nav[aria-label="Life path numbers"]');
      if (await tiles.count()) {
        await tiles.scrollIntoViewIfNeeded();
        await page.waitForTimeout(2600);
        await page.screenshot({ path: `captures/${slug}-${name}-${tag}-paths.png` });
      }
      const key = page.locator('.num-key');
      if (tag === 'after' && await key.count()) {
        await key.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1800);
        await page.screenshot({ path: `captures/${slug}-${name}-after-key.png` });
      }
      // A worked result (an invented name and date, never stored).
      const date = page.locator('#num-date');
      if (await date.count()) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator('#num-name').fill('Tobias Alexander Wren');
        await date.fill('1983-03-14');
        await page.locator('.calc__submit').click();
        await page.waitForSelector('.num__lead', { timeout: 10000 });
        await page.locator('.num__lead').scrollIntoViewIfNeeded();
        await page.waitForTimeout(2600);
        await page.screenshot({ path: `captures/${slug}-${name}-${tag}-result.png` });
      }
      await ctx.close();
    }
    // Reduced motion: everything shown at once, nothing hidden.
    const rctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const rpage = await rctx.newPage();
    await rpage.goto('http://localhost:4400' + path, { waitUntil: 'networkidle' });
    await rpage.screenshot({ path: `captures/${slug}-${name}-after-reduced.png` });
    const hidden = await rpage.evaluate(() => [...document.querySelectorAll('[data-motion]')].filter((el) => getComputedStyle(el).opacity !== '1').length);
    console.log(`${path} ${name} reduced-motion hidden elements: ${hidden}`);
    await rctx.close();
  }
}
await browser.close();
