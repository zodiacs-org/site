/**
 * Google/Apple sign-in and "Save to your profile", driven in Chromium at 360px
 * and 1280px against a simulated Supabase. Never contacts Supabase, Google or
 * Apple. Needs a dist built with the account flags on, for example:
 *
 *   PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co \
 *   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture \
 *   PUBLIC_AUTH_GOOGLE=1 PUBLIC_AUTH_APPLE=1 PUBLIC_ACCOUNT_SAVES_ENABLED=1 npm run build
 *   node tests/account-save-drive.mjs
 *
 * Screenshots go to OUT_DIR (default /tmp/zodiacs-account-save).
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const serviceURL = process.env.PUBLIC_SUPABASE_URL ?? 'https://abcdefghijklmnopqrst.supabase.co';
const service = new URL(serviceURL).origin;
const authStorageKey = `sb-${new URL(serviceURL).hostname.split('.')[0]}-auth-token`;
const out = process.env.OUT_DIR ?? '/tmp/zodiacs-account-save';
await mkdir(out, { recursive: true });

const user = {
  id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated',
  email: 'account-fixture@example.invalid', app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: {}, created_at: '2026-10-01T12:00:00Z',
};
const jwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url'),
  'fixture',
].join('.');
const session = {
  access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 7200,
  expires_at: Math.floor(Date.now() / 1000) + 7200, user,
};

const chartLink = (wire) => `1.${Buffer.from(JSON.stringify(wire)).toString('base64url')}`;
const ana = chartLink({ d: '1990-08-14', z: 'Europe/Lisbon', la: 38.7167, lo: -9.1333, t: '09:30', n: 'Ana', p: 'Lisbon' });
const ben = chartLink({ d: '1992-03-02', z: 'Europe/London', la: 51.5072, lo: -0.1276, n: 'Ben', p: 'London' });
const occasionPath = '/occasions/#o=wedding&d=2027-06-12&n=Ana+%26+Ben&t=16%3A00&tz=Europe%2FLisbon&lat=38.7167&lon=-9.1333&place=Lisbon%2C+Portugal';

const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

await withPreview({ port: 8791 }, async (base) => {
  const browser = await chromium.launch({ headless: true, executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    for (const width of [360, 1280]) {
      const cloud = { rows: [], authorize: null };

      async function context(signedIn) {
        const ctx = await browser.newContext({
          viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block',
        });
        await ctx.addInitScript(({ signedIn, session, authStorageKey }) => {
          if (signedIn && !localStorage.getItem(authStorageKey)) localStorage.setItem(authStorageKey, JSON.stringify(session));
        }, { signedIn, session, authStorageKey });
        await ctx.route(`${service}/**`, async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' };
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          if (url.pathname === '/auth/v1/authorize') {
            cloud.authorize = url;
            return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Provider</title><p>Provider sign-in (simulated)</p>' });
          }
          if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, headers: cors, json: user });
          if (url.pathname === '/rest/v1/saved_pages') {
            if (request.method() === 'POST') {
              const body = request.postDataJSON();
              cloud.rows.unshift({ id: crypto.randomUUID(), saved_at: new Date().toISOString(), ...body });
              return route.fulfill({ status: 201, headers: cors, body: '' });
            }
            if (request.method() === 'DELETE') {
              const id = url.searchParams.get('id')?.replace(/^eq\./u, '');
              cloud.rows = cloud.rows.filter((row) => row.id !== id);
              return route.fulfill({ status: 204, headers: cors, body: '' });
            }
            return route.fulfill({ status: 200, headers: cors, json: cloud.rows });
          }
          // Everything else the profile asks for (charts, profiles, deletions) is empty.
          return route.fulfill({ status: 200, headers: cors, json: [] });
        });
        return ctx;
      }

      // 1. Signed out: the sign-in panel shows both providers above the email box.
      {
        const ctx = await context(false);
        const page = await ctx.newPage();
        await page.goto(`${base}/profile/#profile-sync`, { waitUntil: 'networkidle' });
        const panel = page.locator('#profile-sync');
        await panel.locator('[data-oauth-provider="google"]').waitFor();
        check(`${width}: Google button wording`, (await panel.locator('[data-oauth-provider="google"]').innerText()).trim() === 'Continue with Google');
        check(`${width}: Apple button wording`, (await panel.locator('[data-oauth-provider="apple"]').innerText()).trim() === 'Continue with Apple');
        check(`${width}: email sign-in stays`, await panel.locator('input[type="email"]').isVisible());
        check(`${width}: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await panel.scrollIntoViewIfNeeded();
        await panel.screenshot({ path: `${out}/sign-in-panel-${width}.png` });

        await panel.locator('[data-oauth-provider="google"]').click();
        await page.waitForURL(/\/auth\/v1\/authorize/u);
        check(`${width}: Google goes through Supabase with PKCE`, cloud.authorize?.searchParams.get('provider') === 'google'
          && cloud.authorize.searchParams.get('code_challenge_method') === 's256'
          && Boolean(cloud.authorize.searchParams.get('code_challenge')));
        check(`${width}: returns to the callback, then the profile`,
          cloud.authorize?.searchParams.get('redirect_to') === `${base}/auth/callback/?next=%2Fprofile%2F`);
        await ctx.close();
      }

      // 2. Signed out on an occasion card: a quiet sign-in link, then the profile holds it.
      {
        const ctx = await context(false);
        const page = await ctx.newPage();
        await page.goto(`${base}${occasionPath}`, { waitUntil: 'networkidle' });
        const line = page.locator('[data-account-save="signed-out"]');
        await line.waitFor();
        check(`${width}: occasion signed-out prompt`, (await line.innerText()).includes('Sign in to save this card to your profile'));
        check(`${width}: no modal`, (await page.locator('dialog[open], [role="dialog"]').count()) === 0);
        await page.locator('.occasion__actions').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/occasion-signed-out-${width}.png` });
        await line.getByRole('link', { name: 'Sign in to save' }).click();
        await page.waitForURL(/\/profile\/#profile-sync/u);
        const pending = page.locator('#saved-pages');
        await pending.waitFor();
        check(`${width}: profile names the waiting card`, (await pending.innerText()).includes('The sky on'));
        await ctx.close();
      }

      // 3. Signed in: save the occasion card and the comparison; both list on the profile.
      {
        const ctx = await context(true);
        const page = await ctx.newPage();
        await page.goto(`${base}${occasionPath}`, { waitUntil: 'networkidle' });
        const save = page.locator('[data-account-save="signed-in"] button');
        await save.waitFor();
        check(`${width}: occasion save wording`, (await save.innerText()).trim() === 'Save to your profile');
        await page.locator('.occasion__actions').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/occasion-signed-in-${width}.png` });
        await save.click();
        await page.locator('[data-account-save="saved"]').waitFor();
        check(`${width}: occasion saved`, cloud.rows.some((row) => row.kind === 'occasion' && row.href.startsWith('/occasions/#')));

        await page.goto(`${base}/compatibility/#a=${ana}&b=${ben}`, { waitUntil: 'networkidle' });
        const compatSave = page.locator('[data-account-save="signed-in"] button');
        await compatSave.waitFor({ timeout: 30_000 });
        await compatSave.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/compatibility-signed-in-${width}.png` });
        await compatSave.click();
        await page.locator('[data-account-save="saved"]').waitFor();
        const compatRow = cloud.rows.find((row) => row.kind === 'compatibility');
        check(`${width}: comparison saved as a same-site link`, compatRow?.href.startsWith('/compatibility/#a=1.')
          && compatRow.title === 'Ana and Ben · compatibility');

        // A row the assistant save tool wrote (server-only columns), as the RPC stores it.
        cloud.rows.push({ id: crypto.randomUUID(), saved_at: '2026-10-14T12:00:00Z', kind: 'week', title: 'Your week from 2026-10-14',
          href: '/horoscopes/#week=2026-10-14&saved=0123456789abcdef', source: 'assistant', summary: 'Venus meets your Sun. Wed 14 Oct' });
        await page.goto(`${base}/profile/#saved-pages`, { waitUntil: 'networkidle' });
        const list = page.locator('[data-saved-pages]');
        await list.waitFor();
        check(`${width}: profile lists site and assistant saves together`, (await list.locator('.saved-pages__row').count()) === 3);
        check(`${width}: list links back`, (await list.locator('a.saved-pages__link').first().getAttribute('href'))?.startsWith('/'));
        const assistantRow = list.locator('.saved-pages__row', { hasText: 'Your week from 2026-10-14' });
        check(`${width}: assistant save shows its summary and source`, (await assistantRow.innerText()).includes('Venus meets your Sun.')
          && (await assistantRow.innerText()).includes('from your assistant'));
        await list.scrollIntoViewIfNeeded();
        await list.screenshot({ path: `${out}/profile-saved-pages-${width}.png` });
        await assistantRow.locator('.saved-pages__remove').click();
        await list.locator('.saved-pages__row', { hasText: 'Your week from 2026-10-14' }).waitFor({ state: 'detached' });
        check(`${width}: assistant save removed`, !cloud.rows.some((row) => row.source === 'assistant'));
        await ctx.close();
      }

      // 4. The birth chart: signed out, one line about sign-in; signed in, nothing extra.
      {
        const ctx = await context(false);
        const page = await ctx.newPage();
        await page.goto(`${base}/birth-chart/#c=${ana}`, { waitUntil: 'networkidle' });
        const line = page.locator('[data-account-save="chart"]');
        await line.waitFor({ timeout: 30_000 });
        check(`${width}: chart signed-out line`, (await line.innerText()).includes('Sign in to save'));
        await line.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/birth-chart-signed-out-${width}.png` });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

console.log(`account save drive: ${checks.length} checks passed; screenshots in ${out}`);
