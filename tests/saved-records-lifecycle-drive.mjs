/**
 * Saved calculation records: the real user journey on a build with
 * PUBLIC_SAVED_RECORDS_ENABLED=1. Calculate → keep → find → download the exact
 * bytes → remove → reload; remove all → readmit through an explicit keep;
 * uncertain keep; simulated account-sync-v2 guest/account/retained/guest-view
 * scopes with A→B→A staleness; blocked and unsupported storage.
 *
 * Run after `npm run build` with the flag:
 *   OUT_DIR=tests/visual/artifacts/saved-records-lifecycle node tests/saved-records-lifecycle-drive.mjs
 * Every account id and birth input is synthetic. No request leaves loopback.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { recordHelpers } from './saved-records-browser-lib.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/saved-records-lifecycle');
/** ENGINE=firefox runs the same journeys in a Playwright-managed Firefox (device mode; the simulated v2 reader needs no Web Locks). */
const ENGINE = process.env.ENGINE === 'firefox' ? 'firefox' : 'chromium';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const GRANT_KEY = 'zodiacs.account-sync-v2.profile-access.v1';
const OWNER_KEY = 'zodiacs.account-sync-v2.local-owner.v1';
const RETAINED_KEY = 'zodiacs.account-sync-v2.retained-owner.v1';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const results = [];
let browser;
let base;

async function newContext(options = {}) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const blocked = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  if (options.v2) {
    // Simulate the account-sync-v2 coordinator on a flag-off build: the
    // pre-hydration reader, the session grant and the owner markers are the
    // exact surfaces the strict record mode reads; events revoke handles.
    await context.addInitScript(() => {
      // Init scripts can run before <html> exists; stamp the boundary flag the
      // moment the root element is inserted, before any island reads it.
      const stamp = () => {
        const root = document.documentElement;
        if (!root) return false;
        root.setAttribute('data-account-sync-v2', '');
        return true;
      };
      if (!stamp()) new MutationObserver((_, observer) => { if (stamp()) observer.disconnect(); }).observe(document, { childList: true });
      window.__access = true;
      Object.defineProperty(window, 'zodiacsProfileAccess', {
        configurable: true,
        value: Object.freeze({ activateLease() {}, revokeLease() {}, canRead: () => window.__access === true }),
      });
    });
  }
  if (options.init) await context.addInitScript(options.init);
  const errors = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
  return { context, blocked, errors };
}

const only = process.env.ONLY ?? '';
async function check(name, run) {
  if (only && !name.includes(only)) return;
  const start = Date.now();
  let detail;
  try {
    detail = await run();
    results.push({ name, passed: true, detail, ms: Date.now() - start });
  } catch (error) {
    results.push({ name, passed: false, error: String(error?.stack ?? error), ms: Date.now() - start });
  }
  console.log(`${results.at(-1).passed ? 'PASS' : 'FAIL'} ${name}`);
  // Hosted logs must carry the cause; result.json is only an artifact.
  if (!results.at(-1).passed) console.log(results.at(-1).error.split('\n').slice(0, 14).map((line) => `  ${line}`).join('\n'));
}

// Page helpers shared with the account-coordinator drive; bound to the preview origin below.
let gotoChart, computeKnownTime, keepState, waitKeepState, keep, downloadBytes, gotoProfile, recordCount, removeRecord;

async function setV2(page, mode) {
  await page.evaluate(({ mode, A, B, GRANT_KEY, OWNER_KEY, RETAINED_KEY }) => {
    localStorage.removeItem(OWNER_KEY); localStorage.removeItem(RETAINED_KEY);
    if (mode === 'unowned') sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'unowned' }));
    else {
      const accountId = mode.endsWith('B') ? B : A;
      localStorage.setItem(OWNER_KEY, JSON.stringify({ version: 1, accountId }));
      if (mode.startsWith('retained')) {
        localStorage.setItem(RETAINED_KEY, JSON.stringify({ version: 1, accountId }));
        sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'retained', accountId }));
      } else sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'account', accountId }));
    }
    window.dispatchEvent(new Event('zodiacs:profile-access'));
  }, { mode, A, B, GRANT_KEY, OWNER_KEY, RETAINED_KEY });
}

try {
  await mkdir(OUT, { recursive: true });
  browser = ENGINE === 'firefox'
    ? await firefox.launch({ headless: true })
    : await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
  await withPreview({ port: 4411 }, async (baseURL) => {
    base = baseURL;
    ({ gotoChart, computeKnownTime, keepState, waitKeepState, keep, downloadBytes, gotoProfile, recordCount, removeRecord } = recordHelpers(base));

    // The legacy saved-chart store itself (charts and deletion tombstones). Derived caches (year-ahead
    // forecast) and the Living Chart's lazily created guest vault are written by Profile islands on
    // their own schedule and are not saved-chart data.
    const legacyBytes = (page) => page.evaluate(() => JSON.stringify(Object.entries(localStorage)
      .filter(([key]) => key.startsWith('zodiacs.profile.')).sort()));
    const databases = (page) => page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));

    await check('device mode: keep, find, exact download, remove, reload', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      assert.equal(await gotoProfile(page), 'ready');
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      // Visiting Profile and viewing a result create nothing; only an explicit keep does.
      assert.ok(!(await databases(page)).includes('zodiacs-saved-natal-v1'), 'no database before an explicit keep');
      await page.click('[data-save-chart]');
      await page.waitForFunction(() => /Saved/u.test(document.querySelector('[data-save-chart]')?.textContent ?? ''));
      const legacyBefore = await legacyBytes(page);
      const scopeLine = await page.textContent('#calculation-record-scope');
      assert.match(scopeLine, /Stays on this device only\. Not part of any account\./u);
      const receipt = await downloadBytes(page, '[data-download-calculation-receipt]');
      assert.equal(await keep(page), 'kept');
      assert.ok(await page.$('[data-record-kept]'));
      const state = await gotoProfile(page);
      assert.equal(state, 'ready');
      assert.equal(await recordCount(page), 1);
      const record = await downloadBytes(page, '[data-record-download]');
      assert.equal(sha(record.bytes), sha(receipt.bytes), 'record bytes differ from the calculator receipt');
      assert.match(record.name, /^zodiacs-calculation-record-1990-06-15\.json$/u);
      const facts = await page.textContent('[data-record-id]');
      assert.match(facts, /1990-06-15 · 14:30 · Europe\/London/u);
      await removeRecord(page);
      assert.equal(await recordCount(page), 0);
      await page.reload();
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 0);
      assert.equal(await legacyBytes(page), legacyBefore, 'legacy saved-chart bytes are untouched by keep and remove');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { bytes: receipt.bytes.length, sha256: sha(receipt.bytes) };
    });

    await check('device mode: an armed removal is cancellable and expires; only a deliberate second activation removes', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      assert.equal(await keep(page), 'kept');
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await waitKeepState(page, ['idle']);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 2);

      const armedNow = () => page.$eval('[data-saved-records]', (panel) => panel.querySelector('[aria-pressed="true"]') !== null);
      const liveText = () => page.textContent('[data-records-live]');
      const arm = async (selector) => {
        await page.click(selector);
        assert.equal(await armedNow(), true, `${selector} must arm on the first activation`);
      };
      // The armed state is not only a changed label: it is announced, and it says how to back out.
      await arm('[data-record-remove]');
      assert.match(await liveText(), /press Escape to cancel/u);

      // Every ordinary way of saying "not that" returns the control to safe.
      await page.keyboard.press('Escape');
      assert.equal(await armedNow(), false, 'Escape must disarm');
      await arm('[data-record-remove]');
      await page.click('#calculation-records-heading');
      assert.equal(await armedNow(), false, 'a pointer down anywhere else must disarm');
      await arm('[data-record-remove]');
      await page.$eval('[data-record-remove]', (button) => button.blur());
      assert.equal(await armedNow(), false, 'moving focus away must disarm');
      await arm('[data-records-remove-all]');
      await page.click('#calculation-records-heading');
      assert.equal(await armedNow(), false, 'remove-all must disarm the same way');

      // And one left alone expires on its own, so a later stray tap cannot destroy anything.
      await arm('[data-record-remove]');
      await page.waitForFunction(() => document.querySelector('[data-saved-records] [aria-pressed="true"]') === null, null, { timeout: 30_000 });
      assert.equal(await recordCount(page), 2, 'nothing may be removed by arming alone');

      // A deliberate second activation still removes, says so, and leaves the keyboard inside the panel.
      await arm('[data-record-remove]');
      await page.click('[data-record-remove]');
      await page.waitForFunction(() => document.querySelector('[data-records-count]')?.getAttribute('data-records-count') === '1');
      assert.match(await liveText(), /The record was removed\./u);
      assert.equal(await page.evaluate(() => document.activeElement?.id ?? ''), 'calculation-records-heading');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { cancelled: ['escape', 'pointer-elsewhere', 'blur', 'timeout'], removedAfterConfirm: 1 };
    });

    await check('device mode: remove all, then an explicit keep readmits a new set', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await keep(page), 'kept');
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 2);
      await page.click('[data-records-remove-all]');
      await page.click('[data-records-remove-all]');
      await page.waitForSelector('[data-records-empty="erased"]');
      const message = await page.textContent('[data-records-message]');
      assert.match(message, /All listed records were removed\./u);
      await page.reload();
      assert.equal(await gotoProfile(page), 'ready');
      assert.ok(await page.$('[data-records-empty="erased"]'), 'erased state must survive reload');
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      const note = await page.textContent('#calculation-record-scope');
      assert.match(note, /records kept here were removed earlier/u);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { readmitted: true };
    });

    await check('device mode: an uncertain keep is stated, never retried, and reconciled in Profile', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      // The commit succeeds, then an access change lands before the result is delivered.
      await page.evaluate(() => {
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          const transaction = original.apply(this, args);
          if (this.name === 'zodiacs-saved-natal-v1' && transaction.mode === 'readwrite') {
            IDBDatabase.prototype.transaction = original;
            transaction.addEventListener('complete', () => window.dispatchEvent(new Event('zodiacs:profile-access')), { once: true });
          }
          return transaction;
        };
      });
      const state = await keep(page);
      assert.equal(state, 'uncertain');
      assert.equal(await page.$('[data-record-kept]'), null, 'no success toast after a stale completion');
      assert.match(await page.textContent('[data-record-keep-message]'), /may or may not have been kept/u);
      const label = await page.textContent('[data-keep-calculation-record]');
      assert.match(label, /Keep this calculation again/u);
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1, 'the committed record is discoverable for reconciliation');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { state };
    });

    await check('simulated account-sync-v2: guest, account A, hidden guest records, A→B→A staleness', async () => {
      const { context, blocked, errors } = await newContext({ v2: true });
      const page = await context.newPage();
      await page.goto(`${base}/`);
      await setV2(page, 'unowned');
      await computeKnownTime(page);
      assert.match(await page.textContent('#calculation-record-scope'), /Not part of any account/u);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      // Sign in as A: the owner marker and grant change; the guest namespace is hidden, not relabeled.
      await setV2(page, 'accountA');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready');
      assert.equal(await recordCount(page), 0, 'guest records must not be shown to account A');
      assert.ok(await page.$('[data-records-hidden-guest="1"]'), 'the account is told that hidden guest records exist');
      assert.match(await page.textContent('[data-records-hidden-guest]'), /kept without an account/u);
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await setV2(page, 'accountA');
      await waitKeepState(page, ['idle']);
      assert.match(await page.textContent('#calculation-record-scope'), /kept for your signed-in account/u);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      assert.match(await page.textContent('[data-record-id]'), /1985-03-02/u);
      // A→B→A while a keep commits: the owner string returns to A, the handle is still stale.
      await computeKnownTime(page, { date: '2001-12-21', time: '08:30', place: 'Longyearbyen' });
      await setV2(page, 'accountA');
      await waitKeepState(page, ['idle']);
      await page.evaluate(({ A, B, GRANT_KEY, OWNER_KEY }) => {
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function (...args) {
          const transaction = original.apply(this, args);
          if (this.name === 'zodiacs-saved-natal-v1' && transaction.mode === 'readwrite') {
            IDBDatabase.prototype.transaction = original;
            transaction.addEventListener('complete', () => {
              localStorage.setItem(OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
              sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'account', accountId: B }));
              window.dispatchEvent(new Event('zodiacs:profile-access'));
              localStorage.setItem(OWNER_KEY, JSON.stringify({ version: 1, accountId: A }));
              sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'account', accountId: A }));
              window.dispatchEvent(new Event('zodiacs:profile-access'));
            }, { once: true });
          }
          return transaction;
        };
      }, { A, B, GRANT_KEY, OWNER_KEY });
      const state = await keep(page);
      assert.equal(state, 'uncertain', 'a keep that committed under old A authority is uncertain, not kept');
      assert.equal(await page.$('[data-record-kept]'), null);
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 2, 'A finds both committed records after re-evaluation');
      // B sees neither A's nor the guest's records.
      await setV2(page, 'accountB');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready');
      assert.equal(await recordCount(page), 0);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { state };
    });

    await check('simulated account-sync-v2: retained is read-only; guest view switches only the record scope', async () => {
      const { context, blocked, errors } = await newContext({ v2: true });
      const page = await context.newPage();
      await page.goto(`${base}/`);
      await setV2(page, 'unowned');
      await computeKnownTime(page);
      assert.equal(await keep(page), 'kept');
      await setV2(page, 'accountA');
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await setV2(page, 'accountA');
      await waitKeepState(page, ['idle']);
      const parisReceipt = await downloadBytes(page, '[data-download-calculation-receipt]');
      assert.equal(await keep(page), 'kept');
      await computeKnownTime(page, { date: '1977-08-09', time: '06:00', place: 'Tokyo' });
      await setV2(page, 'accountA');
      await waitKeepState(page, ['idle']);
      assert.equal(await keep(page), 'kept');
      // Explicit retained sign-out: A's records stay readable, new keeps are refused.
      await setV2(page, 'retainedA');
      assert.equal(await gotoProfile(page), 'ready');
      await page.waitForSelector('[data-records-retained]');
      assert.equal(await recordCount(page), 2);
      // Read-only still means find, download the exact bytes and remove.
      const items = await page.$$('[data-record-id]');
      const retainedDownload = await downloadBytes(page, `[data-record-id="${await items[1].getAttribute('data-record-id')}"] [data-record-download]`);
      assert.equal(sha(retainedDownload.bytes), sha(parisReceipt.bytes), 'retained download is the exact receipt');
      await removeRecord(page, 0);
      assert.equal(await recordCount(page), 1);
      assert.match(await page.textContent('[data-record-id]'), /1985-03-02/u);
      await computeKnownTime(page, { date: '2001-12-21', time: '08:30', place: 'Longyearbyen' });
      await setV2(page, 'retainedA');
      const readOnly = await waitKeepState(page, ['read-only']);
      assert.equal(readOnly, 'read-only');
      assert.ok(await page.$('[data-keep-calculation-record][disabled]'));
      assert.match(await page.textContent('[data-record-keep-message]'), /Sign in to keep new calculations/u);
      // Deliberate guest view: the guest record appears, A's record is hidden, keeping works as guest.
      assert.equal(await gotoProfile(page), 'ready');
      await page.click('[data-records-use-guest]');
      await page.waitForSelector('[data-records-guest-view]');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready');
      assert.equal(await recordCount(page), 1);
      assert.match(await page.textContent('[data-record-id]'), /1990-06-15/u);
      await page.click('[data-records-use-account]');
      await page.waitForSelector('[data-records-retained]');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready');
      assert.match(await page.textContent('[data-record-id]'), /1985-03-02/u);
      // Re-authentication as A ignores a guest-view selection; A's namespace is A's.
      await page.click('[data-records-use-guest]');
      await page.waitForSelector('[data-records-guest-view]');
      await setV2(page, 'accountA');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready'
        && !document.querySelector('[data-records-guest-view]'));
      assert.match(await page.textContent('[data-record-id]'), /1985-03-02/u);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { retainedReadOnly: true, guestView: true };
    });

    await check('device mode: an interrupted removal is finished on the next visit; keeping afterwards starts a new set', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      // Every purge transaction aborts on this page after the intent committed.
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.delete;
        IDBObjectStore.prototype.delete = function (...args) {
          const request = original.apply(this, args);
          if (this.name === 'records') request.addEventListener('success', () => { try { this.transaction.abort(); } catch { /* already aborted */ } }, { once: true });
          return request;
        };
      });
      await page.click('[data-records-remove-all]');
      await page.click('[data-records-remove-all]');
      await page.waitForSelector('[data-records-message]');
      assert.match(await page.textContent('[data-records-message]'), /queued but did not finish/u);
      await page.waitForFunction(() => ['unavailable', 'pending'].includes(document.querySelector('[data-saved-records]')?.getAttribute('data-saved-records-state')));
      assert.equal(await page.$('[data-record-id]'), null, 'no record content is shown while the removal is unfinished');
      // The intent is durable: the next visit finishes it without any authority.
      await page.reload();
      assert.equal(await gotoProfile(page), 'ready');
      assert.ok(await page.$('[data-records-empty="erased"]'), 'recovery finished the committed removal');
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      assert.match(await page.textContent('#calculation-record-scope'), /records kept here were removed earlier/u);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { recovered: true };
    });

    await check('device mode: a removal in another tab reaches an open calculator without reload', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await keep(page), 'kept');
      const other = await context.newPage();
      assert.equal(await gotoProfile(other), 'ready');
      assert.equal(await recordCount(other), 1);
      await other.click('[data-records-remove-all]');
      await other.click('[data-records-remove-all]');
      await other.waitForSelector('[data-records-empty="erased"]');
      // The storage announcement re-opens the first tab's scope: no stale "kept", the erased note instead.
      await waitKeepState(page, ['idle']);
      assert.equal(await page.$('[data-record-kept]'), null);
      assert.match(await page.textContent('#calculation-record-scope'), /records kept here were removed earlier/u);
      assert.equal(await keep(page), 'kept', 'an explicit keep readmits the device set');
      await other.waitForFunction(() => document.querySelector('[data-records-count]')?.getAttribute('data-records-count') === '1');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { crossTab: true };
    });

    await check('simulated account-sync-v2: locked without a grant, never a guest fallback', async () => {
      // The pre-hydration reader refuses on every page load, not just this one.
      const { context, blocked, errors } = await newContext({ v2: true, init: () => { window.__access = false; } });
      const page = await context.newPage();
      assert.equal(await gotoProfile(page), 'locked');
      await computeKnownTime(page);
      assert.equal(await waitKeepState(page, ['locked']), 'locked');
      const databases = await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name));
      assert.ok(!databases.includes('zodiacs-saved-natal-v1'), 'a locked visit must not create the database');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { databases };
    });

    await check('blocked storage is an honest unavailable state; legacy saves still work', async () => {
      const { context, blocked, errors } = await newContext({
        init: () => {
          Object.defineProperty(IDBFactory.prototype, 'databases', {
            configurable: true, value: () => Promise.reject(new DOMException('blocked by policy', 'InvalidStateError')),
          });
        },
      });
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await waitKeepState(page, ['unavailable']), 'unavailable');
      await page.click('[data-save-chart]');
      await page.waitForFunction(() => /Saved/u.test(document.querySelector('[data-save-chart]')?.textContent ?? ''));
      assert.equal(await gotoProfile(page), 'unavailable');
      assert.match(await page.textContent('.pf-count'), /1 birth chart saved\./u);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { legacySaveUnaffected: true };
    });

    await check('a browser without indexedDB.databases() is an honest unsupported state; legacy saves still work', async () => {
      const { context, blocked, errors } = await newContext({ init: () => { delete IDBFactory.prototype.databases; } });
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await waitKeepState(page, ['unavailable']), 'unavailable');
      await page.click('[data-save-chart]');
      await page.waitForFunction(() => /Saved/u.test(document.querySelector('[data-save-chart]')?.textContent ?? ''));
      assert.equal(await gotoProfile(page), 'unsupported');
      assert.match(await page.textContent('[data-saved-records] .pf-records__status'), /browser feature this browser does not offer/u);
      assert.match(await page.textContent('.pf-count'), /1 birth chart saved\./u);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { legacySaveUnaffected: true };
    });

    await check('device mode: two tabs keeping at once admit exactly one set; a loser, if any, is told nothing was stored', async () => {
      const { context, blocked, errors } = await newContext();
      const first = await context.newPage();
      const second = await context.newPage();
      await computeKnownTime(first);
      await computeKnownTime(second, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await waitKeepState(first, ['idle']);
      await waitKeepState(second, ['idle']);
      const outcomes = await Promise.all([keep(first), keep(second)]);
      assert.ok(outcomes.includes('kept'), `one keep must win: ${outcomes.join(', ')}`);
      const loser = outcomes[0] === 'kept' ? second : first;
      const loserState = outcomes[0] === 'kept' ? outcomes[1] : outcomes[0];
      assert.ok(['kept', 'changed'].includes(loserState), `loser outcome ${loserState}`);
      if (loserState === 'changed') {
        assert.match(await loser.textContent('[data-record-keep-message]'), /Nothing was stored/u);
        await waitKeepState(loser, ['changed']);
        assert.equal(await keep(loser), 'kept', 'an explicit second keep succeeds against the winner\'s admission');
      }
      assert.equal(await gotoProfile(first), 'ready');
      assert.equal(await recordCount(first), 2);
      const single = await first.evaluate(async () => (await indexedDB.databases()).filter((entry) => entry.name === 'zodiacs-saved-natal-v1').length);
      assert.equal(single, 1);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { outcomes };
    });

    // Records every keep state a calculator tab shows from now on, and counts
    // the completed re-opens of its scope: the scope line empties while the
    // scope is replaced and is written again once the new one is open.
    const watchKeep = (page) => page.evaluate(() => {
      const box = document.querySelector('[data-record-keep]');
      const line = document.querySelector('#calculation-record-scope');
      const seen = (window.__keepSeen = { states: [], reopened: 0 });
      let emptied = false;
      new MutationObserver(() => seen.states.push(box.getAttribute('data-record-keep-state')))
        .observe(box, { attributes: true, attributeFilter: ['data-record-keep-state'] });
      new MutationObserver(() => {
        if (line.textContent.trim() === '') emptied = true;
        else if (emptied) { emptied = false; seen.reopened += 1; }
      }).observe(line, { childList: true, characterData: true, subtree: true });
    });
    const keepSeen = (page) => page.evaluate(() => window.__keepSeen);

    await check('device mode: a keep in another tab leaves this tab\'s "Kept" standing, so nothing offers to keep it twice', async () => {
      const { context, blocked, errors } = await newContext();
      const first = await context.newPage();
      const second = await context.newPage();
      await computeKnownTime(first);
      await computeKnownTime(second, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await waitKeepState(first, ['idle']);
      await waitKeepState(second, ['idle']);
      await watchKeep(second);
      assert.equal(await keep(first), 'kept');
      // One after the other: the second tab has re-opened on the first tab's announcement.
      await second.waitForFunction(() => window.__keepSeen.reopened > 0);
      await waitKeepState(second, ['idle']);
      await watchKeep(first);
      assert.equal(await keep(second), 'kept');
      await first.waitForFunction(() => window.__keepSeen.reopened > 0);
      const probe = await context.newPage();
      assert.equal(await gotoProfile(probe), 'ready');
      assert.equal(await recordCount(probe), 2);
      // The first tab's record is still there, so its confirmation never left
      // and its button never offered to keep the same calculation again.
      const { states } = await keepSeen(first);
      assert.deepEqual(states, [], 'the first tab must stay "Kept" through the second tab\'s keep');
      assert.ok(await first.$('[data-record-kept]'));
      assert.ok(await first.$('[data-keep-calculation-record][disabled]'));
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { firstStatesAfterSecondKeep: states };
    });

    await check('device mode: a keep that missed another tab\'s keep stores nothing and says so until the next click', async () => {
      const { context, blocked, errors } = await newContext();
      const first = await context.newPage();
      const second = await context.newPage();
      // The second tab's click lands before the first tab's announcement
      // reaches it: hold that one announcement back (listening before any page
      // script does), so the click acts on the scope the second tab opened
      // before the device set was admitted.
      await second.addInitScript((key) => {
        const hold = (event) => {
          if (event.key !== key) return;
          event.stopImmediatePropagation();
          window.removeEventListener('storage', hold);
          window.__announcementHeld = true;
        };
        window.addEventListener('storage', hold);
      }, 'zodiacs.saved-records.scope-change.v1');
      await computeKnownTime(first);
      await computeKnownTime(second, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await waitKeepState(first, ['idle']);
      await waitKeepState(second, ['idle']);
      assert.equal(await keep(first), 'kept');
      await second.waitForFunction(() => window.__announcementHeld === true);
      assert.equal(await keep(second), 'changed');
      assert.match(await second.textContent('[data-record-keep-message]'), /Nothing was stored/u);
      // The re-open that follows the refusal leaves the message in place; the
      // button comes back once the fresh scope is open.
      await second.waitForSelector('[data-keep-calculation-record]:not([disabled])');
      assert.equal(await keepState(second), 'changed');
      assert.match(await second.textContent('[data-record-keep-message]'), /Nothing was stored/u);
      assert.equal(await keep(second), 'kept', 'an explicit second keep succeeds against the other tab\'s admission');
      const probe = await context.newPage();
      assert.equal(await gotoProfile(probe), 'ready');
      assert.equal(await recordCount(probe), 2);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { refusedThenKept: true };
    });

    await check('device mode: a single removal in another tab reaches open inventories and the calculator without reload', async () => {
      const { context, blocked, errors } = await newContext();
      const calculator = await context.newPage();
      await computeKnownTime(calculator);
      assert.equal(await keep(calculator), 'kept');
      const first = await context.newPage();
      assert.equal(await gotoProfile(first), 'ready');
      assert.equal(await recordCount(first), 1);
      const second = await context.newPage();
      assert.equal(await gotoProfile(second), 'ready');
      await removeRecord(second);
      assert.equal(await recordCount(second), 0);
      // The other inventory learns of the removal without a reload: no listed
      // record, and no download button for bytes that no longer exist.
      await first.waitForSelector('[data-records-empty="none"]');
      assert.equal(await first.$('[data-record-download]'), null);
      // The calculator withdraws "Kept" for the removed record; the device set
      // itself is still admitted, so the scope line carries no erased note.
      await waitKeepState(calculator, ['idle']);
      assert.equal(await calculator.$('[data-record-kept]'), null, 'a removed record must not stay "Kept"');
      assert.doesNotMatch(await calculator.textContent('#calculation-record-scope'), /removed earlier/u);
      // Keeping again stores a new record, and open inventories learn of it too.
      assert.equal(await keep(calculator), 'kept');
      await first.waitForFunction(() => document.querySelector('[data-records-count]')?.getAttribute('data-records-count') === '1');
      await second.waitForFunction(() => document.querySelector('[data-records-count]')?.getAttribute('data-records-count') === '1');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { singleRemovalPropagated: true };
    });

    await check('simulated account-sync-v2: removal feedback stays with the namespace that asked for it', async () => {
      const { context, blocked, errors } = await newContext({ v2: true });
      const page = await context.newPage();
      await page.goto(`${base}/`);
      await setV2(page, 'accountA');
      await computeKnownTime(page);
      await setV2(page, 'accountA');
      await waitKeepState(page, ['idle']);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      await setV2(page, 'accountA');
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready');
      assert.equal(await recordCount(page), 1);
      // Ownership moves to B the moment A's purge commits, before the outcome reaches the panel.
      await page.evaluate(({ B, GRANT_KEY, OWNER_KEY }) => {
        const original = IDBDatabase.prototype.transaction;
        let writes = 0;
        IDBDatabase.prototype.transaction = function (...args) {
          const transaction = original.apply(this, args);
          if (this.name === 'zodiacs-saved-natal-v1' && transaction.mode === 'readwrite' && ++writes === 2) {
            IDBDatabase.prototype.transaction = original;
            transaction.addEventListener('complete', () => {
              localStorage.setItem(OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
              sessionStorage.setItem(GRANT_KEY, JSON.stringify({ version: 1, mode: 'account', accountId: B }));
              window.dispatchEvent(new Event('zodiacs:profile-access'));
            }, { once: true });
          }
          return transaction;
        };
      }, { B, GRANT_KEY, OWNER_KEY });
      await page.click('[data-records-remove-all]');
      await page.click('[data-records-remove-all]');
      // B's own (empty, never erased) inventory is shown, with no word about A's removal.
      await page.waitForFunction(() => document.querySelector('[data-saved-records-state]')?.getAttribute('data-saved-records-state') === 'ready'
        && document.querySelector('[data-records-empty="none"]') !== null);
      await page.waitForFunction(() => !document.querySelector('[data-records-remove-all][disabled]'));
      assert.equal(await page.$('[data-records-message]'), null, 'feedback about A must not be shown under B');
      // Back on A the removal is visible as fact; the dropped feedback is not resurrected.
      await setV2(page, 'accountA');
      await page.waitForSelector('[data-records-empty="erased"]');
      assert.equal(await page.$('[data-records-message]'), null);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { staleFeedbackSuppressed: true };
    });

    await check('device mode: unknown birth time: keep, find, exact download', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page, { date: '1968-02-29', place: 'Lisbon', timeKnown: false });
      await waitKeepState(page, ['idle']);
      const receipt = await downloadBytes(page, '[data-download-calculation-receipt]');
      assert.match(receipt.bytes.toString('utf8'), /"timeKnown":false/u);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1);
      assert.match(await page.textContent('[data-record-id]'), /1968-02-29 · time unknown · Europe\/Lisbon/u);
      const record = await downloadBytes(page, '[data-record-download]');
      assert.equal(sha(record.bytes), sha(receipt.bytes), 'unknown-time record bytes differ from the calculator receipt');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { bytes: receipt.bytes.length, sha256: sha(receipt.bytes) };
    });

    await check('device mode: the fortieth record is kept; the forty-first is refused and nothing is stored', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await computeKnownTime(page);
      assert.equal(await keep(page), 'kept');
      // Thirty-eight further records with the same exact bytes, written as the store would (synthetic ids).
      await page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open('zodiacs-saved-natal-v1');
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('records', 'readwrite');
          const store = transaction.objectStore('records');
          const all = store.getAll();
          all.onsuccess = () => {
            const [template] = all.result;
            for (let index = 1; index <= 38; index++) {
              store.add({ ...template, id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000` });
            }
          };
          transaction.oncomplete = () => { database.close(); resolve(); };
          transaction.onerror = () => { database.close(); reject(transaction.error); };
        };
        request.onerror = () => reject(request.error);
      }));
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 39);
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      assert.equal(await keep(page), 'kept', 'the fortieth record is within the limit');
      await computeKnownTime(page, { date: '1977-08-09', time: '06:00', place: 'Tokyo' });
      assert.equal(await keep(page), 'full');
      assert.match(await page.textContent('[data-record-keep-message]'), /maximum of 40\. Remove one under Profile/u);
      assert.equal(await page.$('[data-record-kept]'), null);
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 40, 'the refused keep stored nothing');
      // Removing one restores room: the same calculation can then be kept.
      await removeRecord(page);
      assert.equal(await recordCount(page), 39);
      await computeKnownTime(page, { date: '1977-08-09', time: '06:00', place: 'Tokyo' });
      assert.equal(await keep(page), 'kept');
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return { limit: 40 };
    });

    await check('an unreleased schema-2 database is refused intact', async () => {
      const { context, blocked, errors } = await newContext();
      const page = await context.newPage();
      await page.goto(`${base}/`);
      await page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open('zodiacs-saved-natal-v1', 2);
        request.onupgradeneeded = () => {
          const records = request.result.createObjectStore('records', { keyPath: ['ownerKey', 'id'] });
          records.createIndex('ownerKey', 'ownerKey');
          request.result.createObjectStore('erasures', { keyPath: 'target' });
        };
        request.onsuccess = () => {
          const transaction = request.result.transaction('records', 'readwrite');
          transaction.objectStore('records').put({ ownerKey: 'guest:30000000-0000-4000-8000-000000000003', id: '40000000-0000-4000-8000-000000000004', preserved: 'synthetic' });
          transaction.oncomplete = () => { request.result.close(); resolve(); };
        };
        request.onerror = () => reject(request.error);
      }));
      assert.equal(await gotoProfile(page), 'unsupported');
      await computeKnownTime(page);
      assert.equal(await waitKeepState(page, ['unavailable']), 'unavailable');
      const preserved = await page.evaluate(() => new Promise((resolve) => {
        const request = indexedDB.open('zodiacs-saved-natal-v1');
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('records', 'readonly');
          const all = transaction.objectStore('records').getAll();
          all.onsuccess = () => { resolve({ version: database.version, rows: all.result }); database.close(); };
        };
      }));
      assert.equal(preserved.version, 2);
      assert.deepEqual(preserved.rows.map((row) => row.preserved), ['synthetic']);
      assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
      await context.close();
      return preserved;
    });
  });
} finally {
  await browser?.close();
  const report = { completedAt: new Date().toISOString(), node: process.version, engine: ENGINE, browser: await browser?.version?.(), results,
    passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length };
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ file: resolve(OUT, 'result.json'), passed: report.passed, failed: report.failed }));
  if (report.failed) process.exitCode = 1;
}
