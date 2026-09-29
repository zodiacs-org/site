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

    await page.locator('.zassistant__chart-chip').click();
    const preview = page.locator('.zassistant__consent-preview');
    await preview.waitFor({ state: 'visible' });
    const previewText = (await preview.textContent()).trim();
    const placementPreview = previewText.split('\n\n').at(-1)?.trim();
    // The angles go to the whole degree, as in a shared chart code (F-19).
    check('legacy polar Guide: consent identifies the same chart with corrected Aries ASC and house',
      previewText.includes(`Selected self chart (kept on this device): ${fixture.polar.name}`)
      && previewText.includes('ASC: 23° Aries · house 1')
      && !previewText.includes('23°52′') && !previewText.includes('ASC: 23° Libra') && requests.length === 1);
    await checkOriginalProfile(page, fixture, check, 'Guide consent');
    if (outDir) await page.screenshot({ path: `${outDir}/legacy-polar-guide-consent.png`, fullPage: false });
    await page.getByRole('button', { name: 'Attach my chart' }).click();
    await page.locator('.zassistant__input').fill('What does my chart emphasize?');
    await page.locator('.zassistant__input').press('Enter');
    await page.locator('.zassistant__message--assistant').filter({ hasText: 'Your placements' }).waitFor();
    const request = requests.at(-1);
    const source = request.ephemeralContext.baseContext.ownerChart.source;
    check('legacy polar Guide: outgoing chart facts exactly match the corrected consent preview',
      requests.length === 2 && source?.facts.trim() === placementPreview
      && source.facts.includes('ASC: 23° Aries · house 1') && !source.facts.includes('23°52′'));
    const wire = JSON.stringify(request);
    check('legacy polar Guide: chart name, birth data and account identifiers stay off the wire',
      ![fixture.polar.name, fixture.polar.id, accountId, '2001-12-21', '"09:00"',
        'Polar fixture', '78.2232', '15.6267'].some((value) => wire.includes(value)));
    await checkOriginalProfile(page, fixture, check, 'Guide request');
    check('legacy polar Guide has no page errors', errors.length === 0, errors.join(' | '));
  } finally {
    await context.close();
  }
}
