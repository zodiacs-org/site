import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';
import RetrogradeForYou, { NO_SUCH_DAY, RETROGRADE_ERROR_CODE, retrogradeFormRefusal } from './RetrogradeForYou';
import { BIRTH_CALENDAR_COPY } from './birth-calendar-copy';
import { checkedBirthDate, quickBirthDateCheck } from './GatedBirthFields';
import { FUTURE_BIRTH_DATE_SENTENCE } from '../lib/birth-date-policy';

const SOURCE = readFileSync(new URL('./RetrogradeForYou.tsx', import.meta.url), 'utf8');
const input = (markup: string, id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'u'))?.[0] ?? '';

describe('the Retrogrades for you form', () => {
  it('opens with the birth time and birthplace locked, and no birthplace search', () => {
    const markup = render(h(RetrogradeForYou, {}));
    expect(input(markup, 'rfy-time')).toMatch(/\sdisabled/u);
    expect(input(markup, 'rfy-place')).toMatch(/\sdisabled/u);
    expect(markup).not.toContain('role="combobox"');
    expect(markup).toMatch(/<button class="btn btn--primary calc__submit" type="submit" disabled/u);
  });

  it('keeps both submit labels in one cell, so the button keeps its width when the label changes (zero layout shift)', () => {
    const markup = render(h(RetrogradeForYou, {}));
    expect(markup).toContain('<span class="rfy__submit-label"><span>Show my retrogrades</span><span class="is-off">Working it out…</span></span>');
    // The result area holds a screen's height from the moment the form is sent until the next edit.
    expect(SOURCE).toMatch(/setBusy\(true\); setError\(''\); setResult\(null\); setRefused\(null\); setReserved\(true\);/u);
    expect(SOURCE).toMatch(/data-reserved=\{reserved \? '' : undefined\}/u);
    const page = readFileSync(new URL('../pages/retrogrades/for-you/index.astro', import.meta.url), 'utf8');
    expect(page).toContain(":global(.rfy__result[data-reserved]) { display: grid; align-content: start; min-height: 100vh; }");
    expect(page).toContain(':global(.rfy__submit-label > .is-off) { visibility: hidden; }');
  });

  it('asks for the time and birthplace only through the gated fields, opened by the converted date', () => {
    expect(SOURCE).not.toMatch(/<BirthFields\b/u);
    expect(SOURCE).toMatch(/<GatedBirthFields\b/u);
    expect(SOURCE).toMatch(/useBirthDateCheck\(date, calendar, retrogradeFormRefusal\)/u);
    expect(SOURCE).toMatch(/const ready = birthDateOpen\(check\) && city !== null/u);
  });

  describe('refuses on the shared policy\'s UTC-12 day, whatever the device says', () => {
    const zone = process.env.TZ;
    afterEach(() => {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    });

    it.each(['Pacific/Kiritimati', 'Asia/Bangkok', 'Europe/Madrid', 'UTC', 'America/New_York', 'Pacific/Pago_Pago'])('on a device in %s', (deviceZone) => {
      process.env.TZ = deviceZone;
      expect(retrogradeFormRefusal('2013-11-10', new Date('2026-11-10T02:00:00Z'))).toMatch(/^Zodiacs is not made for children under 13/u);
      expect(retrogradeFormRefusal('2013-11-10', new Date('2026-11-10T11:59:59Z'))).toMatch(/^Zodiacs is not made for children under 13/u);
      expect(retrogradeFormRefusal('2013-11-10', new Date('2026-11-10T12:00:00Z'))).toBeNull();
      expect(retrogradeFormRefusal('2026-11-12', new Date('2026-11-10T12:00:00Z'))).toBe(FUTURE_BIRTH_DATE_SENTENCE);
    });
  });

  it('opens the birth time and birthplace only for a real calendar day, whichever calendar was chosen', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    // The calendar control's own sentence for a day the calendar does not have.
    expect(NO_SUCH_DAY).toBe(BIRTH_CALENDAR_COPY.en.gregorianError);
    for (const date of ['1990-02-30', '2019-02-29', '1990-04-31', '1990-13-01', '1990-00-10']) {
      expect(retrogradeFormRefusal(date, now), date).toBe(NO_SUCH_DAY);
      expect(quickBirthDateCheck(date, 'gregorian', retrogradeFormRefusal, now), date).toEqual({ error: NO_SUCH_DAY });
      expect(await checkedBirthDate(date, 'gregorian', retrogradeFormRefusal, now), date).toEqual({ error: NO_SUCH_DAY });
    }
    // Old Style chosen, then a 1924 or later day that does not exist, or an Old Style day that does not exist: refused.
    expect(await checkedBirthDate('1990-02-30', 'julian', retrogradeFormRefusal, now)).toEqual({ error: NO_SUCH_DAY });
    expect(await checkedBirthDate('1900-02-30', 'julian', retrogradeFormRefusal, now)).toEqual({ error: expect.any(String) });
    // A real day still opens them, and an Old Style 29 February 1900 is a real Julian day.
    expect(quickBirthDateCheck('1990-02-28', 'gregorian', retrogradeFormRefusal, now)).toEqual({ date: '1990-02-28' });
    expect(await checkedBirthDate('1900-02-29', 'julian', retrogradeFormRefusal, now)).toEqual({ date: '1900-03-13' });
  });

  it('answers a birth time or a whole date the clock skipped with its own sentence, logging nothing', () => {
    const handler = SOURCE.slice(SOURCE.indexOf('} catch (cause) {'), SOURCE.indexOf('} finally {', SOURCE.indexOf('} catch (cause) {')));
    expect(handler).toMatch(/cause instanceof SkippedBirthTimeError\) setError\(SKIPPED_BIRTH_TIME\)/u);
    expect(handler).toMatch(/cause instanceof SkippedBirthDateError\) setError\(SKIPPED_BIRTH_DATE\)/u);
    // Both come before the branch that logs the error code.
    expect(handler.indexOf('SkippedBirthDateError')).toBeLessThan(handler.indexOf('console.error'));
  });

  it('asks for every zone history file before it prepares the birth\'s own date and zone', () => {
    expect(SOURCE).toMatch(/await prepareEveryZoneHistory\(\);\s*\n\s*await prepareLocalTime\(input\.birthDate, input\.place\.tz\);/u);
  });

  it('logs a fixed error code, never the exception, which can carry the birth details it was given', () => {
    expect(RETROGRADE_ERROR_CODE).toMatch(/^[a-z-]+: [a-z-]+$/u);
    const consoleCalls = SOURCE.match(/console\.\w+\([^)]*\)/gu) ?? [];
    expect(consoleCalls).toEqual(['console.error(RETROGRADE_ERROR_CODE)']);
  });
});

describe('the personal pages drive on this branch', () => {
  const drive = readFileSync(new URL('../../tests/retrogrades-for-you-drive.mjs', import.meta.url), 'utf8');
  const runner = readFileSync(new URL('../../tests/personal-pages-drive.mjs', import.meta.url), 'utf8');
  it('drives only Retrogrades for you, including its age gate', () => {
    expect(runner).toContain("'./retrogrades-for-you-drive.mjs'");
    expect(drive).toContain("path: '/retrogrades/for-you/'");
    expect(drive).not.toMatch(/astrocartography/iu);
    expect(drive).toContain("check('an under-13 date locks the birth time'");
  });
});
