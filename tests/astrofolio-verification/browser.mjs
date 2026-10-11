/**
 * Built-page acceptance, using the repository's existing Playwright harness.
 * Run: node tests/astrofolio-verification/browser.mjs
 * Optional: BASE_URL=https://an-authorized-preview.example (or ZODIACS_TEST_BASE_URL).
 * Protected preview: PREVIEW_STORAGE_STATE points to a private Playwright state file.
 * Select a bounded subset with SCENARIO=name or SCENARIOS=name,name.
 * Fixtures contain only published Registry identifiers and synthetic near misses.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../visual/browser.mjs';
import { projectRoot, withPreview } from '../visual/preview-server.mjs';

const REGISTRY_PATH = '/registry/zodiacs.registry.json';
const PAGE_PATH = '/registry/verify/';
const TIMEOUT = 12_000;
const normalize = (text) => String(text).replace(/\s+/gu, ' ').trim();

export function machineEvidence(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];
  const match = scripts.filter((entry) => /\bid=["']verification-evidence["']/u.test(entry[1]));
  assert.equal(match.length, 1, 'Exactly one page-scoped evidence record is rendered');
  assert.match(match[0][1], /\btype=["']application\/json["']/u);
  return JSON.parse(match[0][2]);
}

export function staticText(html) {
  return normalize(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '').replace(/<[^>]+>/gu, ' ')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/giu, (_, hex, decimal) => String.fromCodePoint(parseInt(hex ?? decimal, hex ? 16 : 10)))
    .replace(/&amp;/gu, '&').replace(/&quot;/gu, '"').replace(/&#39;|&apos;/gu, "'").replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&nbsp;/gu, ' '));
}

export function assertStaticFacts(html, registry) {
  const machine = machineEvidence(html);
  const expected = registry.assets.flatMap((asset) => asset.representations.map((representation) => representation.address));
  const rendered = [...html.matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/giu)]
    .filter((entry) => /\bdata-identifier(?:[\s=>]|$)/u.test(entry[1]))
    .map((entry) => staticText(entry[2]));
  assert.deepEqual(rendered.sort(), expected.toSorted(), 'All 24 static identifiers come exactly from the Registry');
  assert.equal(new Set(rendered).size, 24, 'No identifier was lost or duplicated');
  for (const address of expected) assert.ok(JSON.stringify(machine).includes(address), 'Machine view preserves every Registry identifier');
  assert.ok(Array.isArray(machine.claims) && machine.claims.length > 0, 'Machine claims are available without JavaScript');
  const ids = [...html.matchAll(/\bdata-claim-id=["']([^"']+)["']/gu)].map((entry) => entry[1]);
  assert.deepEqual(ids.toSorted(), machine.claims.map((claim) => claim.id).toSorted(), 'Visible and machine views contain the same claims');
  for (const claim of machine.claims) {
    const article = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/giu)]
      .find((entry) => entry[1].includes(`data-claim-id="${claim.id}"`));
    assert.ok(article, `Claim ${claim.id} has its own readable article`);
    const text = staticText(article[2]);
    assert.ok(article[1].includes(`data-claim-status="${claim.status}"`), `Visible status agrees for ${claim.id}`);
    assert.ok(text.includes(normalize(claim.statement)), `Static text preserves claim ${claim.id}`);
    for (const qualification of Array.isArray(claim.qualifications) ? claim.qualifications : [claim.qualifications].filter(Boolean)) {
      assert.ok(text.includes(normalize(qualification)), `Static text preserves qualification for ${claim.id}`);
    }
    for (const source of claim.sources) assert.ok(article[2].includes(source.url.replaceAll('&', '&amp;')), `Claim ${claim.id} exposes its cited source`);
    assert.ok(text.includes(normalize(claim.review.method)), `Claim ${claim.id} preserves review scope`);
    assert.ok(text.includes(claim.review.reviewedAt), `Claim ${claim.id} preserves the original review date`);
    if (claim.observedAt) assert.ok(text.includes(claim.observedAt), `Claim ${claim.id} preserves its observation date`);
  }
  assert.match(html, /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex)[^>]*>/iu, 'Bounded preview remains noindex');
  assert.match(html, /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/zodiacs\.org\/registry\/verify\/?["'])[^>]*>/iu);
  return machine;
}

async function state(page, expected) {
  await page.waitForFunction((wanted) => {
    const region = document.querySelector('#verify-result');
    return (region?.getAttribute('data-state') ?? region?.querySelector('[data-state]')?.getAttribute('data-state')) === wanted;
  }, expected, { timeout: TIMEOUT });
  assert.ok(await page.locator('#verify-result').isVisible(), `${expected} result is visible`);
}

async function currentState(page) {
  return page.locator('#verify-result').evaluate((region) => region.getAttribute('data-state') ?? region.querySelector('[data-state]')?.getAttribute('data-state'));
}

async function submit(page, network, address) {
  await page.locator('#verify-network').selectOption(network);
  await page.locator('#verify-address').fill(address);
  await page.locator('#verify-submit').click();
}

async function settledFrames(page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function expandRecords(page) {
  const summaries = page.locator('[data-asset] summary');
  for (let index = 0; index < await summaries.count(); index += 1) {
    const summary = summaries.nth(index);
    if (!(await summary.evaluate((element) => element.parentElement.open))) await summary.click();
  }
}

async function run(baseURL) {
  const rawRegistry = await readFile(resolve(projectRoot, 'public', REGISTRY_PATH.slice(1)), 'utf8');
  const registry = JSON.parse(rawRegistry);
  const native = registry.assets[0].native.address;
  const bridged = registry.assets[0].representations.find((record) => record.chain === 'base').address;
  const unknown = `${bridged.slice(0, -1)}${bridged.endsWith('1') ? '2' : '1'}`.toLowerCase();
  assert.ok(!registry.assets.flatMap((asset) => asset.representations).some((record) => record.address.toLowerCase() === unknown));
  const outDir = resolve(projectRoot, 'docs/astrofolio-trust/evidence');
  await mkdir(outDir, { recursive: true });
  let previewStorageState;
  if (process.env.PREVIEW_STORAGE_STATE) {
    try {
      previewStorageState = JSON.parse(await readFile(process.env.PREVIEW_STORAGE_STATE, 'utf8'));
      assert.ok(Array.isArray(previewStorageState.cookies) && Array.isArray(previewStorageState.origins));
    } catch {
      throw new Error('The private preview authorization state could not be read.');
    }
  }
  const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
  const results = [];
  const origin = new URL(baseURL).origin;
  const requestedScenarios = process.env.SCENARIOS ?? process.env.SCENARIO ?? process.env.ASTROFOLIO_SCENARIO;
  const selectedScenarios = requestedScenarios ? new Set(requestedScenarios.split(/[,\s]+/u).filter(Boolean)) : null;
  const previewRun = !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname);
  const capturePrefix = previewRun ? 'preview-' : '';
  const artifactHash = (text) => createHash('sha256').update(text).digest('hex');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const harnessSha256 = artifactHash(await readFile(fileURLToPath(import.meta.url)));
  let servedPageSha256;

  async function scenario(name, callback, options = {}) {
    if (selectedScenarios && !selectedScenarios.has(name)) return;
    let context;
    try {
      context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...(previewStorageState ? { storageState: previewStorageState } : {}), ...options });
    } catch (error) {
      // Playwright errors involving invalid storage state can include private
      // values. Never expose its path, cookies or tokens through diagnostics.
      if (previewStorageState) throw new Error('The protected preview browser context could not be initialized.');
      throw error;
    }
    const requests = [];
    const errors = [];
    const expectedFailures = new Set();
    const observedExpectedFailures = [];
    context.on('request', (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));
    context.on('page', (page) => {
      page.setDefaultTimeout(TIMEOUT);
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const entry = { text: message.text(), url: message.location().url };
        if (expectedFailures.has(entry.url) && /^Failed to load resource: net::ERR_(FAILED|ABORTED|INTERNET_DISCONNECTED)$/u.test(entry.text)) observedExpectedFailures.push(entry);
        else errors.push(entry);
      });
    });
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
    try {
      const page = await context.newPage();
      const open = async () => {
        const response = await page.goto(`${baseURL}${PAGE_PATH}`, { waitUntil: 'networkidle' });
        assert.equal(response?.status(), 200, 'Verification page responds successfully');
        servedPageSha256 ??= artifactHash(await response.body());
        assert.equal(await page.locator('h1').count(), 1);
        assert.match(normalize(await page.locator('h1').innerText()), /Astrofolio|Know what you[’']re looking at/iu);
        return response;
      };
      await callback({ context, page, open, requests, expectedFailures });
      assert.deepEqual(requests.filter((request) => new URL(request.url).origin !== origin), [], 'No third-party traffic');
      assert.deepEqual(errors, [], 'No unexpected browser errors');
      results.push({ scenario: name, status: 'passed', serviceWorkers: options.serviceWorkers ?? 'block', expectedNetworkFailures: observedExpectedFailures });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ scenario: name, status: 'failed', error: error.stack ?? String(error) });
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  try {
    for (const width of [1280, 390, 320]) await scenario(`layout-${width}`, async ({ page, open }) => {
      const response = await open();
      assertStaticFacts(await response.text(), registry);
      await page.screenshot({ path: resolve(outDir, `${capturePrefix}verification-${width}-hero.png`), animations: 'disabled' });
      await page.locator('.zfooter').scrollIntoViewIfNeeded();
      await settledFrames(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await settledFrames(page);
      await page.screenshot({ path: resolve(outDir, `${capturePrefix}verification-${width}.png`), fullPage: true, animations: 'disabled' });
      await expandRecords(page);
      assert.equal(await page.locator('[data-asset]').count(), 12);
      assert.equal(await page.locator('code[data-identifier]').count(), 24);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
      const clipped = await page.locator('code[data-identifier], .av-status, .av-claim-label h3, #verify-fields, .av-revision, .av-machine, .av-check-shell').evaluateAll((elements) => elements.filter((element) => {
        const box = element.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1;
      }).map((element) => ({ element: element.className, text: element.textContent?.slice(0, 60) })));
      assert.deepEqual(clipped, [], 'Material text and controls stay inside the viewport even when global overflow is clipped');
      const contrastFailures = await page.locator('.av-intro h1, .av-helper, #verify-fields label, .av-privacy, .av-status, code[data-identifier], .av-record-count').evaluateAll((elements) => {
        const rgba = (color) => {
          const parts = color.match(/[\d.]+/gu)?.map(Number) ?? [];
          if (parts.length < 3) throw new Error(`Unrecognized computed color: ${color}`);
          return [...parts.slice(0, 3), parts[3] ?? 1];
        };
        const composite = (top, bottom) => top.slice(0, 3).map((value, index) => value * top[3] + bottom[index] * (1 - top[3]));
        const luminance = (rgb) => rgb.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
          .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
        return elements.flatMap((element) => {
          const ancestors = [];
          for (let parent = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
          const background = ancestors.reduce((color, parent) => composite(rgba(getComputedStyle(parent).backgroundColor), color), [255, 255, 255]);
          const style = getComputedStyle(element);
          const foreground = composite(rgba(style.color), background);
          const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          const ratio = (light + .05) / (dark + .05);
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
          return ratio + .01 < (large ? 3 : 4.5) ? [{ text: element.textContent?.slice(0, 60), ratio, required: large ? 3 : 4.5 }] : [];
        });
      });
      assert.deepEqual(contrastFailures, [], 'Key text and evidence labels meet computed foreground/background contrast thresholds');
      assert.ok(await page.locator('#verify-submit').evaluate((button) => getComputedStyle(button).transitionDuration.split(',').every((duration) => parseFloat(duration) === 0)), 'Reduced motion removes the primary control transition');
      const controls = page.locator('#verify-network, #verify-address, #verify-submit, [data-copy-address]');
      for (let index = 0; index < await controls.count(); index += 1) {
        const control = controls.nth(index);
        const box = await control.boundingBox();
        assert.ok(box && box.height >= 44 && box.width >= 44, `Control ${index} has a 44px touch target`);
      }
      if (width === 390) await page.locator('.av-records').screenshot({ path: resolve(outDir, `${capturePrefix}verification-records-390.png`), animations: 'disabled' });
    }, { viewport: { width, height: 900 } });

    await scenario('keyboard-and-privacy', async ({ context, page, open, requests }) => {
      await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__verificationCopied = value; } } }));
      await open();
      await page.locator('#verify-network').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('#verify-address').evaluate((input) => document.activeElement === input));
      await page.keyboard.type(native);
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('#verify-submit').evaluate((button) => document.activeElement === button));
      assert.ok(await page.locator('#verify-submit').evaluate((button) => {
        const style = getComputedStyle(button);
        return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
      }), 'Keyboard focus has a visible outline or shadow');
      await page.keyboard.press('Enter');
      await state(page, 'match');
      assert.match(await page.locator('#verify-result').innerText(), /solana/iu);
      assert.ok((await page.locator('#verify-result').innerText()).includes(native));
      await expandRecords(page);
      const copy = page.locator('[data-copy-address]').first();
      await copy.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction((address) => window.__verificationCopied === address, native);
      const privateSurfaces = await page.evaluate(() => ({ url: location.href, local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie }));
      assert.ok(!JSON.stringify({ requests, privateSurfaces, cookies: await context.cookies() }).includes(native), 'Pasted identifier never enters requests, URL, cookies or storage');
      assert.ok(requests.some((request) => new URL(request.url).pathname === REGISTRY_PATH), 'Match actually fetched the published Registry');
      assert.deepEqual(requests.filter((request) => request.method !== 'GET'), [], 'Read-only page issues only GET requests');
    });

    await scenario('identity-results', async ({ page, open }) => {
      await open();
      await submit(page, 'base', bridged.toLowerCase());
      await state(page, 'match');
      assert.match(await page.locator('#verify-result').innerText(), /base/iu);
      await submit(page, 'base', native);
      await state(page, 'wrong-network');
      await submit(page, 'solana', bridged);
      await state(page, 'wrong-network');
      await submit(page, 'base', unknown);
      await state(page, 'not-found');
      assert.match(await page.locator('#verify-result').innerText(), /does not establish fraud or impersonation/iu);
      for (const malformed of ['ARIES', '<script>alert(1)</script>', `${native}\u200b`]) {
        await submit(page, 'solana', malformed);
        await state(page, 'malformed');
      }
    });

    await scenario('no-javascript-evidence', async ({ page, open }) => {
      await open();
      assertStaticFacts(await page.content(), registry);
      await expandRecords(page);
      assert.equal(await page.locator('code[data-identifier]:visible').count(), 24);
      const claims = page.locator('[data-claim-id]');
      assert.ok(await claims.count() > 0);
      for (let index = 0; index < await claims.count(); index += 1) assert.ok((await claims.nth(index).textContent()).trim().length > 50);
      assert.ok((await page.locator('.av-nojs').innerText()).length > 20, 'No-JavaScript visitors have useful guidance');
    }, { javaScriptEnabled: false });

    await scenario('source-failure-after-success-and-retry', async ({ context, page, open, expectedFailures }) => {
      await open();
      await submit(page, 'solana', native);
      await state(page, 'match');
      const fail = async (route) => { expectedFailures.add(route.request().url()); await route.abort('failed'); };
      await context.route(`**${REGISTRY_PATH}`, fail);
      await submit(page, 'solana', native);
      await state(page, 'source-error');
      assert.equal(await page.locator('#verify-address').inputValue(), native, 'Failure preserves the entered identifier');
      await context.unroute(`**${REGISTRY_PATH}`, fail);
      await submit(page, 'solana', native);
      await state(page, 'match');
    });

    await scenario('changed-source-never-matches', async ({ context, page, open }) => {
      const modified = JSON.parse(rawRegistry);
      modified.assets[0].displayName = 'Changed source fixture';
      await context.route(`**${REGISTRY_PATH}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(modified) }));
      await open();
      await submit(page, 'solana', native);
      await state(page, 'source-changed');
    });

    await scenario('pending-input-edit-invalidates-result', async ({ context, page, open }) => {
      let release;
      let finish;
      const hold = new Promise((done) => { release = done; });
      const handled = new Promise((done) => { finish = done; });
      await open();
      await context.route(`**${REGISTRY_PATH}`, async (route) => {
        await hold;
        try { await route.fulfill({ status: 200, contentType: 'application/json', body: rawRegistry }); }
        finally { finish(); }
      });
      const requestEntered = page.waitForRequest((request) => new URL(request.url()).pathname === REGISTRY_PATH);
      await submit(page, 'solana', native);
      await requestEntered;
      await state(page, 'loading');
      await page.locator('#verify-address').fill('Changed while checking');
      release();
      await handled;
      await settledFrames(page);
      assert.notEqual(await currentState(page), 'match', 'A late response cannot certify an edited field');
      assert.notEqual(await currentState(page), 'loading', 'Edited input does not leave stale loading status');
    });

    await scenario('copy-rejection-is-accessible', async ({ context, page, open }) => {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Fixture denial', 'NotAllowedError'); } } });
        document.execCommand = () => false;
      });
      await open();
      await expandRecords(page);
      await page.locator('[data-copy-address]').first().focus();
      await page.keyboard.press('Enter');
      const feedback = page.locator('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]').filter({ hasText: /could not|couldn.t|unable|unavailable|failed|select.*address|copy.*manually/iu });
      await feedback.first().waitFor({ state: 'visible' });
      assert.ok((await feedback.first().innerText()).trim().length > 15, 'Copy denial gives an actionable, announced outcome');
    });

    await scenario('real-service-worker-offline-never-reuses-match', async ({ context, page, open, expectedFailures }) => {
      await open();
      await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }));
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 45_000 });
      const online = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(online?.status(), 200);
      assert.ok(online?.fromServiceWorker(), 'The real deployed worker controls navigation');
      await submit(page, 'solana', native);
      await state(page, 'match');
      assert.equal(await page.evaluate(async (pathname) => Boolean(await caches.match(pathname)), REGISTRY_PATH), false, 'The worker never caches Registry authority');
      expectedFailures.add(`${baseURL}${REGISTRY_PATH}`);
      // These observed shared assets are not covered by the existing worker's
      // cache policy. Keep their exact offline misses in the evidence report;
      // this workstream does not change shared caching or excuse other errors.
      for (const pathname of [
        '/assets/app-icons/v3/favicon.svg', '/assets/app-icons/v3/favicon-32.png',
        '/assets/app-icons/v3/favicon-16.png', '/assets/app-icons/v3/favicon-96.png',
        '/assets/site-footer.css', '/assets/assistant-ui.js?v=ask-guide-3',
      ]) expectedFailures.add(`${baseURL}${pathname}`);
      await context.setOffline(true);
      await submit(page, 'solana', native);
      await state(page, 'source-error');
      const offline = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(offline?.status(), 200, 'Previously loaded informational page remains readable offline');
      assert.ok(offline?.fromServiceWorker());
      assert.match(await page.locator('.av-source-note').innerText(), /snapshot/iu);
      assert.equal(await currentState(page), 'idle', 'Offline navigation never restores a previous positive result');
      assert.equal(await page.locator('#verify-address').inputValue(), '', 'The address was not retained in the cached page');
      await submit(page, 'solana', native);
      await state(page, 'source-error');
    }, { serviceWorkers: 'allow' });
  } finally {
    await browser.close();
    const reportSuffix = selectedScenarios?.size === 1 ? `-${[...selectedScenarios][0].replace(/[^a-z0-9-]/giu, '')}` : selectedScenarios ? '-selected' : '';
    const reportName = `browser-${previewRun ? 'preview-' : ''}results${reportSuffix}.json`;
    await writeFile(resolve(outDir, reportName), `${JSON.stringify({ recordedAt: new Date().toISOString(), baseURL, sourceCommit, servedPageSha256, harnessSha256, node: process.version, chromium: browser.version(), fixture: 'public/registry/zodiacs.registry.json', viewportWidths: [1280, 390, 320], results }, null, 2)}\n`);
  }
  const failures = results.filter((result) => result.status === 'failed');
  assert.ok(results.length > 0, 'At least one requested browser scenario must run');
  if (selectedScenarios) assert.equal(results.length, selectedScenarios.size, 'Every requested scenario name must exist');
  assert.equal(failures.length, 0, `${failures.length} browser scenario(s) failed; see docs/astrofolio-trust/evidence/browser-results.json`);
  console.log(`${results.length} Astrofolio browser scenarios passed.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const external = process.env.BASE_URL;
  const execute = external ? run(external.replace(/\/$/u, '')) : withPreview({ port: 4397 }, run);
  execute.catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
