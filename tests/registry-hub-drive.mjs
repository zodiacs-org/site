/**
 * Focused browser gate for the static Registry authority hub.
 *
 *   npm run build
 *   node tests/registry-hub-drive.mjs
 */
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import registry from '../public/registry/zodiacs.registry.json' with { type: 'json' };

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const leo = registry.assets.find((asset) => asset.sign === 'leo');
const leoSolana = leo.representations.find((representation) => representation.chain === 'solana').address;
const leoBase = leo.representations.find((representation) => representation.chain === 'base').address;

await withPreview({ port: 4412 }, async (baseURL) => {
  const browser = await chromium.launch({
    executablePath: await findChromium(),
    headless: true,
    args: STABLE_CHROMIUM_ARGS,
  });
  try {
    for (const width of [320, 360, 390, 1180]) {
      const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
      const externalRequests = [];
      const consoleErrors = [];
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== new URL(baseURL).origin) externalRequests.push(request.url());
      });
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.goto(`${baseURL}/registry/`, { waitUntil: 'networkidle' });
      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        records: document.querySelectorAll('[data-registry-record]').length,
        addresses: document.querySelectorAll('.record__network code').length,
        h1: document.querySelectorAll('h1').length,
        title: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(),
        controls: Array.from(document.querySelectorAll('.verify-form button,a.record__open,a.terminal-link,a.authority__link')).map((element) => ({
          text: element.textContent.trim(),
          height: element.getBoundingClientRect().height,
        })),
      }));
      check(`${width}px has one Registry H1 and complete records`, geometry.h1 === 1 && geometry.title === 'Find your sign.' && geometry.records === 12 && geometry.addresses === 24, JSON.stringify(geometry));
      check(`${width}px has no horizontal overflow`, geometry.documentWidth <= geometry.viewportWidth + 1, JSON.stringify(geometry));
      check(`${width}px controls meet the 44px floor`, geometry.controls.every((control) => control.height >= 43.5), JSON.stringify(geometry.controls.filter((control) => control.height < 43.5)));
      check(`${width}px makes no third-party requests`, externalRequests.length === 0, externalRequests.join(', '));
      check(`${width}px has no console errors`, consoleErrors.length === 0, consoleErrors.join(' | '));
      await page.close();
    }

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseURL}/registry/`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('#registry-address');
    const result = page.locator('#verify-result');
    await input.fill(leoSolana);
    await page.locator('[data-address-verifier] button').click();
    check('Solana exact match verifies Leo', await result.getAttribute('data-state') === 'verified' && /Leo · verified original address/.test(await result.textContent()), await result.textContent());
    await input.fill(leoBase.toLowerCase());
    await page.locator('[data-address-verifier] button').click();
    check('Base match accepts canonical address casing', await result.getAttribute('data-state') === 'verified' && /Leo · verified Base address/.test(await result.textContent()), await result.textContent());
    await input.fill(`${leoSolana.slice(0, -1)}X`);
    await page.locator('[data-address-verifier] button').click();
    check('near match is rejected', await result.getAttribute('data-state') === 'unknown', await result.textContent());
    await page.close();

    const noJsContext = await browser.newContext({ viewport: { width: 320, height: 844 }, javaScriptEnabled: false });
    const noJs = await noJsContext.newPage();
    await noJs.goto(`${baseURL}/registry/`, { waitUntil: 'domcontentloaded' });
    const noJsState = await noJs.evaluate(() => ({
      records: document.querySelectorAll('[data-registry-record]').length,
      addresses: document.querySelectorAll('.record__network code').length,
      noScript: document.querySelector('noscript')?.textContent.includes('The complete list is still shown above.'),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }));
    check('no-JS page retains all records and fits 320px', noJsState.records === 12 && noJsState.addresses === 24 && noJsState.noScript && noJsState.documentWidth <= noJsState.viewportWidth + 1, JSON.stringify(noJsState));
    await noJsContext.close();

    for (const [legacy, expectedPath, expectedHash] of [
      ['/registry/?sign=leo#market', '/terminal/', '#market'],
      ['/registry/?rank=liquidity', '/terminal/', ''],
      ['/registry/#outlook', '/terminal/', '#briefing'],
      ['/registry/#aquarius', '/astrofolio/', '#aquarius'],
    ]) {
      const redirect = await browser.newPage();
      await redirect.goto(baseURL + legacy, { waitUntil: 'domcontentloaded' });
      await redirect.waitForURL((url) => url.pathname === expectedPath);
      const url = new URL(redirect.url());
      check(`${legacy} hands off to the matching wing view`,
        url.pathname === expectedPath && url.hash === expectedHash, redirect.url());
      await redirect.close();
    }

    const retained = await browser.newPage();
    await retained.goto(`${baseURL}/registry/#verify`, { waitUntil: 'domcontentloaded' });
    const verifyTop = await retained.locator('#verify').evaluate((element) => element.getBoundingClientRect().top);
    check('new Registry #verify remains on the hub', new URL(retained.url()).pathname === '/registry/' && new URL(retained.url()).hash === '#verify' && verifyTop >= 80, `${retained.url()} · top ${verifyTop}`);
    await retained.close();

    const search = await browser.newPage();
    await search.goto(`${baseURL}/registry/`, { waitUntil: 'domcontentloaded' });
    const searchHref = await search.locator('.wnav__search').getAttribute('href');
    check('search remains a same-origin navigation under the no-connect CSP', searchHref === '/#search', searchHref ?? 'missing');
    await search.close();
  } finally {
    await browser.close();
  }
});

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` · ${result.detail}` : ''}`);
}
console.log(failures ? `\n${failures} FAILURE${failures === 1 ? '' : 'S'}` : `\nALL ${results.length} CHECKS PASS`);
process.exit(failures ? 1 : 0);
