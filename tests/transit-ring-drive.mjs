/**
 * End-to-end drive of the Transit Ring against `astro preview`: seed a saved
 * natal chart, compute, and exercise the bi-wheel — the outer transit ring
 * renders, the scrubber moves the sky, "Now" resets, tapping a contact
 * focuses it. Captures evidence shots.
 *
 *   npm run build
 *   OUT_DIR=/tmp/shots node tests/transit-ring-drive.mjs
 */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startPreview } from './visual/preview-server.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { setTimeout as wait } from 'node:timers/promises';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = await findChromium();

const profile = {
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: 'drive-frida',
    name: 'Frida',
    createdAt: '2026-07-11T00:00:00Z',
    updatedAt: '2026-07-11T00:00:00Z',
    birth: {
      date: '1907-07-06', time: '08:30', timeKnown: true,
      place: { name: 'Coyoacán', admin1: 'CDMX', country: 'MX', lat: 19.35, lon: -99.16, tz: 'America/Mexico_City' },
    },
    summary: {
      engineVersion: '0.0.0-stale', utcISO: '1907-07-06T14:30:00Z', houseSystem: 'whole',
      bodies: [], angles: null, flags: [],
    },
  }],
};

const preview = await startPreview({ port: 4399 });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
const shot = async (t, p, o = {}) => { if (OUT) await t.screenshot({ path: `${OUT}/${p}`, ...o }).catch(() => {}); };

try {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: STABLE_CHROMIUM_ARGS });

  async function run(page) {
    await page.addInitScript((prof) => {
      localStorage.setItem('zodiacs.profile.v1', JSON.stringify(prof));
    }, profile);
    await page.goto(`${preview.baseURL}/transits/`, { waitUntil: 'networkidle' });
    // The saved chart preselects; compute.
    await page.waitForSelector('.calc__submit', { timeout: 15000 });
    await page.locator('.calc__submit').click();
    await page.waitForSelector('.tring', { timeout: 15000 });
    await page.waitForSelector('.wheel__transit', { timeout: 15000 });
  }

  // ── Desktop ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await run(page);

  const transitMarks = await page.locator('.wheel__transit').count();
  check('outer transit ring renders (≥9 bodies)', transitMarks >= 9, `${transitMarks} marks`);
  check('contact chords render', (await page.locator('[data-transit-aspect]').count()) > 0);
  const dateBefore = await page.locator('.tring__date').textContent();
  await shot(page, 'transit-ring-now.png', { clip: { x: 0, y: 0, width: 1440, height: 1100 } });

  // Revision regressions —
  // The natal ring hides the South Node (11 natal bodies, not 12).
  const natalMarks = await page.locator('.wheel__body:not(.wheel__transit)').count();
  check('natal ring hides South Node (11 bodies)', natalMarks === 11, `${natalMarks} natal marks`);
  // The transiting-positions strip is back (accessible text readout, 10 bodies).
  check('positions strip renders all 10 transiting bodies', (await page.locator('.trans__pos').count()) === 10);

  // Capture one transit body's position, scrub +6 months, expect it to move.
  const posOf = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null;
  };
  const sunSel = '[data-transit="transit:Sun"] circle';
  const sunBefore = await posOf(sunSel);
  await page.locator('.tring__range').evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, '180');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(300);
  const sunAfter = await posOf(sunSel);
  const dateAfter = await page.locator('.tring__date').textContent();
  check('scrubbing moves the outer ring', !!sunBefore && !!sunAfter
    && (Math.abs(sunAfter.x - sunBefore.x) > 3 || Math.abs(sunAfter.y - sunBefore.y) > 3), `${JSON.stringify(sunBefore)}→${JSON.stringify(sunAfter)}`);
  check('scrubbing changes the date label', dateAfter !== dateBefore, `${dateBefore} → ${dateAfter}`);
  await shot(page, 'transit-ring-scrubbed.png', { clip: { x: 0, y: 0, width: 1440, height: 1100 } });

  // "Now" resets — it glides back (~700 ms), so wait out the tween.
  await page.locator('.tring__step', { hasText: 'Now' }).click();
  await wait(1000);
  check('Now resets the date', (await page.locator('.tring__date').textContent()) === dateBefore, await page.locator('.tring__date').textContent() ?? '');

  // Tap a transit contact row → focus block appears.
  const firstRow = page.locator('.tring__row').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await wait(150);
    check('tapping a contact opens its reading', await page.locator('.tring__focus').isVisible());
    check('the tapped row is marked focused', (await page.locator('.tring__row.is-focus').count()) === 1);
    await shot(page, 'transit-ring-focus.png', { clip: { x: 0, y: 0, width: 1440, height: 1100 } });

    // Revision regression: scrubbing far past the focused contact's orb must
    // dissolve the focus, not dim the whole ring against a dead highlight.
    await page.locator('.tring__range').evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, '120');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait(300);
    const sunOpacity = await page.locator('[data-transit="transit:Sun"]').getAttribute('opacity');
    check('stale focus dissolves instead of ghosting the ring', sunOpacity === '1', `sun opacity ${sunOpacity}`);
    await page.locator('.tring__step', { hasText: 'Now' }).click();
    await wait(1000);
  } else {
    check('tapping a contact opens its reading', false, 'no contact rows (quiet sky?)');
  }

  // Integration: exact slow-transit markers appear on the timeline.
  await page.waitForSelector('[data-transit-mark]', { timeout: 30000 });
  const markCount = await page.locator('[data-transit-mark]').count();
  check('exact-date markers render on the timeline', markCount > 0, `${markCount} markers`);

  // The calendar file keeps the exact times, from the exact chart, and says
  // so beside its button. The file's UIDs are hashes of what each event shows.
  const notes = await page.locator('.calendar-subscribe__note').allInnerTexts();
  check('personal server calendar subscriptions are retired', await page.locator('[data-calendar-subscribe]').count() === 0);
  check('the download note says the file\'s times come from the exact chart',
    notes.some((note) => note.includes('The times in the file come from your exact chart')));
  const [calendarDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-calendar-download]').click()]);
  const calendarPath = await calendarDownload.path();
  const calendarFile = calendarPath ? await readFile(calendarPath, 'utf8') : '';
  const calendarUids = calendarFile.split('\r\n').filter((line) => line.startsWith('UID:'));
  check('calendar file UIDs carry no time', calendarUids.length > 0
    && calendarUids.every((line) => /^UID:transit-[0-9a-f]{16}@zodiacs\.org$/u.test(line)), calendarUids.slice(0, 2).join(' '));
  check('calendar file keeps each contact to the second',
    (calendarFile.match(/DTSTART:\d{8}T\d{6}Z/gu) ?? []).length === calendarUids.length);
  const dateBeforeJump = await page.locator('.tring__date').textContent();
  // Dates can share a pointer position. Every marker remains keyboard-accessible;
  // the final DOM marker is the foreground pointer target at its position.
  await page.locator('[data-transit-mark]').first().focus();
  await page.locator('[data-transit-mark]').first().press('Enter');
  await wait(1200);
  check('keyboard activation of a marker jumps the sky to that date',
    (await page.locator('.tring__date').textContent()) !== dateBeforeJump);
  const dateBeforePointer = await page.locator('.tring__date').textContent();
  await page.locator('[data-transit-mark]').last().click();
  await wait(1200);
  check('clicking the foreground marker jumps the sky to that date',
    (await page.locator('.tring__date').textContent()) !== dateBeforePointer);
  await shot(page, 'transit-ring-markers.png', { clip: { x: 0, y: 0, width: 1440, height: 1100 } });

  await page.close();

  // ── Mobile ──
  const mob = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, hasTouch: true });
  await run(mob);
  check('mobile: transit ring renders', (await mob.locator('.wheel__transit').count()) >= 9);
  await shot(mob, 'transit-ring-mobile.png');
  await mob.close();

  // ── Reduced motion: scrub still works, jump is instant ──
  const rm = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  await run(rm);
  const rmDate = await rm.locator('.tring__date').textContent();
  await rm.locator('.tring__step', { hasText: '+1 month' }).click();
  await wait(80); // well under any tween
  check('reduced motion: stepper jumps instantly', (await rm.locator('.tring__date').textContent()) !== rmDate);

  // Revision regression: steppers clamp to the ±365-day window (instant
  // jumps under reduced motion make the arithmetic deterministic: 14 × 30
  // = 420, clamped to 365).
  for (let i = 0; i < 13; i += 1) {
    await rm.locator('.tring__step', { hasText: '+1 month' }).click();
    await wait(30);
  }
  check('steppers clamp to the one-year window', (await rm.locator('.tring__range').inputValue()) === '365');
  await rm.close();

  await browser.close();
} catch (error) {
  // Keep the checks already made when a later browser action fails.
  check('drive completed without an unhandled failure', false, error instanceof Error ? error.message : String(error));
} finally {
  await preview.stop();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  · ${r.ok ? r.detail.slice(0, 90) : r.detail}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURES` : '\nALL PASS');
process.exit(failed ? 1 : 0);
