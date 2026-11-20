import { describe, expect, it } from 'vitest';
import {
  FUTURE_BIRTH_DATE_SENTENCE,
  UNDER_13_SENTENCE,
  birthDateRefusal,
  birthDateRefusalLang,
  birthDateRefusalText,
  earliestToday,
  latestToday,
} from './birth-date-policy';

const at = (iso: string) => new Date(iso);

describe('the birth date policy', () => {
  it('takes today as the calendar date at UTC-12 and the latest date at UTC+14', () => {
    expect(earliestToday(at('2026-11-14T11:59:00Z'))).toBe('2026-11-13');
    expect(earliestToday(at('2026-11-14T12:01:00Z'))).toBe('2026-11-14');
    expect(latestToday(at('2026-11-13T09:59:00Z'))).toBe('2026-11-13');
    expect(latestToday(at('2026-11-13T10:01:00Z'))).toBe('2026-11-14');
  });

  // A 13th birthday on 14 November 2026: the person was born on 14 November 2013.
  const born = '2013-11-14';
  it.each([
    ['the day before, 11:59 UTC', '2026-11-13T11:59:00Z', 'under_13'],
    ['the day before, 12:01 UTC', '2026-11-13T12:01:00Z', 'under_13'],
    ['the day of, 11:59 UTC', '2026-11-14T11:59:00Z', 'under_13'],
    ['the day of, 12:01 UTC', '2026-11-14T12:01:00Z', null],
    ['the day after, 11:59 UTC', '2026-11-15T11:59:00Z', null],
    ['the day after, 12:01 UTC', '2026-11-15T12:01:00Z', null],
  ] as const)('reads a 13th birthday on %s', (_label, now, expected) => {
    expect(birthDateRefusal(born, at(now))).toBe(expected);
  });

  it('turns a 29 February birthday 13 on 1 March in a year without one', () => {
    expect(birthDateRefusal('2012-02-29', at('2025-02-28T12:01:00Z'))).toBe('under_13');
    expect(birthDateRefusal('2012-02-29', at('2025-03-01T11:59:00Z'))).toBe('under_13');
    expect(birthDateRefusal('2012-02-29', at('2025-03-01T12:01:00Z'))).toBeNull();
    // On a 29 February, someone born on 1 March 13 years before is still 12.
    expect(birthDateRefusal('2015-03-01', at('2028-02-29T12:01:00Z'))).toBe('under_13');
    expect(birthDateRefusal('2015-02-28', at('2028-02-29T12:01:00Z'))).toBeNull();
  });

  it('calls a date future only after the calendar date at UTC+14', () => {
    const now = at('2026-11-13T10:01:00Z'); // already 14 November at UTC+14
    expect(birthDateRefusal('2026-11-14', now)).toBe('under_13');
    expect(birthDateRefusal('2026-11-15', now)).toBe('future_birth_date');
    const earlier = at('2026-11-13T09:59:00Z'); // still 13 November at UTC+14
    expect(birthDateRefusal('2026-11-14', earlier)).toBe('future_birth_date');
    expect(birthDateRefusal('2026-11-13', earlier)).toBe('under_13');
  });

  it('refuses an obviously future year as future, not as a child', () => {
    expect(birthDateRefusal('2199-01-01', at('2026-11-13T00:00:00Z'))).toBe('future_birth_date');
    expect(birthDateRefusal('2027-11-13', at('2026-11-13T00:00:00Z'))).toBe('future_birth_date');
  });

  it('reads adult and historical dates, and leaves malformed dates to the form', () => {
    const now = at('2026-11-13T00:00:00Z');
    expect(birthDateRefusal('1990-06-15', now)).toBeNull();
    expect(birthDateRefusal('1800-01-01', now)).toBeNull();
    expect(birthDateRefusal('2012-11-12', now)).toBeNull();
    expect(birthDateRefusal('2014-11-13', now)).toBe('under_13');
    expect(birthDateRefusal('', now)).toBeNull();
    expect(birthDateRefusal('2014-1-1', now)).toBeNull();
  });

  it('keeps the audit sentences byte for byte and marks them English', () => {
    expect(UNDER_13_SENTENCE).toBe("Zodiacs is for people 13 and over, so it doesn't read charts for birth dates less than 13 years ago.");
    expect(FUTURE_BIRTH_DATE_SENTENCE).toBe("That birth date hasn't happened yet. Check the year and try again.");
    expect(birthDateRefusalText('under_13')).toBe(UNDER_13_SENTENCE);
    expect(birthDateRefusalText('future_birth_date')).toBe(FUTURE_BIRTH_DATE_SENTENCE);
    expect(birthDateRefusalLang(UNDER_13_SENTENCE)).toBe('en');
    expect(birthDateRefusalLang(FUTURE_BIRTH_DATE_SENTENCE)).toBe('en');
    expect(birthDateRefusalLang('Something else')).toBeUndefined();
    expect(birthDateRefusalLang('')).toBeUndefined();
  });
});
