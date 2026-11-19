import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = process.env.ZODIACS_OWNERSHIP_ROOT ?? process.cwd();
const evidence = process.env.OUT_DIR ?? process.env.ZODIACS_OWNERSHIP_EVIDENCE
  ?? resolve(root, 'tests/visual/artifacts/chart-ownership');
const run = resolve(evidence, `browser-${Date.now()}`);
await mkdir(run, { recursive: true });
const { chromium } = createRequire(resolve(root, 'package.json'))('playwright-core');
const { findChromium, STABLE_CHROMIUM_ARGS } = await import(pathToFileURL(resolve(root, 'tests/visual/browser.mjs')).href);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePath = resolve(root, 'src/islands/ChartCalculator.tsx');
const source = await readFile(sourcePath);
await writeFile(resolve(run, 'ChartCalculator.source.tsx'), source);
const dist = resolve(root, 'dist');
const ts = createRequire(resolve(root, 'package.json'))('typescript');
/**
 * Find the engine's own natal calculation in whatever chunk the bundler put it.
 *
 * It is the one served function that takes the caller's input and returns the
 * chart built from it with that input passed through unmodified. The shape is
 * what identifies it; the chunk it lands in is the bundler's business, and it
 * moves as soon as a second island imports the engine and the shared code is
 * split out. Pinning a chunk name measured the bundler, not the site.
 *
 * Since engine 0.1.1-rc.8 the calculation sets its ΔT clock and hands the
 * input to a builder, chartAt(input, pin), which returns the chart. The
 * calculation is then the one-argument function that returns that builder's
 * chart of its own input. A builder is any served function whose return value
 * (the last operand of a comma expression included) is the chart with its
 * first argument passed through as input.
 *
 * Since engine 0.1.1-rc.13 the calculation runs the builder inside the
 * engine's error wrapper, evaluated(() => { clock(pin); try { return
 * chartAt(input, pin); } ... }), which turns anything but an Error thrown by
 * the ephemeris into a RangeError. The builder's chart is then what the
 * wrapped function returns, so a call that wraps such a function counts too.
 *
 * Since engine 0.1.1-rc.15 the builder takes the input alone and reads the
 * clock from it, evaluated(() => chartAt(input)), so it has the calculation's
 * own shape. A builder that another one-argument function hands its input to
 * is that function's inner step, not a second calculation, and is not counted.
 */
const chunkDir = resolve(dist, '_astro');
const natalCandidates = [];
const nestedFunction = (node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)
  || ts.isSetAccessorDeclaration(node) || ts.isConstructorDeclaration(node);
function returnedExpressions(fn) {
  const expressions = [];
  (function walk(node) {
    if (ts.isReturnStatement(node) && node.expression) expressions.push(node.expression);
    if (!nestedFunction(node)) ts.forEachChild(node, walk);
  })(fn.body);
  return expressions;
}
function lastOperand(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)
    || (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.CommaToken)) {
    current = ts.isParenthesizedExpression(current) ? current.expression : current.right;
  }
  return current;
}
for (const file of (await readdir(chunkDir)).filter((name) => name.endsWith('.js'))) {
  const source = (await readFile(resolve(chunkDir, file))).toString();
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = [];
  (function collect(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body && node.parameters.length >= 1) functions.push(node);
    ts.forEachChild(node, collect);
  })(ast);
  const builders = new Set(functions.filter((fn) => {
    const input = fn.parameters[0].name.getText(ast);
    return returnedExpressions(fn).some((expression) => {
      const returned = lastOperand(expression);
      if (!ts.isObjectLiteralExpression(returned)) return false;
      const properties = new Map(returned.properties.filter(ts.isPropertyAssignment)
        .map((property) => [property.name.getText(ast), property.initializer.getText(ast)]));
      return properties.get('input') === input && properties.has('bodies') && properties.has('engineVersion');
    });
  }).map((fn) => fn.name.text));
  const buildsFrom = (expression, input, self) => ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression) && expression.expression.text !== self
    && builders.has(expression.expression.text) && expression.arguments[0]?.getText(ast) === input;
  // What a function passed to the returned call returns: the error wrapper's body.
  const wrappedReturns = (expression) => (ts.isCallExpression(expression) ? expression.arguments : [])
    .filter((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
    .flatMap((wrapped) => (ts.isBlock(wrapped.body) ? returnedExpressions(wrapped) : [wrapped.body]))
    .map(lastOperand);
  const candidates = [];
  for (const fn of functions) {
    if (fn.parameters.length !== 1) continue;
    const input = fn.parameters[0].name.getText(ast);
    const delegatesTo = returnedExpressions(fn)
      .flatMap((expression) => [expression, ...wrappedReturns(expression)])
      .filter((expression) => buildsFrom(expression, input, fn.name.text))
      .map((expression) => expression.expression.text);
    if (builders.has(fn.name.text) || delegatesTo.length > 0) candidates.push({ name: fn.name.text, delegatesTo });
  }
  const inner = new Set(candidates.flatMap((candidate) => candidate.delegatesTo));
  for (const candidate of candidates) {
    if (!inner.has(candidate.name)) natalCandidates.push({ file, function: candidate.name });
  }
}
assert.equal(natalCandidates.length, 1, `expected exactly one served natal calculation, found ${JSON.stringify(natalCandidates)}`);
const nativeFile = natalCandidates[0].file;
const nativeBytes = await readFile(resolve(chunkDir, nativeFile));
const nativeFunctions = [natalCandidates[0].function];
const nativeIdentity = { file: nativeFile, sha256: sha(nativeBytes), function: nativeFunctions[0], mapping: 'One-argument function returning its exact input plus bodies and engineVersion, itself or through the chart builder it passes that input to, directly or inside the error wrapper of the engine; parsed from actual served chunk.' };
const served = {}, requests = [], results = [], contexts = [], releases = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = createServer(async (req, res) => {
  try {
    let file = resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    assert.ok(file === dist || file.startsWith(dist + sep));
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const bytes = await readFile(file);
    served[file.slice(dist.length + 1)] = { bytes: bytes.length, sha256: sha(bytes) };
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const ordinary = { d: '1990-06-15', t: '14:30', z: 'America/New_York', la: 40.71, lo: -74, h: 'placidus', n: 'Synthetic owner', p: 'Synthetic place' };
const link = (wire = ordinary) => origin + '/birth-chart/#c=1.' + Buffer.from(JSON.stringify(wire)).toString('base64url');
let browser;
async function setup(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  contexts.push(context);
  const errors = [], external = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url); return route.abort();
  });
  await context.addInitScript(() => {
    window.__ownership = { computed: [], contexts: [], failReceipt: false, downloads: 0 };
    addEventListener('zodiacs:chart-computed', (event) => window.__ownership.computed.push(event.detail));
    addEventListener('zodiacs:chart-context', (event) => window.__ownership.contexts.push(event.detail));
    const stringify = JSON.stringify;
    JSON.stringify = function (value, ...args) {
      if (window.__ownership.failReceipt && value?.schema === 'zodiacs.natal-envelope.draft-v1') throw Error('Synthetic private receipt failure');
      return stringify.call(this, value, ...args);
    };
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push({ case: name, method: request.method(), path: new URL(request.url()).pathname }));
  return { name, context, page, cdp, errors, external, expectedNatal: 1 };
}
async function gate(subject, pattern) {
  let begin, release;
  const started = new Promise((done) => { begin = done; });
  const waiting = new Promise((done) => { release = done; });
  releases.push(release);
  await subject.context.route(pattern, async (route) => { begin(); await waiting; await route.continue().catch(() => {}); });
  return { started, release };
}
async function hydrated(subject, url = link()) {
  await subject.page.goto(url, { waitUntil: 'domcontentloaded' });
  await subject.page.locator('astro-island[component-url*="ChartCalculator"]:not([ssr])').waitFor();
}
async function settled(subject) {
  await subject.page.waitForFunction(() => document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false');
}
async function observed(subject) {
  return subject.page.evaluate(() => ({ ...window.__ownership, result: !!document.querySelector('.calc__result'), receipt: !!document.querySelector('[data-calculation-receipt-export]'), share: !!document.querySelector('[data-share-card]'), save: !!document.querySelector('[data-save-chart]'), postContext: window.zodiacsPostChartContext ?? null, date: document.querySelector('#birth-date')?.value, busy: document.querySelector('.calc__form')?.getAttribute('aria-busy'), error: document.querySelector('.calc__error')?.textContent ?? '', alertFocused: document.activeElement?.matches('.calc__error') ?? false }));
}
async function assertEmpty(subject) {
  const state = await observed(subject);
  assert.equal(state.result, false); assert.equal(state.receipt, false); assert.equal(state.share, false); assert.equal(state.save, false); assert.equal(state.postContext, null);
  return state;
}
async function check(name, action) {
  const subject = await setup(name);
  try {
    const detail = await action(subject);
    assert.deepEqual(subject.errors, []);
    const coverage = (await subject.cdp.send('Profiler.takePreciseCoverage')).result.filter((script) => script.url.endsWith('/' + nativeFile));
    await writeFile(resolve(run, name + '-native-coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
    const nativeCalls = coverage.flatMap((script) => script.functions).filter((fn) => fn.functionName === nativeIdentity.function).reduce((sum, fn) => sum + fn.ranges[0].count, 0);
    assert.equal(nativeCalls, subject.expectedNatal, 'Actual native natal calculation count');
    results.push({ name, status: 'passed', detail, nativeCalls, observation: await observed(subject), external: subject.external });
  } catch (error) {
    results.push({ name, status: 'failed', error: error.stack, observation: await observed(subject), pageErrors: subject.errors, external: subject.external });
    await subject.page.screenshot({ path: resolve(run, name + '-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    for (const release of releases.splice(0)) release();
    await subject.context.close();
  }
  console.log(JSON.stringify({ name, status: results.at(-1).status }));
}
try {
  browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
  await check('edit-during-receipt-loader', async (subject) => {
    subject.expectedNatal = 0;
    const pending = await gate(subject, '**/calculator-receipt.*.js');
    await hydrated(subject); await pending.started;
    await subject.page.locator('#birth-date').fill('1991-06-15');
    pending.release(); await settled(subject); await subject.page.waitForTimeout(200);
    const state = await assertEmpty(subject); assert.equal(state.date, '1991-06-15'); assert.equal(state.computed.length, 0);
    return { obsoleteCalculationSuppressed: true };
  });
  await check('edit-after-success-clears-result', async (subject) => {
    await hydrated(subject); await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    assert.match(await subject.page.locator('[data-result-opening]').innerText(), /this person’s needs/);
    assert.equal(await subject.page.locator('[data-check-our-math] time[datetime]').count(), 1);
    await subject.page.locator('#birth-time').fill('15:30');
    const state = await assertEmpty(subject); assert.equal(state.computed.length, 1); assert.equal(state.busy, 'false');
    return { oldResultAndActionsCleared: true };
  });
  await check('failed-new-run-clears-result-and-recovers', async (subject) => {
    subject.expectedNatal = 3;
    await hydrated(subject); await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    await subject.page.locator('#birth-date').fill('1991-06-15');
    await subject.page.evaluate(() => { window.__ownership.failReceipt = true; });
    await subject.page.locator('.calc__submit').click(); await subject.page.locator('.calc__error').waitFor(); await settled(subject);
    await subject.page.waitForFunction(() => document.activeElement?.matches('.calc__error'), undefined, { timeout: 2000 });
    const failed = await assertEmpty(subject); assert.equal(failed.date, '1991-06-15'); assert.equal(failed.computed.length, 1); assert.equal(failed.alertFocused, true); assert.ok(!failed.error.includes('Synthetic private'));
    await subject.page.evaluate(() => { window.__ownership.failReceipt = false; });
    await subject.page.locator('.calc__submit').click(); await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    assert.equal((await observed(subject)).computed.length, 2);
    await subject.page.screenshot({ path: resolve(run, 'recovered-result.png'), fullPage: true });
    return { failed, successfulRetry: true };
  });
  await check('edit-during-engine-loader', async (subject) => {
    subject.expectedNatal = 0;
    const pending = await gate(subject, '**/full.*.js');
    await hydrated(subject); await pending.started;
    await subject.page.locator('#birth-time').fill('15:30');
    pending.release(); await settled(subject); await subject.page.waitForTimeout(200);
    const state = await assertEmpty(subject); assert.equal(state.computed.length, 0);
    return { staleEngineCompletionDiscarded: true };
  });
  await check('new-run-while-old-loader-pending', async (subject) => {
    const pending = await gate(subject, '**/calculator-receipt.*.js');
    await hydrated(subject); await pending.started;
    await subject.page.locator('#birth-date').fill('1991-06-15');
    assert.equal(await subject.page.locator('.calc__submit').isEnabled(), true);
    await subject.page.locator('.calc__submit').click(); pending.release();
    await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    const state = await observed(subject); assert.equal(state.computed.length, 1);
    assert.ok((await subject.page.locator('[data-chart-receipt]').textContent()).includes('1991-06-15'));
    return { onlyReplacementCalculated: true };
  });
  await check('delayed-share-surface-after-edit', async (subject) => {
    const pending = await gate(subject, '**/PositionsShareSurface.*.js');
    await hydrated(subject); await pending.started; await subject.page.locator('.calc__result').waitFor();
    await subject.page.locator('#birth-date').fill('1991-06-15'); pending.release();
    await subject.page.waitForTimeout(250); await assertEmpty(subject);
    return { lateSharePreparationCannotRestoreResult: true };
  });
  await check('delayed-share-dialog-after-edit', async (subject) => {
    const pending = await gate(subject, '**/ChartShareDialog.*.js');
    await hydrated(subject); await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    await subject.page.locator('[data-chart-more]>summary').click();
    await subject.page.locator('[data-share-options]').click(); await pending.started;
    await subject.page.locator('#birth-date').fill('1991-06-15'); pending.release();
    await subject.page.waitForTimeout(250); await assertEmpty(subject);
    assert.equal(await subject.page.locator('[data-share-dialog]').count(), 0);
    return { obsoleteDialogCannotOpen: true };
  });
  await check('positions-only-initialization', async (subject) => {
    subject.expectedNatal = 0;
    const token = '2.' + Buffer.from(JSON.stringify({ b: Array.from({ length: 12 }, (_, index) => index * 27), h: 'w', v: '0.1.1-rc.6' })).toString('base64url');
    await hydrated(subject, origin + '/birth-chart/#p=' + token);
    await subject.page.locator('[data-positions-only]').waitFor();
    assert.equal(await subject.page.locator('[data-calculation-receipt-export]').count(), 0);
    assert.equal((await observed(subject)).computed.length, 0);
    return { existingPositionsSurfacePreserved: true };
  });
  await check('positions-only-loader-after-edit', async (subject) => {
    subject.expectedNatal = 0;
    const pending = await gate(subject, '**/PositionsShareSurface.*.js');
    const token = '2.' + Buffer.from(JSON.stringify({ b: Array.from({ length: 12 }, (_, index) => index * 27), h: 'w', v: '0.1.1-rc.6' })).toString('base64url');
    await hydrated(subject, origin + '/birth-chart/#p=' + token); await pending.started;
    await subject.page.locator('#birth-date').fill('1991-06-15'); pending.release();
    await subject.page.waitForTimeout(250); await assertEmpty(subject);
    assert.equal(await subject.page.locator('[data-positions-only]').count(), 0);
    return { delayedImportDoesNotReplaceEditedForm: true };
  });
  for (const kind of ['invalid', 'conflicting']) await check('positions-' + kind + '-loader-after-edit', async (subject) => {
    subject.expectedNatal = 0;
    const pending = await gate(subject, '**/PositionsShareSurface.*.js');
    await hydrated(subject, origin + '/birth-chart/#p=invalid' + (kind === 'conflicting' ? '&c=invalid' : '')); await pending.started;
    await subject.page.locator('#birth-date').fill('1991-06-15'); pending.release();
    await subject.page.waitForTimeout(250); const state = await assertEmpty(subject);
    assert.equal(state.error, ''); assert.equal(state.date, '1991-06-15');
    return { obsoleteFragmentErrorSuppressed: true };
  });
  for (const regrant of [false, true]) await check('positions-profile-mine-' + (regrant ? 'revoke-regrant' : 'revoke'), async (subject) => {
    const pending = await gate(subject, '**/PositionsShareSurface.*.js');
    await subject.context.addInitScript(() => {
      window.__ownershipAccess = true;
      const reader = Object.freeze({ canRead: () => window.__ownershipAccess });
      Object.defineProperty(window, 'zodiacsProfileAccess', { get: () => reader, set: () => {}, configurable: true });
    });
    const id = '10000000-0000-4000-8000-000000000001';
    const token = '2.' + Buffer.from(JSON.stringify({ b: Array.from({ length: 12 }, (_, index) => index * 27), h: 'w', v: '0.1.1-rc.6' })).toString('base64url');
    await hydrated(subject, origin + '/birth-chart/#p=' + token + '&subject=other&mineId=' + id + '&mineSource=profile'); await pending.started;
    await subject.page.evaluate((regrant) => {
      document.documentElement.setAttribute('data-account-sync-v2', ''); window.__ownershipAccess = false; dispatchEvent(new Event('zodiacs:profile-access'));
      if (regrant) { window.__ownershipAccess = true; dispatchEvent(new Event('zodiacs:profile-access')); }
    }, regrant);
    pending.release(); await subject.page.locator('[data-positions-only]').waitFor();
    assert.equal(await subject.page.locator('[data-calculation-receipt-export]').count(), 0);
    await subject.page.locator('#birth-date').fill('1990-01-04'); await subject.page.locator('#birth-time').fill('12:00');
    await subject.page.locator('#place').fill('Bangkok'); await subject.page.locator('[role=listbox] [role=option]').first().click();
    await subject.page.locator('.calc__submit').click(); await subject.page.locator('[data-chart-action-dock]').waitFor(); await settled(subject);
    const links = await subject.page.locator('a[href*="compatibility"]').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    assert.ok(links.length > 0); assert.ok(links.every(link => !link.includes(id)), JSON.stringify(links));
    assert.equal(await subject.page.evaluate(() => localStorage.getItem('zodiacs.profile.v1')), null);
    return { publicPositionsPreserved: true, anonymousPrimaryCalculated: true, obsoleteMineAbsent: true, links };
  });
  for (const phase of ['pending', 'completed']) await check('profile-revoke-' + phase, async (subject) => {
    subject.expectedNatal = phase === 'pending' ? 0 : 1;
    const id = '10000000-0000-4000-8000-000000000001', stamp = '2026-01-01T00:00:00.000Z';
    const profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [{ id, name: 'Synthetic private chart', relationship: 'self', createdAt: stamp, updatedAt: stamp, birth: { date: '1990-06-15', time: '14:30', timeKnown: true, place: { name: 'Synthetic Place', admin1: '', country: 'US', lat: 40.71, lon: -74, tz: 'America/New_York' } }, summary: { engineVersion: '0.1.1-rc.6', utcISO: '1990-06-15T18:30:00.000Z', houseSystem: 'whole', bodies: [], angles: null, flags: [] } }] };
    await subject.context.addInitScript((profile) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile));
      window.__ownershipAccess = true;
      const reader = Object.freeze({ canRead: () => window.__ownershipAccess });
      Object.defineProperty(window, 'zodiacsProfileAccess', { get: () => reader, set: () => {}, configurable: true });
    }, profile);
    const pending = phase === 'pending' ? await gate(subject, '**/calculator-receipt.*.js') : null;
    await hydrated(subject, origin + '/birth-chart/#profileChartId=' + id);
    if (pending) await pending.started;
    else { await subject.page.locator('.calc__result').waitFor(); await settled(subject); }
    await subject.page.evaluate(() => { document.documentElement.setAttribute('data-account-sync-v2', ''); window.__ownershipAccess = false; dispatchEvent(new Event('zodiacs:profile-access')); });
    pending?.release(); await subject.page.waitForTimeout(250);
    const state = await assertEmpty(subject); assert.equal(state.date, ''); assert.equal(state.busy, 'false');
    return { actualProfileResetBoundary: true };
  });
  await check('unmount-with-loader-pending', async (subject) => {
    subject.expectedNatal = 0;
    const pending = await gate(subject, '**/calculator-receipt.*.js');
    await hydrated(subject); await pending.started;
    await subject.page.locator('astro-island[component-url*="ChartCalculator"]').evaluate((island) => island.dispatchEvent(new CustomEvent('astro:unmount')));
    pending.release(); await subject.page.waitForTimeout(250);
    assert.equal(await subject.page.locator('.calc').count(), 0);
    assert.equal((await observed(subject)).computed.length, 0);
    return { actualAstroPreactUnmountHook: true };
  });
  await check('optional-receipt-module-failure', async (subject) => {
    await subject.context.route('**/calculator-receipt.*.js', (route) => route.abort('failed'));
    await hydrated(subject); await subject.page.locator('.calc__result').waitFor(); await settled(subject);
    assert.equal(await subject.page.locator('[data-download-calculation-receipt]').isDisabled(), true);
    assert.equal((await observed(subject)).computed.length, 1);
    return { existingSingleCalculationFallbackPreserved: true };
  });
} finally {
  for (const release of releases) release();
  for (const context of contexts) await context.close().catch(() => {});
  const browserVersion = browser?.version(); await browser?.close();
  await new Promise((done) => server.close(done));
  const report = { run, origin, node: process.version, browser: browserVersion, sourceSha256: sha(source), finalSourceSha256: sha(await readFile(sourcePath)), driverSha256: sha(await readFile(new URL(import.meta.url))), nativeIdentity, results, passed: results.filter((row) => row.status === 'passed').length, failed: results.filter((row) => row.status === 'failed').length, served, requests, cleanup: { contextsClosed: true, browserClosed: true, serverClosed: true } };
  await writeFile(resolve(run, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(resolve(evidence, 'browser-latest.json'), JSON.stringify({ run }, null, 2) + '\n');
  console.log(JSON.stringify({ run, passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
}
