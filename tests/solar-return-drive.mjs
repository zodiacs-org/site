/** Solar Return acceptance checks, invoked by Explorer and usable standalone. */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;
const kahloBodies = [{ body: 'Sun', lon: 103.3755, retrograde: false }];
const place = { name: 'Mexico City', admin1: 'Ciudad de México', country: 'Mexico', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' };
const profile = {
  version: 1, settings: { houseSystem: 'whole' }, charts: [
    { id: 'kahlo-located', name: 'Frida — located', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', birth: { date: '1907-07-06', time: '08:30', timeKnown: true, place }, summary: { engineVersion: '1.0.0', utcISO: '1907-07-06T15:06:36Z', houseSystem: 'whole', bodies: kahloBodies, angles: null, flags: [] } },
    { id: 'kahlo-no-place', name: 'Frida — saved Sun only', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', birth: { date: '1907-07-06', time: null, timeKnown: false, place: null }, summary: { engineVersion: '1.0.0', utcISO: '1907-07-06T15:06:36Z', houseSystem: 'whole', bodies: kahloBodies, angles: null, flags: ['no-time'] } },
    { id: 'kahlo-no-place-known', name: 'Frida — timed saved Sun', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', birth: { date: '1907-07-06', time: '08:30', timeKnown: true, place: null }, summary: { engineVersion: '1.0.0', utcISO: '1907-07-06T15:06:36Z', houseSystem: 'whole', bodies: kahloBodies, angles: null, flags: [] } },
  ],
};

// The exact failed URL must explain every allowed error; an injected failure
// never excuses an unrelated console argument, request or unhandled exception.
export function isExpectedSolarError(entry, failedUrls) {
  return (entry.argumentCount === 0 && failedUrls.has(entry.url)
    && entry.text === 'Failed to load resource: net::ERR_FAILED')
    || (entry.argumentCount === 1 && entry.errors.length === 1
      && entry.errors[0].name === 'ModuleLoadError'
      && entry.errors[0].message === 'Calculation module unavailable'
      && [...failedUrls].some((url) => entry.errors[0].cause === `Failed to fetch dynamically imported module: ${url}`));
}

function observeErrors(context) {
  const failedUrls = new Set();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const pending = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const entry = { text: message.text().trim(), url: message.location().url, argumentCount: message.args().length, errors: [] };
      consoleErrors.push(entry);
      pending.push(Promise.all(message.args().map((arg) => arg.evaluate((value) => value instanceof Error ? {
        name: value.name, message: value.message,
        cause: value.cause instanceof Error ? value.cause.message : null,
      } : null).catch(() => null))).then((errors) => { entry.errors = errors.filter(Boolean); }));
    });
  });
  return {
    failRequest(url) { failedUrls.add(url); },
    async verify(check, label) {
      await Promise.all(pending);
      const unexpectedConsole = consoleErrors.filter((entry) => !isExpectedSolarError(entry, failedUrls));
      const unexpectedRequests = requestFailures.filter((entry) => !failedUrls.has(entry.url) || entry.error !== 'net::ERR_FAILED');
      check(`Solar ${label}: no unhandled exceptions or unexpected console/request failures`,
        pageErrors.length === 0 && unexpectedConsole.length === 0 && unexpectedRequests.length === 0,
        JSON.stringify({ pageErrors, unexpectedConsole, unexpectedRequests }));
    },
  };
}

async function seedContext(context) {
  await context.addInitScript((seed) => {
    // Initial about:blank documents have no storage origin; seed real pages only.
    if (location.origin === 'null') return;
    localStorage.setItem('zodiacs.profile.v1', JSON.stringify(seed));
    window.__srEvents = [];
    window.__srShareCalls = [];
    window.__srShareMode = 'shared';
    window.__srEncodeFailures = 0;
    window.__srCardTexts = [];
    window.zodiacsAnalytics = Object.freeze({ track(name, props) { window.__srEvents.push({ name, props }); } });
    // Observe a real prepared file without opening an external native share sheet.
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => window.__srShareMode !== 'unsupported' });
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (payload) => {
      const call = { active: navigator.userActivation.isActive, keys: Object.keys(payload), name: payload.files[0].name, type: payload.files[0].type };
      window.__srShareCalls.push(call);
      call.sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await payload.files[0].arrayBuffer()))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (window.__srShareMode === 'cancelled') throw new DOMException('Cancelled', 'AbortError');
    } });
    // Fail PNG encoding once while retaining the genuine renderer and modules.
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      if (this.width === 1080 && this.height === 1350 && window.__srEncodeFailures > 0) {
        window.__srEncodeFailures -= 1;
        queueMicrotask(() => callback(null));
        return;
      }
      return toBlob.call(this, callback, ...args);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) {
        window.__srCardTexts.push(String(text));
      }
      return maxWidth === undefined ? fillText.call(this, text, x, y) : fillText.call(this, text, x, y, maxWidth);
    };
  }, profile);
}

async function openReturn(page, baseURL) {
  const response = await page.goto(`${baseURL}/solar-return/`, { waitUntil: 'networkidle' });
  if (response?.status() !== 200) throw new Error('Solar Return did not return HTTP 200');
  await page.waitForFunction(() => document.querySelector('#sr-source')?.value === 'kahlo-located');
  await page.locator('#sr-year-mode').selectOption('custom');
  await page.getByLabel('Custom return year').fill('2024');
}

async function cast(page) {
  await page.evaluate(() => { window.__srCardTexts = []; });
  await page.getByRole('button', { name: 'Cast solar return', exact: true }).click();
  await page.locator('[data-solar-return-result]').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false'
    && document.activeElement?.id === 'solar-return-reading-title');
}

async function imageReady(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sr-exports] button')].some((button) => button.textContent === 'Save image' && !button.disabled), null, { timeout: TIMEOUT });
}

async function receiveDownload(page, label, outDir, artifact) {
  const event = page.waitForEvent('download', { timeout: TIMEOUT });
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await event;
  const bytes = await readFile(await download.path());
  if (outDir) await download.saveAs(`${outDir}/${artifact}`);
  return { name: download.suggestedFilename(), bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function calendarFields(bytes) {
  return Object.fromEntries(bytes.toString('utf8').replace(/\r\n[ \t]/g, '').split('\r\n').map((line) => {
    const colon = line.indexOf(':');
    return [line.slice(0, colon), line.slice(colon + 1)];
  }));
}

async function checkCalendar(page, check, outDir, slug, approximate) {
  const file = await receiveDownload(page, 'Add to calendar', outDir, `${slug}.ics`);
  const fields = calendarFields(file.bytes);
  const receipt = await page.locator('[data-return-instant]').textContent();
  const utc = receipt.match(/UTC · (\d{4}-\d\d-\d\d) · (\d\d:\d\d:\d\d)/);
  const shown = utc ? Date.parse(`${utc[1]}T${utc[2]}Z`) : Number.NaN;
  // The calendar marks the return to the whole minute, found from the birth
  // instant's whole minute: within a minute of the page's own return.
  const marked = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)00Z$/.exec(fields.DTSTART ?? '');
  const markedMs = marked ? Date.UTC(+marked[1], +marked[2] - 1, +marked[3], +marked[4], +marked[5]) : Number.NaN;
  const text = file.bytes.toString('utf8');
  check(`Solar ${slug}: calendar marks the displayed return to the whole minute with honest uncertainty`,
    file.name === `zodiacs-${approximate ? 'approximate-' : ''}solar-return-2024.ics`
    && Math.abs(markedMs - shown) <= 60_000 && fields.DURATION === 'PT1M' && fields.TRANSP === 'TRANSPARENT'
    && fields.SUMMARY === `${approximate ? 'Approximate solar return' : 'Solar return'} · 2024`
    && fields.DESCRIPTION.includes('for display only')
    && fields.DESCRIPTION.includes('shift by hours') === approximate
    && !/Frida|1907-07-06|Mexico City|LOCATION:|BEGIN:VALARM|RRULE:/.test(text));
  return { file, fields };
}

async function checkImage(page, check, outDir, slug, approximate) {
  await imageReady(page);
  const file = await receiveDownload(page, 'Save image', outDir, `${slug}.png`);
  const png = PNG.sync.read(file.bytes);
  const painted = (await page.evaluate(() => window.__srCardTexts)).join(' ');
  const reading = await page.locator('[data-sr-corpus]').allTextContents();
  check(`Solar ${slug}: genuine portrait PNG retains the full reading and privacy qualification`,
    file.name === `zodiacs-${approximate ? 'approximate-' : ''}solar-return-2024.png`
    && png.width === 1080 && png.height === 1350
    && painted.includes(`${approximate ? 'Approximate solar return' : 'Solar return'} · 2024`)
    && reading.every((line) => painted.includes(line))
    && painted.includes(`Engine ${ENGINE_VERSION}`) && painted.includes('zodiacs.org')
    && (await page.locator('[data-solar-return-result]').getAttribute('data-sr-no-place') !== 'true' || painted.includes('No stored birthplace is available, so this return is planets-only.'))
    && painted.includes('shift by hours') === approximate
    && !/Frida|1907-07-06|Mexico City|08:30/.test(painted), `${png.width}×${png.height}; ${file.sha256}`);
  return file;
}

async function captureResult(page, check, outDir, slug, widths = [1440, 390, 320]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const result = page.locator('[data-solar-return-result]');
    const geometry = await result.evaluate((node) => ({
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      resultFits: node.scrollWidth <= node.clientWidth + 1,
      controls: [...node.querySelectorAll('[data-sr-exports] button')].map((button) => {
        const box = button.getBoundingClientRect();
        return { height: box.height, left: box.left, right: box.right };
      }),
    }));
    check(`Solar ${slug} ${width}: result fits and export controls retain 44px targets`, geometry.pageFits && geometry.resultFits
      && geometry.controls.every((box) => box.height >= 43.5 && box.left >= 0 && box.right <= width), JSON.stringify(geometry));
    if (outDir) {
      await result.screenshot({ path: `${outDir}/${slug}-result-${width}.png`, animations: 'disabled' });
      await page.locator('[data-sr-exports]').screenshot({ path: `${outDir}/${slug}-actions-${width}.png`, animations: 'disabled' });
    }
  }
}

export async function runSolarReturnChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const mainErrors = observeErrors(context);
  await seedContext(context);
  const artifacts = [];
  const record = (slug, file) => artifacts.push({ slug, name: file.name, bytes: file.bytes.length, sha256: file.sha256 });
  try {
    const page = await context.newPage();
    const fetched = [];
    const requests = [];
    let downloads = 0;
    page.on('response', (response) => fetched.push(new URL(response.url()).pathname));
    page.on('request', (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() ?? '' }));
    page.on('download', () => { downloads += 1; });
    await openReturn(page, baseURL);
    check('Solar: engine, result, wheel and export modules remain lazy before calculation', !fetched.some((path) => /(?:full|SolarReturnResult|TransitRing|compute|share-card|solar-return-ical)\.[\w-]+\.js$/.test(path)));
    check('Solar: custom year retains the supported bounds', await page.getByLabel('Custom return year').getAttribute('min') === '1800' && await page.getByLabel('Custom return year').getAttribute('max') === '2200');
    await cast(page);
    const details = page.locator('[data-solar-return-result] [data-evidence-disclosure]');
    check('Solar: reading leads, exact data starts closed and result heading receives focus',
      await details.getAttribute('open') === null
      && await page.evaluate(() => {
        const reading = document.querySelector('[data-sr-corpus]');
        const disclosure = document.querySelector('[data-evidence-disclosure]');
        return document.activeElement?.id === 'solar-return-reading-title'
          && Boolean(reading && disclosure && (reading.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING));
      }));
    await details.locator('summary').click();
    check('Solar: fixed 2024 located fixture retains authored ASC and Sun-house readings',
      await page.locator('[data-sr-corpus="asc"]').textContent() === 'The year leads with depth — shared resources, real intimacy, and at least one honest reckoning. What survives this year was built to.'
      && await page.locator('[data-sr-corpus="sun-house"]').textContent() === "A horizon year — study, travel, publishing, belief under revision. Distance clarifies what proximity couldn't."
      && (await page.locator('[data-sr-reading-basis]').textContent()).includes('Ascendant 21°55′ Scorpio · Sun in house 9'));
    const bodies = await page.locator('.calc__table tbody td:first-child').allTextContents();
    check('Solar: located wheel, houses and both node placements remain available', await page.locator('.wheel').count() === 1 && await page.getByRole('columnheader', { name: 'House', includeHidden: true }).count() === 1 && bodies.includes('North Node') && bodies.includes('South Node'));
    check('Solar: one completed result emits one page view', await page.evaluate(() => window.__srEvents.filter((event) => event.name === 'srchart_view' && event.props.via === 'page').length) === 1);
    const knownImage = await checkImage(page, check, outDir, 'known-2024', false);
    record('known', knownImage);
    const knownCalendar = await checkCalendar(page, check, outDir, 'known-2024', false);
    record('known-calendar', knownCalendar.file);
    await details.locator('summary').click();
    await captureResult(page, check, outDir, 'known');

    await page.getByRole('button', { name: 'Share image', exact: true }).click();
    await page.getByText('Image shared.', { exact: true }).waitFor();
    const shared = await page.evaluate(() => window.__srShareCalls[0]);
    check('Solar: native share uses the prepared file with live user activation and no URL or birth payload', shared.active && shared.keys.join(',') === 'files' && shared.sha256 === knownImage.sha256 && shared.type === 'image/png');
    const beforeCancel = downloads;
    await page.evaluate(() => { window.__srShareMode = 'cancelled'; });
    await page.getByRole('button', { name: 'Share image', exact: true }).click();
    await page.waitForFunction(() => window.__srShareCalls.length === 2 && window.__srShareCalls[1].sha256 && [...document.querySelectorAll('[data-sr-exports] button')].some((button) => button.textContent === 'Share image' && !button.disabled));
    check('Solar: native cancellation stays neutral without a fallback download', downloads === beforeCancel && await page.locator('[data-sr-image-error], [data-sr-image-message]').count() === 0);
    await page.evaluate(() => { window.__srShareMode = 'unsupported'; });
    const fallback = await receiveDownload(page, 'Share image', outDir, 'known-share-fallback.png');
    check('Solar: unsupported native sharing downloads the same prepared PNG', fallback.sha256 === knownImage.sha256);
    record('native-fallback', fallback);

    const sun = Number(await page.locator('[data-solar-return-result]').getAttribute('data-sr-sun'));
    const asc = Number(await page.locator('[data-solar-return-result]').getAttribute('data-sr-asc'));
    await page.getByLabel('Cast for a different place').check();
    check('Solar: editing relocation immediately removes stale result and exports', await page.locator('[data-solar-return-result], [data-sr-exports]').count() === 0);
    await page.getByLabel('Return location').fill('London');
    await page.locator('#sr-cast-place-list button').first().click({ timeout: 15_000 });
    await cast(page);
    const relocatedImage = await checkImage(page, check, outDir, 'relocated-2024', false);
    const relocatedCalendar = await checkCalendar(page, check, outDir, 'relocated-2024', false);
    check('Solar: relocation rebuilds the image while preserving the solar instant and calendar identity',
      Number(await page.locator('[data-solar-return-result]').getAttribute('data-sr-asc')) !== asc
      && Math.abs(Number(await page.locator('[data-solar-return-result]').getAttribute('data-sr-sun')) - sun) < 1e-10
      && relocatedImage.sha256 !== knownImage.sha256
      && relocatedCalendar.fields.DTSTART === knownCalendar.fields.DTSTART && relocatedCalendar.fields.UID === knownCalendar.fields.UID);
    record('relocated', relocatedImage); record('relocated-calendar', relocatedCalendar.file);
    await captureResult(page, check, outDir, 'relocated', [390]);

    await page.locator('#sr-source').selectOption('kahlo-no-place-known');
    await cast(page);
    check('Solar: known time without birthplace remains planets-only without a noon claim', await page.locator('[data-noon-notice]').count() === 0 && await page.getByRole('columnheader', { name: 'House', includeHidden: true }).count() === 0 && await page.locator('[data-sr-corpus="planets-only"]').count() === 1);
    record('known-no-place', await checkImage(page, check, outDir, 'known-no-place-2024', false));
    record('known-no-place-calendar', (await checkCalendar(page, check, outDir, 'known-no-place-2024', false)).file);
    await captureResult(page, check, outDir, 'known-no-place', [390]);

    await page.locator('#sr-source').selectOption('kahlo-no-place');
    await page.evaluate(() => { window.__srEncodeFailures = 1; });
    await cast(page);
    await page.locator('[data-sr-image-error]').waitFor({ timeout: TIMEOUT });
    check('Solar: failed PNG encoding keeps the valid unknown-time wheel and calendar', await page.locator('.wheel').count() === 1
      && await page.getByRole('button', { name: 'Save image', exact: true }).isDisabled()
      && await page.getByRole('button', { name: 'Add to calendar', exact: true }).isEnabled()
      && await page.locator('[data-noon-notice]').textContent() === 'Computed from the sky at 12:00 UTC on your birth date — the return instant can shift by up to about a day with your exact birth time, and houses need it.'
      && await page.getByRole('columnheader', { name: 'House', includeHidden: true }).count() === 0);
    record('unknown-calendar', (await checkCalendar(page, check, outDir, 'unknown-2024', true)).file);
    if (outDir) await page.locator('[data-sr-exports]').screenshot({ path: `${outDir}/image-encode-failure-390.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Prepare image again', exact: true }).click();
    record('unknown-retried', await checkImage(page, check, outDir, 'unknown-2024', true));
    check('Solar: retry restores image actions without redoing the return', await page.locator('[data-sr-image-error]').count() === 0 && await page.locator('[data-solar-return-result]').getAttribute('data-sr-no-time') === 'true');
    await captureResult(page, check, outDir, 'unknown');

    await page.locator('#sr-source').selectOption('');
    await page.locator('#sr-date').fill('1907-07-06');
    await page.locator('#sr-time').fill('08:30');
    await page.locator('#sr-place').fill('Mexico City');
    await page.locator('#sr-place-list button').first().click({ timeout: 15_000 });
    check('Solar: manual birth fields become ready', await page.getByRole('button', { name: 'Cast solar return', exact: true }).isEnabled());
    await page.locator('#sr-source').selectOption('kahlo-no-place-known');
    await cast(page);
    check('Solar: saved no-place chart never reuses the manual birthplace', await page.locator('[data-solar-return-result]').getAttribute('data-sr-no-place') === 'true' && await page.getByRole('columnheader', { name: 'House', includeHidden: true }).count() === 0);
    await page.locator('#sr-source').selectOption('');
    await page.getByLabel("I don't know it").check();
    await cast(page);
    check('Solar: manual unknown time suppresses relocation, angles and houses', await page.getByLabel('Cast for a different place').count() === 0 && await page.locator('[data-noon-notice]').count() === 1 && await page.getByRole('columnheader', { name: 'House', includeHidden: true }).count() === 0);

    await page.locator('#sr-source').selectOption('kahlo-located');
    await cast(page);
    await page.evaluate(() => {
      const next = JSON.parse(localStorage.getItem('zodiacs.profile.v1'));
      next.charts[0].name = 'Renamed only';
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: next }));
    });
    await page.waitForFunction(() => document.querySelector('#sr-source option[value="kahlo-located"]')?.textContent.includes('Renamed only'));
    check('Solar: cosmetic saved-chart rename preserves the completed return', await page.locator('[data-solar-return-result]').count() === 1);
    await page.evaluate(() => {
      const next = JSON.parse(localStorage.getItem('zodiacs.profile.v1'));
      next.charts[0].birth.time = '09:30';
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: next }));
    });
    await page.locator('[data-solar-return-result]').waitFor({ state: 'detached' });
    check('Solar: saved birth edit clears the completed return and its exports', await page.locator('[data-sr-exports]').count() === 0);
    await cast(page);
    await page.evaluate(() => {
      const next = JSON.parse(localStorage.getItem('zodiacs.profile.v1'));
      next.charts = next.charts.filter((chart) => chart.id !== 'kahlo-located');
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('zodiacs:profile', { detail: next }));
    });
    await page.waitForFunction(() => document.querySelector('#sr-source')?.value === '' && !document.querySelector('[data-solar-return-result]'));
    check('Solar: deleting the selected saved chart returns to usable manual inputs', await page.locator('#sr-date').isVisible() && await page.locator('[data-sr-exports]').count() === 0);
    check('Solar: calculation and export traffic remains same-origin GET without birth payloads', requests.every((request) => new URL(request.url).origin === baseURL && request.method === 'GET' && !/1907-07-06|08%3A30|08:30/.test(`${request.url}${request.body}`)));
  } finally {
    try { await mainErrors.verify(check, 'main'); } finally { await context.close(); }
  }

  // A failed native import may remain cached. Test honest reload separately
  // from the recoverable PNG-encoding retry above.
  const failure = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const failureErrors = observeErrors(failure);
  await seedContext(failure);
  const imageModule = /\/_astro\/share-card\.[^/]+\.js$/;
  try {
    let blocked = 0;
    await failure.route(imageModule, async (route) => { blocked += 1; failureErrors.failRequest(route.request().url()); await route.abort('failed'); });
    const page = await failure.newPage();
    await openReturn(page, baseURL);
    await cast(page);
    await page.locator('[data-sr-image-error]').waitFor({ timeout: TIMEOUT });
    check('Solar: initial image-module failure retains a valid return and explicit reload warning', blocked > 0 && await page.locator('.wheel').count() === 1 && await page.getByRole('button', { name: 'Reload page', exact: true }).isVisible() && (await page.locator('[data-sr-exports]').textContent()).includes('Reloading clears unsaved entries.'));
    record('module-failure-calendar', (await checkCalendar(page, check, outDir, 'module-failure-2024', false)).file);
    if (outDir) await page.locator('[data-solar-return-result]').screenshot({ path: `${outDir}/image-module-failure-390.png`, animations: 'disabled' });
    await failure.unroute(imageModule);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.getByRole('button', { name: 'Reload page', exact: true }).click()]);
    await page.waitForFunction(() => document.querySelector('#sr-source')?.value === 'kahlo-located');
    await page.locator('#sr-year-mode').selectOption('custom');
    await page.getByLabel('Custom return year').fill('2024');
    await cast(page);
    await imageReady(page);
    check('Solar: explicit reload permits a fresh image preparation after native module failure', await page.locator('[data-sr-image-error]').count() === 0);
  } finally {
    try { await failureErrors.verify(check, 'image-module failure'); } finally { await failure.close(); }
  }

  const pending = await browser.newContext({ viewport: { width: 390, height: 1000 }, serviceWorkers: 'block' });
  const pendingErrors = observeErrors(pending);
  await seedContext(pending);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  try {
    const computeModule = /\/_astro\/compute\.[^/]+\.js$/;
    await pending.route(computeModule, async (route) => { await held; await route.continue(); });
    const page = await pending.newPage();
    await openReturn(page, baseURL);
    const computeRequested = page.waitForRequest((request) => computeModule.test(new URL(request.url()).pathname), { timeout: TIMEOUT });
    await page.getByRole('button', { name: 'Cast solar return', exact: true }).click();
    await computeRequested;
    await page.getByLabel('Custom return year').fill('2025');
    check('Solar: editing a pending calculation releases the form without exposing old exports', await page.getByRole('button', { name: 'Cast solar return', exact: true }).isEnabled() && await page.locator('[data-sr-exports]').count() === 0);
    release();
    await page.waitForLoadState('networkidle');
    check('Solar: the cancelled module completion does not publish the old result', await page.locator('[data-solar-return-result]').count() === 0);
    await cast(page);
    check('Solar: a fresh calculation uses the edited year after cancellation', await page.getByText('Your 2025 return', { exact: true }).count() === 1);
  } finally {
    release();
    try { await pendingErrors.verify(check, 'pending calculation'); } finally { await pending.close(); }
  }
  if (outDir) await writeFile(`${outDir}/export-receipt.json`, JSON.stringify({ scope: 'Real browser PNG/calendar downloads; native share intercepted locally; independent engine fixtures live separately.', artifacts }, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` · ${detail}` : ''}`); };
  await withPreview({ port: 4410 }, async (baseURL) => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? await findChromium(), args: STABLE_CHROMIUM_ARGS });
    try { await runSolarReturnChecks({ browser, baseURL, check, outDir: process.env.OUT_DIR ?? null }); }
    finally { await browser.close(); }
  });
  if (checks.some((item) => !item.ok)) process.exitCode = 1;
  else console.log(`ALL ${checks.length} CHECKS PASS`);
}
