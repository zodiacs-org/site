/** Real calculator integration; synthetic longitude graphs remain unit fixtures. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

const birth = { d: '1999-08-11', z: 'Etc/UTC', la: 51.5, lo: 0, t: '12:00' };
const fragment = (known = true) => `#c=1.${Buffer.from(JSON.stringify(known ? birth : { ...birth, t: undefined })).toString('base64url')}`;
const normalize = (s) => s.replace(/\s+/gu, ' ').trim();

export function inspectPatternInk(rows) {
  const clipped = rows.filter(r => ![r.left, r.right, r.top, r.bottom].every(Number.isFinite)
    || r.left < 32 || r.right > 1048 || r.top < 32 || r.bottom > 1325);
  const overlaps = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) overlaps.push([a.text, b.text]);
  }
  return { clipped, overlaps };
}

export function isExpectedPatternModuleError(entry, failedUrls) {
  return entry.argumentCount === 0 && failedUrls.has(entry.url)
    && entry.text === 'Failed to load resource: net::ERR_FAILED';
}

function observe(context) {
  const errors = [], consoleErrors = [], requests = [], failedUrls = new Set();
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push({ text: message.text().trim(), url: message.location().url, argumentCount: message.args().length });
    });
    page.on('requestfailed', request => requests.push({ url: request.url(), error: request.failure()?.errorText }));
  });
  return {
    failedUrls,
    verify(check, name) {
      const unexpectedConsole = consoleErrors.filter(e => !isExpectedPatternModuleError(e, failedUrls));
      const unexpectedRequests = requests.filter(r => !failedUrls.has(r.url) || r.error !== 'net::ERR_FAILED');
      check(`${name}: no unexpected console, request or page errors`, !errors.length && !unexpectedConsole.length && !unexpectedRequests.length,
        JSON.stringify({ errors, unexpectedConsole, unexpectedRequests }));
    },
  };
}

async function instrument(context) {
  await context.addInitScript(() => {
    window.__patternProbe = { ink: [], shares: [], revoked: [], shareOutcome: 'shared', failEncode: false };
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = function(url) { window.__patternProbe.revoked.push(url); return revoke.call(this, url); };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) {
        const ink = this.measureText(text), matrix = this.getTransform();
        const corners = [
          [x - ink.actualBoundingBoxLeft, y - ink.actualBoundingBoxAscent],
          [x + ink.actualBoundingBoxRight, y - ink.actualBoundingBoxAscent],
          [x - ink.actualBoundingBoxLeft, y + ink.actualBoundingBoxDescent],
          [x + ink.actualBoundingBoxRight, y + ink.actualBoundingBoxDescent],
        ].map(([a, b]) => matrix.transformPoint(new DOMPoint(a, b)));
        window.__patternProbe.ink.push({ text: String(text), left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
          top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) });
      }
      return fillText.call(this, text, x, y, ...rest);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      if (this.width === 1080 && this.height === 1350 && window.__patternProbe.failEncode) {
        window.__patternProbe.failEncode = false;
        queueMicrotask(() => callback(null));
        return;
      }
      return toBlob.call(this, callback, ...args);
    };
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => window.__patternProbe.shareOutcome !== 'unsupported' });
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async payload => {
      const file = payload.files[0];
      window.__patternProbe.shares.push({ active: navigator.userActivation.isActive, keys: Object.keys(payload), name: file.name, type: file.type });
      if (window.__patternProbe.shareOutcome === 'cancelled') throw new DOMException('Cancelled', 'AbortError');
    } });
  });
}

async function openNatal(page, baseURL, known = true, prefix = '') {
  await page.goto(`${baseURL}${prefix}/birth-chart/${fragment(known)}`, { waitUntil: 'networkidle' });
  await page.locator('.wheel--interactive').waitFor({ timeout: 30_000 });
}

async function inspectPanel(page, check, label, screenshot, measurements) {
  await page.evaluate(() => { window.__patternProbe.shareOutcome = 'shared'; });
  const feature = page.locator('[data-aspect-patterns]');
  await feature.locator(':scope > summary').click();
  await feature.locator('[data-pattern-panel]').waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  check(`${label}: ordinary calculated input exposes a complete grand cross`,
    await feature.locator('[data-pattern-title]').textContent() === 'Grand cross'
    && await feature.locator('[data-pattern-edge]').count() === 6
    && await feature.locator('[data-pattern-chord]').count() === 6);
  await feature.scrollIntoViewIfNeeded();
  check(`${label}: native controls retain44px targets and no horizontal overflow`, await feature.evaluate(node =>
    document.documentElement.scrollWidth <= innerWidth && node.scrollWidth <= node.clientWidth + 1
    && [...node.querySelectorAll('button, select, summary')].filter(el => el.getClientRects().length)
      .every(el => el.getBoundingClientRect().height >= 44)));
  const edge = feature.locator('[data-pattern-edge]').first();
  const key = await edge.getAttribute('data-pattern-edge');
  await edge.focus(); await page.keyboard.press('Enter');
  check(`${label}: native edge action selects its exact local chord and announces it`,
    await edge.getAttribute('aria-pressed') === 'true'
    && await feature.locator('[data-pattern-chord][data-selected="true"]').getAttribute('data-pattern-chord') === key
    && (await feature.locator('[data-pattern-announcement]').textContent()).includes('highlighted'));
  await feature.locator('[data-pattern-included] > summary').click();
  check(`${label}: all four contained T-squares remain available`, await feature.locator('[data-pattern-included] button').count() === 4);
  await screenshot(feature, `${label}-cross`);
  await feature.locator('[data-pattern-included] button').first().click();
  check(`${label}: included selection has three edges and returns focus to native selector`,
    await feature.locator('[data-pattern-title]').textContent() === 'T-square'
    && await feature.locator('[data-pattern-edge]').count() === 3
    && await feature.locator('[data-pattern-select]').evaluate(node => document.activeElement === node));
  const member = feature.locator('[data-pattern-body]').first(), body = await member.getAttribute('data-pattern-body');
  await member.focus(); await page.keyboard.press('Enter');
  const context = await feature.getAttribute('data-pattern-context');
  check(`${label}: native member action addresses the owning chart body`, context === 'natal'
    ? new URL(page.url()).searchParams.get('sel') === `body:${body}`
    : await page.locator(`[data-composite-point="${body}"]`).getAttribute('aria-pressed') === 'true');
  if (context === 'natal') {
    await page.locator('.insp__close').click();
    check(`${label}: detail panel closes before returning to the pattern`, !new URL(page.url()).searchParams.has('sel'));
  }
  await feature.scrollIntoViewIfNeeded();
  await screenshot(feature, `${label}-included`);

  const title = await feature.locator('[data-pattern-title]').textContent();
  const receipt = await feature.locator('[data-pattern-edge]').allTextContents();
  await page.evaluate(() => { window.__patternProbe.ink = []; });
  await feature.locator('[data-pattern-export]').click();
  await feature.locator('[data-pattern-image]').waitFor({ timeout: 20_000 });
  const pending = page.waitForEvent('download');
  await feature.locator('[data-pattern-download]').click();
  const download = await pending, path = await download.path();
  if (!path) throw new Error('Pattern download has no bytes');
  const bytes = await readFile(path), png = PNG.sync.read(bytes);
  let ink = 0;
  for (let i = 0; i < png.data.length; i += 16) if (Math.max(...png.data.subarray(i, i + 3)) > 95) ink++;
  const rows = await page.evaluate(() => window.__patternProbe.ink), text = normalize(rows.map(r => r.text).join(' '));
  const layout = inspectPatternInk(rows);
  check(`${label}: downloaded selected PNG is nonblank and carries the exact visible receipt`, png.width === 1080 && png.height === 1350
    && ink > 1000 && text.includes(title) && receipt.every(r => text.includes(normalize(r))), JSON.stringify({ width: png.width, height: png.height, ink }));
  check(`${label}: actual transformed canvas text fits without overlapping ink`, rows.length > 10 && !layout.clipped.length && !layout.overlaps.length, JSON.stringify(layout));
  check(`${label}: selected image omits birth data and source identifiers`, !['1999-08-11', '12:00', 'Etc/UTC', 'Pattern input A', 'Pattern input B'].some(s => text.includes(s)));
  await screenshot(feature, `${label}-image-ready`);
  await feature.locator('[data-pattern-share]').click();
  check(`${label}: prepared native sharing receives user activation and an image file`, await page.evaluate(() => {
    const call = window.__patternProbe.shares.at(-1);
    return call?.active && call.type === 'image/png' && call.keys.length === 1 && call.keys[0] === 'files';
  }));
  await page.evaluate(() => { window.__patternProbe.shareOutcome = 'cancelled'; });
  await feature.locator('[data-pattern-share]').click();
  check(`${label}: cancellation keeps the prepared image available`, await feature.locator('[data-pattern-image]').isVisible());
  await page.evaluate(() => { window.__patternProbe.shareOutcome = 'unsupported'; });
  const fallbackPending = page.waitForEvent('download');
  await feature.locator('[data-pattern-share]').click();
  const fallback = await fallbackPending, fallbackPath = await fallback.path();
  if (!fallbackPath) throw new Error('Pattern fallback download has no bytes');
  const fallbackHash = createHash('sha256').update(await readFile(fallbackPath)).digest('hex');
  check(`${label}: unsupported native sharing downloads the same prepared snapshot`, fallbackHash === createHash('sha256').update(bytes).digest('hex'));
  await feature.locator('[data-pattern-export-close]').click();
  check(`${label}: close returns focus and removes the prepared image`, await feature.locator('[data-pattern-export]').evaluate(n => document.activeElement === n)
    && await feature.locator('[data-pattern-image]').count() === 0);
  if (label === 'pattern-natal-390') {
    await feature.locator('[data-pattern-export]').click();
    await feature.locator('[data-pattern-image]').waitFor({ timeout: 20_000 });
    const priorUrl = await feature.locator('[data-pattern-image]').getAttribute('src');
    await feature.locator('[data-pattern-select]').selectOption({ index: 0 });
    check('pattern changed selection: prior preview and sharing controls are revoked',
      await feature.locator('[data-pattern-image], [data-pattern-share]').count() === 0
      && await page.evaluate(url => window.__patternProbe.revoked.includes(url), priorUrl));
  }
  measurements.push({ label, filename: download.suggestedFilename(), sha256: createHash('sha256').update(bytes).digest('hex'), receipt, text, layout, bytes });
}

export async function runAspectPatternBrowserChecks({ browser, baseURL, check, outDir }) {
  const measurements = [];
  if (outDir) await mkdir(outDir, { recursive: true });
  const screenshot = async (node, name) => { if (outDir) await node.screenshot({ path: `${outDir}/${name}.png`, animations: 'disabled' }); };
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const observation = observe(context);
    try {
      await instrument(context);
      const page = await context.newPage();
      await openNatal(page, baseURL);
      await inspectPanel(page, check, `pattern-natal-${width}`, screenshot, measurements);
      await page.goto('about:blank');
      await openNatal(page, baseURL, false);
      const feature = page.locator('[data-aspect-patterns]');
      await feature.locator(':scope > summary').click();
      await feature.locator('[data-pattern-panel]').waitFor();
      check(`pattern unknown${width}: reference geometry excludes Moon and withholds reading/export`,
        (await feature.locator('[data-pattern-scope]').textContent()).includes('Moon excluded')
        && await feature.locator('[data-pattern-body="Moon"]').count() === 0
        && await feature.locator('[data-pattern-reading], [data-pattern-export]').count() === 0
        && await feature.locator('[data-pattern-withheld]').count() === 1);
      await screenshot(feature, `pattern-unknown-${width}`);
      await page.goto('about:blank');
      await openNatal(page, baseURL, true, '/pt');
      check(`pattern PT${width}: English-only feature does not enter translated chrome`, await page.locator('[data-aspect-patterns]').count() === 0);

      // Real saved birth inputs force ordinary engine recomputation. No
      // constructed longitude graph is injected into a product surface.
      await page.evaluate(() => {
        const chart = (id, time, name) => ({ id, name, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
          birth: { date: '1999-08-11', time, timeKnown: true, place: { name: 'UTC reference location', admin1: '', country: '', lat: 51.5, lon: 0, tz: 'Etc/UTC' } },
          summary: { engineVersion: '0-stale', utcISO: '1999-08-11T12:00:00Z', houseSystem: 'whole', bodies: [], angles: null, flags: [] } });
        localStorage.setItem('zodiacs.profile.v1', JSON.stringify({ version: 1, settings: { houseSystem: 'whole' },
          charts: [chart('pattern-a', '12:00', 'Pattern input A'), chart('pattern-b', '12:01', 'Pattern input B')] }));
      });
      await page.goto(`${baseURL}/compatibility/`, { waitUntil: 'networkidle' });
      await page.locator('#syn-a-source').selectOption('pattern-a');
      await page.locator('#syn-b-source').selectOption('pattern-b');
      await page.locator('.calc__submit').click();
      await page.locator('[data-relationship-tab="composite"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-relationship-tab="composite"]').click();
      await inspectPanel(page, check, `pattern-composite-${width}`, screenshot, measurements);

      // Recompute from the same real birth inputs with one time now unknown.
      // Non-Moon geometry stays inspectable without granting timed reading/export.
      await page.evaluate(() => {
        const profile = JSON.parse(localStorage.getItem('zodiacs.profile.v1'));
        const chart = profile.charts.find(row => row.id === 'pattern-b');
        chart.birth.time = null; chart.birth.timeKnown = false;
        chart.summary.engineVersion = '0-stale'; chart.summary.bodies = []; chart.summary.angles = null;
        localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile));
      });
      await page.goto(`${baseURL}/compatibility/`, { waitUntil: 'networkidle' });
      await page.locator('#syn-a-source').selectOption('pattern-a');
      await page.locator('#syn-b-source').selectOption('pattern-b');
      await page.locator('.calc__submit').click();
      await page.locator('[data-relationship-tab="composite"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-relationship-tab="composite"]').click();
      const unknownComposite = page.locator('[data-aspect-patterns][data-pattern-context="composite"]');
      await unknownComposite.locator(':scope > summary').click();
      await unknownComposite.locator('[data-pattern-panel]').waitFor({ timeout: 15_000 });
      check(`pattern composite unknown${width}: original input certainty withholds Moon, reading and export`,
        await page.locator('[data-composite-provisional]').isVisible()
        && (await unknownComposite.locator('[data-pattern-scope]').textContent()).includes('one or both birth times unknown')
        && await unknownComposite.locator('[data-pattern-edge]').count() > 0
        && await unknownComposite.locator('[data-pattern-body="Moon"]').count() === 0
        && await unknownComposite.locator('[data-pattern-reading], [data-pattern-export]').count() === 0
        && await unknownComposite.locator('[data-pattern-withheld]').count() === 1);
      await screenshot(unknownComposite, `pattern-composite-unknown-${width}`);
      observation.verify(check, `patterns${width}`);
    } finally { await context.close(); }
  }
  const recovery = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recoveryObservation = observe(recovery);
  try {
    await instrument(recovery);
    const page = await recovery.newPage();
    const matcher = url => /^\/_astro\/AspectPatternPanel\.[^/]+\.js$/u.test(url.pathname);
    await page.route(matcher, route => { recoveryObservation.failedUrls.add(route.request().url()); return route.abort('failed'); });
    await openNatal(page, baseURL);
    const feature = page.locator('[data-aspect-patterns]');
    await feature.locator(':scope > summary').click();
    await feature.locator('[role="alert"]').waitFor({ timeout: 15_000 });
    check('pattern module failure: exact optional request fails while chart and warned retry/reload remain',
      recoveryObservation.failedUrls.size === 1 && await page.locator('.wheel--interactive').isVisible()
      && await feature.locator('[data-pattern-retry]').isEnabled()
      && await feature.getByRole('button', { name: 'Reload page', exact: true }).isVisible()
      && (await feature.textContent()).includes('Reloading clears unsaved entries.'));
    await screenshot(feature, 'pattern-module-failure');
    await page.unroute(matcher);
    await feature.locator('[data-pattern-retry]').click();
    await page.waitForFunction(() => document.querySelector('[data-pattern-panel]') || document.querySelector('[data-aspect-patterns] [role="alert"]'));
    if (!await feature.locator('[data-pattern-panel]').count()) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), feature.getByRole('button', { name: 'Reload page', exact: true }).click()]);
      check('pattern reload: warned unsaved input is cleared', await page.locator('.wheel--interactive').count() === 0 && await page.locator('#birth-date').inputValue() === '');
      await page.goto('about:blank');
      await openNatal(page, baseURL);
      await feature.locator(':scope > summary').click();
    }
    await feature.locator('[data-pattern-panel]').waitFor({ timeout: 15_000 });
    check('pattern module recovery: explicit retry or warned reload restores the genuine panel', await feature.locator('[data-pattern-title]').textContent() === 'Grand cross');
    // The reading images share the pattern card's 1080x1350 canvas and are now
    // prepared after the chart's entrance, so let them finish before the probe
    // fails the next encode; otherwise a reading image takes the failure.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-approach-share], [data-communication-share]')]
      .every((button) => button.getAttribute('data-card-state') !== 'preparing'), null, { timeout: 30_000 });
    await page.evaluate(() => { window.__patternProbe.failEncode = true; });
    await feature.locator('[data-pattern-export]').click();
    await feature.locator('[data-pattern-export-error]').waitFor({ timeout: 20_000 });
    check('pattern raster failure: chart and reading survive without a stale image',
      await page.locator('.wheel--interactive').isVisible() && await feature.locator('[data-pattern-reading]').isVisible()
      && await feature.locator('[data-pattern-image]').count() === 0);
    await screenshot(feature, 'pattern-raster-failure');
    await feature.locator('[data-pattern-export]').click();
    await feature.locator('[data-pattern-image]').waitFor({ timeout: 20_000 });
    const pending = page.waitForEvent('download');
    await feature.locator('[data-pattern-download]').click();
    const download = await pending, path = await download.path();
    if (!path) throw new Error('Recovered cross image has no bytes');
    const bytes = await readFile(path), png = PNG.sync.read(bytes);
    check('pattern raster retry: full six-edge grand cross produces a real PNG', png.width === 1080 && png.height === 1350
      && await feature.locator('[data-pattern-edge]').count() === 6);
    if (outDir) await writeFile(`${outDir}/pattern-recovered-cross-download.png`, bytes);
    await screenshot(feature, 'pattern-raster-recovered');
    recoveryObservation.verify(check, 'pattern recovery');
  } finally { await recovery.close(); }
  const compact = await browser.newContext({ viewport: { width: 320, height: 844 } });
  const compactObservation = observe(compact);
  try {
    const page = await compact.newPage(); await openNatal(page, baseURL);
    await page.locator('[data-aspect-patterns] > summary').click();
    await page.locator('[data-pattern-panel]').waitFor();
    check('pattern320: complete receipt wraps without horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshot(page.locator('[data-aspect-patterns]'), 'pattern-natal-320');
    compactObservation.verify(check, 'pattern320');
  } finally { await compact.close(); }
  if (outDir) {
    for (const row of measurements) await writeFile(`${outDir}/${row.label}-download.png`, row.bytes);
    await writeFile(`${outDir}/report.json`, JSON.stringify({ scope: 'Ordinary-input browser integration, not an independent ephemeris oracle; native share is instrumented, no OS sheet or screen-reader session.', measurements: measurements.map(({ bytes, ...row }) => row) }, null, 2));
  }
}
