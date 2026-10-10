import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

// Run against Astro dev (with the real same-origin API) or a supported preview.
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const OUT = process.env.OUT_DIR ?? '/tmp/market-lens-browser';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
const checks = [];
const errors = [];
const requests = [];
const secretText = 'PRIVATE-LENS-HYPOTHESIS-<img src=x onerror=alert(1)>';
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, timezoneId: 'America/New_York', acceptDownloads: true });
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
context.on('request', request => requests.push({ url: request.url(), body: request.postData() ?? '' }));
const page = await context.newPage();
const tab = async (p, name) => {
  await p.waitForFunction(() => ['ready', 'unavailable'].includes(document.querySelector('[data-testid="market-lens"]')?.getAttribute('data-storage-state')));
  await p.getByTestId(`lens-tab-${name}`).click();
};
const ready = async p => {
  await p.goto(`${BASE}/terminal/desk/`);
  await p.waitForFunction(() => document.querySelector('.lens-market-summary strong')?.textContent?.startsWith('$'), { timeout: 40000 });
  await p.locator('[data-testid="lens-chart"] canvas').first().waitFor();
};
const store = p => p.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('zodiacs-market-lens-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try { return await new Promise((resolve, reject) => { const r = db.transaction('private-workspace').objectStore('private-workspace').get('market-lens:snapshot:v1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  finally { db.close(); }
});
const saveNote = async (p, hypothesis, plan = 'Wait for a finalized candle; record my observation.') => {
  await p.getByTestId('journal-hypothesis').fill(hypothesis);
  await p.getByTestId('journal-plan').fill(plan);
  await p.getByTestId('journal-save').click();
};
try {
  await ready(page);
  await page.getByLabel('Economics', { exact: true }).uncheck();
  assert.match(await page.locator('.lens-market-summary').innerText(), /Coinbase Exchange/);
  assert.equal(await page.getByLabel('Display timezone').inputValue(), 'America/New_York');
  for (const instrument of ['BTC-USD', 'ETH-USD']) {
    await page.getByTestId('lens-instrument').selectOption(instrument);
    for (const interval of ['1h', '1d']) {
      const response = await context.request.get(`${BASE}/api/registry/lens?instrument=${instrument}&interval=${interval}`);
      assert.equal(response.status(), 200);
      const live = await response.json();
      assert.equal(live.instrument.id, instrument);
      assert.equal(live.interval, interval);
      assert.ok(live.candles.length > 100 && live.candles.some(c => c.complete));
      assert.equal(live.stale, false);
      await page.getByRole('button', { name: interval === '1h' ? '1 hour' : '1 day', exact: true }).click();
      await page.waitForFunction(({ instrument, interval }) => {
        const caption = document.querySelector('.lens-data-table caption')?.textContent ?? '';
        return caption.includes(instrument) && caption.includes(interval);
      }, { instrument, interval });
    }
  }
  checks.push('Real BTC/ETH hourly and daily API data and chart selection');
  await page.getByTestId('lens-instrument').selectOption('BTC-USD');
  await page.waitForFunction(() => document.querySelector('.lens-data-table caption')?.textContent.includes('BTC-USD'));
  await page.getByLabel('Display timezone').selectOption('Asia/Kathmandu');
  await page.locator('.lens-data-table summary').click();
  assert.ok((await page.locator('.lens-data-table thead').innerText()).includes('RSI 14'));
  assert.ok((await page.getByTestId('lens-event-detail').innerText()).includes('GMT+5:45'));
  await page.locator('.lens-data-table summary').click();
  await page.screenshot({ path: `${OUT}/desktop-chart.png`, fullPage: true });
  checks.push('Fractional timezone and accessible indicator table');

  await tab(page, 'calendar');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  const first = page.locator('.lens-event-row').first();
  await first.waitFor();
  assert.match(await first.innerText(), /2026|2027|2028|2029|2030/);
  await first.click();
  assert.ok((await page.getByTestId('lens-event-detail').innerText()).includes('GMT+5:45'));
  const icsDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to calendar', exact: true }).click();
  const ics = await icsDownload;
  await ics.saveAs(`${OUT}/selected-event.ics`);
  assert.match(await readFile(`${OUT}/selected-event.ics`, 'utf8'), /BEGIN:VCALENDAR[\s\S]*UID:[\s\S]*DTSTART:\d{8}T\d{6}Z/);
  for (const name of ['Day', 'Week', 'Month']) await page.getByRole('button', { name, exact: true }).click();
  checks.push('All calendar views, event selection, exact ICS export');

  await tab(page, 'rules');
  await page.getByTestId('rule-condition').selectOption('price-cross-up');
  await page.getByTestId('rule-threshold').fill('90000');
  await page.getByTestId('rule-window').fill('24');
  await page.getByTestId('rule-save').click();
  await page.getByTestId('watch-rule').waitFor();
  assert.match(await page.getByTestId('watch-rule').innerText(), /90000 USD/);
  await page.getByTestId('rule-toggle').click();
  await page.getByRole('button', { name: 'Enable', exact: true }).waitFor();
  assert.equal((await store(page)).rules[0].version, 1);
  await page.getByTestId('rule-toggle').click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  assert.equal((await store(page)).rules[0].version, 1);
  await page.reload();
  await tab(page, 'rules');
  await page.getByTestId('watch-rule').waitFor();
  await page.getByTestId('rule-delete').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="watch-rule"]'));
  checks.push('Rule create, pause/resume without version reset, reload and deletion');

  await tab(page, 'journal');
  await saveNote(page, secretText);
  await page.getByTestId('journal-entry').waitFor();
  assert.ok((await page.getByTestId('journal-entry').innerText()).includes(secretText));
  assert.equal(await page.getByTestId('journal-entry').locator('img').count(), 0);
  await page.getByTestId('journal-edit').click();
  await page.getByTestId('journal-outcome').fill('Manually recorded outcome: no trade taken.');
  await page.getByTestId('journal-save').click();
  await page.getByTestId('journal-revisions').waitFor();
  assert.equal((await store(page)).entries[0].revisions.length, 2);
  const exportDownload = page.waitForEvent('download');
  await page.getByTestId('journal-export').click();
  await (await exportDownload).saveAs(`${OUT}/journal.json`);
  const backup = await readFile(`${OUT}/journal.json`, 'utf8');
  assert.equal(JSON.parse(backup).entries[0].hypothesis, secretText);
  await page.getByTestId('journal-delete').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="journal-entry"]'));
  await page.getByTestId('journal-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.getByRole('alert').filter({ hasText: /JSON|invalid|backup/i }).waitFor();
  assert.equal(await page.getByTestId('journal-import').isDisabled(), false);
  await page.getByTestId('journal-import').setInputFiles({ name: 'journal.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByTestId('journal-entry').waitFor();
  await page.reload();
  await tab(page, 'journal');
  await page.getByTestId('journal-entry').waitFor();
  assert.equal((await store(page)).entries.length, 1);
  checks.push('Private journal save/revision/export/delete/import/reload and recovery after invalid import');

  const second = await context.newPage();
  await ready(second);
  await tab(second, 'journal');
  await second.getByTestId('journal-hypothesis').fill('Second tab unsaved observation.');
  await second.getByTestId('journal-plan').fill('Wait for a finalized candle; record my observation.');
  await saveNote(page, 'First tab saved observation.');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="journal-entry"]').length === 2);
  await second.waitForFunction(() => document.querySelectorAll('[data-testid="journal-entry"]').length === 2);
  assert.equal(await second.getByTestId('journal-hypothesis').inputValue(), 'Second tab unsaved observation.');
  assert.equal((await store(second)).entries.length, 2);
  await second.getByTestId('journal-save').click();
  await second.waitForFunction(() => document.querySelectorAll('[data-testid="journal-entry"]').length === 3);
  assert.equal((await store(second)).entries.length, 3);
  await page.reload();
  await tab(page, 'journal');
  await page.getByTestId('journal-edit').first().click();
  await page.getByTestId('journal-hypothesis').fill('Unsaved revision of deleted entry.');
  await second.getByTestId('journal-delete').first().click();
  await second.waitForFunction(() => document.querySelectorAll('[data-testid="journal-entry"]').length === 2);
  await page.getByTestId('journal-save').click();
  await page.getByRole('alert').filter({ hasText: /another tab/i }).waitFor();
  await page.getByTestId('journal-save').click();
  await page.getByRole('alert').filter({ hasText: /deleted in another tab/i }).waitFor();
  assert.equal(await page.getByTestId('journal-hypothesis').inputValue(), 'Unsaved revision of deleted entry.');
  await page.getByRole('button', { name: 'Save as new entry', exact: true }).click();
  await tab(page, 'calendar');
  await tab(page, 'journal');
  assert.equal(await page.getByTestId('journal-hypothesis').inputValue(), 'Unsaved revision of deleted entry.');
  await page.getByTestId('journal-save').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="journal-entry"]').length === 3);
  await second.close();
  checks.push('Stale-tab conflicts preserve entries and drafts; deleted entries cannot silently reappear; drafts survive view changes');

  await tab(page, 'history');
  await page.getByRole('button', { name: 'Load 900 daily candles', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.lens-market-summary')?.textContent.includes('899 finalized'), { timeout: 40000 });
  assert.ok(await page.locator('.lens-table-scroll tbody tr').count() > 0);
  await page.screenshot({ path: `${OUT}/desktop-history.png`, fullPage: true });
  checks.push('Real expanded historical data and complete/pending/incomplete occurrence rows');

  await context.route('**/api/registry/lens?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated provider unavailable' }) }));
  await page.getByRole('button', { name: 'Refresh candles', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /unavailable/i }).waitFor();
  assert.match(await page.locator('.lens-market-summary').innerText(), /stale \/ previous response/);
  await tab(page, 'calendar');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  assert.ok(await page.locator('.lens-event-row').count() > 0);
  await tab(page, 'journal');
  assert.ok(await page.getByTestId('journal-entry').count() > 0);
  await context.unroute('**/api/registry/lens?*');
  checks.push('Provider outage retains previous prices and working calendar/journal');

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await ready(mobile);
  await tab(mobile, 'calendar');
  await mobile.getByRole('button', { name: 'Agenda', exact: true }).waitFor();
  assert.equal(await mobile.getByRole('button', { name: 'Agenda', exact: true }).getAttribute('aria-pressed'), 'true');
  for (const name of ['chart', 'calendar', 'rules', 'journal', 'history']) {
    await tab(mobile, name);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Mobile ${name} overflows`);
  }
  await tab(mobile, 'calendar');
  await mobile.screenshot({ path: `${OUT}/mobile-agenda.png`, fullPage: true });
  await mobile.getByRole('button', { name: 'Month', exact: true }).click();
  assert.equal(await mobile.locator('.lens-mobile-day-list').isVisible(), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: `${OUT}/mobile-month.png`, fullPage: true });
  await mobile.close();
  checks.push('390px mobile all five views, default agenda and readable month-day alternative');

  assert.equal(requests.some(r => (r.url + r.body).includes(secretText) || (r.url + r.body).includes(encodeURIComponent(secretText))), false);
  assert.equal(requests.some(r => /plausible|vercel-insights|vitals\.vercel|google-analytics/.test(r.url)), false);
  assert.deepEqual(errors, []);
  checks.push('No private note payload transmission, third-party analytics or page exceptions');

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const blockedPage = await blocked.newPage();
  await ready(blockedPage);
  await tab(blockedPage, 'journal');
  await blockedPage.getByRole('alert').filter({ hasText: /storage is unavailable/i }).waitFor();
  assert.equal(await blockedPage.getByTestId('journal-save').isDisabled(), true);
  await tab(blockedPage, 'calendar');
  await blockedPage.locator('.lens-calendar-day').first().waitFor();
  assert.ok(await blockedPage.locator('.lens-calendar-day').count() > 0);
  await blocked.close();
  checks.push('Blocked private storage leaves public workspace usable');

  // Controlled price fixture is used only for the asset-switch regression;
  // the four venue/interval checks above always require live API responses.
  const fixtureContext = await browser.newContext();
  const template = await (await context.request.get(`${BASE}/api/registry/lens?instrument=BTC-USD&interval=1d`)).json();
  await fixtureContext.route('**/api/registry/lens?*', async route => {
    const instrument = new URL(route.request().url()).searchParams.get('instrument');
    if (instrument === 'ETH-USD') await new Promise(resolve => setTimeout(resolve, 200));
    const base = instrument === 'ETH-USD' ? 'ETH' : 'BTC';
    const candles = template.candles.map((bar, index) => {
      const close = base === 'ETH' ? 10 : index < template.candles.length - 5 ? 100 : 200;
      return { ...bar, open: close, high: close + 1, low: close - 1, close, volume: 1 };
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...template, instrument: { id: instrument, name: base === 'ETH' ? 'Ethereum' : 'Bitcoin', base, quote: 'USD', venue: 'Coinbase Exchange', sourceUrl: `https://exchange.coinbase.com/trade/${instrument}` }, source: `https://api.exchange.coinbase.com/products/${instrument}/candles`, candles, warnings: ['Controlled asset-switch regression fixture.'] }) });
  });
  const fixturePage = await fixtureContext.newPage();
  await ready(fixturePage);
  await tab(fixturePage, 'journal');
  const rule = { id: 'asset-switch-regression', version: 1, instrument: 'ETH-USD', interval: '1d', condition: 'price-cross-up', threshold: 150, family: 'any', windowHours: 720, enabled: true, createdAt: new Date(Date.parse(template.fetchedAt) - 60 * 86400000).toISOString() };
  await fixturePage.getByTestId('journal-import').setInputFiles({ name: 'rule.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schema: 1, rules: [rule], entries: [], seenMatches: [] })) });
  await fixturePage.getByRole('status').filter({ hasText: 'Journal imported.' }).waitFor();
  await fixturePage.getByTestId('lens-instrument').selectOption('ETH-USD');
  await tab(fixturePage, 'rules');
  await fixturePage.waitForFunction(() => document.querySelector('.lens-market-summary strong')?.textContent === '$10.00');
  assert.deepEqual((await store(fixturePage)).seenMatches, []);
  assert.equal(await fixturePage.getByTestId('rule-matches').count(), 0);
  await fixtureContext.close();
  checks.push('Instrument switches cannot evaluate ETH rules against preceding BTC candles');
  await writeFile(`${OUT}/receipt.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, checks, errors, requests: requests.length }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, artifacts: OUT }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
