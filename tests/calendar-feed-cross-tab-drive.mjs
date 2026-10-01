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
import * as store from './src/lib/calendar-feed/browser-store';
import { clearAllZodiacsDataFromDevice } from './src/lib/account-v2/profile-boundary';
import { runExclusiveAccountProfileTransition } from './src/lib/account-v2/profile-lease';
window.CalendarFixtureSource = { client, store, clearAllZodiacsDataFromDevice, runExclusiveAccountProfileTransition };
`;
const bundled = await build({
  absWorkingDir: root, stdin: { contents: entry, resolveDir: root },
  bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022',
  define: { 'import.meta.env': '{}' }, metafile: true,
});

// Serialized as browser fixture code; native IndexedDB and Web Locks remain real.
function installFixture() {
  const { client, store, clearAllZodiacsDataFromDevice, runExclusiveAccountProfileTransition } = window.CalendarFixtureSource;
  const { CALENDAR_FEED_DATABASE_NAME, CALENDAR_FEED_OBJECT_STORE, CALENDAR_FEED_STATE_KEY, CALENDAR_FEED_CHANGE_CHANNEL } = store;
  const local = window.localStorage;
  const native = {
    open: IDBFactory.prototype.open,
    transaction: IDBDatabase.prototype.transaction,
    get: IDBObjectStore.prototype.get,
    put: IDBObjectStore.prototype.put,
    clear: IDBObjectStore.prototype.clear,
    count: IDBObjectStore.prototype.count,
    abort: IDBTransaction.prototype.abort,
  };
  const faults = { reads: false, writes: false, clears: false, transactions: false, abortPut: false, abortClear: false, dropEvents: false };
  // Bounded native operation diagnostics contain only synthetic fence values,
  // counts, modes and request states, never capability URLs, keys or chart data.
  const trace = [];
  const transactions = new WeakMap();
  let nextTransaction = 0;
  const traceEvent = (kind, detail = {}) => {
    if (trace.length < 500) trace.push({ at: performance.timeOrigin + performance.now(), kind, ...detail });
  };
  const pending = new Map();
  let next = 0;
  let stop;
  let observed = [];
  let storageEvents = 0;
  let broadcastEvents = 0;
  let heldClear = null;
  let heldStorage = null;
  const calendarStore = (objectStore) => objectStore.transaction.db.name === CALENDAR_FEED_DATABASE_NAME
    && objectStore.name === CALENDAR_FEED_OBJECT_STORE;
  const observeTransaction = (transaction) => {
    if (transactions.has(transaction)) return transactions.get(transaction);
    const id = nextTransaction++;
    transactions.set(transaction, id);
    traceEvent('idb-transaction', { transaction: id, mode: transaction.mode });
    for (const kind of ['complete', 'abort', 'error']) transaction.addEventListener(kind, () => {
      traceEvent('idb-transaction-' + kind, { transaction: id, error: transaction.error?.name ?? null });
    });
    return id;
  };
  IDBFactory.prototype.open = function (name, ...args) {
    const request = native.open.call(this, name, ...args);
    if (name === CALENDAR_FEED_DATABASE_NAME) {
      traceEvent('idb-open');
      request.addEventListener('upgradeneeded', () => { observeTransaction(request.transaction); });
      for (const kind of ['success', 'error', 'blocked']) request.addEventListener(kind, () => {
        traceEvent('idb-open-' + kind, { error: kind === 'error' ? request.error?.name : undefined });
      });
    }
    return request;
  };
  IDBDatabase.prototype.transaction = function (...args) {
    if (this.name === CALENDAR_FEED_DATABASE_NAME && faults.transactions) {
      traceEvent('idb-transaction-refused');
      throw new DOMException('Synthetic refused transaction', 'InvalidStateError');
    }
    const transaction = native.transaction.apply(this, args);
    if (this.name === CALENDAR_FEED_DATABASE_NAME) observeTransaction(transaction);
    return transaction;
  };
  for (const [method, fault, errorName] of [
    ['get', 'reads', 'SecurityError'], ['put', 'writes', 'QuotaExceededError'], ['clear', 'clears', 'SecurityError'],
  ]) {
    IDBObjectStore.prototype[method] = function (...args) {
      if (!calendarStore(this)) return native[method].apply(this, args);
      const transaction = observeTransaction(this.transaction);
      if (faults[fault]) {
        traceEvent('idb-' + method + '-refused', { transaction });
        throw new DOMException('Synthetic refused ' + method, errorName);
      }
      const request = native[method].apply(this, args);
      traceEvent('idb-' + method, { transaction, ...(method === 'put' ? { fence: args[0]?.fence ?? null } : {}) });
      request.addEventListener('success', () => {
        traceEvent('idb-' + method + '-success', { transaction, ...(method === 'get' ? { fence: request.result?.fence ?? null } : {}) });
        if ((method === 'put' && faults.abortPut) || (method === 'clear' && faults.abortClear)) {
          traceEvent('idb-synthetic-abort', { transaction, after: method });
          native.abort.call(this.transaction);
        }
      });
      request.addEventListener('error', () => traceEvent('idb-' + method + '-error', { transaction, error: request.error?.name ?? null }));
      return request;
    };
  }
  const NativeBroadcastChannel = window.BroadcastChannel;
  window.BroadcastChannel = class extends NativeBroadcastChannel {
    constructor(name) {
      super(name);
      if (name === CALENDAR_FEED_CHANGE_CHANNEL) this.addEventListener('message', (event) => {
        broadcastEvents += 1;
        traceEvent('broadcast-message', { changed: event.data === 'changed', dropped: faults.dropEvents });
        if (faults.dropEvents) event.stopImmediatePropagation();
      });
    }
  };
  window.addEventListener('storage', (event) => {
    storageEvents += 1;
    traceEvent('storage', { key: event.key, dropped: faults.dropEvents });
    if (faults.dropEvents) event.stopImmediatePropagation();
  }, true);
  // Inspection bypasses only the fixture's injected faults. It uses native
  // requests in a real transaction, never the client cache or notifications.
  // An absent database is left absent by aborting the initial upgrade.
  const inspectDatabase = () => new Promise((resolveInspection, reject) => {
    const request = native.open.call(indexedDB, CALENDAR_FEED_DATABASE_NAME, 1);
    let absent = false;
    request.onupgradeneeded = () => { absent = true; native.abort.call(request.transaction); };
    request.onerror = () => absent
      ? resolveInspection({ rowCount: 0, fence: null, feedIds: [], rowFields: [], feedFields: [] })
      : reject(request.error);
    request.onblocked = () => reject(new Error('Canonical inspection was blocked.'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = native.transaction.call(database, CALENDAR_FEED_OBJECT_STORE, 'readonly');
      const objectStore = transaction.objectStore(CALENDAR_FEED_OBJECT_STORE);
      const read = native.get.call(objectStore, CALENDAR_FEED_STATE_KEY);
      const count = native.count.call(objectStore);
      transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.oncomplete = () => {
        const row = read.result;
        database.close();
        resolveInspection({
          rowCount: count.result, fence: row?.fence ?? null,
          feedIds: (row?.feeds ?? []).map((feed) => feed.id),
          rowFields: row ? Object.keys(row).sort() : [],
          feedFields: (row?.feeds ?? []).map((feed) => Object.keys(feed).sort()),
        });
      };
    };
  });
  for (const kind of ['pageshow', 'pagehide', 'focus']) {
    window.addEventListener(kind, (event) => traceEvent(kind, { persisted: event.persisted }));
  }
  document.addEventListener('visibilitychange', () => traceEvent('visibilitychange', { visibility: document.visibilityState }));
  const sanitize = (result) => ({ state: result.state, ...(result.state === 'created' ? { kept: result.kept } : {}) });
  window.fixture = {
    faults,
    client,
    trace() { return [...trace]; },
    inspectDatabase,
    eventCounts() { return { storageEvents, broadcastEvents }; },
    // Cache-only observation is essential for hydration/notification tests:
    // this must never request a canonical read that could repair a stale view.
    cachedView() {
      return {
        observed: [...observed],
        available: client.readAvailableCalendarFeeds().map((feed) => feed.id),
        storageState: client.calendarFeedStorageState(),
      };
    },
    mount() {
      stop?.();
      const update = () => { observed = client.readAvailableCalendarFeeds().map((feed) => feed.id); };
      stop = client.watchCalendarFeeds(update);
      update();
    },
    unmount() { stop?.(); stop = undefined; observed = []; },
    start(id) {
      const ticket = next++;
      traceEvent('start', { ticket });
      const record = { resolve: null, result: null, settled: false };
      pending.set(ticket, record);
      record.promise = client.createCalendarFeed('2.synthetic-cross-tab-fixture', () => new Promise((resolve) => {
        traceEvent('post', { ticket });
        record.resolve = () => resolve(new Response(JSON.stringify({
          id, url: 'https://zodiacs.org/api/calendar/feeds/' + id, secret: 'k'.repeat(42) + 'A',
        }), { status: 201 }));
      })).then((result) => { record.result = sanitize(result); record.settled = true; traceEvent('result', { ticket, ...record.result }); return record.result; });
      return ticket;
    },
    started(ticket) { return typeof pending.get(ticket)?.resolve === 'function'; },
    finish(ticket) { traceEvent('finish', { ticket }); pending.get(ticket).resolve(); },
    result(ticket) { return pending.get(ticket).promise; },
    settled(ticket) { return pending.get(ticket).settled; },
    async remove(id) {
      const feed = client.readAvailableCalendarFeeds().find((entry) => entry.id === id);
      if (!feed) throw new Error('Synthetic removal requires an available capability.');
      const requests = [];
      const state = await client.removeCalendarFeed(feed, async (url, init) => {
        requests.push({
          method: init?.method,
          pathMatches: url === '/api/calendar/feeds/' + id,
          bearerMatches: init?.headers?.Authorization === 'Bearer ' + feed.secret,
        });
        traceEvent('delete', { method: init?.method });
        return new Response(JSON.stringify({ removed: true }), { status: 200 });
      });
      return { state, requests };
    },
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
    startHeldStorage() {
      heldStorage = { entered: false, release: null, result: null };
      heldStorage.result = navigator.locks.request('zodiacs-calendar-feed-storage-v1', { mode: 'exclusive' }, async () => {
        heldStorage.entered = true;
        await new Promise((resolve) => { heldStorage.release = resolve; });
      });
    },
    storageEntered() { return heldStorage?.entered === true; },
    releaseStorage() { heldStorage.release(); return heldStorage.result; },
    async snapshot() {
      const stored = (await client.readKeptCalendarFeeds()).map((feed) => feed.id);
      return {
        available: client.readAvailableCalendarFeeds().map((feed) => feed.id),
        stored, observed: [...observed], storageEvents, broadcastEvents,
        database: await inspectDatabase(),
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
  controlledBoundaries: ['synthetic POST response settlement and successful DELETE response', 'per-document native IndexedDB request/transaction refusal and abort', 'dropped native BroadcastChannel and storage-event delivery'],
  storageAndLocks: 'Native same-origin IndexedDB and Web Locks in two real documents; localStorage is inspected only for absent calendar keys',
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
const inspectDatabase = (page) => page.evaluate(() => window.fixture.inspectDatabase());
const snapshot = async (page) => {
  const state = await page.evaluate(() => window.fixture.snapshot());
  assert.deepEqual(state.calendarKeys, [], 'calendar capabilities and fences must never use localStorage');
  assert.ok(state.database.rowCount === 0 || state.database.rowCount === 1, 'the canonical store must contain at most one row');
  assert.deepEqual([...state.stored].sort(), [...state.database.feedIds].sort(), 'the kept list must match the actual canonical row');
  if (state.database.rowCount === 1) {
    assert.deepEqual(state.database.rowFields, ['feeds', 'fence']);
    assert.match(state.database.fence, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    for (const fields of state.database.feedFields) assert.deepEqual(fields, ['id', 'madeAt', 'secret', 'url']);
  }
  return state;
};
const cleared = async (page) => {
  const result = await page.evaluate(() => window.fixture.clear());
  assert.deepEqual(result, { ok: true, value: { ok: true, restoredPreviousArchive: false } });
  const state = await snapshot(page);
  assert.deepEqual(state.calendarKeys, [], 'clear-all must leave no calendar-owned marker');
  assert.equal(state.database.rowCount, 0, 'successful clear must erase every canonical row');
  assert.equal(state.database.fence, null, 'successful clear must erase the fence');
  assert.deepEqual(state.database.feedIds, [], 'successful clear must erase all capabilities');
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
    // Finish initial canonical refreshes before a test deliberately holds locks.
    await Promise.all([snapshot(a), snapshot(b)]);
    const evidence = await run({ a, b, context });
    report.results.push({ name, passed: true, evidence });
  } catch (error) {
    report.results.push({ name, passed: false, error: String(error.stack ?? error) });
  } finally {
    report.results.at(-1).traces = await Promise.all([a, b].map(async (page, index) => ({
      document: index === 0 ? 'a' : 'b',
      events: await page.evaluate(() => window.fixture?.trace() ?? []).catch(() => []),
    })));
    await context.close();
  }
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
    await a.waitForFunction(() => window.fixture.eventCounts().broadcastEvents > 0);
    assert.deepEqual(await finish(a, ticket), { state: 'cancelled' });
    assert.deepEqual((await snapshot(a)).stored, []);
    assert.deepEqual((await snapshot(a)).available, []);
    return { nativeBroadcastMessagesObserved: true, staleResponse: 'cancelled', postClearCalendarKeys: 0 };
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
    assert.deepEqual((await inspectDatabase(a)).feedIds, []);
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
    assert.equal((await inspectDatabase(a)).rowCount, 0);
    assert.deepEqual(await a.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('zodiacs.calendar'))), []);
    assert.deepEqual(await b.evaluate(() => window.fixture.releaseClear()), { ok: true, value: { ok: true, restoredPreviousArchive: false } });
    await a.waitForFunction((value) => window.fixture.started(value), ticket);
    assert.deepEqual(await finish(a, ticket), { state: 'created', kept: true });
    assert.deepEqual((await snapshot(a)).stored, [ID]);
    return { postStartedBeforeClearReleased: false, preflightLinearizedAfterClear: true, newSubscriptionKept: true };
  });
  // Both documents have initialized an absent-fence cache before either
  // preflight can run. Exercise native lock handoff in fresh contexts rather
  // than trusting Playwright to schedule two page.evaluate calls together.
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await group(`queued independent subscriptions preserve both records (${attempt}/20)`, async ({ a, b }) => {
      await a.evaluate(() => window.fixture.startHeldStorage());
      await a.waitForFunction(() => window.fixture.storageEntered());
      const [one, two] = await Promise.all([
        a.evaluate((id) => window.fixture.start(id), ID),
        b.evaluate((id) => window.fixture.start(id), OTHER_ID),
      ]);
      await a.waitForFunction(async () => (await navigator.locks.query()).pending
        .filter((lock) => lock.name === 'zodiacs-calendar-feed-storage-v1' && lock.mode === 'exclusive').length === 2);
      assert.equal(await a.evaluate((ticket) => window.fixture.started(ticket), one), false);
      assert.equal(await b.evaluate((ticket) => window.fixture.started(ticket), two), false);
      await a.evaluate(() => window.fixture.releaseStorage());
      await Promise.all([
        a.waitForFunction((ticket) => window.fixture.started(ticket), one),
        b.waitForFunction((ticket) => window.fixture.started(ticket), two),
      ]);
      const results = await Promise.all([finish(a, one), finish(b, two)]);
      assert.deepEqual(results, [{ state: 'created', kept: true }, { state: 'created', kept: true }]);
      assert.deepEqual((await snapshot(a)).stored.sort(), [ID, OTHER_ID].sort());
      assert.deepEqual((await snapshot(b)).stored.sort(), [ID, OTHER_ID].sort());
      await cleared(b);
      assert.deepEqual((await snapshot(a)).available, []);
      return { preflightsQueuedBeforeRelease: 2, independentPosts: 2, storedFeeds: 2, postClearCalendarKeys: 0 };
    });
  }
  for (const fault of ['transactions', 'abortPut']) {
    await group(`a ${fault === 'abortPut' ? 'native aborted put' : 'denied native transaction'} never reports a retained capability`, async ({ a }) => {
      const ticket = await begin(a);
      const before = await inspectDatabase(a);
      assert.equal(before.rowCount, 1);
      assert.deepEqual(before.feedIds, []);
      await a.evaluate((name) => { window.fixture.faults[name] = true; }, fault);
      assert.deepEqual(await finish(a, ticket), { state: 'created', kept: false });
      const failed = await inspectDatabase(a);
      assert.deepEqual(failed, before, 'failure must not commit any part of the capability write');
      await a.evaluate((name) => { window.fixture.faults[name] = false; window.fixture.unmount(); window.fixture.mount(); }, fault);
      const recovered = await snapshot(a);
      assert.deepEqual(recovered.stored, []);
      assert.deepEqual(recovered.available, [ID]);
      assert.deepEqual(recovered.observed, [ID]);
      assert.deepEqual(recovered.database, before, 'recovering access must never persist volatile capabilities automatically');
      const events = await a.evaluate(() => window.fixture.trace());
      assert.ok(events.some((event) => event.kind === (fault === 'abortPut' ? 'idb-synthetic-abort' : 'idb-transaction-refused')));
      if (fault === 'abortPut') assert.ok(events.some((event) => event.kind === 'idb-transaction-abort'));
      await cleared(a);
      assert.deepEqual((await snapshot(a)).available, []);
      return { fault, result: { state: 'created', kept: false }, rolledBack: true, retainedAfterRecovery: false, volatileCapabilityErased: true };
    });
  }
  for (const fault of ['clears', 'abortClear']) {
    await group(`a ${fault === 'abortClear' ? 'native aborted clear' : 'denied native clear'} cannot report successful erasure`, async ({ a, b }) => {
      assert.deepEqual(await finish(a, await begin(a)), { state: 'created', kept: true });
      const before = await snapshot(b);
      assert.deepEqual(before.stored, [ID]);
      assert.equal(before.database.rowCount, 1);
      await b.evaluate((name) => { window.fixture.faults[name] = true; }, fault);
      assert.deepEqual(await b.evaluate(() => window.fixture.clear()), { ok: true, value: { ok: false, restoredPreviousArchive: false } });
      assert.deepEqual(await inspectDatabase(b), before.database, 'failed erasure must retain the complete original canonical row');
      await b.evaluate((name) => { window.fixture.faults[name] = false; }, fault);
      assert.deepEqual((await snapshot(a)).stored, [ID]);
      assert.deepEqual((await snapshot(b)).stored, [ID]);
      const events = await b.evaluate(() => window.fixture.trace());
      assert.ok(events.some((event) => event.kind === (fault === 'abortClear' ? 'idb-synthetic-abort' : 'idb-clear-refused')));
      assert.ok(events.some((event) => event.kind === 'idb-transaction-abort'));
      await cleared(b);
      const after = await snapshot(a);
      assert.deepEqual(after.available, []);
      assert.deepEqual(after.stored, []);
      assert.equal(after.database.rowCount, 0);
      assert.equal(after.database.fence, null);
      return { fault, failedErasureReported: true, originalRowRetainedUntilRetry: true, successfulRetryErasedRowsAndFence: true };
    });
  }
  await group('remount after a missed clear hydrates a previously durable key away without an explicit read', async ({ a, b }) => {
    assert.deepEqual(await finish(a, await begin(a)), { state: 'created', kept: true });
    assert.deepEqual(await a.evaluate(() => window.fixture.cachedView()), {
      observed: [ID], available: [ID], storageState: 'ready',
    });
    const messagesBeforeClear = await a.evaluate(() => window.fixture.eventCounts().broadcastEvents);
    await a.evaluate(() => { window.fixture.faults.dropEvents = true; window.fixture.unmount(); });
    await cleared(b);
    await a.waitForFunction((before) => window.fixture.eventCounts().broadcastEvents > before, messagesBeforeClear);
    assert.deepEqual(await a.evaluate(() => window.fixture.cachedView()), {
      observed: [], available: [ID], storageState: 'ready',
    }, 'the missed clear must leave a stale cached key before remount exercises automatic hydration');
    const mounting = await a.evaluate(() => { window.fixture.mount(); return window.fixture.cachedView(); });
    assert.equal(mounting.storageState, 'loading', 'remount must expose its pending canonical hydration');
    await a.waitForFunction(() => {
      const view = window.fixture.cachedView();
      return view.storageState === 'ready' && view.observed.length === 0 && view.available.length === 0;
    });
    assert.deepEqual(await a.evaluate(() => window.fixture.cachedView()), {
      observed: [], available: [], storageState: 'ready',
    });
    // Verify erasure only after the cache-only assertions have passed.
    const database = await inspectDatabase(a);
    assert.equal(database.rowCount, 0);
    assert.equal(database.fence, null);
    assert.deepEqual(database.feedIds, []);
    assert.ok((await a.evaluate(() => window.fixture.trace())).some((event) => event.kind === 'broadcast-message' && event.dropped));
    return { previouslyDurable: true, clearNotificationDropped: true, remountExposedLoading: true, automaticHydrationRemovedCachedKey: true };
  });
  await group('another document removing a durable feed clears the creator cache under the retained fence', async ({ a, b }) => {
    assert.deepEqual(await finish(a, await begin(a)), { state: 'created', kept: true });
    assert.deepEqual(await a.evaluate(() => window.fixture.cachedView()), {
      observed: [ID], available: [ID], storageState: 'ready',
    });
    await b.waitForFunction((id) => {
      const view = window.fixture.cachedView();
      return view.storageState === 'ready' && view.observed.includes(id) && view.available.includes(id);
    }, ID);
    const before = await inspectDatabase(a);
    assert.equal(before.rowCount, 1);
    assert.deepEqual(before.feedIds, [ID]);
    const messagesBeforeRemoval = await a.evaluate(() => window.fixture.eventCounts().broadcastEvents);
    assert.deepEqual(await b.evaluate((id) => window.fixture.remove(id), ID), {
      state: 'removed', requests: [{ method: 'DELETE', pathMatches: true, bearerMatches: true }],
    });
    await a.waitForFunction((messagesBefore) => {
      const view = window.fixture.cachedView();
      return window.fixture.eventCounts().broadcastEvents > messagesBefore
        && view.storageState === 'ready' && view.observed.length === 0 && view.available.length === 0;
    }, messagesBeforeRemoval);
    assert.deepEqual(await a.evaluate(() => window.fixture.cachedView()), {
      observed: [], available: [], storageState: 'ready',
    }, 'an advisory refresh must not retain a durable capability as a volatile echo');
    // Inspect the retained canonical fence after proving the notification alone
    // refreshed A's view; no explicit client read may repair the cache first.
    const after = await inspectDatabase(a);
    assert.equal(after.rowCount, 1);
    assert.equal(after.fence, before.fence);
    assert.deepEqual(after.feedIds, []);
    return { syntheticDeleteSent: true, nativeAdvisoryReceived: true, creatorCacheAndObserverEmpty: true, fenceRetained: true };
  });
  assert.equal(report.results.length, 34, 'all original 8 semantic cases, 20 queued-preflight cases, 4 native failure cases, and 2 automatic view refresh cases are required');
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
