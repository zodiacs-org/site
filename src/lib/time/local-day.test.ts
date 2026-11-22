import { describe, expect, it } from 'vitest';
import { localDaySpan, readsOnDate } from './local-day';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';

/** A local date's span on the site's own resolver, as the /vedic-signs/ page reads it. */
async function span(date: string, zone: string, longitude?: number) {
  await prepareLocalTime(date, zone);
  const options = longitude === undefined ? {} : { longitude };
  return localDaySpan(date, resolveLocalToUtc(date, '00:00', zone, options), resolveLocalToUtc(date, '23:59', zone, { ...options, fold: 'later' }));
}
const iso = (value: [Date, Date] | null) => value && value.map((at) => at.toISOString());

describe('a local date as real time', () => {
  it('covers both passes of a date the clock showed twice (Apia, 4 July 1892)', async () => {
    expect(iso(await span('1892-07-04', 'Pacific/Apia'))).toEqual(['1892-07-03T11:26:56.000Z', '1892-07-05T11:26:55.000Z']);
    // With the birthplace's own mean time (171.75 degrees west is 11:27:00 behind UTC).
    expect(iso(await span('1892-07-04', 'Pacific/Apia', -171.75))).toEqual(['1892-07-03T11:27:00.000Z', '1892-07-05T11:26:59.000Z']);
    // The days either side are ordinary.
    expect(iso(await span('1892-07-05', 'Pacific/Apia'))).toEqual(['1892-07-05T11:26:56.000Z', '1892-07-06T11:26:55.000Z']);
  });

  it('takes the later pass only when asked, and leaves other wall times alone', async () => {
    await prepareLocalTime('1892-07-04', 'Pacific/Apia');
    expect(resolveLocalToUtc('1892-07-04', '23:59', 'Pacific/Apia').utc.toISOString()).toBe('1892-07-04T11:25:56.000Z');
    expect(resolveLocalToUtc('1892-07-04', '23:59', 'Pacific/Apia', { fold: 'later' }).utc.toISOString()).toBe('1892-07-05T11:25:56.000Z');
    expect(resolveLocalToUtc('2026-11-02', '12:00', 'America/New_York', { fold: 'later' }).utc.toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });

  it('is null for a date the clock never showed (Apia, 30 December 2011, and Manila, 31 December 1844)', async () => {
    expect(await span('2011-12-30', 'Pacific/Apia')).toBeNull();
    expect(await span('2011-12-30', 'Pacific/Apia', -171.75)).toBeNull();
    expect(await span('1844-12-31', 'Asia/Manila')).toBeNull();
    await prepareLocalTime('2011-12-30', 'Pacific/Apia');
    // The resolver moves its wall times onto the next date; readsOnDate sees it.
    const noon = resolveLocalToUtc('2011-12-30', '12:00', 'Pacific/Apia');
    expect(noon.flags).toContain('dst-gap');
    expect(readsOnDate('2011-12-30', noon)).toBe(false);
    expect(readsOnDate('2011-12-31', noon)).toBe(true);
    expect(iso(await span('2011-12-31', 'Pacific/Apia'))).toEqual(['2011-12-30T10:00:00.000Z', '2011-12-31T09:59:59.000Z']);
  });

  it('gives a daylight saving day its 23 or 25 hours, and a gap at midnight its first real minute', async () => {
    const hours = (value: [Date, Date] | null) => value && (value[1].getTime() - value[0].getTime() + 1000) / 3_600_000;
    expect(hours(await span('2026-03-08', 'America/New_York'))).toBe(23);
    expect(hours(await span('2026-11-01', 'America/New_York'))).toBe(25);
    // São Paulo skipped 00:00 to 01:00 on 4 November 2018: the date started at its 01:00.
    expect(iso(await span('2018-11-04', 'America/Sao_Paulo'))?.[0]).toBe('2018-11-04T03:00:00.000Z');
  });
});
