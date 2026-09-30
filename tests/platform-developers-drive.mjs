import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const source = await readFile(new URL('../src/lib/sky-api/examples/today.mjs', import.meta.url), 'utf8');
const starter = JSON.parse(await readFile(new URL('../public/examples/platform-starter.json', import.meta.url), 'utf8'));
const engine = JSON.parse(await readFile(new URL('../src/data/platform-engine-candidate.json', import.meta.url), 'utf8'));
const output = resolve(process.env.PLATFORM_BROWSER_EVIDENCE ?? 'tests/visual/artifacts/platform');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
const checks = [];
try {
  await withPreview({ port: 4335 }, async (baseURL) => {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(`${baseURL}/developers/`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      const paths = page.getByRole('navigation', { name: 'Developer integration paths', exact: true });
      // The six cards, in the order the hub presents them. The order is the
      // point: an earlier version led with sky data and a hosted API that did
      // not exist yet, so a first-time reader met the two things they could not
      // use before the two they could. The two ways to calculate a chart come
      // first, in your own process and then on our server; the conformance
      // suite, which is for people writing an engine rather than using one,
      // comes last.
      const cards = [
        ['Calculate a chart', '/developers/engine/'],
        ['Calculate on our server', '/developers/compute/'],
        ['Embed a tool', '/widgets/'],
        ['Connect an AI assistant', '/developers/mcp/'],
        ['Compare two calculation records', '/developers/compare/'],
        ['Check an engine against independent references', '/developers/conformance/'],
      ];
      for (const [name, href] of cards) {
        assert.equal(await paths.getByRole('link', { name, exact: true }).getAttribute('href'), href);
      }
      assert.deepEqual(
        await paths.locator('li h2 a').evaluateAll((links) => links.map((link) => link.textContent.trim())),
        cards.map(([name]) => name),
        'the cards must stay in the order a first-time reader can act on',
      );
      // Shared sky data is named below the cards.
      assert.equal(await page.getByRole('link', { name: 'shared sky data', exact: true })
        .getAttribute('href'), '#sky-data');
      await page.screenshot({ path: resolve(output, `developer-entry-${width}.png`) });
      const terminal = page.getByRole('region', { name: 'Terminal quick start', exact: true });
      const code = page.getByRole('region', { name: 'JavaScript quick start', exact: true });
      assert.equal(await code.locator('code').textContent(), source, 'displayed example must be the executed source');
      // Both scrollers, in the order they appear. This assertion was written
      // when the JavaScript block was the first thing after the prose link; a
      // later commit put the terminal block in front of it and the single Tab
      // stopped landing where the assertion said, a week before the cards were
      // reordered. Tabbing through both is what it meant to check, and it does
      // not silently pass if a third scroller appears between them.
      await page.getByRole('link', { name: 'chart calculation stays on the device', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await terminal.evaluate((element) => element === document.activeElement), true,
        'Tab must reach the first code scroller');
      await page.keyboard.press('Tab');
      assert.equal(await code.evaluate((element) => element === document.activeElement), true,
        'a second Tab must reach the JavaScript code scroller');
      if (width <= 390) {
        // The focused scroller, which is the JavaScript one — `.dev-code` alone
        // picks the terminal block above it and would wait for a scroll that
        // never happens there.
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() =>
          document.querySelector('[aria-label="JavaScript quick start"]').scrollLeft > 0);
      }
      const layout = await code.evaluate((element) => ({
        viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
        codeWidth: element.clientWidth, codeScrollWidth: element.scrollWidth, codeScrollLeft: element.scrollLeft,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        overlay: !!document.querySelector('astro-error-overlay'),
      }));
      assert.equal(layout.pageWidth, width, 'code must not overflow the page');
      assert.equal(layout.reducedMotion, true);
      assert.equal(layout.overlay, false);
      assert.deepEqual(errors, []);
      await code.evaluate((element) => { element.scrollLeft = 0; });
      await page.screenshot({ path: resolve(output, `developers-${width}.png`) });
      checks.push({ width, sourceMatches: true, keyboardFocus: true, ...layout, pageErrors: errors });

      await page.getByRole('link', { name: 'the support matrix', exact: true }).click();
      await page.waitForURL('**/developers/support/');
      await page.waitForLoadState('networkidle');
      const matrix = page.getByRole('region', { name: 'Local engine support matrix', exact: true });
      assert.equal(await matrix.locator('tbody tr').count(), 11);
      assert.equal(await matrix.locator('caption').textContent(), `Local engine ${engine.version}`);
      assert.ok((await matrix.getByRole('row', { name: /Portable natal records/ }).textContent()).includes('does not authenticate imported claims'));
      assert.equal(await page.getByRole('link', { name: 'current candidate API guide', exact: true }).getAttribute('href'), `${engine.sourceRepository}/blob/${engine.sourceCommit}/${engine.sourcePackagePath ? `${engine.sourcePackagePath}/` : ''}README.md`);
      assert.equal(await page.getByRole('link', { name: 'archived rc.1 API reference', exact: true }).getAttribute('href'), '/sdk/engine/');
      assert.equal(await page.locator('footer.zfooter').count(), 1);
      assert.equal(await page.locator('#hosted').textContent(), 'Hosted computation · available');
      await page.getByRole('link', { name: 'archived rc.1 API reference', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await matrix.evaluate((element) => element === document.activeElement), true);
      assert.equal(await matrix.evaluate((element) => {
        const style = getComputedStyle(element);
        return element.matches(':focus-visible') && style.outlineStyle !== 'none'
          && Number.parseFloat(style.outlineWidth) >= 2;
      }), true);
      for (const zoom of width === 1280 ? [1, 2] : [1]) {
        // CSS zoom exercises enlarged text and layout reflow. This is explicitly
        // recorded as CSS zoom, not a claim about native browser zoom controls.
        await page.evaluate((value) => { document.documentElement.style.zoom = String(value); }, zoom);
        const supportLayout = await page.evaluate(() => ({
          width: innerWidth, pageWidth: document.documentElement.scrollWidth,
          zoom: getComputedStyle(document.documentElement).zoom,
          overflow: document.documentElement.scrollWidth > innerWidth,
          overlay: !!document.querySelector('astro-error-overlay'),
        }));
        assert.equal(supportLayout.overflow, false, `support matrix must reflow at ${width}px / CSS zoom ${zoom}`);
        assert.equal(supportLayout.overlay, false);
        assert.deepEqual(errors, []);
        await matrix.scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(output, `developer-support-${width}-zoom${zoom}.png`) });
        checks.push({ route: '/developers/support/', cssZoom: zoom, keyboardFocus: true,
          canonicalFooter: true, ...supportLayout, pageErrors: [...errors] });
      }
      await page.evaluate(() => { document.documentElement.style.zoom = ''; });
      await page.getByRole('link', { name: 'Run the starter project', exact: true }).click();
      await page.waitForURL('**/developers/examples/');
      await page.waitForLoadState('networkidle');
      const setup = page.getByRole('region', { name: 'Starter setup commands', exact: true });
      const commands = await setup.locator('code').textContent();
      const artifactUrl = `https://raw.githubusercontent.com/zodiacs-org/site/${starter.artifactCommit}/public/examples/${starter.file}`;
      assert.equal(await page.getByRole('link', { name: `Download starter ${starter.version} (.tgz)`, exact: true }).getAttribute('href'), artifactUrl);
      assert.ok(commands.includes(artifactUrl) && commands.includes(starter.sha256));
      assert.ok(commands.includes('npm ci --ignore-scripts --no-audit --no-fund'));
      assert.ok(commands.startsWith('( set -eu\n') && commands.endsWith('npm start\n)'));
      await page.getByRole('link', { name: `Download starter ${starter.version} (.tgz)`, exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await setup.evaluate((element) => element === document.activeElement && element.matches(':focus-visible')), true);
      if (width <= 390) {
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('pre').scrollLeft > 0);
      }
      assert.equal(await page.locator('footer.zfooter').count(), 1);
      for (const id of ['natal', 'transits', 'widget']) assert.equal(await page.locator(`h2#${id}`).count(), 1);
      assert.deepEqual(errors, []);
      await writeFile(resolve(output, 'starter-setup.sh'), commands + '\n');
      for (const zoom of width === 1280 ? [1, 2] : [1]) {
        await page.evaluate((value) => { document.documentElement.style.zoom = String(value); window.scrollTo(0, 0); }, zoom);
        const examplesLayout = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(examplesLayout.overflow, false);
        await page.screenshot({ path: resolve(output, `developer-examples-${width}-zoom${zoom}.png`) });
        checks.push({ route: '/developers/examples/', cssZoom: zoom, keyboardFocus: true, canonicalFooter: true, artifactUrl, ...examplesLayout, pageErrors: [...errors] });
      }
      await context.close();
    }
  });
  const report = { capturedAt: new Date().toISOString(), browser: browser.version(), result: 'passed', checks };
  await writeFile(resolve(output, 'developers-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
