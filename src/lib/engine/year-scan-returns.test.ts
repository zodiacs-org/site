import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mostRecentSolarReturnInstant } from '@zodiacs/engine/techniques';
import { bodyLongitude } from './full';
import { REFERENCE_SPAN_END_MS, clipToReferenceSpan } from './reference-span';
import { findLongitudeCrossings } from './returns';
import { yearScan } from './year-scan';

// The year ahead's solar returns are the package's, as the solar-return tool's
// are since engine rc.16 (P2.E.returns). These spies only watch the calls.
vi.mock('@zodiacs/engine/techniques', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zodiacs/engine/techniques')>();
  return { ...actual, mostRecentSolarReturnInstant: vi.fn(actual.mostRecentSolarReturnInstant) };
});
vi.mock('./returns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./returns')>();
  return { ...actual, findLongitudeCrossings: vi.fn(actual.findLongitudeCrossings) };
});

const DAY_MS = 86_400_000;
// The shared crossing solver bisects a one-day step 24 times, so two searches
// whose sample grids start at different instants may settle up to
// 86,400,000 / 2^24 ≈ 5.15 ms apart on the same crossing.
const SOLVER_RESOLUTION_MS = 6;

/** The construction year-scan used before: the site's own Sun crossing scan. */
function siteScan(sunLon: number, from: Date, to: Date): string[] {
  const window = clipToReferenceSpan(from, to);
  return (window ? findLongitudeCrossings('Sun', sunLon, window.from, window.to, 1) : [])
    .map((crossing) => crossing.at.toISOString());
}

function scanOf(sunLon: number, from: Date, to: Date) {
  return yearScan({ sunLon, moonLon: null, ascLon: null, birthUtc: new Date('1990-02-01T12:00:00Z') }, from, to);
}

/** A seeded generator, so the synthetic charts are the same on every run. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

beforeEach(() => {
  vi.mocked(mostRecentSolarReturnInstant).mockClear();
  vi.mocked(findLongitudeCrossings).mockClear();
});

describe('yearScan solar returns come from @zodiacs/engine', () => {
  it('asks the package for the return and never scans the Sun itself', () => {
    const sunLon = bodyLongitude('Sun', new Date('1990-02-01T12:00:00Z'));
    const scan = scanOf(sunLon, new Date('2026-07-07T00:00:00Z'), new Date('2027-07-08T00:00:00Z'));
    expect(scan.solarReturns).toHaveLength(1);
    expect(vi.mocked(mostRecentSolarReturnInstant)).toHaveBeenCalled();
    const results = vi.mocked(mostRecentSolarReturnInstant).mock.results.map((result) => (result.value as Date).toISOString());
    expect(results).toContain(scan.solarReturns[0]);
    const bodies = vi.mocked(findLongitudeCrossings).mock.calls.map(([body]) => body);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies).not.toContain('Sun');
  });

  it('matches the site\'s former scan on seeded synthetic charts and windows', () => {
    const random = mulberry32(20261004);
    const birthStart = Date.parse('1900-01-01T00:00:00Z');
    const birthEnd = Date.parse('2026-01-01T00:00:00Z');
    const fromStart = Date.parse('1950-01-01T00:00:00Z');
    const fromEnd = Date.parse('2199-06-01T00:00:00Z');
    let returns = 0;
    let worst = 0;
    for (let index = 0; index < 48; index += 1) {
      const birth = new Date(birthStart + random() * (birthEnd - birthStart));
      const sunLon = bodyLongitude('Sun', birth);
      const from = new Date(fromStart + random() * (fromEnd - fromStart));
      const to = new Date(from.getTime() + 366 * DAY_MS);
      const expected = siteScan(sunLon, from, to);
      const actual = scanOf(sunLon, from, to).solarReturns;
      expect(actual.length, `${birth.toISOString()} ${from.toISOString()}`).toBe(expected.length);
      actual.forEach((instant, at) => {
        worst = Math.max(worst, Math.abs(Date.parse(instant) - Date.parse(expected[at])));
      });
      returns += actual.length;
    }
    // A window clipped at the end of 2199 may hold none; the rest hold one or two.
    expect(returns).toBeGreaterThanOrEqual(44);
    expect(worst).toBeLessThanOrEqual(SOLVER_RESOLUTION_MS);
  }, 60_000);

  it('keeps the window (from, to]: a return at its start is out, one before its end is in', () => {
    const sunLon = 123.456;
    const to = new Date('2031-01-01T00:00:00Z');
    // The scan's first question for this end, so the instant below is the one it gets.
    const found = mostRecentSolarReturnInstant(sunLon, to).getTime();
    expect(scanOf(sunLon, new Date(found), to).solarReturns).toEqual([]);
    expect(scanOf(sunLon, new Date(found - 1), to).solarReturns).toEqual([new Date(found).toISOString()]);
    // Ends a second either side, far wider than the solver's resolution, so the
    // answer does not depend on where a search's sample grid starts.
    expect(scanOf(sunLon, new Date(found - 300 * DAY_MS), new Date(found + 1000)).solarReturns).toHaveLength(1);
    expect(scanOf(sunLon, new Date(found - 300 * DAY_MS), new Date(found - 1000)).solarReturns).toEqual([]);
  });

  it('lists both returns, in order, when the window spans more than a year', () => {
    const sunLon = 300;
    const from = new Date('2040-01-01T00:00:00Z');
    const to = new Date(from.getTime() + 400 * DAY_MS);
    const both = scanOf(sunLon, from, to).solarReturns;
    expect(both).toHaveLength(2);
    expect(Date.parse(both[1]) - Date.parse(both[0])).toBeGreaterThan(365 * DAY_MS);
    expect(both.every((instant) => Date.parse(instant) > from.getTime() && Date.parse(instant) <= to.getTime())).toBe(true);
  });

  it('stays inside the reference span, as the scan it replaced did', () => {
    const sunLon = 200;
    const nearEnd = scanOf(sunLon, new Date('2199-03-01T00:00:00Z'), new Date('2200-03-01T00:00:00Z'));
    expect(nearEnd.rangeClipped).toBe(true);
    expect(nearEnd.solarReturns.every((instant) => Date.parse(instant) < REFERENCE_SPAN_END_MS)).toBe(true);
    expect(nearEnd.solarReturns).toHaveLength(siteScan(sunLon, new Date('2199-03-01T00:00:00Z'), new Date('2200-03-01T00:00:00Z')).length);
    const outside = scanOf(sunLon, new Date('2200-02-01T00:00:00Z'), new Date('2201-02-01T00:00:00Z'));
    expect(outside.solarReturns).toEqual([]);
    expect(outside.rangeClipped).toBe(true);
  });
});
