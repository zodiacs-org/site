import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {findChromium, STABLE_CHROMIUM_ARGS} from './visual/browser.mjs';

// Verify the actual hosted function and usable non-price UI while rights are pending.
// Cloud Chromium does not share Node's proxy trust store. Relay browser requests
// through native fetch with TLS verification, retaining status/security headers.
const base = new URL(process.env.BASE_URL ?? '');
assert.equal(base.protocol, 'https:');
assert.match(base.hostname, /^zodiacs(?:-org)?-[a-z0-9-]+-zodiacsofficial\.vercel\.app$/u);
const out = process.env.OUT_DIR ?? '/tmp/lens-deployed';
await mkdir(out, {recursive: true});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';
assert.ok(!/[\r\n]/.test(bypass));
const oidc = process.env.VERCEL_OIDC_TOKEN ?? '';
assert.ok(!/[\r\n]/.test(oidc));
const headers = oidc ? {'x-vercel-trusted-oidc-idp-token': oidc} : bypass ? {'x-vercel-protection-bypass': bypass} : {};
const checks = [], errors = [], requests = [];
for (const instrument of ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'XNAS:AAPL', 'FX:EUR/USD', 'ETF:NYSE:GLD']) {
  for (const interval of ['1h', '1d']) {
    const response = await fetch(new URL(`/api/registry/lens?instrument=${instrument}&interval=${interval}`, base), {headers, redirect: 'manual'});
    assert.equal(response.status, 503, 'Expected the configured disabled market API, not an edge login/HTML response');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).error, 'display-disabled');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  }
}
checks.push('Cross-asset hourly/daily requests reach the actual function and return the noncached display-disabled contract');
const badQuery = await fetch(new URL('/api/registry/lens?instrument=UNLISTED-USD', base), {headers});
assert.equal(badQuery.status, 400);
assert.equal((await badQuery.json()).error, 'request');
const wrongMethod = await fetch(new URL('/api/registry/lens', base), {method: 'POST', headers});
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.get('allow'), 'GET');
checks.push('Hosted query allowlist and method validation');

const browser = await chromium.launch({executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, timezoneId: 'Asia/Kathmandu'});
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({url: url.href, method: request.method(), body: request.postData() ?? ''});
    if (url.origin !== base.origin) { errors.push(`Unexpected external request: ${url.origin}`); await route.abort(); return; }
    assert.equal(request.method(), 'GET');
    const response = await fetch(url, {headers, redirect: 'manual'});
    const responseHeaders = Object.fromEntries(response.headers);
    delete responseHeaders['content-encoding']; // Native fetch already decoded transfer compression.
    delete responseHeaders['content-length'];
    await route.fulfill({status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer())});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/terminal/desk/', base).href);
  await page.waitForFunction(() => document.querySelector('[data-testid="market-lens"]')?.getAttribute('data-storage-state') === 'ready');
  await page.getByText('Market prices are not enabled for this deployment.', {exact: false}).waitFor();
  await page.getByTestId('lens-tab-calendar').click();
  await page.locator('.lens-event-row').first().waitFor();
  await page.screenshot({path: `${out}/deployed-calendar-mobile.png`, fullPage: true});
  checks.push('Deployed mobile calendar loads real event shards with prices disabled');
  await page.getByTestId('lens-tab-journal').click();
  const privateText = 'PRIVATE-DEPLOYED-LENS-NOTE';
  await page.getByTestId('journal-hypothesis').fill(privateText);
  await page.getByTestId('journal-plan').fill('Record a hypothesis before its outcome.');
  await page.getByTestId('journal-save').click();
  await page.getByTestId('journal-entry').waitFor();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-testid="market-lens"]')?.getAttribute('data-storage-state') === 'ready');
  await page.getByTestId('lens-tab-journal').click();
  assert.ok((await page.getByTestId('journal-entry').innerText()).includes(privateText));
  assert.ok(!requests.some(request => request.url.includes(privateText) || request.body.includes(privateText)));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  checks.push('Deployed journal saves/reloads privately and mobile layout fits');
  await page.goto(new URL('/terminal/desk/research/', base).href);
  await page.getByRole('heading', {name: 'The prospective paper protocol'}).waitFor();
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /^noindex, follow(?:,|$)/);
  checks.push('Deployed retrospective report and prospective protocol remain noindex');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/acceptance.json`, JSON.stringify({verifiedAt: new Date().toISOString(), base: base.origin, transport: 'TLS-verified native-fetch relay to actual deployed URLs; no data fixtures', status: 'passed', checks, pageErrors: errors, privatePayloadTransmitted: false, livePricePathVerified: false, livePriceBlocker: 'Owner confirmed no display license; hosted prices are disabled'}, null, 2) + '\n');
  console.log(JSON.stringify({status: 'passed', base: base.origin, checks}, null, 2));
} finally { await browser.close(); }
