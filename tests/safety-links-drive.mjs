/**
 * Phone drive (390 x 844) for the two safety fixes on the birth chart page:
 * links never carry birth details (Decision A) and the calculator refuses
 * birth dates under 13 and future birth dates (Decision C). It uses only
 * fictional charts and prints only check names.
 *
 *   npm run build && node tests/safety-links-drive.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;
const UNDER_13 = "Zodiacs is for people 13 and over, so it doesn't read charts for birth dates less than 13 years ago.";
const FUTURE = "That birth date hasn't happened yet. Check the year and try again.";

const yearsFromToday = (years) => {
  const day = new Date();
  day.setUTCFullYear(day.getUTCFullYear() + years);
  return day.toISOString().slice(0, 10);
};

const legacyToken = `1.${Buffer.from(JSON.stringify({
  d: '1990-06-15', t: '12:00', z: 'America/New_York', la: 40.7128, lo: -74.006, n: 'Drive person', p: 'New York',
})).toString('base64url')}`;

const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures += 1;
};

async function fillAndSubmit(page, date) {
  await page.locator('#birth-date').fill(date);
  await page.locator('#birth-time').fill('12:30');
  const place = page.locator('#place');
  if ((await place.inputValue()) === '') {
    await place.fill('Coyo');
    await page.locator('#place-opt-0').waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.locator('#place-opt-0').click();
  }
  await page.locator('.calc__submit').click();
}

try {
  await withPreview({ port: 4338 }, async (baseURL) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    // A legacy #c= link still opens, and the fragment is gone straight after.
    const legacy = await context.newPage();
    await legacy.goto(`${baseURL}/birth-chart/#c=${legacyToken}`, { waitUntil: 'domcontentloaded' });
    await legacy.locator('[data-chart-action-dock]').waitFor({ state: 'visible', timeout: TIMEOUT });
    check('legacy #c= link opens the chart', true);
    check('legacy #c= fragment is stripped', new URL(legacy.url()).hash === '');
    const shareButton = legacy.locator('[data-share-card]').first();
    if (await shareButton.isVisible()) {
      await shareButton.click();
      await legacy.waitForTimeout(800);
      check('the share dialog has no "Copy details link"', !(await legacy.getByText('Copy details link').count()));
    }
    const hrefs = await legacy.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
    check('no link on the chart page carries a chart', hrefs.every((href) => !/[#&?](?:c|mine|a|b)=1\./u.test(href) && !/#date=|card=/u.test(href)));
    await legacy.close();

    // A session handoff opens the chart, keeps the address bar clean and is deleted once read.
    const handoff = await context.newPage();
    // Stash the entry on this origin, then navigate from another page so the
    // calculator mounts with the fragment. A same-page hash change would not
    // remount it, and the handoff is only read in the mount effect.
    await handoff.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    const key = 'abcdef0123456789abcdef0123456789';
    await handoff.evaluate(([storageKey, token]) => {
      sessionStorage.setItem(`zodiacs.handoff.${storageKey}`, JSON.stringify({ k: 'chart', c: token }));
    }, [key, legacyToken]);
    await handoff.goto(`${baseURL}/birth-chart/#h=${key}`, { waitUntil: 'domcontentloaded' });
    await handoff.locator('[data-chart-action-dock]').waitFor({ state: 'visible', timeout: TIMEOUT });
    check('session handoff opens the chart', true);
    check('session handoff leaves only an empty fragment', new URL(handoff.url()).hash === '');
    check('session handoff entry is deleted once read', await handoff.evaluate(() =>
      Object.keys(sessionStorage).every((name) => !name.startsWith('zodiacs.handoff.'))));
    await handoff.close();

    // The refusal: under 13, then a future date, then an adult date.
    const form = await context.newPage();
    await form.goto(`${baseURL}/birth-chart/`, { waitUntil: 'domcontentloaded' });
    const storedBefore = await form.evaluate(() => JSON.stringify(Object.keys(localStorage).sort()));
    await fillAndSubmit(form, yearsFromToday(-12));
    const error = form.locator('.calc__error').first();
    await error.waitFor({ state: 'visible', timeout: TIMEOUT });
    check('under 13: the exact sentence appears', (await error.innerText()).trim() === UNDER_13);
    check('under 13: no result and no Save control', !(await form.locator('[data-chart-action-dock], [data-save-chart]').count()));
    check('under 13: the typed date stays', (await form.locator('#birth-date').inputValue()) === yearsFromToday(-12));
    await fillAndSubmit(form, yearsFromToday(1));
    await form.waitForTimeout(300);
    check('future: the exact sentence appears', (await form.locator('.calc__error').first().innerText()).trim() === FUTURE);
    check('refused dates stored nothing new', storedBefore === await form.evaluate(() => JSON.stringify(Object.keys(localStorage).sort())));
    await fillAndSubmit(form, yearsFromToday(-14));
    await form.locator('[data-chart-action-dock]').waitFor({ state: 'visible', timeout: TIMEOUT });
    check('14 years ago: the chart renders as before', true);
    await form.close();
    await context.close();
  });
} finally {
  await browser.close();
}

assert.equal(failures, 0, `${failures} safety check(s) failed`);
