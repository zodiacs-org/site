import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';
import RetrogradeForYou, { RETROGRADE_ERROR_CODE, retrogradeFormRefusal } from './RetrogradeForYou';
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
  const drive = readFileSync(new URL('../../tests/personal-pages-drive.mjs', import.meta.url), 'utf8');
  it('drives only Retrogrades for you, including its age gate', () => {
    expect(drive).toContain("path: '/retrogrades/for-you/'");
    expect(drive).not.toMatch(/astrocartography/iu);
    expect(drive).toContain("check('an under-13 date locks the birth time'");
  });
});
