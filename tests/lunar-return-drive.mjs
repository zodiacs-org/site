/** Lunar return browser acceptance; root integrates the awaited Explorer call. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

const TIMEOUT = 45_000;
const REFERENCE = '2026-03-01T00:00:00.000Z';
const place = { name: 'Synthetic UTC input', admin1: '', country: '', lat: 0, lon: 0, tz: 'Etc/UTC' };
const saved = (id, birth) => ({ id, name: `Private ${id}`, createdAt: REFERENCE, updatedAt: REFERENCE,
  birth, summary: { engineVersion: 'stale-test-cache', utcISO: '1990-02-01T12:00:00Z', houseSystem: 'placidus', bodies: [], angles: null, flags: [] } });
const profile = { version: 1, settings: { houseSystem: 'placidus' }, charts: [
  saved('timed', { date: '1990-02-01', time: '12:00', timeKnown: true, place }),
  saved('unknown', { date: '1990-02-01', time: null, timeKnown: false, place }),
  saved('no-place', { date: '1990-02-01', time: '12:00', timeKnown: true, place: null }),
  saved('fold', { date: '2025-11-02', time: '01:30', timeKnown: true, place: { ...place, tz: 'America/New_York' } }),
] };

export function isExpectedLunarError(entry, failedUrls) {
  return entry.argumentCount === 0 && failedUrls.has(entry.url)
    && entry.text === 'Failed to load resource: net::ERR_FAILED';
}
export function lunarTextGeometryFits(boxes, width = 1080, height = 1350) {
  if (!boxes.length) return false;
  if (!boxes.every((b) => [b.left, b.right, b.top, b.bottom].every(Number.isFinite)
    && b.left >= 0 && b.top >= 0 && b.right <= width && b.bottom <= height && b.right > b.left && b.bottom > b.top)) return false;
  return !boxes.some((a, i) => boxes.slice(i + 1).some((b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5));
}
function observe(context) {
  const failed = new Set(); const pageErrors = []; const consoles = []; const requests = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoles.push({ text: message.text().trim(), url: message.location().url, argumentCount: message.args().length }); });
    page.on('requestfailed', (request) => requests.push({ url: request.url(), error: request.failure()?.errorText }));
  });
  return { failed, verify(check, label) {
    const unexpectedConsole = consoles.filter((row) => !isExpectedLunarError(row, failed));
    const unexpectedRequests = requests.filter((row) => !failed.has(row.url) || row.error !== 'net::ERR_FAILED');
    check(`Lunar ${label}: no unexpected page, console or request errors`, !pageErrors.length && !unexpectedConsole.length && !unexpectedRequests.length,
      JSON.stringify({ pageErrors, unexpectedConsole, unexpectedRequests }));
  } };
}
async function seed(context) {
  await context.addInitScript((input) => {
    // Initial about:blank documents have no storage origin; seed real pages only.
    if (location.origin === 'null') return;
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(input));
    window.__lrText = []; window.__lrShare = []; window.__lrShareMode = 'shared'; window.__lrEncodeFailures = 0; window.__lrRevoked = [];
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = (url) => { window.__lrRevoked.push(url); return revoke.call(URL, url); };
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(value, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350 && String(value).trim()) {
        const m = this.measureText(String(value)); const matrix = this.getTransform();
        const pts = [[x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent], [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]]
          .map(([px, py]) => new DOMPoint(px, py).matrixTransform(matrix));
        window.__lrText.push({ text: String(value), left: pts[0].x, top: pts[0].y, right: pts[1].x, bottom: pts[1].y });
      }
      return maxWidth === undefined ? fill.call(this, value, x, y) : fill.call(this, value, x, y, maxWidth);
    };
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      if (this.width === 1080 && this.height === 1350 && window.__lrEncodeFailures > 0) { window.__lrEncodeFailures--; queueMicrotask(() => callback(null)); return; }
      return encode.call(this, callback, ...args);
    };
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => window.__lrShareMode !== 'unsupported' });
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (payload) => {
      const row = { active: navigator.userActivation.isActive, keys: Object.keys(payload), name: payload.files[0].name };
      window.__lrShare.push(row);
      row.sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await payload.files[0].arrayBuffer()))].map((n) => n.toString(16).padStart(2, '0')).join('');
      if (window.__lrShareMode === 'cancelled') throw new DOMException('Cancelled', 'AbortError');
    } });
  }, profile);
}
async function open(page, baseURL) {
  await page.clock.setFixedTime(new Date(REFERENCE));
  const response = await page.goto(`${baseURL}/lunar-return/`, { waitUntil: 'networkidle' });
  if (response?.status() !== 200) throw new Error('Lunar return route did not return HTTP 200');
  await page.waitForFunction(() => document.querySelector('#lr-source')?.value === 'timed');
}
async function cast(page) {
  await page.locator('[data-lunar-return-calculator] button[type="submit"]').click();
  await page.locator('[data-lunar-return-result]').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => document.activeElement?.id === 'lunar-return-reading-title');
  // Finish the real wheel image requests before the next deliberate form edit.
  await page.waitForLoadState('networkidle');
}
async function prepare(page) {
  await page.evaluate(() => { window.__lrText = []; });
  await page.locator('[data-lr-create-image]').click();
  await page.locator('[data-lr-image]').waitFor({ state: 'visible', timeout: TIMEOUT });
}
async function download(page, marker, outDir, name) {
  const pending = page.waitForEvent('download', { timeout: TIMEOUT }); await page.locator(marker).click();
  const file = await pending; const bytes = await readFile(await file.path());
  if (outDir) await file.saveAs(`${outDir}/${name}`);
  return { name: file.suggestedFilename(), bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const fields = (bytes) => Object.fromEntries(bytes.toString('utf8').replace(/\r\n[ \t]/g, '').split('\r\n').map((line) => { const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1)]; }));
async function geometry(page, check, outDir, slug) {
  const box = await page.locator('[data-lunar-return-calculator]').evaluate((node) => ({ pageFits: document.documentElement.scrollWidth <= innerWidth,
    resultFits: node.scrollWidth <= node.clientWidth + 1, controls: [...node.querySelectorAll('button:not([disabled]),select,input:not([type=checkbox]):not([disabled])')].filter((n) => n.getClientRects().length).map((n) => { const r = n.getBoundingClientRect(); return { height: r.height, left: r.left, right: r.right }; }) }));
  check(`Lunar ${slug}: no horizontal overflow and 44px controls`, box.pageFits && box.resultFits && box.controls.every((r) => r.height >= 43.5 && r.left >= 0 && r.right <= page.viewportSize().width + 0.5), JSON.stringify(box));
  if (outDir) await page.locator('[data-lunar-return-calculator]').screenshot({ path: `${outDir}/${slug}.png`, animations: 'disabled' });
}

async function inspectToggleTargets(page, check, width) {
  const controls = page.locator('[data-lunar-return-calculator] input[type="checkbox"]');
  const observed = [];
  for (const control of await controls.all()) {
    if (!await control.isVisible()) continue;
    // Both native controls are wrapped by their real clickable labels. Check
    // the association, then measure/hit-test that label rather than its glyph.
    await control.locator('..').evaluate(label => label.scrollIntoView({ block: 'center', behavior: 'instant' }));
    observed.push(await control.evaluate(input => {
      const label = input.labels?.[0];
      if (!label) return { associated: false };
      const r = label.getBoundingClientRect();
      const points = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [r.left + r.width / 2, r.top + r.height / 2]];
      return { associated: label.control === input, label: label.textContent.trim(), width: r.width, height: r.height,
        hit: points.every(([x, y]) => {
          const target = document.elementFromPoint(x, y);
          return x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight
            && Boolean(target && (target === label || label.contains(target)));
        }) };
    }));
  }
  check(`Lunar ${width}: both checkbox labels have associated 44px corner-to-corner click targets`, observed.length === 2
    && observed.every(row => row.associated && row.width >= 44 && row.height >= 44 && row.hit), JSON.stringify(observed));
}

export async function runLunarReturnChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const artifacts = []; const moduleUrls = {};
  const record = (slug, file) => artifacts.push({ slug, name: file.name, bytes: file.bytes.length, sha256: file.sha256 });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = observe(context); await seed(context);
    try {
      const page = await context.newPage(); const responses = []; const pendingReads = [];
      page.on('response', (response) => {
        responses.push(response.url());
        if (/\/_astro\/[^/?]+\.js$/.test(response.url())) pendingReads.push(response.text().then((text) => {
          if (text.includes('A known birth time is needed.')) moduleUrls.compute = response.url();
          if (text.includes('lunar_canvas_unavailable')) moduleUrls.image = response.url();
        }).catch(() => {}));
      });
      await open(page, baseURL);
      const discovery = await page.evaluate(() => ({
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        nodes: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
          const data = JSON.parse(script.textContent); return data['@graph'] ?? [data];
        }),
      }));
      const sitemap = await page.request.get(`${baseURL}/sitemap.xml`);
      const sitemapText = await sitemap.text();
      const lunarEntries = (sitemapText.match(/<url>[\s\S]*?<\/url>/g) ?? [])
        .filter((entry) => entry.includes('<loc>https://zodiacs.org/lunar-return/</loc>'));
      check(`Lunar ${width}: public tool has a canonical, WebApplication graph and dated sitemap entry`,
        discovery.canonical === 'https://zodiacs.org/lunar-return/'
        && discovery.nodes.filter((node) => node['@type'] === 'WebApplication').length === 1
        && sitemap.ok() && lunarEntries.length === 1
        && lunarEntries[0].includes('<lastmod>2026-09-06</lastmod>'));
      check(`Lunar ${width}: calculation and image modules wait for a request`, !responses.some((url) => /(?:LunarReturnResult|lunar-return-card|TransitRing|compute)\.[\w-]+\.js$/.test(url)));
      await geometry(page, check, outDir, `input-${width}`); await cast(page);
      const result = page.locator('[data-lunar-return-result]'); const instant = await result.getAttribute('data-lr-instant');
      check(`Lunar ${width}: strict next result retains the ordinary captured clock`, await result.getAttribute('data-lr-reference') === REFERENCE
        && Date.parse(instant) > Date.parse(REFERENCE) && Date.parse(instant) <= Date.parse(REFERENCE) + 40 * 86400000);
      const detail = page.locator('[data-lunar-return-result] [data-evidence-disclosure]');
      check(`Lunar ${width}: result heading receives focus and details start closed`, await detail.getAttribute('open') === null);
      await geometry(page, check, outDir, `result-${width}`);
      await detail.locator('summary').focus(); await page.keyboard.press('Enter');
      check(`Lunar ${width}: native Enter opens the placements and reading basis`, await detail.getAttribute('open') !== null
        && await detail.getByRole('rowheader', { name: 'Moon', exact: true }).count() === 1);
      if (outDir) await detail.screenshot({ path: `${outDir}/details-${width}.png`, animations: 'disabled' });
      const calendar = await download(page, '[data-lr-calendar]', outDir, `return-${width}.ics`); record(`calendar-${width}`, calendar);
      const cal = fields(calendar.bytes); const calText = calendar.bytes.toString('utf8');
      // The calendar and the image give the return to the whole minute (the next one if the nearest would not follow the reference).
      const nearest = Math.round(Date.parse(instant) / 60000) * 60000;
      const shown = new Date(nearest <= Date.parse(REFERENCE) ? nearest + 60000 : nearest).toISOString();
      check(`Lunar ${width}: real calendar marks the displayed return to the whole minute, after the reference, with a private identity`, cal.DTSTART === shown.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        && cal.UID === `lunar-return-${shown.slice(0, 16).replace(/[-:]/g, '')}Z@zodiacs.org` && cal.DURATION === 'PT1M' && cal.TRANSP === 'TRANSPARENT'
        && cal.DESCRIPTION.includes(REFERENCE) && cal.DESCRIPTION.includes(shown) && cal.DESCRIPTION.includes('for display only')
        && !/Private|1990-02-01|Synthetic|LOCATION:|VALARM|RRULE/.test(calText));
      await prepare(page); const image = await download(page, '[data-lr-download]', outDir, `return-${width}.png`); record(`image-${width}`, image);
      const png = PNG.sync.read(image.bytes); const ink = await page.evaluate(() => window.__lrText); const text = ink.map((r) => r.text).join(' ');
      // Placidus houses, and the house they put the Moon in, are left out of the image.
      const reading = await page.locator('[data-lr-reading]:not([data-lr-reading="moon-house"])').allTextContents();
      check(`Lunar ${width}: actual PNG contains matching clocks, reading, branding and unclipped text`, png.width === 1080 && png.height === 1350
        && text.includes('Lunar return') && text.includes(`Return: ${shown.slice(0, 16).replace('T', ' ')} UTC`)
        && text.includes(`Next after: ${REFERENCE.slice(0, 16).replace('T', ' ')} UTC`) && text.includes('zodiacs.org')
        && text.includes('Placidus houses are left out of this image.') && reading.every((line) => text.includes(line)) && lunarTextGeometryFits(ink) && !/Private|1990-02-01|Synthetic/.test(text), JSON.stringify({ sha256: image.sha256, ink }));
      await page.locator('[data-lr-share]').focus(); await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__lrShare[0]?.sha256);
      const share = await page.evaluate(() => window.__lrShare[0]);
      check(`Lunar ${width}: native share tap has active files-only matching PNG`, share.active && JSON.stringify(share.keys) === '["files"]' && share.sha256 === image.sha256);
      await page.evaluate(() => { window.__lrShareMode = 'cancelled'; }); await page.locator('[data-lr-share]').click();
      await page.waitForFunction(() => !document.querySelector('[data-lr-share]')?.disabled);
      check(`Lunar ${width}: cancellation retains the image without reporting a successful share`, await page.locator('[data-lr-image]').count() === 1 && (await page.locator('[data-lr-image-status]').textContent()).trim() === '');
      await page.evaluate(() => { window.__lrShareMode = 'unsupported'; });
      const fallback = await download(page, '[data-lr-share]', outDir, `fallback-${width}.png`); record(`fallback-${width}`, fallback);
      check(`Lunar ${width}: unsupported sharing downloads the same prepared file`, fallback.sha256 === image.sha256);
      const preview = await page.locator('[data-lr-image]').getAttribute('src'); await page.locator('[data-lr-close-image]').click();
      check(`Lunar ${width}: closing revokes preview and returns focus`, await page.evaluate((url) => window.__lrRevoked.includes(url) && document.activeElement?.hasAttribute('data-lr-create-image'), preview));
      await page.keyboard.press('Tab');
      check(`Lunar ${width}: native Tab reaches the independent calendar action`, await page.evaluate(() => document.activeElement?.hasAttribute('data-lr-calendar')));
      await page.getByLabel('Cast for a different place', { exact: false }).check();
      check(`Lunar ${width}: relocation edit immediately removes old results and exports`, await page.locator('[data-lunar-return-result],[data-lr-exports]').count() === 0);
      await page.locator('#lr-cast-place').fill('London'); await page.getByRole('option', { name: /London/ }).first().click(); await cast(page);
      check(`Lunar ${width}: relocation preserves geocentric instant`, await result.getAttribute('data-lr-instant') === instant);
      const relocated = await download(page, '[data-lr-calendar]', outDir, `relocated-${width}.ics`); record(`relocated-calendar-${width}`, relocated);
      check(`Lunar ${width}: relocation preserves stable calendar UID`, fields(relocated.bytes).UID === cal.UID);
      await geometry(page, check, outDir, `relocated-${width}`);
      for (const id of ['unknown', 'no-place']) {
        await page.locator('#lr-source').selectOption(id);
        check(`Lunar ${width} ${id}: incomplete saved birth cannot compute or export`, await page.locator('[data-lr-incomplete]').isVisible()
          && await page.locator('button[type=submit]').isDisabled() && await page.locator('[data-lunar-return-result],[data-lr-exports]').count() === 0);
        await geometry(page, check, outDir, `${id}-${width}`);
      }
      await page.locator('#lr-source').selectOption('fold'); await page.locator('button[type=submit]').click();
      await page.getByRole('alert').filter({ hasText: 'skipped or repeated' }).waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
      check(`Lunar ${width}: ambiguous IANA time focuses its explanation with no result`, await page.evaluate(() => document.activeElement?.getAttribute('role') === 'alert') && await result.count() === 0);
      await page.locator('#lr-source').selectOption('timed'); await cast(page);
      await page.evaluate(() => { window.__lrEncodeFailures = 1; }); await page.locator('[data-lr-create-image]').click();
      await page.locator('[data-lr-image-error]').waitFor({ state: 'visible', timeout: TIMEOUT });
      check(`Lunar ${width}: encoding failure retains return, reading and calendar`, await result.count() === 1 && await page.locator('[data-lr-calendar]').isEnabled());
      await prepare(page); await geometry(page, check, outDir, `image-recovery-${width}`);
      const visibleImage = await page.locator('[data-lr-image]').getAttribute('src');
      await page.locator('#lr-source').selectOption('');
      check(`Lunar ${width}: switching to manual input revokes the old prepared image`, await page.evaluate((url) => window.__lrRevoked.includes(url), visibleImage)
        && await page.locator('[data-lr-image],[data-lunar-return-result]').count() === 0);
      await page.locator('#lr-date').fill('1990-02-01'); await page.locator('#lr-time').fill('12:00');
      await page.locator('#lr-place').fill('London'); await page.getByRole('option', { name: /London/ }).first().click();
      await inspectToggleTargets(page, check, width);
      const unknownTime = page.locator('[data-lunar-return-calculator] .field__labelrow input[type="checkbox"]');
      await unknownTime.focus(); await page.keyboard.press('Space');
      check(`Lunar ${width}: native unknown-time toggle disables calculation and exposes its explanation`,
        await unknownTime.isChecked() && await page.locator('#lr-time').isDisabled()
        && await page.locator('button[type=submit]').isDisabled() && await page.locator('[data-lr-incomplete]').isVisible());
      await page.keyboard.press('Space');
      await cast(page);
      check(`Lunar ${width}: equivalent ordinary manual input selects the same return`, await result.getAttribute('data-lr-instant') === instant);
      await page.locator('[data-lr-create-image]').scrollIntoViewIfNeeded();
      check(`Lunar ${width}: Guide does not obstruct the image action`, await page.locator('[data-lr-create-image]').evaluate((button) => {
        const r = button.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return Boolean(hit && (hit === button || button.contains(hit)));
      }));
      if (width === 390) { await page.setViewportSize({ width: 320, height: 1000 }); await geometry(page, check, outDir, 'wrap-320'); }
      await Promise.all(pendingReads); errors.verify(check, String(width));
    } finally { await context.close(); }
  }
  // Discover the actual requested module URLs above, then fail only those
  // exact assets in fresh contexts; no result or ephemeris is substituted.
  for (const kind of ['compute', 'image']) {
    check(`Lunar: discovered actual ${kind} module for bounded failure`, Boolean(moduleUrls[kind]));
    if (!moduleUrls[kind]) continue;
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = observe(context); await seed(context);
    try {
      let rejected = false;
      await context.route(moduleUrls[kind], (route) => { if (!rejected) { rejected = true; errors.failed.add(route.request().url()); return route.abort('failed'); } return route.continue(); });
      const page = await context.newPage(); await open(page, baseURL);
      if (kind === 'image') { await cast(page); await page.locator('[data-lr-create-image]').click(); }
      else await page.locator('button[type=submit]').click();
      await page.getByRole('alert').first().waitFor({ state: 'visible', timeout: TIMEOUT });
      check(`Lunar ${kind}: failed module releases busy controls and retains birth selection`, rejected && await page.locator('#lr-source').inputValue() === 'timed'
        && await page.locator('button[type=submit]').isEnabled() && (kind !== 'image' || await page.locator('[data-lunar-return-result]').count() === 1));
      if (outDir) await page.locator('[data-lunar-return-calculator]').screenshot({ path: `${outDir}/${kind}-module-failure-390.png`, animations: 'disabled' });
      // A failed browser module may remain cached; the existing reload control
      // explicitly warns that unsaved details will be lost. The fixture's saved input survives.
      const reload = page.getByRole('button', { name: 'Reload page', exact: true });
      check(`Lunar ${kind}: existing reload recovery is available`, await reload.count() === 1);
      await reload.click(); await page.waitForFunction(() => document.querySelector('#lr-source')?.value === 'timed');
      await cast(page); if (kind === 'image') await prepare(page);
      await geometry(page, check, outDir, `${kind}-module-recovery-390`); errors.verify(check, `${kind}-recovery`);
    } finally { await context.close(); }
  }
  if (outDir) await writeFile(`${outDir}/lunar-receipt.json`, JSON.stringify({ referenceUtc: REFERENCE, scope: 'Genuine calculations and downloaded files; native API observation is not an OS share-sheet or screen-reader session.', artifacts, moduleUrls }, null, 2) + '\n');
}
