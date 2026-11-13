/**
 * Curated wing-search and plain-wing-link drive against the production build.
 *
 *   npm run build
 *   OUT_DIR=/tmp/search-wing node tests/search-wing-drive.mjs
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const queries = [
  ['terminal', 'Terminal', 'Terminal'],
  ['registry', 'Zodiacs Registry', 'Registry'],
  ['zodiac capital markets', 'Terminal', 'Terminal'],
  ['market tape liquidity', 'Terminal', 'Terminal'],
  ['ranked zodiac tokens', 'Terminal', 'Terminal'],
  ['zodiac gallery verifier', 'Astrofolio', 'Astrofolio'],
  ['astrofolio', 'Astrofolio', 'Astrofolio'],
  ['thesis', 'Why Zodiacs Matter — the Registry thesis', 'Registry'],
  ['aries record', 'Aries — official Zodiac record', 'Registry'],
];
const wingPaths = ['/astrofolio/', '/terminal/', '/registry/', '/thesis/', '/sdk/', '/registry/aries/'];
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

if (OUT) await mkdir(OUT, { recursive: true });

await withPreview({ port: 4403 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: STABLE_CHROMIUM_ARGS,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    await page.goto(`${baseURL}/?search=1`, { waitUntil: 'networkidle' });
    const input = page.locator('.zsearch__input');
    await input.waitFor({ state: 'visible' });
    const cleaned = new URL(page.url());
    check('query parameter opens the search dialog', await page.locator('.zsearch__panel').isVisible());
    check('query parameter is removed without navigation', cleaned.pathname === '/' && !cleaned.searchParams.has('search'), cleaned.href);
    check('query-opened search focuses the input', await input.evaluate((element) => document.activeElement === element));

    // The links other pages carry: /#search, a plain homepage link to crawlers.
    const hashPage = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
    await hashPage.goto(`${baseURL}/#search`, { waitUntil: 'networkidle' });
    await hashPage.locator('.zsearch__input').waitFor({ state: 'visible' });
    const hashCleaned = new URL(hashPage.url());
    check('#search opens the search dialog', await hashPage.locator('.zsearch__panel').isVisible());
    check('#search is removed without navigation', hashCleaned.pathname === '/' && hashCleaned.hash === '', hashCleaned.href);
    await hashPage.close();

    for (const [query, expectedTitle, expectedKind] of queries) {
      await input.fill(query);
      const result = page.locator('.zsearch__opt').filter({
        has: page.locator('.zsearch__title', { hasText: expectedTitle }),
      }).filter({
        has: page.locator('.zsearch__kind', { hasText: new RegExp(`^${expectedKind}$`) }),
      }).first();
      await result.waitFor({ state: 'visible' });
      const resultTitle = await result.locator('.zsearch__title').textContent();
      const resultKind = await result.locator('.zsearch__kind').textContent();
      check(
        `${query}: returns the expected wing entry`,
        resultTitle === expectedTitle && resultKind === expectedKind,
        `${resultTitle} · ${resultKind}`,
      );
      if (OUT) await page.locator('.zsearch__panel').screenshot({ path: `${OUT}/search-${query.replaceAll(' ', '-')}.png` });
    }
    await page.close();

    const wing = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    for (const path of wingPaths) {
      await wing.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      const searchLinks = wing.locator('a[href="/#search"][aria-label="Search the site"]');
      await searchLinks.first().waitFor({ state: 'visible' });
      check(`${path}: wing nav exposes Search`, await searchLinks.count() >= 1, String(await searchLinks.count()));
    }
    await wing.close();
  } finally {
    await browser.close();
  }
});

let failed = 0;
for (const result of results) {
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURE${failed === 1 ? '' : 'S'}` : `\nALL ${results.length} CHECKS PASS`);
process.exit(failed ? 1 : 0);
