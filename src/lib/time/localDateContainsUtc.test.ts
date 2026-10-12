import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { localDateContainsUtc, prepareLocalTime, resolveLocalToUtc } from './localToUtc';
import { resolveLocalDateIntervals } from './local-date-intervals';
import { UI, CATALOG_LOCALES } from '../i18n';

const message = 'Could not determine local-date membership from the supplied date, instant and explicit timezone.';
afterEach(() => vi.restoreAllMocks());

describe('local date membership of a selected instant', () => {
  it.each([
    ['2011-12-30', 'Pacific/Apia'], ['1993-08-21', 'Pacific/Kwajalein'],
    ['1994-12-31', 'Pacific/Kiritimati'], ['1844-12-31', 'Pacific/Guam'],
  ])('refuses the out-of-date noon selected for %s in %s', async (date, zone) => {
    await prepareLocalTime(date, zone);
    const resolved = resolveLocalToUtc(date, '12:00', zone);
    expect(localDateContainsUtc(date, resolved.utc, zone)).toBe(false);
    expect(resolved.flags).toContain('dst-gap'); // Existing resolution policy is unchanged.
  });

  it.each([
    ['2000-02-29', 'UTC'], ['2026-03-08', 'America/New_York'],
    ['2024-10-06', 'Australia/Lord_Howe'], ['1892-07-04', 'Pacific/Apia'],
    ['1969-09-30', 'Pacific/Kwajalein'], ['1867-10-18', 'America/Juneau'],
    ['1919-03-31', 'America/Toronto'], ['2009-11-01', 'America/St_Johns'],
    ['1990-01-04', 'US/Eastern'], ['1990-01-04', '+0100'],
  ])('admits a reference on %s in %s without making a coverage claim', async (date, zone) => {
    await prepareLocalTime(date, zone);
    expect(localDateContainsUtc(date, resolveLocalToUtc(date, '12:00', zone).utc, zone)).toBe(true);
  });

  it.each([
    ['0000-01-01', 'UTC'], ['0000-02-29', 'UTC'], ['0099-12-31', 'UTC'],
    ['9999-12-31', 'UTC'], ['0000-01-01', '+23:59'], ['9999-12-31', '-23:59'],
    ['1907-07-06', 'America/Mexico_City'], ['1883-11-17', 'America/Denver'],
    ['1900-01-01', 'Asia/Colombo'],
  ])('uses exact era-aware midnight membership for %s in %s', async (date, zone) => {
    await prepareLocalTime(date, zone);
    const midnight = resolveLocalToUtc(date, '00:00', zone).utc;
    expect(localDateContainsUtc(date, midnight, zone)).toBe(true);
    expect(localDateContainsUtc(date, new Date(midnight.getTime() - 1), zone)).toBe(false);
  });

  it('does not compare the UTC date or round a historical seconds offset', () => {
    const utc = new Date('1907-07-06T06:36:36.000Z');
    expect(localDateContainsUtc('1907-07-06', utc, 'America/Mexico_City')).toBe(true);
    expect(localDateContainsUtc('1907-07-06', new Date(utc.getTime() - 1), 'America/Mexico_City')).toBe(false);
    expect(localDateContainsUtc('2000-01-01', new Date('1999-12-31T23:30Z'), '+01:00')).toBe(true);
  });

  it.each([undefined, null, '', ' ', 'Private/unsupported', '+01:00:30', {}, 0])('never falls back for an invalid or missing explicit zone (%j)', (zone) => {
    expect(() => localDateContainsUtc('2000-01-01', new Date('2000-01-01Z'), zone as string)).toThrow(message);
  });

  it.each(['2000-1-01', '2000-02-30', '1900-02-29', '10000-01-01', '2000-01-01\n', '', null, {}])('rejects noncanonical or impossible requested dates (%j)', (date) => {
    expect(() => localDateContainsUtc(date as string, new Date(), 'UTC')).toThrow(message);
  });

  it.each([new Date(NaN), '2000-01-01T00:00Z', 0, null, {}, { getTime: (): number => 0 }])('requires a finite actual Date (%j)', (instant) => {
    expect(() => localDateContainsUtc('2000-01-01', instant as Date, 'UTC')).toThrow(message);
  });

  it('accepts cross-realm Dates and ignores overridden getters', () => {
    const crossRealm = runInNewContext("new Date('2000-01-01T00:00:00Z')") as Date;
    expect(localDateContainsUtc('2000-01-01', crossRealm, 'UTC')).toBe(true);
    Object.defineProperty(crossRealm, 'getTime', { get() { throw Error('Private getter'); } });
    expect(localDateContainsUtc('2000-01-01', crossRealm, 'UTC')).toBe(true);
    expect(crossRealm.toISOString()).toBe('2000-01-01T00:00:00.000Z');
  });

  it('sanitizes formatter failures without claiming a different or empty date', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => { throw Error('Private zone and instant'); });
    let caught: unknown;
    try { localDateContainsUtc('2000-01-01', new Date('2000-01-01Z'), 'UTC'); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(RangeError); expect((caught as Error).message).toBe(message);
    expect((caught as Error).cause).toBeUndefined(); expect(String(caught)).not.toContain('Private');
  });

  it('retains the synthetic nonempty-date conservative refusal counterexample', () => {
    const zone = 'Synthetic/ReferenceMembershipForward15', date = '2000-01-01';
    const transition = Date.parse('2000-01-01T00:00Z');
    const offset = (instant: number) => instant < transition ? 0 : 15 * 3_600_000;
    const Original = Intl.DateTimeFormat;
    const wall = new Original('en-US', { timeZone: 'UTC', calendar: 'gregory', numberingSystem: 'latn', era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' });
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((locales, options) => {
      if (options?.timeZone !== zone) return new Original(locales, options);
      return { formatToParts(value: number) { return options.timeZoneName === 'longOffset'
        ? [{ type: 'timeZoneName', value: offset(Number(value)) === 0 ? 'GMT' : 'GMT+15:00' }]
        : wall.formatToParts(Number(value) + offset(Number(value))); } } as Intl.DateTimeFormat;
    }) as typeof Intl.DateTimeFormat);
    const noon = resolveLocalToUtc(date, '12:00', zone);
    expect(localDateContainsUtc(date, noon.utc, zone)).toBe(false);
    expect(localDateContainsUtc(date, new Date(transition), zone)).toBe(true);
    expect(resolveLocalDateIntervals(date, zone, {
      completeness: 'complete-transitions-v1', offsetMilliseconds: (_zone, instant) => offset(instant),
      nextTransitionMilliseconds: (_zone, after) => after < transition ? transition : null,
    })).toEqual({ status: 'existing', intervals: [{ start: transition, endExclusive: transition + 9 * 3_600_000 }] });
  });

  it.each(CATALOG_LOCALES)('supplies a dedicated localized unresolved-reference message for %s', (locale) => {
    expect(UI[locale].localDateReferenceError.length).toBeGreaterThan(40);
    expect(UI[locale].localDateReferenceError).not.toBe(UI[locale].chartError);
    if (locale !== 'en') expect(UI[locale].localDateReferenceError).not.toBe(UI.en.localDateReferenceError);
  });
});
