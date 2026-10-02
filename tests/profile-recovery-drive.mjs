/** Disposable browsers and a simulated Supabase service. Never sends email or user data to production. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const serviceURL = process.env.PUBLIC_SUPABASE_URL ?? 'https://mftpcdpttteuwbolobye.supabase.co';
const authStorageKey = `sb-${new URL(serviceURL).hostname.split('.')[0]}-auth-token`;
// Linux WebKit may issue preflight before route interception. A loopback-only
// server handles that handshake; every data-bearing request must hit the mock.
let preflightServer;
if (new URL(serviceURL).hostname === '127.0.0.1') {
  preflightServer = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] ?? '*');
    res.setHeader('access-control-allow-credentials', 'true');
    res.writeHead(req.method === 'OPTIONS' ? 204 : 500); res.end();
  });
  await new Promise((resolve, reject) => {
    preflightServer.once('error', reject);
    preflightServer.listen(Number(new URL(serviceURL).port), '127.0.0.1', resolve);
  });
}
const out = process.env.OUT_DIR ?? '/tmp/zodiacs-profile-recovery';
await mkdir(out, { recursive: true });
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const chart = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Maya', relationship: 'self',
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
  birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: { name: 'London', admin1: '', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
  summary: { engineVersion: '0.1.0', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 280, retrograde: false }, { body: 'Moon', lon: 330, retrograde: false }], angles: { asc: 10, mc: 280 }, flags: [] },
};
const profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [chart] };
const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated',
  email: 'consumer-fixture@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-01T12:00:00Z' };
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url'), 'fixture'].join('.');
const session = { access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 7200,
  expires_at: Math.floor(Date.now() / 1000) + 7200, user };
const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#B9D4BE' } }).png().toBuffer();

try { await withPreview({ port: 8786 }, async base => {
for (const engine of (process.env.PROFILE_TEST_ENGINES ?? 'chromium,webkit').split(',')) {
  const browser = engine === 'webkit' ? await webkit.launch({ headless: true })
    : await chromium.launch({ headless: true, executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  const cloud = { charts: [], settings: { houseSystem: 'whole' }, fail: false, otp: null, otpURL: null };
  const options = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' };
  async function context({ seed = false, signedIn = false, width = 390 } = {}) {
    const ctx = await browser.newContext({ ...options, viewport: { width, height: 844 } });
    await ctx.addInitScript(({ seed, signedIn, profile, session, authStorageKey }) => {
      if (sessionStorage.getItem('profile-fixture-seeded')) return;
      if (seed) {
        localStorage.setItem('zodiacs.profile.v1', JSON.stringify(profile));
        localStorage.setItem('zodiacs.me.v1', JSON.stringify({ version: 1, displayName: 'Maya', keepCloseDismissed: false }));
      }
      if (signedIn) localStorage.setItem(authStorageKey, JSON.stringify(session));
      sessionStorage.setItem('profile-fixture-seeded', '1');
    }, { seed, signedIn, profile, session, authStorageKey });
    await ctx.route(`${serviceURL}/**`, async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'access-control-allow-origin': new URL(base).origin,
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'apikey,authorization,content-type,x-client-info',
        'access-control-allow-credentials': 'true' };
      const reply = (json, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(json) });
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname === '/auth/v1/otp') { cloud.otp = req.postDataJSON(); cloud.otpURL = url; return reply({}); }
      if (url.pathname === '/auth/v1/user') return reply(user);
      if (url.pathname === '/auth/v1/token') return reply(session);
      if (url.pathname === '/auth/v1/logout') return reply({});
      if (url.pathname.startsWith('/rest/v1/')) {
        if (cloud.fail) return reply({ message: 'Fixture connection unavailable' }, 503);
        const table = url.pathname.split('/').pop();
        if (table === 'charts') {
          if (req.method() === 'GET') return reply(cloud.charts);
          if (req.method() === 'POST') { cloud.charts = req.postDataJSON(); return reply(null, 201); }
          return reply(null);
        }
        if (table === 'profiles') {
          if (req.method() === 'GET') return reply({ settings: cloud.settings });
          if (req.method() === 'POST') cloud.settings = req.postDataJSON().settings;
          return reply(null, 201);
        }
        if (table === 'chart_deletions') return reply(req.method() === 'GET' ? [] : null);
        return reply([]);
      }
      return reply({ error: 'Unexpected fixture endpoint' }, 400);
    });
    return ctx;
  }
  try {
    const first = await context({ seed: true }); const page = await first.newPage(); const errors = [];
    const consoleErrors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(`${base}/profile/`);
    await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Save across devices' }).waitFor();
    check(`${engine}: top-of-page cross-device action exists`, await page.getByRole('link', { name: 'Save across devices' }).getAttribute('href') === '#profile-sync');
    check(`${engine}: mobile status is local without sign-in`, await page.locator('.pf-safety__status').innerText().then(s => s.includes('Saved in this browser')));
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    check(`${engine}: touch editor avoids opening the keyboard`, await page.locator('#pf-me-name').evaluate(e => document.activeElement !== e));
    await page.locator('#pf-me-photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: photo });
    await page.getByAltText('Photo preview').waitFor();
    await page.locator('#pf-me-edit').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByAltText('Your profile photo').waitFor();
    check(`${engine}: photo stored as a small JPEG`, await page.getByAltText('Your profile photo').getAttribute('src').then(s => s.startsWith('data:image/jpeg;base64,') && s.length < 100000));
    const downloadWait = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup', exact: true }).click();
    const download = await downloadWait; const backupPath = `${out}/${engine}-backup.json`; await download.saveAs(backupPath);
    const saved = JSON.parse(await readFile(backupPath, 'utf8'));
    check(`${engine}: backup includes photo and full birth inputs without an auth session`, !!saved.me.photo && saved.profile.charts[0].birth.date === chart.birth.date && !JSON.stringify(saved).includes('fixture-refresh'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${out}/${engine}-mobile-profile.png` });
    const second = await context(); const restorePage = await second.newPage(); await restorePage.goto(`${base}/profile/`);
    await restorePage.getByRole('button', { name: 'Restore backup', exact: true }).waitFor();
    await restorePage.waitForFunction(() => document.querySelector('input[aria-label="Choose chart backup"]')?.disabled === false);
    await restorePage.locator('input[aria-label="Choose chart backup"]').setInputFiles(backupPath);
    await restorePage.getByRole('group', { name: 'Review backup before restoring' }).waitFor();
    check(`${engine}: preview has not yet written charts`, await restorePage.evaluate(() => !localStorage.getItem('zodiacs.profile.v1')));
    await restorePage.getByRole('checkbox', { name: 'Also use the name and photo from this backup' }).check();
    await restorePage.getByRole('button', { name: 'Restore charts and cards' }).click();
    await restorePage.getByAltText('Your profile photo').waitFor();
    check(`${engine}: a second browser recovers chart and identity from file`, await restorePage.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.profile.v1')).charts.length === 1 && JSON.parse(localStorage.getItem('zodiacs.me.v1')).displayName === 'Maya'));
    await restorePage.reload(); await restorePage.getByAltText('Your profile photo').waitFor();
    check(`${engine}: restored photo survives reload`, true);
    await restorePage.locator('input[aria-label="Choose chart backup"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await restorePage.getByText('This is not a valid Zodiacs chart backup. Nothing was changed.').waitFor();
    check(`${engine}: corrupt file keeps existing saves`, await restorePage.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.profile.v1')).charts.length === 1));
    await restorePage.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await restorePage.getByRole('button', { name: 'Remove photo', exact: true }).click();
    await restorePage.locator('#pf-me-edit').getByRole('button', { name: 'Save', exact: true }).click();
    check(`${engine}: removing a photo restores the initial`, await restorePage.getByRole('button', { name: 'Add profile photo' }).isVisible());
    for (const width of [360, 390, 768, 1440]) {
      await restorePage.setViewportSize({ width, height: 844 });
      const fits = await restorePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      if (!fits) {
        console.log(await restorePage.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
          culprits: [...document.querySelectorAll('main *')].map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right })).filter(e => e.right > innerWidth + 1).slice(0, 8) })));
        await restorePage.screenshot({ path: `${out}/${engine}-overflow-${width}.png` });
      }
      check(`${engine}: no overflow at ${width}px`, fits);
    }
    await page.getByRole('link', { name: 'Save across devices' }).click();
    await page.getByRole('textbox', { name: 'Email for profile sync' }).fill(user.email);
    await page.getByRole('button', { name: 'Send sign-in link ↗' }).click();
    await page.waitForFunction(() => document.querySelector('.pf-sync__message')?.textContent?.includes('Check')).catch(async error => {
      console.log(`${engine}: email fixture diagnostics`, { requested: Boolean(cloud.otp),
        message: await page.locator('.pf-sync__message').allTextContents(), errors, consoleErrors });
      throw error;
    });
    check(`${engine}: email sign-in requests the correct return URL`, cloud.otp?.email === user.email && cloud.otpURL?.searchParams.get('redirect_to') === `${base}/profile/`);
    const cloudFirst = await context({ seed: true, signedIn: true }); const signed = await cloudFirst.newPage(); await signed.goto(`${base}/profile/`);
    await signed.getByText('Charts synced to your account', { exact: true }).waitFor();
    check(`${engine}: synced status follows a successful cloud write`, cloud.charts.length === 1);
    const cloudSecond = await context({ signedIn: true }); const recovered = await cloudSecond.newPage(); await recovered.goto(`${base}/profile/`);
    await recovered.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
    check(`${engine}: signed-in second device retrieves a saved birth chart`, await recovered.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.profile.v1')).charts.some(c => c.id === '11111111-1111-4111-8111-111111111111')));
    cloud.fail = true; await signed.getByRole('button', { name: /^(Sync now|Synced)$/ }).click();
    await signed.getByText('Saved in this browser · sync needs attention', { exact: true }).waitFor();
    check(`${engine}: failed sync retains local chart`, await signed.evaluate(() => JSON.parse(localStorage.getItem('zodiacs.profile.v1')).charts.length === 1));
    await cloudFirst.setOffline(true);
    await signed.getByText('Saved in this browser · offline', { exact: true }).waitFor();
    check(`${engine}: offline state does not claim current cloud sync`, true);
    check(`${engine}: no uncaught page errors`, errors.length === 0);
    await signed.screenshot({ path: `${out}/${engine}-offline-profile.png` });
    await first.close(); await second.close(); await cloudFirst.close(); await cloudSecond.close();
  } finally { await browser.close(); }
}
await writeFile(`${out}/results.json`, JSON.stringify({ checks, count: checks.length, simulatedCloud: true }, null, 2));
console.log(`Profile recovery: ${checks.length} checks passed.`);
});
} finally { if (preflightServer) await new Promise(resolve => preflightServer.close(resolve)); }
