/**
 * Native same-origin calendar erasure regression. Production client, clear-all
 * and profile-lock source are bundled unchanged. Only POST settlement and
 * browser storage/event failures are controlled; all records are synthetic.
 * No live services or chart data are used. Run in the supported CI browser:
 *   node tests/calendar-feed-cross-tab-drive.mjs
 * --bundle-only checks the source fixture without claiming browser execution.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/calendar-feed-cross-tab');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const entry = `
import * as client from './src/lib/calendar-feed/client';
import { clearAllZodiacsDataFromDevice } from './src/lib/account-v2/profile-boundary';
import { runExclusiveAccountProfileTransition } from './src/lib/account-v2/profile-lease';
window.CalendarFixtureSource = { client, clearAllZodiacsDataFromDevice, runExclusiveAccountProfileTransition };
`;
const bundled = await build({
  absWorkingDir: root, stdin: { contents: entry, resolveDir: root },
  bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022',
  define: { 'import.meta.env': '{}' }, metafile: true,
});

// Serialized as browser fixture code; native Storage and Web Locks remain real.
function installFixture() {
  const { client, clearAllZodiacsDataFromDevice, runExclusiveAccountProfileTransition } = window.CalendarFixtureSource;
  const local = window.localStorage;
  const get = Storage.prototype.getItem;
  const set = Storage.prototype.setItem;
  const remove = Storage.prototype.removeItem;
  const faults = { reads: false, writes: false, removes: false, dropEvents: false };
  const pending = new Map();
  let next = 0;
  let stop;
  let observed = [];
  let storageEvents = 0;
  let heldClear = null;
  Storage.prototype.getItem = function (key) {
    if (this === local && faults.reads) throw new DOMException('Synthetic refused read', 'SecurityError');
    return get.call(this, key);
  };
  Storage.prototype.setItem = function (key, value) {
    if (this === local && faults.writes) throw new DOMException('Synthetic refused write', 'QuotaExceededError');
    return set.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key) {
    if (this === local && faults.removes) throw new DOMException('Synthetic refused remove', 'SecurityError');
    return remove.call(this, key);
  };
  window.addEventListener('storage', (event) => {
    storageEvents += 1;
    if (faults.dropEvents) event.stopImmediatePropagation();
  }, true);
  const sanitize = (result) => ({ state: result.state, ...(result.state === 'created' ? { kept: result.kept } : {}) });
  window.fixture = {
    faults,
    client,
    mount() {
      stop?.();
      const update = () => { observed = client.readAvailableCalendarFeeds().map((feed) => feed.id); };
      stop = client.watchCalendarFeeds(update);
      update();
    },
    unmount() { stop?.(); stop = undefined; observed = []; },
    start(id) {
      const ticket = next++;
      const record = { resolve: null, result: null, settled: false };
      pending.set(ticket, record);
      record.promise = client.createCalendarFeed('2.synthetic-cross-tab-fixture', () => new Promise((resolve) => {
        record.resolve = () => resolve(new Response(JSON.stringify({
          id, url: 'https://zodiacs.org/api/calendar/feeds/' + id, secret: 'k'.repeat(42) + 'A',
        }), { status: 201 }));
      })).then((result) => { record.result = sanitize(result); record.settled = true; return record.result; });
      return ticket;
    },
    started(ticket) { return typeof pending.get(ticket)?.resolve === 'function'; },
    finish(ticket) { pending.get(ticket).resolve(); },
    result(ticket) { return pending.get(ticket).promise; },
    settled(ticket) { return pending.get(ticket).settled; },
    clear() {
      return runExclusiveAccountProfileTransition(local, () => clearAllZodiacsDataFromDevice(local, sessionStorage));
    },
    startHeldClear() {
      heldClear = { entered: false, release: null, result: null };
      heldClear.result = runExclusiveAccountProfileTransition(local, async () => {
        heldClear.entered = true;
        await new Promise((resolve) => { heldClear.release = resolve; });
        return clearAllZodiacsDataFromDevice(local, sessionStorage);
      });
    },
    clearEntered() { return heldClear?.entered === true; },
    releaseClear() { heldClear.release(); return heldClear.result; },
    snapshot() {
      return {
        available: client.readAvailableCalendarFeeds().map((feed) => feed.id),
        stored: client.readKeptCalendarFeeds().map((feed) => feed.id),
        observed: [...observed], storageEvents,
        calendarKeys: Object.keys(local).filter((key) => key.startsWith('zodiacs.calendar')).sort(),
      };
    },
  };
  window.fixture.mount();
}
const script = Buffer.concat([Buffer.from(bundled.outputFiles[0].contents), Buffer.from(`\n(${installFixture.toString()})();\n`)]);
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'fixture.js'), script);
const inputs = await Promise.all(Object.keys(bundled.metafile.inputs).filter((path) => !path.startsWith('<')).sort().map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })));
const report = {
  schema: 'zodiacs.calendar-feed-cross-tab-browser/v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), node: process.version, inputs, bundleSha256: hash(script),
  sourceInstrumented: false,
  controlledBoundaries: ['synthetic POST response settlement', 'per-document native Storage method refusal', 'dropped native storage-event delivery'],
  storageAndLocks: 'Native same-origin Storage and Web Locks in two real documents',
  results: [], pageErrors: [], blockedExternalRequests: [], outcome: 'not-run',
};
await writeFile(resolve(out, 'bundle-inputs.json'), JSON.stringify(bundled.metafile, null, 2) + '\n');
if (process.argv.includes('--bundle-only')) {
  await writeFile(resolve(out, 'bundle-only.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Calendar cross-tab fixture bundled; browser cases not run.');
  process.exit(0);
}
const ID = 'Zq3xPq0Jr9Vb_Tm2-Ka5sA';
const OTHER_ID = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
let browser;
let origin;
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.setHeader('Content-Type', 'application/javascript'); response.end(script);
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Calendar cross-tab fixture</title><script src="/fixture.js"></script>');
  }
});
const begin = async (page, id = ID) => {
  const ticket = await page.evaluate((value) => window.fixture.start(value), id);
  await page.waitForFunction((value) => window.fixture.started(value), ticket);
  return ticket;
};
const finish = async (page, ticket) => {
  await page.evaluate((value) => window.fixture.finish(value), ticket);
  return page.evaluate((value) => window.fixture.result(value), ticket);
};
const snapshot = (page) => page.evaluate(() => window.fixture.snapshot());
const cleared = async (page) => {
  const result = await page.evaluate(() => window.fixture.clear());
  assert.deepEqual(result, { ok: true, value: { ok: true, restoredPreviousArchive: false } });
  assert.deepEqual((await snapshot(page)).calendarKeys, [], 'clear-all must leave no calendar-owned marker');
};
async function group(name, run) {
  const context = await browser.newContext();
  context.setDefaultTimeout(7000);
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) return route.continue();
    report.blockedExternalRequests.push(url); return route.abort();
  });
  const a = await context.newPage(); const b = await context.newPage();
  for (const page of [a, b]) page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  try {
    await Promise.all([a.goto(origin), b.goto(origin)]);
    await Promise.all([a.waitForFunction(() => !!window.fixture), b.waitForFunction(() => !!window.fixture)]);
    assert.equal(await a.evaluate(() => typeof navigator.locks?.request), 'function');
    const evidence = await run({ a, b, context });
    report.results.push({ name, passed: true, evidence });
  } catch (error) {
    report.results.push({ name, passed: false, error: String(error.stack ?? error) });
  } finally { await context.close(); }
  console.log(`${report.results.at(-1).passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!report.results.at(-1).passed) console.log(report.results.at(-1).error);
}
try {
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
  report.browser = await browser.version();
  await group('native clear notification fences a pending POST in another document', async ({ a, b }) => {
    const ticket = await begin(a);
    await cleared(b);
    await a.waitForFunction(() => window.fixture.snapshot().storageEvents > 0);
    assert.deepEqual(await finish(a, ticket), { state: 'cancelled' });
    assert.deepEqual((await snapshot(a)).stored, []);
    assert.deepEqual((await snapshot(a)).available, []);
    return { nativeStorageEventsObserved: true, staleResponse: 'cancelled', postClearCalendarKeys: 0 };
  });
  await group('missed events and unmounted offline readers cannot resurrect the pre-clear key', async ({ a, b, context }) => {
    await a.evaluate(() => { window.fixture.faults.dropEvents = true; });
    const ticket = await begin(a);
    await a.evaluate(() => window.fixture.unmount());
    await context.setOffline(true);
    await cleared(b);
    assert.deepEqual(await finish(a, ticket), { state: 'cancelled' });
    await context.setOffline(false);
    await a.evaluate(() => window.fixture.mount());
    assert.deepEqual((await snapshot(a)).stored, []);
    assert.deepEqual((await snapshot(a)).observed, []);
    return { eventsSuppressed: true, networkOfflineDuringClear: true, observerRemounted: true, staleResponse: 'cancelled' };
  });
  await group('absent then fresh random fence cannot authorize the old pending POST', async ({ a, b }) => {
    await a.evaluate(() => { window.fixture.faults.dropEvents = true; });
    const old = await begin(a);
    await cleared(b);
    const fresh = await begin(b, OTHER_ID);
    assert.deepEqual(await finish(b, fresh), { state: 'created', kept: true });
    assert.deepEqual(await finish(a, old), { state: 'cancelled' });
    assert.deepEqual((await snapshot(a)).stored, [OTHER_ID]);
    assert.deepEqual((await snapshot(b)).stored, [OTHER_ID]);
    return { freshPostStored: true, oldPostCancelled: true, storedFeedCount: 1 };
  });
  await group('a request with no established fence never upgrades after writes recover', async ({ a, b }) => {
    await a.evaluate(() => { window.fixture.faults.writes = true; window.fixture.faults.dropEvents = true; });
    const ticket = await begin(a);
    await cleared(b);
    await a.evaluate(() => { window.fixture.faults.writes = false; });
    const result = await finish(a, ticket);
    assert.ok(result.state === 'cancelled' || (result.state === 'created' && result.kept === false));
    assert.deepEqual((await snapshot(a)).stored, []);
    assert.deepEqual((await snapshot(a)).calendarKeys, []);
    await a.evaluate(() => { window.fixture.unmount(); window.fixture.mount(); });
    assert.deepEqual((await snapshot(a)).stored, []);
    return { preflightWriteRefused: true, writeRecoveredBeforeResponse: true, persisted: false, result };
  });
  await group('a denied final read cannot authorize a write or later automatic retry', async ({ a }) => {
    const ticket = await begin(a);
    await a.evaluate(() => { window.fixture.faults.reads = true; });
    const result = await finish(a, ticket);
    assert.ok(result.state === 'cancelled' || (result.state === 'created' && result.kept === false));
    await a.evaluate(() => { window.fixture.faults.reads = false; window.fixture.unmount(); window.fixture.mount(); });
    assert.deepEqual((await snapshot(a)).stored, []);
    return { commitReadRefused: true, persistedAfterRecovery: false, result };
  });
  await group('final commit waits for the native exclusive clear and then rejects its old fence', async ({ a, b }) => {
    await a.evaluate(() => { window.fixture.faults.dropEvents = true; });
    const ticket = await begin(a);
    await b.evaluate(() => window.fixture.startHeldClear());
    await b.waitForFunction(() => window.fixture.clearEntered());
    await a.evaluate((value) => window.fixture.finish(value), ticket);
    await a.waitForFunction(async () => (await navigator.locks.query()).pending
      .some((lock) => lock.name === 'zodiacs-profile-boundary-v1' && lock.mode === 'shared'));
    // This observation is made while the real profile exclusive lock is held.
    // It does not rely on a sleep to decide whether erasure won the race.
    assert.deepEqual((await snapshot(a)).stored, []);
    assert.equal(await a.evaluate((value) => window.fixture.settled(value), ticket), false);
    assert.deepEqual(await b.evaluate(() => window.fixture.releaseClear()), { ok: true, value: { ok: true, restoredPreviousArchive: false } });
    assert.deepEqual(await a.evaluate((value) => window.fixture.result(value), ticket), { state: 'cancelled' });
    assert.deepEqual((await snapshot(a)).calendarKeys, []);
    return { exclusiveLockHeldAtResponse: true, storedBeforeClear: 0, staleResponse: 'cancelled' };
  });
  await group('independent new subscriptions preserve both records across documents', async ({ a, b }) => {
    const [one, two] = await Promise.all([begin(a), begin(b, OTHER_ID)]);
    const results = await Promise.all([finish(a, one), finish(b, two)]);
    assert.deepEqual(results, [{ state: 'created', kept: true }, { state: 'created', kept: true }]);
    assert.deepEqual((await snapshot(a)).stored.sort(), [ID, OTHER_ID].sort());
    await cleared(b);
    assert.deepEqual((await snapshot(a)).available, []);
    return { independentPosts: 2, storedFeeds: 2, postClearCalendarKeys: 0 };
  });
  await group('a never-fenced preflight queued during clear starts its POST only after erasure', async ({ a, b }) => {
    await a.evaluate(() => { window.fixture.faults.dropEvents = true; });
    await b.evaluate(() => window.fixture.startHeldClear());
    await b.waitForFunction(() => window.fixture.clearEntered());
    const ticket = await a.evaluate((id) => window.fixture.start(id), ID);
    await a.waitForFunction(async () => (await navigator.locks.query()).pending
      .some((lock) => lock.name === 'zodiacs-profile-boundary-v1' && lock.mode === 'shared'));
    assert.equal(await a.evaluate((value) => window.fixture.started(value), ticket), false);
    assert.deepEqual((await snapshot(a)).calendarKeys, []);
    assert.deepEqual(await b.evaluate(() => window.fixture.releaseClear()), { ok: true, value: { ok: true, restoredPreviousArchive: false } });
    await a.waitForFunction((value) => window.fixture.started(value), ticket);
    assert.deepEqual(await finish(a, ticket), { state: 'created', kept: true });
    assert.deepEqual((await snapshot(a)).stored, [ID]);
    return { postStartedBeforeClearReleased: false, preflightLinearizedAfterClear: true, newSubscriptionKept: true };
  });
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.blockedExternalRequests, []);
  report.outcome = report.results.every((result) => result.passed) ? 'passed' : 'failed';
  if (report.outcome !== 'passed') process.exitCode = 1;
} catch (error) {
  report.outcome = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(resolve(out, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
}
console.log(JSON.stringify({ outcome: report.outcome, passed: report.results.filter((result) => result.passed).length, failed: report.results.filter((result) => !result.passed).length, file: resolve(out, 'result.json') }));
