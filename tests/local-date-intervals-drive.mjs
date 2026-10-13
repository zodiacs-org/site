/** Owned static fixture; no site build, polyfill, user profile or remote service. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(process.env.OUT_DIR ?? join(root, 'tests/visual/artifacts/local-date-intervals'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Explicit historical fixtures retained from the endpoint architecture review.
// These finite cases do not establish completeness for other host histories.
const cases = [
  ['2000-01-01', 'Asia/Tokyo', [['1999-12-31T15:00:00.000Z', '2000-01-01T15:00:00.000Z']]],
  ['2024-03-10', 'America/New_York', [['2024-03-10T05:00:00.000Z', '2024-03-11T04:00:00.000Z']]],
  ['2024-11-03', 'America/New_York', [['2024-11-03T04:00:00.000Z', '2024-11-04T05:00:00.000Z']]],
  ['1919-03-30', 'America/Toronto', [['1919-03-30T05:00:00.000Z', '1919-03-31T04:30:00.000Z']]],
  ['1919-03-31', 'America/Toronto', [['1919-03-31T04:30:00.000Z', '1919-04-01T04:00:00.000Z']]],
  ['2011-12-29', 'Pacific/Apia', [['2011-12-29T10:00:00.000Z', '2011-12-30T10:00:00.000Z']]],
  ['2011-12-30', 'Pacific/Apia', []],
  ['1844-12-31', 'Pacific/Guam', []],
  ['2011-12-31', 'Pacific/Apia', [['2011-12-30T10:00:00.000Z', '2011-12-31T10:00:00.000Z']]],
  ['2009-10-31', 'America/St_Johns', [['2009-10-31T02:30:00.000Z', '2009-11-01T02:30:00.000Z'], ['2009-11-01T02:31:00.000Z', '2009-11-01T03:30:00.000Z']]],
  ['2009-11-01', 'America/St_Johns', [['2009-11-01T02:30:00.000Z', '2009-11-01T02:31:00.000Z'], ['2009-11-01T03:30:00.000Z', '2009-11-02T03:30:00.000Z']]],
  ['1988-10-29', 'America/Goose_Bay', [['1988-10-29T02:00:00.000Z', '1988-10-30T02:00:00.000Z'], ['1988-10-30T02:01:00.000Z', '1988-10-30T04:00:00.000Z']]],
  ['1988-10-30', 'America/Goose_Bay', [['1988-10-30T02:00:00.000Z', '1988-10-30T02:01:00.000Z'], ['1988-10-30T04:00:00.000Z', '1988-10-31T04:00:00.000Z']]],
  ['1892-07-04', 'Pacific/Apia', [['1892-07-03T11:26:56.000Z', '1892-07-05T11:26:56.000Z']]],
  ['0000-01-01', 'UTC', [['0000-01-01T00:00:00.000Z', '0000-01-02T00:00:00.000Z']]],
  ['0000-02-29', 'UTC', [['0000-02-29T00:00:00.000Z', '0000-03-01T00:00:00.000Z']]],
  ['0099-12-31', 'UTC', [['0099-12-31T00:00:00.000Z', '0100-01-01T00:00:00.000Z']]],
  ['9999-12-31', 'UTC', [['9999-12-31T00:00:00.000Z', '+010000-01-01T00:00:00.000Z']]],
  ['1914-01-01', 'America/Manaus', [['1914-01-01T04:00:04.000Z', '1914-01-02T04:00:00.000Z']]],
  ['2024-04-07', 'Australia/Lord_Howe', [['2024-04-06T13:00:00.000Z', '2024-04-07T13:30:00.000Z']]],
  ['2024-10-06', 'Australia/Lord_Howe', [['2024-10-05T13:30:00.000Z', '2024-10-06T13:00:00.000Z']]],
  ['1900-01-01', 'America/Mexico_City', [['1900-01-01T06:36:36.000Z', '1900-01-02T06:36:36.000Z']]],
  ['0000-01-01', 'Etc/GMT-1', [['-000001-12-31T23:00:00.000Z', '0000-01-01T23:00:00.000Z']]],
];

await mkdir(out, { recursive: true });
const bundle = await build({
  absWorkingDir: root,
  stdin: { contents: "export { resolveLocalDateIntervals, createNativeTemporalTransitionProvider } from './src/lib/time/local-date-intervals'; export { assessLocalDateReference } from './src/lib/time/local-date-reference'; export { prepareLocalTime, resolveLocalToUtc } from './src/lib/time/localToUtc';", resolveDir: root },
  bundle: true, write: false, format: 'iife', globalName: 'dateIntervalsSubject',
  platform: 'browser', target: 'es2022', metafile: true,
});
const script = bundle.outputFiles[0].contents;
await writeFile(join(out, 'subject.js'), script);
const sources = await Promise.all(Object.keys(bundle.metafile.inputs).filter((path) => path !== '<stdin>').map(async (path) => ({ path, sha256: sha256(await readFile(join(root, path))) })));
const report = { at: new Date().toISOString(), node: process.version, sources, bundleSha256: sha256(script), requests: [], pageErrors: [], outcome: 'failed' };
const server = createServer((req, res) => {
  if (req.url === '/subject.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(script); }
  else if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local date interval fixture</title><script src="/subject.js"></script>'); }
  else { res.statusCode = 404; res.end(); }
});
let browser;
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = await findChromium();
  browser = await chromium.launch({ executablePath, headless: true, args: STABLE_CHROMIUM_ARGS });
  report.browser = { version: browser.version(), executablePath };
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    report.requests.push(url);
    if (new URL(url).origin === origin) await route.continue();
    else await route.abort('blockedbyclient');
  });
  await context.addInitScript(() => {
    const stats = globalThis.moduleEffects = { temporalReads: 0, intl: 0, storage: 0, idb: 0, fetch: 0, xhr: 0, beacon: 0 };
    const nativeTemporal = globalThis.Temporal;
    Object.defineProperty(globalThis, 'Temporal', { configurable: true, get() { stats.temporalReads++; return nativeTemporal; } });
    const NativeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = new Proxy(NativeFormat, {
      construct(target, args, ctor) { stats.intl++; return Reflect.construct(target, args, ctor); },
      apply(target, receiver, args) { stats.intl++; return Reflect.apply(target, receiver, args); },
    });
    for (const [object, key, counter] of [
      [Storage.prototype, 'setItem', 'storage'], [IDBFactory.prototype, 'open', 'idb'],
      [globalThis, 'fetch', 'fetch'], [XMLHttpRequest.prototype, 'open', 'xhr'], [Navigator.prototype, 'sendBeacon', 'beacon'],
    ]) {
      const original = object[key];
      object[key] = function (...args) { stats[counter]++; return Reflect.apply(original, this, args); };
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  await page.goto(origin, { waitUntil: 'load' });
  report.importEffects = await page.evaluate(() => ({ ...globalThis.moduleEffects }));
  assert.deepEqual(report.importEffects, { temporalReads: 0, intl: 0, storage: 0, idb: 0, fetch: 0, xhr: 0, beacon: 0 });
  report.native = await page.evaluate(async (fixtures) => {
    const { resolveLocalDateIntervals: resolve, createNativeTemporalTransitionProvider: provider, assessLocalDateReference: assess, prepareLocalTime: prepare, resolveLocalToUtc: local } = globalThis.dateIntervalsSubject;
    // The resolver is the engine's, which loads on first use, with each zone's history before 1970.
    for (const [date, zone] of fixtures) await prepare(date, zone);
    const nativeAvailable = provider() !== null;
    const rows = [];
    const iso = (n) => new Date(n).toISOString();
    for (const [date, zone, expected] of fixtures) {
      const result = resolve(date, zone);
      const actual = result.status === 'unresolved' ? null : result.intervals.map(({ start, endExclusive }) => [iso(start), iso(endExclusive)]);
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', era: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
      const localDate = (instant) => {
        const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
        const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
        return `${String(year).padStart(4, '0')}-${parts.month}-${parts.day}`;
      };
      const boundaries = result.status !== 'existing' ? [] : result.intervals.flatMap(({ start, endExclusive }) => [[start - 1, false], [start, true], [endExclusive - 1, true], [endExclusive, false]].map(([instant, expectedMember]) => ({ instant: iso(instant), localDate: localDate(instant), expectedMember, passed: (localDate(instant) === date) === expectedMember })));
      const reference = local(date, '12:00', zone).utc;
      const assessment = assess(date, reference, zone);
      const expectedReference = expected.some(([start, end]) => Date.parse(start) <= reference.getTime() && reference.getTime() < Date.parse(end));
      const assessmentPassed = JSON.stringify(assessment.coverage) === JSON.stringify(result)
        && assessment.referenceStatus === (expectedReference ? 'member' : 'outside-date')
        && assessment.evidence?.provider === 'host-temporal'
        && assessment.evidence?.observations.some(row => row.kind === 'next-transition');
      rows.push({ date, zone, expected, result, actual, boundaries, reference: reference.toISOString(), assessment, passed: assessmentPassed && JSON.stringify(actual) === JSON.stringify(expected) && boundaries.every((row) => row.passed) });
    }
    const offsets = [['+01:00', 3600000], ['+0100', 3600000], ['-02:30', -9000000], ['-00:00', 0]].map(([zone, offset]) => {
      let intlAccepted = true;
      let temporalAccepted = true;
      try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch { intlAccepted = false; }
      try { Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone); } catch { temporalAccepted = false; }
      const result = resolve('2000-01-01', zone);
      const midnight = Date.parse('2000-01-01T00:00Z');
      const expected = [{ start: midnight - offset, endExclusive: midnight + 86400000 - offset }];
      const passed = intlAccepted && temporalAccepted
        ? result.status === 'existing' && JSON.stringify(result.intervals) === JSON.stringify(expected)
        : result.status === 'unresolved';
      return { zone, intlAccepted, temporalAccepted, result, passed };
    });
    const original = Object.getOwnPropertyDescriptor(globalThis, 'Temporal');
    Object.defineProperty(globalThis, 'Temporal', { configurable: true, value: undefined });
    const unavailable = resolve('2000-01-01', 'UTC');
    const unavailableAssessment = assess('2000-01-01', new Date('2000-01-01T12:00Z'), 'UTC');
    Object.defineProperty(globalThis, 'Temporal', original);
    const invalidNativeZone = resolve('2000-01-01', '2000-01-01T00:00+01:00');
    const failing = resolve('2000-01-01', 'UTC', { completeness: 'complete-transitions-v1', offsetMilliseconds() { return 0; }, nextTransitionMilliseconds() { throw new Error('private synthetic detail'); } });
    const effects = { ...globalThis.moduleEffects };
    return { nativeAvailable, rows, offsets, unavailable, unavailableAssessment, invalidNativeZone, failing, effects };
  }, cases);
  assert.equal(report.native.nativeAvailable, true, 'Native Temporal transition API is required for this driver; no polyfill or skipped success.');
  assert.ok(report.native.rows.every((row) => row.passed), 'Native fixture or independent Intl boundary membership mismatch.');
  assert.ok(report.native.offsets.every((row) => row.passed), 'Fixed-offset acceptance or unresolved boundary mismatch.');
  assert.deepEqual(report.native.unavailable, { status: 'unresolved', reason: 'provider-unavailable' });
  assert.deepEqual(report.native.unavailableAssessment, { referenceStatus: 'member', coverage: { status: 'unresolved', reason: 'provider-unavailable' }, evidence: null });
  assert.deepEqual(report.native.invalidNativeZone, { status: 'unresolved', reason: 'provider-failed' });
  assert.deepEqual(report.native.failing, { status: 'unresolved', reason: 'provider-failed' });
  for (const key of ['storage', 'idb', 'fetch', 'xhr', 'beacon']) assert.equal(report.native.effects[key], 0);
  assert.deepEqual(report.pageErrors, []);
  assert.ok(report.requests.every((url) => new URL(url).origin === origin));
  report.outcome = 'passed';
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
  report.cleanup = 'Owned browser context and loopback server closed.';
  await writeFile(join(out, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
