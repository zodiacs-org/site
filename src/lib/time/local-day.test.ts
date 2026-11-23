import { describe, expect, it } from 'vitest';
import { localDaySpan, readsOnDate, type WallResolution, type WallResolver } from './local-day';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';

/** A local date's span on the site's own resolver, as the /vedic-signs/ page reads it. */
async function span(date: string, zone: string, longitude?: number) {
  await prepareLocalTime(date, zone);
  const options = longitude === undefined ? {} : { longitude };
  return localDaySpan(date, (day, time, fold) => resolveLocalToUtc(day, time, zone, { ...options, fold }));
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

  it('ends a date where the clock jumped out of it, not an hour into the next (St. John\'s, 2 May 1920)', async () => {
    // At 23:00 on 2 May 1920 (UTC−3:30:52) St. John's went straight to 00:00 on 3 May (UTC−2:30:52).
    // Its 23:59 never happened; read forward by the jump it falls at 03:29:52 UTC on 3 May.
    await prepareLocalTime('1920-05-02', 'America/St_Johns');
    expect(resolveLocalToUtc('1920-05-02', '23:59', 'America/St_Johns', { fold: 'later' }).flags).toContain('dst-gap');
    expect(iso(await span('1920-05-02', 'America/St_Johns'))).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.000Z']);
    expect(iso(await span('1920-05-03', 'America/St_Johns'))).toEqual(['1920-05-03T02:30:52.000Z', '1920-05-04T02:30:51.000Z']);
  });

  it('starts a date where the clock jumped into it, when its 00:00 was skipped partway through a gap (Toronto, 31 March 1919)', async () => {
    // At 23:30 on 30 March 1919 (UTC−5) Toronto went to 00:30 on 31 March (UTC−4).
    expect(iso(await span('1919-03-30', 'America/Toronto'))).toEqual(['1919-03-30T05:00:00.000Z', '1919-03-31T04:29:59.000Z']);
    expect(iso(await span('1919-03-31', 'America/Toronto'))).toEqual(['1919-03-31T04:30:00.000Z', '1919-04-01T03:59:59.000Z']);
  });

  it('ends a date at its last pass when the clock turned back over midnight (Goose Bay, 25 October 1987)', async () => {
    // At 00:01 on 25 October 1987 (UTC−3) Goose Bay went back to 23:01 on 24 October (UTC−4).
    expect(iso(await span('1987-10-24', 'America/Goose_Bay'))).toEqual(['1987-10-24T03:00:00.000Z', '1987-10-25T03:59:59.000Z']);
    expect(iso(await span('1987-10-25', 'America/Goose_Bay'))).toEqual(['1987-10-25T03:00:00.000Z', '1987-10-26T03:59:59.000Z']);
  });

  it('ends the day before a skipped date where the jump happened (Apia, 29 December 2011)', async () => {
    expect(iso(await span('2011-12-29', 'Pacific/Apia'))).toEqual(['2011-12-29T10:00:00.000Z', '2011-12-30T09:59:59.000Z']);
  });

  it('starts and ends a date at a clock change within a minute, to the second (Accra, 2 November 1915)', async () => {
    // Accra left local mean time at 00:00:52 UTC. At 0.25 degrees west the birthplace clock
    // (UTC−0:01:00) then went from 23:59:52 on 1 November to 00:00:52 on 2 November.
    await prepareLocalTime('1915-11-02', 'Africa/Accra');
    const midnight = resolveLocalToUtc('1915-11-02', '00:00', 'Africa/Accra', { longitude: -0.25 });
    expect(midnight.flags).toContain('dst-gap');
    expect(midnight.transition?.at).toBe('1915-11-02T00:00:52.000Z');
    expect(iso(await span('1915-11-02', 'Africa/Accra', -0.25))).toEqual(['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.000Z']);
    expect(iso(await span('1915-11-01', 'Africa/Accra', -0.25))).toEqual(['1915-11-01T00:01:00.000Z', '1915-11-02T00:00:51.000Z']);
    // On the zone's own mean time (UTC−0:00:52) the clock went from 00:00:00 to 00:00:52 on 2 November.
    expect(iso(await span('1915-11-02', 'Africa/Accra'))).toEqual(['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.000Z']);
    expect(iso(await span('1915-11-01', 'Africa/Accra'))).toEqual(['1915-11-01T00:00:52.000Z', '1915-11-02T00:00:51.000Z']);
  });

  it('covers a date the clock turned back into by more than a day (Sitka, 18 October 1867)', async () => {
    // At 15:30 on 19 October (UTC+14:58:47) Sitka went back to 15:30 on 18 October (UTC−9:01:13).
    expect(iso(await span('1867-10-18', 'America/Sitka'))).toEqual(['1867-10-17T09:01:13.000Z', '1867-10-19T09:01:12.000Z']);
    expect(iso(await span('1867-10-19', 'America/Sitka'))).toEqual(['1867-10-18T09:01:13.000Z', '1867-10-20T09:01:12.000Z']);
  });

  it('reads the dates either side of the shipped history\'s end (London, 31 December 1969 and 1 January 1970)', async () => {
    // British Standard Time (UTC+1) ran from 1968 to 1971.
    expect(iso(await span('1969-12-31', 'Europe/London'))).toEqual(['1969-12-30T23:00:00.000Z', '1969-12-31T22:59:59.000Z']);
    expect(iso(await span('1970-01-01', 'Europe/London'))).toEqual(['1969-12-31T23:00:00.000Z', '1970-01-01T22:59:59.000Z']);
  });

  it('refuses a date whose next date the resolver cannot read', () => {
    expect(() => localDaySpan('9999-12-31', utcClock)).toThrow(RangeError);
  });
});

/**
 * A clock that resolves wall times as the engine does, from a starting offset
 * and its changes (UTC instant, offset after, in seconds): a repeated wall
 * time at the pass asked for, a skipped one moved forward by the jump, each
 * with the change behind it. For clock changes no real zone made.
 */
function steppedClock(initialSeconds: number, changes: Array<[string, number]>): WallResolver {
  const steps = changes.map(([at, offset]) => ({ at: Date.parse(at), offset }));
  const offsetAt = (ms: number) => steps.filter((step) => step.at <= ms).at(-1)?.offset ?? initialSeconds;
  const change = (at: number) => ({ at: new Date(at).toISOString(), offsetAfterMinutes: offsetAt(at) / 60 });
  return (date, time, fold): WallResolution => {
    const wall = Date.parse(`${date}T${time}:00Z`);
    const passes = [...new Set([initialSeconds, ...steps.map((step) => step.offset)])]
      .map((offset) => ({ utc: wall - offset * 1000, offset }))
      .filter((pass) => offsetAt(pass.utc) === pass.offset)
      .sort((a, b) => a.utc - b.utc);
    if (passes.length === 1) return { utc: new Date(passes[0].utc), offsetMinutes: passes[0].offset / 60, flags: [] };
    if (passes.length > 1) {
      const pass = fold === 'later' ? passes.at(-1)! : passes[0];
      const at = steps.find((step) => step.at > passes[0].utc && step.at <= passes.at(-1)!.utc)!.at;
      return { utc: new Date(pass.utc), offsetMinutes: pass.offset / 60, flags: ['dst-fold'], transition: change(at) };
    }
    const step = steps.find((candidate) => candidate.at + offsetAt(candidate.at - 1) * 1000 <= wall && wall < candidate.at + candidate.offset * 1000)!;
    const before = offsetAt(step.at - 1);
    return { utc: new Date(wall - before * 1000), offsetMinutes: step.offset / 60, flags: ['dst-gap'], transition: change(step.at) };
  };
}
const utcClock = steppedClock(0, []);

describe('a local date as real time, on clock changes no zone made', () => {
  it('runs a date to its last pass when the clock turned back over midnight by less than a minute', () => {
    // At 00:00:30 on 2 January the clock went back 50 seconds, to 23:59:40 on 1 January.
    const clock = steppedClock(0, [['2000-01-02T00:00:30Z', -50]]);
    expect(iso(localDaySpan('2000-01-01', clock))).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-02T00:00:49.000Z']);
    expect(iso(localDaySpan('2000-01-02', clock))).toEqual(['2000-01-02T00:00:00.000Z', '2000-01-03T00:00:49.000Z']);
  });

  it('keeps a date the clock jumped into for its last seconds, after a jump of more than a day', () => {
    // At 23:00 on 1 January the clock went forward 24:59:30, to 23:59:30 on 2 January.
    const clock = steppedClock(0, [['2000-01-01T23:00:00Z', 89_970]]);
    expect(iso(localDaySpan('2000-01-01', clock))).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-01T22:59:59.000Z']);
    expect(iso(localDaySpan('2000-01-02', clock))).toEqual(['2000-01-01T23:00:00.000Z', '2000-01-01T23:00:29.000Z']);
    // Jumping to 00:00:30 on 3 January instead skips the 2nd whole.
    const past = steppedClock(0, [['2000-01-01T23:00:00Z', 90_030]]);
    expect(localDaySpan('2000-01-02', past)).toBeNull();
    expect(iso(localDaySpan('2000-01-01', past))).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-01T22:59:59.000Z']);
    expect(iso(localDaySpan('2000-01-03', past))).toEqual(['2000-01-01T23:00:00.000Z', '2000-01-02T22:59:29.000Z']);
  });

  it('agrees with the site resolver on real clock changes', async () => {
    // St. John's, 2 May 1920: UTC−3:30:52 to UTC−2:30:52 at 02:30:52 UTC on 3 May.
    const clock = steppedClock(-(3 * 3600 + 30 * 60 + 52), [['1920-05-03T02:30:52Z', -(2 * 3600 + 30 * 60 + 52)]]);
    expect(iso(localDaySpan('1920-05-02', clock))).toEqual(iso(await span('1920-05-02', 'America/St_Johns')));
  });
});
