import { legacyPolarFixture, installLegacyProfile, checkOriginalProfile } from './legacy-polar-fixture.mjs';

/** Use the normal Guide consent/transport UI; only auth and the reply are mocked. */
export async function driveLegacyPolarGuide({ browser, baseURL, check, outDir, installGuideRoute, accountId }) {
  const fixture = legacyPolarFixture();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await installLegacyProfile(context, fixture);
  await context.addInitScript(({ accountId, chartId }) => {
    localStorage.setItem('zodiacs.account-sync-v2.local-owner.v1', JSON.stringify({ version: 1, accountId }));
    localStorage.setItem(`zodiacs.account-sync-v2.account.${accountId}.v1`, JSON.stringify({
      version: 1, accountId, deviceId: '44444444-4444-4444-8444-444444444444',
      serverCursor: null, pendingConsentOperation: null,
      charts: [{ chartId, selectedForSync: true, serverRevision: 1, pendingOperation: null }],
    }));
    const jwtPart = (value) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
    const accessToken = `${jwtPart({ alg: 'none', typ: 'JWT' })}.${jwtPart({ aud: 'authenticated', exp: 4_102_444_800, sub: accountId })}.signature`;
    localStorage.setItem('sb-guide-test-auth-token', JSON.stringify({
      access_token: accessToken, refresh_token: 'browser-test-refresh-token',
      expires_at: 4_102_444_800, expires_in: 2_147_483_647, token_type: 'bearer',
      user: { id: accountId, aud: 'authenticated', role: 'authenticated' },
    }));
    window.zodiacsProfileAccess = { canRead: () => true };
  }, { accountId, chartId: fixture.polar.id });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await installGuideRoute(page, requests);
    await page.goto(`${baseURL}/ask/`, { waitUntil: 'networkidle' });
    // The existing Guide driver owns this simulated account-v2 boundary when
    // CI builds with rollout off. It does not bypass chart consent or parsing.
    await page.evaluate(() => document.documentElement.setAttribute('data-account-sync-v2', ''));
    await page.locator('[data-guide-launcher]').click();
    await page.locator('.zassistant__panel').waitFor({ state: 'visible' });
    await page.locator('.zassistant__input').fill('What is an ascendant?');
    await page.locator('.zassistant__input').press('Enter');
    await page.getByRole('button', { name: 'Continue with Guide' }).click();
    await page.locator('.zassistant__message--assistant').filter({ hasText: 'practical answer' }).waitFor();
    check('legacy polar Guide: ordinary consent sends no saved chart',
      requests.length === 1 && requests[0].ephemeralContext.baseContext.ownerChart.state === 'unavailable');

    check('legacy polar Guide keeps personal chart attachment hidden',
      await page.locator('.zassistant__chart-chip').isHidden());
    await checkOriginalProfile(page, fixture, check, 'Guide privacy boundary');
    if (outDir) await page.screenshot({ path: `${outDir}/legacy-polar-guide-local.png`, fullPage: false });
    check('legacy polar Guide has no page errors', errors.length === 0, errors.join(' | '));
  } finally {
    await context.close();
  }
}
