/**
 * Flag rollback gates for saved calculation records.
 *
 * `PUBLIC_SAVED_RECORDS_ENABLED` is a build-time flag. Activating it and later
 * unsetting it must not strand records on a device, must not defeat the removal
 * promise the feature makes, and must not let an older build corrupt newer rows.
 * These phases run against successive builds of the SAME source while reusing one
 * persistent browser profile, so the IndexedDB state really does survive the
 * "deployment" the way a visitor's browser would.
 *
 * Driven by tests/saved-records-rollback.mjs, which performs the builds in order.
 * Each phase is a separate process against the dist currently on disk:
 *
 *   PHASE=fresh-off      flag-off build, brand new profile: nothing renders, no database
 *   PHASE=keep           flag-on build:  keep two records, capture exact receipt bytes
 *   PHASE=disabled       flag-off build: the records kept above must stay findable,
 *                        downloadable byte-for-byte and removable; no keep affordance
 *   PHASE=reenabled      flag-on build:  whatever phase `disabled` left is what shows
 *
 * Every birth input is synthetic and no request leaves loopback.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { recordHelpers } from './saved-records-browser-lib.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const PHASE = process.env.PHASE ?? '';
const PROFILE_DIR = resolve(process.env.PROFILE_DIR ?? '/tmp/zodiacs-rollback-profile');
const OUT = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/saved-records-rollback');
const STATE = resolve(OUT, 'carry.json');
const DATABASE = 'zodiacs-saved-natal-v1';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const PHASES = ['fresh-off', 'keep', 'disabled', 'reenabled'];
if (!PHASES.includes(PHASE)) {
  console.error(`PHASE must be one of ${PHASES.join(', ')}`);
  process.exit(2);
}

/** Facts carried between phases (they run as separate processes). */
async function readCarry() {
  try { return JSON.parse(await readFile(STATE, 'utf8')); } catch { return {}; }
}
async function writeCarry(next) {
  await mkdir(OUT, { recursive: true });
  await writeFile(STATE, `${JSON.stringify(next, null, 2)}\n`);
}

const results = [];
function record(name, detail) {
  results.push({ phase: PHASE, name, detail });
  console.log(`PASS ${PHASE}: ${name}`);
}

/** Content-free presence probe; never creates the database. */
const databasePresent = (page) => page.evaluate(async (name) => {
  if (typeof indexedDB.databases !== 'function') return 'unsupported';
  return (await indexedDB.databases()).some((entry) => entry.name === name);
}, DATABASE);

let context;
try {
  await mkdir(OUT, { recursive: true });
  const carry = await readCarry();
  const executablePath = await findChromium();

  await withPreview({ port: 4413 }, async (base) => {
    const helpers = recordHelpers(base);
    const { computeKnownTime, waitKeepState, keep, downloadBytes, gotoProfile, recordCount, removeRecord } = helpers;

    // One persistent profile across every phase: this is what makes the test a
    // rollback test rather than four unrelated sessions.
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      executablePath, headless: true, args: STABLE_CHROMIUM_ARGS,
      acceptDownloads: true, viewport: { width: 1280, height: 900 },
    });
    const blocked = [];
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      blocked.push(url);
      return route.abort();
    });
    const errors = [];
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(String(error))));
    const page = context.pages()[0] ?? await context.newPage();

    if (PHASE === 'fresh-off') {
      // A visitor who never had the feature must see exactly today's product.
      await page.goto(`${base}/profile/`);
      // The profile header (.pf-me) is drawn before and after the page hydrates.
      await page.waitForSelector('#profile-sync, .pf-hero, .pf-me');
      assert.equal(await page.$('[data-saved-records]'), null, 'the records panel must not render with the flag off');
      await computeKnownTime(page, { expectKeep: false });
      assert.equal(await page.$('[data-keep-calculation-record]'), null, 'no keep affordance with the flag off');
      assert.equal(await databasePresent(page), false, 'a flag-off build must create no records database');
      record('flag-off build renders nothing and creates no database', { database: false });
    }

    if (PHASE === 'keep') {
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      const first = await downloadBytes(page, '[data-download-calculation-receipt]');
      assert.equal(await keep(page), 'kept');
      await computeKnownTime(page, { date: '1985-03-02', time: '09:15', place: 'Paris' });
      await waitKeepState(page, ['idle']);
      const second = await downloadBytes(page, '[data-download-calculation-receipt]');
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 2);
      assert.equal(await databasePresent(page), true);
      await writeCarry({
        ...carry,
        keptShas: [sha(first.bytes), sha(second.bytes)].sort(),
        keptCount: 2,
      });
      record('flag-on build kept two records with exact receipt bytes', { count: 2 });
    }

    if (PHASE === 'disabled') {
      assert.ok(Array.isArray(carry.keptShas) && carry.keptShas.length === 2, 'phase keep must run first');
      // GATE 1: the records kept while the feature was on stay findable.
      // (The probe needs the site origin: IndexedDB is denied on about:blank.)
      const state = await gotoProfile(page);
      assert.equal(await databasePresent(page), true, 'the rollback must not have destroyed the database');
      assert.equal(state, 'ready', `records must stay discoverable after a rollback (state: ${state})`);
      assert.equal(await recordCount(page), 2, 'both records must still be listed after a rollback');
      // GATE 2: the exact bytes are still exportable.
      const items = await page.$$('[data-record-id]');
      const exported = [];
      for (const item of items) {
        const id = await item.getAttribute('data-record-id');
        const file = await downloadBytes(page, `[data-record-id="${id}"] [data-record-download]`);
        exported.push(sha(file.bytes));
      }
      assert.deepEqual(exported.sort(), carry.keptShas, 'exported bytes after rollback must equal the original receipts');
      // GATE 3: no new records can be created by a rolled-back build.
      await computeKnownTime(page, { expectKeep: false });
      assert.equal(await page.$('[data-keep-calculation-record]'), null, 'a rolled-back build must offer no keep affordance');
      // GATE 4: removal still works, so the deletion promise survives the rollback.
      assert.equal(await gotoProfile(page), 'ready');
      await removeRecord(page);
      assert.equal(await recordCount(page), 1, 'a single removal must work after a rollback');
      await page.click('[data-records-remove-all]');
      await page.click('[data-records-remove-all]');
      await page.waitForSelector('[data-records-empty="erased"]');
      await writeCarry({ ...carry, removedWhileDisabled: true });
      record('rolled-back build keeps discovery, exact export and removal', { exported });
    }

    if (PHASE === 'reenabled') {
      assert.equal(carry.removedWhileDisabled, true, 'phase disabled must run first');
      const state = await gotoProfile(page);
      assert.equal(state, 'ready');
      assert.equal(await recordCount(page), 0, 'records removed while disabled must stay removed');
      assert.ok(await page.$('[data-records-empty="erased"]'), 'the erased state must survive re-enabling');
      // Keeping works again, and lands in the same device namespace.
      await computeKnownTime(page);
      await waitKeepState(page, ['idle']);
      assert.equal(await keep(page), 'kept');
      assert.equal(await gotoProfile(page), 'ready');
      assert.equal(await recordCount(page), 1, 'an explicit keep must readmit after off-on-off-on');
      record('re-enabling readmits cleanly with no stranded or resurrected rows', { count: 1 });
    }

    assert.deepEqual(blocked, [], `unexpected off-origin requests: ${blocked.join(', ')}`);
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  });
} catch (error) {
  console.log(`FAIL ${PHASE}: ${String(error?.stack ?? error).split('\n').slice(0, 12).join('\n')}`);
  process.exitCode = 1;
} finally {
  await context?.close();
  await mkdir(OUT, { recursive: true });
  const file = resolve(OUT, `phase-${PHASE}.json`);
  await writeFile(file, `${JSON.stringify({ phase: PHASE, node: process.version, results, failed: process.exitCode === 1 }, null, 2)}\n`);
  console.log(JSON.stringify({ file, checks: results.length, failed: process.exitCode === 1 }));
}
