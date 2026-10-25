// Review build (PUBLIC_NATAL_ASPECTS_PREVIEW=1): the three natal pair pages
// in a browser. Structure, register, noindex and sitemap exclusion, static
// delivery, the accessible diagram, 320px and 200% text, keyboard access and
// zero layout shift.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { withPreview } from './visual/preview-server.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { NATAL_ASPECT_PAIRS, natalAspectsEnabled, natalAspectsPublished } from '../scripts/natal-aspects-policy.mjs';

assert(natalAspectsEnabled, 'Build with PUBLIC_NATAL_ASPECTS_PREVIEW=1 first.');
const GEOMETRIES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];
const VERBS = { conjunction: 'conjunct', sextile: 'sextile', square: 'square', trine: 'trine', opposition: 'opposite' };
const root = 'tests/visual/artifacts/natal-aspects';
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
const results = [];
try {
  await withPreview({ port: 4349 }, async (baseURL) => {
    const sitemap = await (await fetch(`${baseURL}/sitemap.xml`)).text();
    const search = await (await fetch(`${baseURL}/search-index.json`)).text();
    for (const pair of NATAL_ASPECT_PAIRS) {
      const path = `/learn/aspects/${pair}/`;
      assert.equal(sitemap.includes(`https://zodiacs.org${path}`), natalAspectsPublished, `${path}: only a published edition enters the sitemap`);
      assert.equal(search.includes(path), natalAspectsPublished, `${path}: search withholds the review edition`);
      const [a, b] = pair.split('-').map((body) => body[0].toUpperCase() + body.slice(1));
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 320, height: 900 }, javaScriptEnabled, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        if (javaScriptEnabled) await page.addInitScript(() => {
          globalThis.__natalShifts = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__natalShifts.push(entry.value);
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, `${path} serves`);
        const html = await response.text();
        assert(!/[\u2013\u2014]/u.test(html), `${path}: no long dash characters in server HTML`);

        const text = await page.locator('.natal-ref').innerText();
        assert(!/[\u2013\u2014]/u.test(text), `${path}: no long dash characters in the article`);
        assert(!/\b(?:crypto|tokens?|wallet|blockchain|investment|marriage|divorce|soulmate|destiny)\b/i.test(text), `${path}: consumer register, no outcome claims`);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal((await page.locator('h1').innerText()).trim(), `${a}-${b} aspects in a birth chart`);
        assert.match(await page.title(), /in a birth chart/);
        for (const geometry of GEOMETRIES) {
          assert.equal((await page.locator(`h2#${geometry}`).innerText()).trim(), `${a} ${VERBS[geometry]} ${b} in a birth chart`);
        }
        for (const id of ['orbs-heading', 'birth-time-heading', 'examples-heading']) assert.equal(await page.locator(`h2#${id}`).count(), 1);
        assert.equal(await page.locator('.natal-ref__examples article').count(), 2);
        assert.equal(await page.locator('.natal-ref__table caption').count(), 1);
        assert.equal(await page.locator('.natal-ref__table th[scope="col"]').count(), 4);
        assert.equal(await page.locator('.natal-ref__table tbody tr').count(), 5);
        assert.equal(await page.locator('.faq details').count(), 4);
        assert.equal(await page.locator('.natal-ref svg[role="img"]').count(), 1, `${path}: one schematic diagram`);
        assert.equal(await page.locator('.natal-ref svg[role="img"] title').count(), 1);
        assert.equal(await page.locator('.natal-ref svg[role="img"] desc').count(), 1);
        assert.equal(await page.locator('a[href^="/compatibility/aspects/"]').count(), 0, `${path}: no link to unpublished synastry routes`);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://zodiacs.org${path}`);
        assert.equal(/noindex/.test(await page.locator('meta[name="robots"]').getAttribute('content')), !natalAspectsPublished);
        assert.equal(await page.locator('link[hreflang]').count(), 0, `${path}: English only, no alternates`);
        assert.equal(await page.locator('.zfooter').count(), 1, `${path}: the Celestial Colophon ends the page`);
        assert.equal(await page.locator('astro-island').count(), 0, `${path}: static, no islands`);
        assert.equal(await page.locator('button a, a button').count(), 0);
        const breadcrumb = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts
          .flatMap((script) => JSON.parse(script.textContent)['@graph'] || [])
          .find((node) => node['@type'] === 'BreadcrumbList'));
        assert.deepEqual(breadcrumb.itemListElement.map((item) => item.item).slice(-2), ['https://zodiacs.org/learn/aspects/', `https://zodiacs.org${path}`]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits 320px`);

        const faq = page.locator('.faq details').first();
        await faq.locator('summary').focus();
        await page.keyboard.press('Enter');
        assert.equal(await faq.getAttribute('open'), '', `${path}: FAQ opens from the keyboard`);

        if (javaScriptEnabled) {
          // The Learn reading map (ArticleContents) lists every section.
          for (const geometry of GEOMETRIES) assert.equal(await page.locator(`[data-article-contents] a[href="#${geometry}"]`).count(), 1, `${path}: reading map links ${geometry}`);
          await page.locator('[data-article-contents] summary').evaluate((summary) => { summary.parentElement.open = true; });
          await page.locator('[data-article-contents] a[href="#square"]').focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => location.hash === '#square');
          await page.evaluate(() => scrollTo(0, 0));
          await page.locator('.natal-ref__cta').scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
          const cls = await page.evaluate(() => globalThis.__natalShifts.reduce((sum, value) => sum + value, 0));
          assert.equal(cls, 0, `${path} raw CLS`);
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits with 200% text`);
          await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
          await page.screenshot({ path: `${root}/${pair}-320.png`, fullPage: true });
          results.push({ path, javaScriptEnabled, cls, viewport: 320, textZoom: '200%', errors });
        } else results.push({ path, javaScriptEnabled, viewport: 320, errors });
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
  });
} finally {
  await browser.close();
}
await writeFile(`${root}/results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(`Natal aspect browser checks passed: ${results.length} scenarios, ${NATAL_ASPECT_PAIRS.length} pages, zero CLS, static delivery, 320px, 200% text and keyboard.`);
