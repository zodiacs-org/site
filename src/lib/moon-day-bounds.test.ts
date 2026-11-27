import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bodyLongitude } from './engine/full';
import { localDateMoonSigns, type LocalDateMoonInput } from './moon-day-bounds';
import { SIGNS, signForLongitude } from './signs';
import type { CompleteTransitionProvider, LocalDateUnresolvedReason } from './time/local-date-intervals';
import { assessLocalDateReference, type LocalDateReferenceAssessment } from './time/local-date-reference';
import { localDateContainsUtc, offsetAt, prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const moon = (utc: Date) => bodyLongitude('Moon', utc);

/**
 * Test-only complete provider read from the host's Intl offsets: an hourly
 * scan, then a bisection to the millisecond. Production never samples; this
 * stands in for Temporal, which Node does not have, on zones whose changes
 * are hours apart.
 */
const intlProvider: CompleteTransitionProvider = {
  completeness: 'complete-transitions-v1',
  offsetMilliseconds: (zone, instant) => Math.round(offsetAt(zone, instant) * MINUTE),
  nextTransitionMilliseconds(zone, after) {
    const offset = (instant: number) => Math.round(offsetAt(zone, instant) * MINUTE);
    const base = offset(after);
    for (let probe = after + HOUR; probe <= after + 80 * HOUR; probe += HOUR) {
      if (offset(probe) === base) continue;
      let low = probe - HOUR, high = probe;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (offset(middle) === base) low = middle; else high = middle;
      }
      return high;
    }
    return null;
  },
};

type Path = 'complete' | 'unavailable';
const providers: Record<Path, CompleteTransitionProvider | null> = { complete: intlProvider, unavailable: null };

/** The calculator's own steps: the noon reference, its assessment, then the signs. */
function signsFor(date: string, zone: string, path: Path, lon = 0) {
  const reference = resolveLocalToUtc(date, '12:00', zone, { longitude: lon });
  const assessment = assessLocalDateReference(date, reference.utc, zone, providers[path]);
  expect(assessment.referenceStatus).toBe('member');
  expect(assessment.coverage.status).toBe(path === 'complete' ? 'existing' : 'unresolved');
  return localDateMoonSigns({
    date, place: { tz: zone, lon }, assessment, referenceFlags: reference.flags, moonLongitude: moon,
  });
}

/**
 * Independent oracle: the date's instants found on the host's clock alone,
 * every 15 minutes across the widest window and bisected to the millisecond
 * at both edges, then the Moon's sign every hour from the first instant and
 * at the last. The dates here are each one unbroken run.
 */
function oracle(date: string, zone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  const member = (instant: number) => localDateContainsUtc(date, new Date(instant), zone);
  const samples: number[] = [];
  for (let instant = midnight - 15 * HOUR; instant <= midnight + 39 * HOUR; instant += 15 * MINUTE) {
    if (member(instant)) samples.push(instant);
  }
  expect(samples.at(-1)! - samples[0]).toBe((samples.length - 1) * 15 * MINUTE);
  let [outside, inside] = [samples[0] - 15 * MINUTE, samples[0]];
  while (inside - outside > 1) {
    const middle = Math.floor((outside + inside) / 2);
    if (member(middle)) inside = middle; else outside = middle;
  }
  const first = inside;
  [inside, outside] = [samples.at(-1)!, samples.at(-1)! + 15 * MINUTE];
  while (outside - inside > 1) {
    const middle = Math.floor((outside + inside) / 2);
    if (member(middle)) inside = middle; else outside = middle;
  }
  const last = inside;
  const signs: string[] = [];
  for (let instant = first; instant < last; instant += HOUR) signs.push(signForLongitude(moon(new Date(instant))).slug);
  signs.push(signForLongitude(moon(new Date(last))).slug);
  return { length: last + 1 - first, signs: [...new Set(signs)] };
}

/**
 * Independent oracle for a date of any shape: its first and last instants on
 * the host's clock, found minute by minute across the widest window and
 * bisected to the millisecond, and the Moon's sign at each. Where those
 * differ, the Moon changed sign once in between, and the date names both
 * signs only if the instant it did so is one of the date's own.
 */
function changeOracle(date: string, zone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  const member = (instant: number) => localDateContainsUtc(date, new Date(instant), zone);
  const sign = (instant: number) => signForLongitude(moon(new Date(instant))).slug;
  const minutes: number[] = [];
  for (let instant = midnight - 15 * HOUR; instant <= midnight + 39 * HOUR; instant += MINUTE) {
    if (member(instant)) minutes.push(instant);
  }
  /** Between an instant `test` holds at and one it does not, the instant it last holds at before the edge. */
  const edge = (yes: number, no: number, test: (instant: number) => boolean) => {
    while (Math.abs(no - yes) > 1) {
      const middle = Math.floor((yes + no) / 2);
      if (test(middle)) yes = middle; else no = middle;
    }
    return yes;
  };
  const first = edge(minutes[0], minutes[0] - MINUTE, member);
  const last = edge(minutes.at(-1)!, minutes.at(-1)! + MINUTE, member);
  const [from, to] = [sign(first), sign(last)];
  if (from === to) return [from];
  const change = edge(first, last, (instant) => sign(instant) === from) + 1;
  return member(change) ? [from, to] : [];
}

function assessed(coverage: LocalDateReferenceAssessment['coverage']): LocalDateReferenceAssessment {
  return { referenceStatus: 'member', coverage, evidence: null };
}

/** A synthetic Moon moving steadily from `from` degrees at `at`. */
const steadyMoon = (at: number, from: number, degreesPerDay = 13.2) => (utc: Date) => from + (utc.getTime() - at) / DAY * degreesPerDay;

const T0 = Date.UTC(2025, 5, 15);
function synthetic(intervals: [number, number][], moonLongitude: LocalDateMoonInput['moonLongitude'], date = '2025-06-15') {
  return localDateMoonSigns({
    date, place: { tz: 'UTC', lon: 0 }, assessment: assessed({
      status: 'existing',
      intervals: intervals.map(([start, endExclusive]) => ({ start, endExclusive })) as [{ start: number; endExclusive: number }],
    }), referenceFlags: [], moonLongitude,
  });
}

const ZONES = ['UTC', 'America/New_York', 'Australia/Lord_Howe', 'America/Havana', 'Pacific/Apia', 'America/Toronto', 'America/Juneau', 'America/Sao_Paulo', 'Europe/Paris', 'Europe/London', 'Asia/Bangkok', 'America/St_Johns'];
beforeAll(() => Promise.all(ZONES.map((zone) => prepareLocalTime('1800-01-01', zone))));

describe('the Moon’s signs from a date’s own limits', () => {
  it('names one sign when the Moon held it through the date, and both in its order across one ingress', async () => {
    expect(await synthetic([[T0, T0 + DAY]], steadyMoon(T0, 10))).toEqual(['aries']);
    expect(await synthetic([[T0, T0 + DAY]], steadyMoon(T0, 355))).toEqual(['pisces', 'aries']);
    expect(await synthetic([[T0, T0 + DAY]], steadyMoon(T0, 60 - 13.2 * 0.5))).toEqual(['taurus', 'gemini']);
  });

  it('samples a 48-hour date every 12 hours, and refuses one that spans three signs', async () => {
    const calls: number[] = [];
    const watched = (utc: Date) => { calls.push(utc.getTime()); return steadyMoon(T0, 40, 14)(utc); };
    expect(await synthetic([[T0, T0 + 2 * DAY]], watched)).toEqual(['taurus', 'gemini']);
    expect(calls).toEqual([T0, T0 + 12 * HOUR, T0 + DAY, T0 + 36 * HOUR, T0 + 2 * DAY - 1]);
    // 29.9 degrees to 60.5: Aries, Taurus and Gemini in one repeated date.
    expect(await synthetic([[T0, T0 + 2 * DAY]], steadyMoon(T0, 29.9, 15.3))).toEqual([]);
  });

  it('joins the runs of a broken date, naming both signs only when the change fell inside one', async () => {
    const runs: [number, number][] = [[T0, T0 + 8 * HOUR], [T0 + 20 * HOUR, T0 + 30 * HOUR]];
    // Aries through both runs.
    expect(await synthetic(runs, steadyMoon(T0, 2))).toEqual(['aries']);
    // Into Taurus three hours into the first run, then two hours into the second,
    // and at the exact inclusive start of the second run (which belongs to the date).
    expect(await synthetic(runs, steadyMoon(T0, 30 - 13.2 * 3 / 24))).toEqual(['aries', 'taurus']);
    expect(await synthetic(runs, steadyMoon(T0, 30 - 13.2 * 22 / 24))).toEqual(['aries', 'taurus']);
    expect(await synthetic(runs, steadyMoon(T0, 30 - 13.2 * 20 / 24))).toEqual(['aries', 'taurus']);
    // Into Taurus about nine hours in, between the runs, when the clock showed another date: either sign is
    // possible, but the date did not see the change.
    expect(await synthetic(runs, steadyMoon(T0, 25))).toEqual([]);
    // Two signs that are not neighbours are not one ingress.
    const jump = (utc: Date) => (utc.getTime() < T0 + 10 * HOUR ? 25 : 70);
    expect(await synthetic([[T0, T0 + HOUR], [T0 + 30 * HOUR, T0 + 31 * HOUR]], jump)).toEqual([]);
  });

  it('settles nothing from a longitude that does not move like the Moon', async () => {
    const broken: Record<string, LocalDateMoonInput['moonLongitude']> = {
      constant: () => 100,
      backwards: steadyMoon(T0, 100, -13.2),
      fast: steadyMoon(T0, 100, 30),
      slow: steadyMoon(T0, 100, 5),
      'not a number': () => Number.NaN,
      throwing: () => { throw new Error('ephemeris unavailable'); },
      // Slipping back over a sign boundary would otherwise read as eleven signs.
      wrapped: (utc) => (utc.getTime() - T0 < 12 * HOUR ? 31 : 29),
    };
    for (const [name, moonLongitude] of Object.entries(broken)) {
      expect(await synthetic([[T0, T0 + DAY]], moonLongitude), name).toEqual([]);
    }
  });

  it.each([
    'invalid-input', 'invalid-provider', 'provider-failed', 'provider-violation', 'transition-limit',
  ] satisfies LocalDateUnresolvedReason[])('fails closed when coverage is unresolved by %s', async (reason) => {
    const moonLongitude = vi.fn(moon);
    expect(await localDateMoonSigns({
      date: '1990-01-04', place: { tz: 'Asia/Bangkok', lon: 100.5 }, assessment: assessed({ status: 'unresolved', reason }),
      referenceFlags: [], moonLongitude,
    })).toEqual([]);
    expect(moonLongitude).not.toHaveBeenCalled();
  });

  it('fails closed on an empty date and on reference flags that leave the date unsettled', async () => {
    expect(await localDateMoonSigns({
      date: '1990-01-04', place: { tz: 'UTC', lon: 0 }, assessment: assessed({ status: 'empty', intervals: [] }), referenceFlags: [], moonLongitude: moon,
    })).toEqual([]);
    for (const flag of ['host-zone-data-differs', 'calendar-unknown']) {
      const moonLongitude = vi.fn(moon);
      expect(await synthetic([[T0, T0 + DAY]], moonLongitude)).toEqual(oracle('2025-06-15', 'UTC').signs);
      expect(await localDateMoonSigns({
        date: '2025-06-15', place: { tz: 'UTC', lon: 0 }, assessment: assessed({ status: 'existing', intervals: [{ start: T0, endExclusive: T0 + DAY }] }),
        referenceFlags: [flag], moonLongitude,
      }), flag).toEqual([]);
    }
  });

  it.each(['complete', 'unavailable'] as const)('agrees with the hourly oracle on ordinary dates, %s coverage', async (path) => {
    const cases = [
      ['1990-01-04', 'Asia/Bangkok', ['aries']],
      ['1990-01-01', 'Europe/London', ['aquarius', 'pisces']],
      ['1990-01-02', 'Europe/London', ['pisces']],
      ['1990-01-03', 'UTC', ['pisces', 'aries']],
      ['2012-10-07', 'Australia/Lord_Howe', ['gemini', 'cancer']],
      ['2011-12-29', 'Pacific/Apia', ['pisces']],
    ] as const;
    for (const [date, zone, expected] of cases) {
      expect(await signsFor(date, zone, path), `${date} ${zone}`).toEqual(expected);
      expect(oracle(date, zone).signs, `${date} ${zone} oracle`).toEqual(expected);
    }
  });

  it('falls back only on an ordinary date: a repeated midnight leaves it to the host’s transitions', async () => {
    // Havana goes back from 01:00 to 00:00 on 2 November 2025 and forward
    // from 00:00 to 01:00 on 9 March.
    for (const date of ['2025-11-01', '2025-11-02']) {
      expect(await signsFor(date, 'America/Havana', 'unavailable'), date).toEqual([]);
      expect(await signsFor(date, 'America/Havana', 'complete'), date).toEqual(oracle(date, 'America/Havana').signs);
    }
    expect(oracle('2025-11-02', 'America/Havana').length).toBe(25 * HOUR);
    expect(await signsFor('2025-03-09', 'America/Havana', 'unavailable')).toEqual(oracle('2025-03-09', 'America/Havana').signs);
    expect(oracle('2025-03-09', 'America/Havana').length).toBe(23 * HOUR);
  });

  it('names no sign for a date the Moon changed sign between the runs of, and both for the date that saw it', async () => {
    // St. John's turned its clocks back from 00:01 on 29 October 1989 to 23:01 on the 28th, so both dates come
    // in two runs: the 28th's second is the repeated hour, the 29th's first its first minute.
    const zone = 'America/St_Johns';
    const lon = -52.71;
    const runs = (date: string) => {
      const reference = resolveLocalToUtc(date, '12:00', zone, { longitude: lon });
      const { coverage } = assessLocalDateReference(date, reference.utc, zone, intlProvider);
      return coverage.status === 'existing'
        ? coverage.intervals.map(({ start, endExclusive }) => [new Date(start).toISOString(), new Date(endExclusive).toISOString()])
        : coverage.status;
    };
    expect(runs('1989-10-28')).toEqual([
      ['1989-10-28T02:30:00.000Z', '1989-10-29T02:30:00.000Z'], ['1989-10-29T02:31:00.000Z', '1989-10-29T03:30:00.000Z'],
    ]);
    expect(runs('1989-10-29')).toEqual([
      ['1989-10-29T02:30:00.000Z', '1989-10-29T02:31:00.000Z'], ['1989-10-29T03:30:00.000Z', '1989-10-30T03:30:00.000Z'],
    ]);
    // The Moon entered Scorpio in the repeated hour, at an instant of the 28th. The 29th had Libra in its first
    // minute and Scorpio after it, so either sign is possible for a birth that day, but the Moon did not change
    // sign on it: it names no sign, and so no notice says it did. The 28th names both.
    const libra = (instant: number) => signForLongitude(moon(new Date(instant))).slug === 'libra';
    expect(libra(Date.parse('1989-10-29T02:31:00Z'))).toBe(true);
    expect(libra(Date.parse('1989-10-29T03:30:00Z'))).toBe(false);
    expect(await signsFor('1989-10-29', zone, 'complete', lon)).toEqual([]);
    expect(changeOracle('1989-10-29', zone)).toEqual([]);
    expect(await signsFor('1989-10-28', zone, 'complete', lon)).toEqual(['libra', 'scorpio']);
    expect(changeOracle('1989-10-28', zone)).toEqual(['libra', 'scorpio']);
    // A date in two runs keeps the one sign the Moon held through both (31 October 1993, Taurus), and an
    // unbroken date the Moon changed sign on keeps both (London, 1 January 1990).
    expect(runs('1993-10-31')).toHaveLength(2);
    expect(await signsFor('1993-10-31', zone, 'complete', lon)).toEqual(['taurus']);
    expect(await signsFor('1990-01-01', 'Europe/London', 'complete')).toEqual(['aquarius', 'pisces']);
    // Without the host's transitions the repeated midnight leaves the 28th and the 29th unresolved, as before.
    for (const date of ['1989-10-28', '1989-10-29']) expect(await signsFor(date, zone, 'unavailable', lon), date).toEqual([]);
  });

  it('agrees with where the Moon changed sign on every St. John’s date a clock split, 1987 to 2010', async () => {
    // Each autumn from 1987 to 2010 St. John's turned its clocks back from 00:01 to 23:01 the day before,
    // which leaves that Saturday and that Sunday in two runs.
    const zone = 'America/St_Johns';
    const answers = { one: 0, both: 0, none: 0 };
    for (let year = 1987; year <= 2010; year++) {
      for (let day = Date.UTC(year, 9, 20); day < Date.UTC(year, 10, 10); day += DAY) {
        const date = new Date(day).toISOString().slice(0, 10);
        const reference = resolveLocalToUtc(date, '12:00', zone, { longitude: -52.71 });
        const { coverage } = assessLocalDateReference(date, reference.utc, zone, intlProvider);
        if (coverage.status !== 'existing' || coverage.intervals.length === 1) continue;
        const signs = await signsFor(date, zone, 'complete', -52.71);
        expect(signs, date).toEqual(changeOracle(date, zone));
        answers[signs.length === 1 ? 'one' : signs.length === 2 ? 'both' : 'none'] += 1;
      }
    }
    // Only 29 October 1989 saw the Moon change sign between its runs.
    expect(answers).toEqual({ one: 24, both: 23, none: 1 });
  }, 60_000);

  it.each(['complete', 'unavailable'] as const)('never verifies one sign on the contradictory and repeated controls, %s coverage', async (path) => {
    // Toronto skipped 23:30 to 00:30 into 31 March 1919 at 04:30 UTC: with
    // complete coverage the engine's recorded transition meets the host's first
    // instant, naming both Pisces and Aries (never Aries alone); without
    // complete coverage it stays unverified. Juneau's 18 October 1867 came
    // twice, with its next midnight repeated.
    expect(await signsFor('1919-03-31', 'America/Toronto', path, -79.38)).toEqual(path === 'complete' ? ['pisces', 'aries'] : []);
    expect(oracle('1919-03-31', 'America/Toronto').signs).toEqual(['pisces', 'aries']);
    expect(await signsFor('1867-10-18', 'America/Juneau', path, -79.38)).toEqual([]);
    // Apia's 4 July 1892 lasted 48 hours; with complete transitions it is one
    // run whose ends the engine's midnights meet exactly.
    expect(await signsFor('1892-07-04', 'Pacific/Apia', path, -79.38)).toEqual(path === 'complete' ? ['libra', 'scorpio'] : []);
    expect(oracle('1892-07-04', 'Pacific/Apia')).toEqual({ length: 2 * DAY, signs: ['libra', 'scorpio'] });
  });

  it('verifies an earlier date only where the engine’s midnights meet the host’s coverage', async () => {
    expect(await signsFor('1955-06-15', 'America/New_York', 'complete', -74)).toEqual(oracle('1955-06-15', 'America/New_York').signs);
    expect(await signsFor('1955-06-15', 'America/New_York', 'unavailable', -74)).toEqual([]);
    // Sao Paulo sprang forward at 00:00 on 1 December 1950 (03:00 UTC): both
    // the shifted midnight and its recorded transition meet the host's first instant.
    expect(await signsFor('1950-12-01', 'America/Sao_Paulo', 'complete', -46.63)).toEqual(['leo', 'virgo']);
    expect(oracle('1950-12-01', 'America/Sao_Paulo').signs).toEqual(['leo', 'virgo']);
    expect(await signsFor('1950-11-30', 'America/Sao_Paulo', 'complete', -46.63)).toEqual(oracle('1950-11-30', 'America/Sao_Paulo').signs);
    // Lyon in 1880 kept its own mean time, about ten minutes from Paris's.
    expect(resolveLocalToUtc('1880-05-01', '12:00', 'Europe/Paris', { longitude: 4.83 }).localMeanTime).toBeDefined();
    expect(await signsFor('1880-05-01', 'Europe/Paris', 'complete', 4.83)).toEqual([]);
  });

  it.each(['complete', 'unavailable'] as const)('misses no sign on any day of 2025, DST days included, %s coverage', async (path) => {
    const lengths = new Map<string, number>();
    let crossings = 0;
    for (const zone of ['America/New_York', 'Australia/Lord_Howe', 'UTC']) {
      for (let day = Date.UTC(2025, 0, 1); day < Date.UTC(2026, 0, 1); day += DAY) {
        const date = new Date(day).toISOString().slice(0, 10);
        const truth = oracle(date, zone);
        const signs = await signsFor(date, zone, path);
        expect(signs, `${date} ${zone}`).toEqual(truth.signs);
        if (signs.length === 2) crossings += 1;
        if (truth.length !== DAY) lengths.set(`${zone} ${date}`, truth.length / HOUR);
      }
    }
    expect(Object.fromEntries(lengths)).toEqual({
      'America/New_York 2025-03-09': 23, 'America/New_York 2025-11-02': 25,
      'Australia/Lord_Howe 2025-04-06': 24.5, 'Australia/Lord_Howe 2025-10-05': 23.5,
    });
    expect(crossings).toBeGreaterThan(3 * 120);
  }, 60_000);

  it('keeps every candidate a real sign slug', async () => {
    expect(SIGNS.map((sign) => sign.slug)).toContain((await synthetic([[T0, T0 + DAY]], steadyMoon(T0, 345)))[0]);
  });
});
