// Zodiacs Desk acceptance on the built site: trade window, planned-entry
// warnings, window calendar export, plan ledger reviews, schema 2 and schema 3
// imports, persistence across reload, export round trip and privacy, at 390 px
// and on desktop. Market prices stay disabled, as on the protected preview, and
// no synthetic candles are served. Set DESK_BASE_URL to drive another server.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { startPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? '/tmp/zodiacs-desk-browser';
await mkdir(OUT, { recursive: true });
const CATALOG_VERSION = (await readFile(new URL('../src/exchange/lens/catalog.ts', import.meta.url), 'utf8')).match(/CATALOG_VERSION = '([^']+)'/)[1];
const preview = process.env.DESK_BASE_URL ? null : await startPreview({ port: 4396 });
const BASE = process.env.DESK_BASE_URL ?? preview.baseURL;
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
const errors = [], requests = [], checks = [];
const PRIVATE = ['DESK-PRIVATE-PLAN', 'FIXTURE-PRIVATE'];
const H = 3_600_000;
const minute = ms => new Date(Math.floor(ms / 60_000) * 60_000);
const wall = date => date.toISOString().slice(0, 16);

function store(entries, schema = 3) {
  return { schema, catalogVersion: CATALOG_VERSION, rules: [], entries, seenMatches: [] };
}
function fixturePlan(id, method, technicalSetup, extra = {}) {
  const at = minute(Date.now() - 4 * 24 * H).toISOString();
  const setup = { interval: '1d', technicalSetup, confirmation: 'Daily close above 100', invalidation: 'Daily close below 95', risk: { instrumentId: 'BTC-USD', currency: 'USD', funding: 'cash', equity: 10_000, riskMode: 'percent', riskValue: 1, entry: 100, stop: 95, target: 110, feeBps: 10, slippageBps: 5 } };
  const text = { hypothesis: `FIXTURE-PRIVATE ${id}`, plan: 'Buy the retest', outcome: '' };
  return { id, instrument: 'BTC-USD', createdAt: at, updatedAt: at, eventIds: [], horizonHours: 24, method, ...text, revisions: [{ at, ...text, setup }], setup, ...extra };
}
const upload = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });

async function open(context) {
  await context.route('**/api/registry/lens?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'display-disabled' }) }));
  context.on('request', request => requests.push({ url: request.url(), body: request.postData() ?? '' }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${BASE}/terminal/desk/`);
  await page.waitForFunction(() => document.querySelector('[data-testid="market-lens"]')?.getAttribute('data-storage-state') === 'ready');
  await page.getByLabel('Display timezone').selectOption('UTC');
  return page;
}
async function fillSetup(page, { entryAt, horizon }) {
  const setup = page.getByTestId('lens-setup');
  for (const [label, value] of [['Technical setup / price levels', 'DESK-PRIVATE-PLAN reclaim of the 20-day average'], ['Confirmation condition', 'Daily close above 100'], ['Invalidation condition', 'Daily close below 95'], ['Timing hypothesis', 'Unvalidated test hypothesis']]) await setup.getByLabel(label, { exact: true }).fill(value);
  await setup.getByLabel('Entry (USD)', { exact: true }).fill('100');
  await setup.getByLabel('Stop (USD)', { exact: true }).fill('95');
  await setup.getByLabel('Target (optional USD)', { exact: true }).fill('110');
  await setup.getByLabel('Horizon (hours)', { exact: true }).fill(String(horizon));
  await setup.getByTestId('setup-entry').fill(wall(entryAt));
  return setup;
}
const due = ledger => ledger.getByTestId('ledger-due').locator('article');

try {
  // Phone width: plan, warn, export, save, import, review, reload and export.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', acceptDownloads: true });
  const page = await open(mobile);
  assert.match(await page.title(), /^Zodiacs Desk/);
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Zodiacs Desk');
  await page.getByText('Market prices are not enabled for this deployment.', { exact: false }).first().waitFor();
  checks.push('Zodiacs Desk route renders with prices disabled and no synthetic candles');

  await page.getByTestId('lens-tab-setup').click();
  const entryAt = minute(Date.now() + 2 * 24 * H);
  const setup = await fillSetup(page, { entryAt, horizon: 72 });
  const window = setup.getByTestId('trade-window');
  await window.getByText('From planned entry:', { exact: false }).waitFor();
  assert.match(await window.innerText(), /\(72 h\)/);
  await setup.getByTestId('setup-entry').fill(wall(new Date(Date.now() - 2 * 24 * H)));
  await setup.getByTestId('setup-late').waitFor();
  await setup.getByTestId('setup-entry').fill(wall(entryAt));
  await setup.getByTestId('setup-late').waitFor({ state: 'detached' });
  checks.push('Trade window follows the planned entry and horizon; a past entry is flagged before saving');

  const [download] = await Promise.all([page.waitForEvent('download'), window.getByTestId('trade-window-export').click()]);
  const ics = await readFile(await download.path(), 'utf8');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /PRODID:-\/\/Zodiacs\/\/Zodiacs Desk\/\/EN\r\n/);
  assert.match(ics, /SUMMARY:Trade window: BTC-USD\\, 72 h\r\n/);
  assert.ok(!PRIVATE.some(text => ics.includes(text)), 'The calendar file must not carry plan text');
  checks.push('Window calendar export contains the trade window and no plan text');

  await setup.getByRole('button', { name: 'Save setup to journal', exact: true }).click();
  await setup.getByText('Choose what the timing changed before saving.', { exact: false }).waitFor();
  await setup.getByTestId('setup-timing').selectOption('larger');
  await setup.getByRole('button', { name: 'Save setup to journal', exact: true }).click();
  await setup.getByText('Setup saved in your private journal.', { exact: false }).waitFor();
  await window.screenshot({ path: `${OUT}/desk-trade-window-mobile.png` });
  checks.push('A TA + astrology setup requires its timing answer before it saves');

  await page.getByTestId('lens-tab-journal').click();
  const ledger = page.getByTestId('lens-ledger');
  await ledger.getByText('No plans are waiting for review.', { exact: false }).waitFor();
  const journal = page.getByTestId('lens-journal');
  const legacyNote = { id: 'legacy-note', instrument: 'BTC-USD', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', eventIds: [], horizonHours: 24, method: 'TA only', hypothesis: 'FIXTURE-PRIVATE legacy', plan: 'Legacy plan', outcome: '', revisions: [{ at: '2026-10-01T00:00:00.000Z', hypothesis: 'FIXTURE-PRIVATE legacy', plan: 'Legacy plan', outcome: '' }] };
  await journal.getByTestId('journal-import').setInputFiles(upload('legacy-schema-2.json', store([legacyNote], 2)));
  await page.getByText('Imported 1 notes', { exact: false }).waitFor();
  const reviewedLegacy = fixturePlan('legacy-reviewed', 'TA only', 'Legacy with a review', { review: { status: 'not-triggered' } });
  reviewedLegacy.revisions[0].review = { status: 'not-triggered' };
  await journal.getByTestId('journal-import').setInputFiles(upload('invalid-schema-2.json', store([reviewedLegacy], 2)));
  await journal.getByText('need workspace schema 3', { exact: false }).waitFor();
  checks.push('Schema 2 backups import unchanged; schema 3 fields inside a schema 2 file are refused');

  await journal.getByTestId('journal-import').setInputFiles(upload('ledger-fixture.json', store([fixturePlan('fixture-ta', 'TA only', 'Fixture retest TA'), fixturePlan('fixture-veto', 'TA + astrology', 'Fixture retest veto', { timingRole: 'veto' })])));
  await page.getByText('Imported 2 notes', { exact: false }).waitFor();
  assert.equal(await due(ledger).count(), 2);

  await due(ledger).filter({ hasText: 'Fixture retest TA' }).getByTestId('ledger-review').click();
  let form = ledger.getByTestId('review-form');
  await form.getByText('Target reached', { exact: true }).click();
  assert.equal(await form.getByTestId('review-exit').inputValue(), '110');
  assert.match(await form.getByTestId('review-r').inputValue(), /^1\.\d+$/);
  await form.getByText("from the plan's entry, stop, fees and slippage", { exact: false }).waitFor();
  await form.getByTestId('review-followed').selectOption('yes');
  await form.screenshot({ path: `${OUT}/desk-review-form-mobile.png` });
  await form.getByTestId('review-save').click();
  await ledger.getByTestId('ledger-group-ta').getByText('1 traded', { exact: false }).waitFor();
  assert.equal(await due(ledger).count(), 1);

  await due(ledger).filter({ hasText: 'Fixture retest veto' }).getByTestId('ledger-review').click();
  form = ledger.getByTestId('review-form');
  await form.getByText('Passed on it', { exact: true }).click();
  assert.equal(await form.getByTestId('review-followed').count(), 0);
  await form.getByTestId('review-exit').fill('92');
  assert.match(await form.getByTestId('review-r').inputValue(), /^-1\.\d+$/);
  await form.getByTestId('review-save').click();
  const veto = ledger.getByTestId('ledger-group-timing-veto');
  await veto.getByText('Would-have results of passed plans: 1 recorded.', { exact: true }).waitFor();
  assert.equal(await due(ledger).count(), 0);
  checks.push('Reviews compute R from the plan at entry, keep would-have results apart and clear the queue');

  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-testid="market-lens"]')?.getAttribute('data-storage-state') === 'ready');
  await page.getByTestId('lens-tab-journal').click();
  await page.getByTestId('ledger-group-ta').getByText('1 traded', { exact: false }).waitFor();
  await page.getByTestId('ledger-group-timing-veto').getByText('1 passed', { exact: false }).waitFor();
  await page.getByTestId('lens-ledger').screenshot({ path: `${OUT}/desk-ledger-mobile.png` });
  checks.push('Reviews and the ledger persist across reload');

  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByTestId('journal-export').click()]);
  const exported = JSON.parse(await readFile(await backup.path(), 'utf8'));
  assert.equal(exported.schema, 3);
  const byId = id => exported.entries.find(entry => entry.id === id);
  assert.deepEqual(byId('fixture-ta').review, { status: 'target', exit: 110, r: byId('fixture-ta').review.r, followedPlan: true });
  assert.ok(byId('fixture-ta').review.r > 1 && byId('fixture-ta').review.r < 2);
  assert.equal(byId('fixture-veto').review.status, 'skipped');
  assert.ok(byId('fixture-veto').review.r < -1);
  const saved = exported.entries.find(entry => entry.setup?.technicalSetup.startsWith('DESK-PRIVATE-PLAN'));
  assert.equal(saved.timingRole, 'larger');
  assert.equal(saved.setup.entryAt, entryAt.toISOString());
  assert.ok(byId('legacy-note') && !byId('legacy-reviewed'));
  checks.push('Export is schema 3 with reviews, the fixed timing answer and the planned entry');

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.close();

  // Desktop: the exported backup imports into a fresh browser profile.
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', acceptDownloads: true });
  const wide = await open(desktop);
  await wide.getByTestId('lens-tab-journal').click();
  await wide.getByTestId('journal-import').setInputFiles(upload('round-trip.json', exported));
  await wide.getByText('Imported 4 notes', { exact: false }).waitFor();
  await wide.getByTestId('ledger-group-timing-veto').getByText('1 passed', { exact: false }).waitFor();
  await wide.getByTestId('lens-ledger').screenshot({ path: `${OUT}/desk-ledger-desktop.png` });
  await wide.getByTestId('lens-tab-setup').click();
  await fillSetup(wide, { entryAt, horizon: 72 });
  await wide.getByTestId('lens-setup').getByTestId('trade-window').screenshot({ path: `${OUT}/desk-trade-window-desktop.png` });
  checks.push('Desktop round trip: a schema 3 export imports into a fresh profile');
  await desktop.close();

  assert.ok(!requests.some(request => PRIVATE.some(text => request.url.includes(text) || request.body.includes(text))), 'Private plan text must not enter network requests');
  assert.deepEqual(errors, []);
  checks.push('No page errors; private plan text never enters network requests; no horizontal overflow at 390 px');
  await writeFile(`${OUT}/acceptance.json`, `${JSON.stringify({ at: new Date().toISOString(), status: 'passed', transport: 'built production UI; market prices disabled; synthetic journal fixtures only', checks }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally {
  await browser.close();
  await preview?.stop();
}
