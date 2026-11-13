/** Request-level recovery acceptance. Run only through the existing browser CI.
 * No calculation code is replaced and no production test hook is required. */
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';

const TIMEOUT = 30_000;
const LOAD_ERROR = 'The calculation files could not load. Check your connection and try again.';
const PLACE_ERROR = "Couldn't load the place index. Check your connection and try again.";
const RELOAD_WARNING = 'Reloading clears unsaved entries.';
const EMPTY_TRANSITS = 'No slow transits go exact in this window.';
const FULL_CHUNK = /\/_astro\/full\.[^/]+\.js$/;
const SCANNER_CHUNK = /\/_astro\/transit-scan\.[^/]+\.js$/;
const knownFragment = `#c=1.${Buffer.from(JSON.stringify({
  d: '1907-07-06', t: '08:30', z: 'America/Mexico_City',
  la: 19.35, lo: -99.16, p: 'Coyoacán, Mexico',
})).toString('base64url')}`;

async function hydrated(page) {
  await page.locator('.calc__form').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const form = document.querySelector('.calc__form');
    const island = form?.closest('astro-island');
    return island ? !island.hasAttribute('ssr') : Boolean(form);
  }, null, { timeout: TIMEOUT });
}

async function open(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (response?.status() !== 200) throw new Error(`Recovery fixture returned ${response?.status()}: ${url}`);
  await hydrated(page);
}

const commitFrames = (page) => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function withDeadline(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} did not arrive within ${TIMEOUT}ms`)), TIMEOUT);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

export function isExpectedInjectedError(entry, failedUrls) {
  const expectedNetworkError = entry.argumentCount === 0 && failedUrls.has(entry.url)
    && /^Failed to load resource: net::ERR_(FAILED|ABORTED)$/.test(entry.text);
  const expectedModuleError = entry.argumentCount === 1 && entry.errors.length === 1
    && entry.errors.every((error) => error.name === 'ModuleLoadError'
    && error.message === 'Calculation module unavailable'
    && [...failedUrls].some((url) => error.cause === `Failed to fetch dynamically imported module: ${url}`));
  return expectedNetworkError || expectedModuleError;
}

// Keep unexpected errors fatal. Only the exact requests deliberately aborted
// by this fixture, and their caught ModuleLoadError cause, are allowlisted.
function observeErrors(context) {
  const failedUrls = new Set();
  const pageErrors = [];
  const consoleErrors = [];
  const pending = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const entry = { text: message.text().trim(), url: message.location().url, argumentCount: message.args().length, errors: [] };
      consoleErrors.push(entry);
      pending.push(Promise.all(message.args().map((arg) => arg.evaluate((value) => (
        value instanceof Error ? {
          name: value.name, message: value.message,
          cause: value.cause instanceof Error ? value.cause.message : null,
        } : null
      )).catch(() => null))).then((errors) => { entry.errors = errors.filter(Boolean); }));
    });
  });
  return {
    failRequest(url) { failedUrls.add(url); },
    async verify(check, label) {
      await Promise.all(pending);
      const unexpected = consoleErrors.filter((entry) => !isExpectedInjectedError(entry, failedUrls));
      check(`recovery ${label}: no unhandled or unexpected console errors`,
        pageErrors.length === 0 && unexpected.length === 0,
        JSON.stringify({ pageErrors, unexpected }));
    },
  };
}

async function scenario({ browser, check }, label, options, run) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce',
    // Request fixtures must reach Playwright rather than a service-worker cache.
    serviceWorkers: 'block', ...options,
  });
  const errors = observeErrors(context);
  try {
    await run(context, errors);
  } finally {
    try {
      await errors.verify(check, label);
    } finally {
      await context.close();
    }
  }
}

async function screenshot(target, outDir, name) {
  if (outDir) await target.screenshot({ path: `${outDir}/${name}.png`, animations: 'disabled' });
}

async function chooseLondon(page, id = 'place') {
  await page.locator(`#${id}`).fill('London');
  const option = page.locator(`#${id}-list [role="option"]:not([aria-disabled="true"])`).first();
  await option.waitFor({ state: 'visible', timeout: TIMEOUT });
  if (!(await option.innerText()).startsWith('London')) throw new Error('Expected the real London city result');
  await option.click();
}

async function engineRecovery(args) {
  const { baseURL, check, outDir } = args;
  await scenario(args, 'engine', {}, async (context, errors) => {
    let aborted = 0;
    await context.route(FULL_CHUNK, async (route) => {
      errors.failRequest(route.request().url());
      aborted += 1;
      await route.abort('failed');
    });
    const page = await context.newPage();
    await open(page, `${baseURL}/birth-chart/${knownFragment}`);
    const alert = page.locator('.calc__form .calc__error[role="alert"]');
    await alert.waitFor({ state: 'visible', timeout: TIMEOUT });
    check('recovery engine: a rejected real ephemeris request produces an honest load error',
      aborted > 0 && (await alert.innerText()) === LOAD_ERROR
      && await page.locator('.calc__result').count() === 0);
    check('recovery engine: failure preserves all entered details and offers explicit reload',
      await page.locator('#birth-date').inputValue() === '1907-07-06'
      && await page.locator('#birth-time').inputValue() === '08:30'
      && (await page.locator('#place').inputValue()).includes('Coyoacán')
      && (await page.locator('.calc__form').innerText()).includes(RELOAD_WARNING)
      && await page.getByRole('button', { name: 'Reload page', exact: true }).isVisible());
    await screenshot(page.locator('.calc__form'), outDir, 'engine-failure-390');

    await context.unroute(FULL_CHUNK);
    await page.locator('.calc__submit').focus();
    await page.keyboard.press('Enter');
    await commitFrames(page);
    await page.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false'
      && (document.querySelector('.calc__result') || document.querySelector('.calc__form .calc__error')), null, { timeout: TIMEOUT });
    if (await page.locator('.calc__result').count() === 0) {
      // Chromium may cache the rejected native module even though the app
      // evicts its promise. Retry must stay honest and preserve the input.
      check('recovery engine: a retained native failure remains recoverable without losing input',
        (await alert.innerText()) === LOAD_ERROR
        && await page.locator('#birth-date').inputValue() === '1907-07-06');
      const reload = page.getByRole('button', { name: 'Reload page', exact: true });
      await reload.focus();
      await Promise.all([page.waitForEvent('load'), reload.press('Enter')]);
      await hydrated(page);
      await page.waitForLoadState('networkidle');
      check('recovery engine: explicit reload clears unsaved entries exactly as warned',
        await page.locator('#birth-date').inputValue() === '' && await page.locator('.calc__result').count() === 0);
      // The private handoff was consumed and removed from the URL. Re-enter it.
      await page.goto('about:blank');
      await open(page, `${baseURL}/birth-chart/${knownFragment}`);
    }
    await page.locator('.calc__result').waitFor({ state: 'visible', timeout: TIMEOUT });
    check('recovery engine: reconnection produces a real chart after keyboard recovery',
      await page.locator('.calc__three .three-card').count() === 3
      && await page.locator('.calc__form .calc__error').count() === 0);
    await page.waitForLoadState('networkidle');
    await screenshot(page.locator('.calc__three'), outDir, 'engine-recovered-390');
  });
}

async function cityRecovery(args, resource) {
  const { baseURL, check, outDir } = args;
  await scenario(args, `city-${resource}`, {}, async (context, errors) => {
    const pathname = resource === 'index' ? '/data/cities/index.json' : '/data/cities/l.json';
    const requestUrl = `${baseURL}${pathname}`;
    let aborted = 0;
    await context.route(requestUrl, async (route) => {
      errors.failRequest(route.request().url());
      aborted += 1;
      await route.abort('failed');
    });
    const page = await context.newPage();
    await open(page, `${baseURL}/birth-chart/`);
    await page.locator('#birth-date').fill('1990-01-01');
    await page.locator('#place').fill('London');
    const place = page.locator('.place').filter({ has: page.locator('#place') });
    await place.getByRole('alert').waitFor({ state: 'visible', timeout: TIMEOUT });
    check(`recovery city ${resource}: failed data is not presented as a successful empty search`,
      aborted > 0 && (await place.getByRole('alert').innerText()) === PLACE_ERROR
      && await page.locator('.place__empty').count() === 0
      && await page.locator('#place').inputValue() === 'London');
    await screenshot(place, outDir, `city-${resource}-failure-390`);

    await context.unroute(requestUrl);
    await place.getByRole('button', { name: 'Try again', exact: true }).focus();
    await page.keyboard.press('Enter');
    const first = page.locator('#place-list [role="option"]:not([aria-disabled="true"])').first();
    await first.waitFor({ state: 'visible', timeout: TIMEOUT });
    check(`recovery city ${resource}: keyboard retry reuses the same query and restores real options`,
      await page.locator('#place').inputValue() === 'London'
      && (await first.innerText()).startsWith('London')
      && await page.locator('#place').evaluate((node) => document.activeElement === node)
      && await page.locator('#birth-date').inputValue() === '1990-01-01');
    await page.locator('#place').press('Enter');
    check(`recovery city ${resource}: the recovered result is selectable`,
      await page.locator('#place').getAttribute('readonly') !== null
      && (await page.locator('#place').inputValue()).startsWith('London'));
    if (resource === 'shard') {
      await page.locator('.place__clear').click();
      await page.locator('#place').fill('Londonzzzzunlisted');
      await page.locator('.place__empty').waitFor({ state: 'visible', timeout: TIMEOUT });
      check('recovery city: a genuinely empty successful query uses the no-results guidance',
        (await page.locator('.place__empty').innerText()).startsWith('Not listed?')
        && await page.locator('.place__error').count() === 0);
    }
    await page.waitForLoadState('networkidle');
  });
}

// A real HTTP response reaches fetch(), then stalls in response.json(). This
// exercises the production 15-second deadline without replacing fetch/timers.
async function partialJsonServer() {
  const responses = new Set();
  let beganAt = 0;
  let disconnected = false;
  const server = createServer((_request, response) => {
    responses.add(response);
    response.on('close', () => { responses.delete(response); disconnected = true; });
    response.writeHead(200, {
      'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store', Connection: 'close',
    });
    response.write('{"tz":');
    beganAt = Date.now();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}/index.json`,
    startedAt: () => beganAt,
    disconnected: () => disconnected,
    async close() {
      responses.forEach((response) => response.destroy());
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function cityBodyTimeout(args) {
  const { baseURL, check, outDir } = args;
  const stalled = await partialJsonServer();
  try {
    await scenario(args, 'city-body-timeout', {}, async (context, errors) => {
      const indexUrl = `${baseURL}/data/cities/index.json`;
      let routed = 0;
      errors.failRequest(indexUrl);
      errors.failRequest(stalled.url);
      await context.route(indexUrl, async (route) => {
        routed += 1;
        await route.continue({ url: stalled.url });
      });
      const page = await context.newPage();
      await open(page, `${baseURL}/birth-chart/`);
      await page.locator('#place').fill('London');
      const place = page.locator('.place').filter({ has: page.locator('#place') });
      await place.getByRole('status').waitFor({ state: 'visible', timeout: TIMEOUT });
      await place.getByRole('alert').waitFor({ state: 'visible', timeout: TIMEOUT });
      const elapsedMs = Date.now() - stalled.startedAt();
      check('recovery city deadline: a partial response body times out instead of remaining busy',
        routed > 0 && stalled.startedAt() > 0 && elapsedMs >= 14_000 && elapsedMs <= 22_000
        && (await place.getByRole('alert').innerText()) === PLACE_ERROR
        && await place.getByRole('status').count() === 0
        && await page.locator('.place__empty').count() === 0,
        JSON.stringify({ elapsedMs, deadlineMs: 15_000 }));
      await screenshot(place, outDir, 'city-body-timeout-390');
      await context.unroute(indexUrl);
      await place.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.locator('#place-list [role="option"]:not([aria-disabled="true"])').first()
        .waitFor({ state: 'visible', timeout: TIMEOUT });
      check('recovery city deadline: the same query recovers after the aborted body is evicted',
        await page.locator('#place').inputValue() === 'London'
        && (await page.locator('#place-list').innerText()).startsWith('London')
        && stalled.disconnected());
      await page.waitForLoadState('networkidle');
    });
  } finally {
    await stalled.close();
  }
}

async function fillTransits(page) {
  await page.locator('#trans-date').fill('1907-07-06');
  await page.locator('#trans-time').fill('08:30');
  await chooseLondon(page, 'trans-place');
  await page.locator('.calc__submit').click();
  await page.locator('.tring__wheelbox svg').waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function transitScanRecovery(args) {
  const { baseURL, check, outDir } = args;
  await scenario(args, 'transit-scan', { viewport: { width: 1440, height: 1000 } }, async (context, errors) => {
    let release;
    const decision = new Promise((resolve) => { release = resolve; });
    let intercepted;
    const requested = new Promise((resolve) => { intercepted = resolve; });
    await context.route(SCANNER_CHUNK, async (route) => {
      errors.failRequest(route.request().url());
      intercepted();
      await decision;
      await route.abort('failed');
    });
    try {
      const page = await context.newPage();
      await open(page, `${baseURL}/transits/`);
      await fillTransits(page);
      await withDeadline(requested, 'The controlled transit scanner request');
      const initialWheel = await page.locator('.tring__wheelbox').innerHTML();
      check('recovery transit: the valid sky ring is usable while the independent dates scan loads',
        await page.locator('.tring__scan[role="status"]').isVisible()
        && !(await page.locator('.tring').innerText()).includes(EMPTY_TRANSITS));
      release();
      const alert = page.locator('.tring__scan [role="alert"]');
      await alert.waitFor({ state: 'visible', timeout: TIMEOUT });
      check('recovery transit: a failed scanner request retains the ring and never claims an empty window',
        (await alert.innerText()) === LOAD_ERROR
        && await page.locator('.tring__wheelbox').innerHTML() === initialWheel
        && !(await page.locator('.tring').innerText()).includes(EMPTY_TRANSITS)
        && await page.locator('.calc__form .calc__error').count() === 0);
      const beforeInstant = await page.locator('[data-ring-instant]').getAttribute('data-ring-instant');
      await page.locator('#tring-date').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction((before) => document.querySelector('[data-ring-instant]')?.getAttribute('data-ring-instant') !== before, beforeInstant);
      const movedInstant = await page.locator('[data-ring-instant]').getAttribute('data-ring-instant');
      check('recovery transit: the retained ring still responds to its keyboard date control', movedInstant !== beforeInstant);
      await screenshot(page.locator('.tring'), outDir, 'transit-scan-failure-1440');
      await context.unroute(SCANNER_CHUNK);
      await page.locator('.tring__scan').getByRole('button', { name: 'Try again', exact: true }).focus();
      await page.keyboard.press('Enter');
      await commitFrames(page);
      await page.waitForFunction(() => document.querySelector('[data-transit-mark]')
        || document.querySelector('.tring__scan [role="alert"]'), null, { timeout: TIMEOUT });
      check('recovery transit: retry preserves the ring date and returns focus to its native range',
        await page.locator('[data-ring-instant]').getAttribute('data-ring-instant') === movedInstant
        && await page.locator('#tring-date').evaluate((node) => document.activeElement === node));
      if (await alert.count()) {
        check('recovery transit: retained native rejection offers explicit warned reload',
          (await alert.innerText()) === LOAD_ERROR
          && (await page.locator('.tring__scan').innerText()).includes(RELOAD_WARNING));
        const reload = page.locator('.tring__scan').getByRole('button', { name: 'Reload page', exact: true });
        await reload.focus();
        await Promise.all([page.waitForEvent('load'), reload.press('Enter')]);
        await hydrated(page);
        await page.waitForLoadState('networkidle');
        check('recovery transit: explicit reload clears the unsaved chart as warned',
          await page.locator('.tring').count() === 0 && await page.locator('#trans-date').inputValue() === '');
        await fillTransits(page);
      }
      await page.locator('[data-transit-mark]').first().waitFor({ state: 'visible', timeout: TIMEOUT });
      check('recovery transit: restored real scanner produces exact-date markers and removes the error',
        await page.locator('.tring__wheelbox svg').isVisible() && await alert.count() === 0);
      await page.waitForLoadState('networkidle');
      await screenshot(page.locator('.tring'), outDir, 'transit-scan-recovered-1440');
      // Successful [] is covered by slow-transit-scan.test.ts. A public ring has
      // a fixed two-year window and a full natal chart; this fixture never swaps
      // in fake astronomy code to manufacture an empty result.
    } finally {
      release();
    }
  });
}

async function resultArrivalMotion(args, reducedMotion) {
  const { baseURL, check } = args;
  await scenario(args, `result-arrival-${reducedMotion}`, { reducedMotion }, async (context) => {
    await context.addInitScript(() => {
      const original = Element.prototype.scrollIntoView;
      globalThis.__recoveryArrivalScrolls = [];
      Element.prototype.scrollIntoView = function (options) {
        const call = this.matches('.calc__result') ? {
          behavior: options?.behavior, before: scrollY,
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        } : null;
        const returned = original.apply(this, arguments);
        if (call) {
          // Measure at the native call itself. Sampling only after a Node
          // round trip could miss a glide that completed before observation.
          call.after = scrollY;
          call.samples = [scrollY];
          globalThis.__recoveryArrivalScrolls.push(call);
          const sample = () => {
            call.samples.push(scrollY);
            if (call.samples.length < 4) requestAnimationFrame(sample);
            else call.complete = true;
          };
          requestAnimationFrame(sample);
        }
        return returned;
      };
    });
    const page = await context.newPage();
    await open(page, `${baseURL}/birth-chart/${knownFragment}`);
    await page.waitForFunction(() => globalThis.__recoveryArrivalScrolls.some((call) => call.complete), null, { timeout: TIMEOUT });
    const calls = await page.evaluate(() => globalThis.__recoveryArrivalScrolls);
    const reduced = reducedMotion === 'reduce';
    check(`recovery result arrival: native scroll honors ${reducedMotion}`,
      calls.every((call) => call.behavior === (reduced ? 'auto' : 'smooth') && call.reduced === reduced), JSON.stringify(calls));
    if (reduced) {
      const { before, after, samples } = calls[0];
      check('recovery reduced motion: actual result-arrival scroll settles without an animated glide',
        after > before + 20 && samples.length === 4 && Math.max(...samples) - Math.min(...samples) <= 1,
        JSON.stringify({ before, after, samples }));
    }
    await page.waitForLoadState('networkidle');
  });
}

export async function runRecoveryBrowserChecks({ browser, baseURL, check, outDir }) {
  const recoveryDir = outDir ? `${outDir}/recovery` : null;
  if (recoveryDir) await mkdir(recoveryDir, { recursive: true });
  const args = { browser, baseURL, check, outDir: recoveryDir };
  await engineRecovery(args);
  await cityRecovery(args, 'index');
  await cityRecovery(args, 'shard');
  await cityBodyTimeout(args);
  await transitScanRecovery(args);
  await resultArrivalMotion(args, 'reduce');
  await resultArrivalMotion(args, 'no-preference');
}
