import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { withSecurePreview } from './visual/secure-preview.mjs';

const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/chart-of-day');
await mkdir(out, { recursive: true });
const editions = JSON.parse(await readFile(new URL('../src/data/chart-of-the-day.json', import.meta.url), 'utf8')).editions;
assert(editions.length > 0, 'The owner-approved publication drive needs a reviewed edition');
const edition = editions.find(({ day }) => day === '2026-10-04');
assert(edition?.ownerApproval.approved);
const locales = ['', 'es/', 'pt/', 'fr/', 'it/', 'ru/'];
const policy = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).headers.find(({ source }) => source === '/(.*)').headers.find(({ key }) => key === 'Content-Security-Policy').value;
const observations = [];
const record = (name) => { observations.push({ name }); console.log(`PASS: ${name}`); };
const drivers = [{ name: 'chromium', type: chromium, options: { executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS } }, ...(process.env.RETURN_VISITS_BROWSERS === 'chromium' ? [] : [{ name: 'webkit', type: webkit, options: {} }])];
async function pageSetup(context, day) {
  await context.addInitScript(({ day }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [`${day}T12:00:00Z`])); }
      static now() { return new NativeDate(`${day}T12:00:00Z`).getTime(); }
    }
    globalThis.Date = FixedDate;
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`));
  }, { day });
  await context.route('**/*', async (route) => {
    if (!route.request().isNavigationRequest() || route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
}
async function settle(page) {
  await page.locator('.zfooter').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.zfooter__brand')).display === 'inline-flex');
  await page.evaluate(() => document.fonts.ready);
  // Full-page screenshots otherwise skip this offscreen footer's paint.
  // Visit its real layout first, then render it without content-visibility.
  await page.locator('.zfooter').evaluate((footer) => { footer.style.contentVisibility = 'visible'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.evaluate(() => scrollTo(0, 0));
}
await withPreview({ port: 8792 }, (preview) => withSecurePreview(preview, async (base, localTls) => {
  // The local TLS fixture is intentionally not trusted by Node fetch. Check
  // static discovery against the underlying preview instead; browsers use TLS.
  const discovery = await (await fetch(`${preview}/sitemap.xml`)).text();
  for (const locale of locales) assert(discovery.includes(`https://zodiacs.org/${locale}chart-of-the-day/${edition.day}/`));
  record('six approved dated routes are in the sitemap');
  for (const driver of drivers) {
    const browser = await driver.type.launch({ headless: true, ...driver.options });
    try {
      const cases = [...locales.map((locale) => ({ locale, width: 390 })), { locale: '', width: 360 }, { locale: '', width: 1280 }];
      for (const { locale, width } of cases) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, ignoreHTTPSErrors: localTls });
        await pageSetup(context, edition.day);
        const page = await context.newPage(), errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/${locale}chart-of-the-day/`);
        const current = page.locator('.return-panel .btn');
        await current.waitFor();
        assert.equal(await page.locator(`.return-panel a[href$="/${edition.day}/"]`).count(), 1, 'Current edition is not duplicated in the archive');
        await current.click();
        await page.locator('[data-check-our-math]').waitFor({ timeout: 30000 });
        assert.equal(new URL(page.url()).pathname, `/${locale}chart-of-the-day/${edition.day}/`);
        assert.equal(await page.locator('[data-check-our-math]').getAttribute('data-instant-basis'), 'reference');
        assert((await page.locator('[data-check-our-math]').innerText()).includes('2001-08-16T12:00:00.000Z'));
        assert.equal(await page.locator('.return-result .return-contact-list li').count(), 12);
        assert.equal(await page.locator(`a[href="${edition.birthSource}"]`).count(), 1);
        assert.equal(await page.locator(`a[href="${edition.newsSource}"]`).count(), 1);
        assert((await page.locator('main').innerText()).includes(edition.reliability[locale.replace('/', '') || 'en']));
        assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(), 7);
        assert(!(await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
        assert.equal(await page.locator('[data-nav] a[href="/astrofolio/"]').count(), 1);
        assert.equal(await page.locator('main a[href="/astrofolio/"]').count(), 0);
        assert.equal(await page.locator('input[type="date"], input[type="time"]').count(), 0);
        assert.equal(await page.locator('.return-result .return-contact-list').getByText(/Ascendant|Rising|ASC/).count(), 0);
        await settle(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
        await page.screenshot({ path: resolve(out, `${driver.name}-${locale.replace('/', '') || 'en'}-${width}.png`), fullPage: true });
        record(`${driver.name} ${locale || 'en/'} ${width}: approved chart, sources, reference UTC, no angles, complete translations and responsive layout`);
        await context.close();
      }
      if (driver.name === 'chromium') {
        for (const locale of locales) {
          const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: localTls });
          await pageSetup(context, edition.day);
          let failed = true;
          await context.route('**/full.*.js', (route) => failed ? route.abort() : route.continue());
          const page = await context.newPage();
          await page.goto(`${base}/${locale}chart-of-the-day/${edition.day}/`);
          await page.getByRole('alert').waitFor();
          const messages = await page.evaluate(() => window.__ZDX_UI__.messages);
          assert((await page.getByRole('alert').innerText()).includes(messages.calculationLoadError));
          await page.getByRole('button', { name: messages.calculationRetry, exact: false }).waitFor();
          const reload = page.getByRole('button', { name: messages.calculationReload, exact: true });
          await reload.waitFor(); failed = false; await reload.click();
          await page.locator('[data-check-our-math]').waitFor({ timeout: 30000 });
          assert.equal(await page.getByRole('alert').count(), 0);
          record(`${locale || 'en/'}: failed engine download has translated retry and explicit reload recovery`);
          await context.close();
        }
        const next = new Date(`${edition.day}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); const nextDay = next.toISOString().slice(0, 10);
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: localTls });
        await pageSetup(context, nextDay); const page = await context.newPage();
        await page.goto(`${base}/chart-of-the-day/`); await page.locator('astro-island:not([ssr])').first().waitFor();
        // Yesterday stays featured, but labelled as the latest edition rather than today's.
        assert.match(await page.locator('.return-panel .btn').innerText(), /^Latest chart · /);
        assert.equal(await page.locator(`.return-panel a[href$="/${edition.day}/"]`).count(), 1);
        assert.equal((await page.goto(`${base}/chart-of-the-day/${nextDay}/`)).status(), 404);
        record('unapproved next day stays unpublished; the approved edition stays featured as the latest');
        await context.close();
      }
    } finally { await browser.close(); }
  }
}));
await writeFile(resolve(out, 'observations.json'), JSON.stringify(observations, null, 2));
