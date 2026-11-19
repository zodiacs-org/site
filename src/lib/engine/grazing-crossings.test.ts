/**
 * Step 1.6: crossing pairs that fall between two coarse samples around a
 * station are no longer dropped (audit production-event-search-4).
 */
import { describe, expect, it } from 'vitest';
import { bodyLongitude, longitudeSpeed } from './full';
import { findLongitudeCrossingsWith } from '@zodiacs/engine/crossings';
import { saturnReturns } from './returns';
import { yearScan } from './year-scan';

const DAY = 86_400_000;
const norm = (value: number) => ((value % 360) + 360) % 360;

function stationNear(body: 'Jupiter' | 'Saturn', from: number, to: number): { at: number; lon: number } {
  // Golden-section maximum of longitude (both stations used here are retrograde stations).
  let lo = from;
  let hi = to;
  const r = (Math.sqrt(5) - 1) / 2;
  const L = (t: number) => bodyLongitude(body, new Date(t));
  while (hi - lo > 1) {
    const a = hi - r * (hi - lo);
    const b = lo + r * (hi - lo);
    if (L(a) > L(b)) hi = b; else lo = a;
  }
  const at = Math.round((lo + hi) / 2);
  expect(longitudeSpeed(body, new Date(at - 5 * DAY))).toBeGreaterThan(0);
  return { at, lon: L(at) };
}

describe('grazing crossing pairs', () => {
  it('finds a synthetic pair inside one 5-day cell', () => {
    for (const dip of [0.005, 0.001, 1e-6]) {
      const k = 0.001;
      const fn = (day: number) => 100 + dip - k * (day - 12.5) ** 2;
      const found = findLongitudeCrossingsWith((_b, d) => norm(fn(d.getTime() / DAY)), 'Mars', 100,
        new Date(0), new Date(25 * DAY), 5);
      const half = Math.sqrt(dip / k);
      expect(found.map((c) => c.retrograde)).toEqual([false, true]);
      expect(Math.abs(found[0].at.getTime() / DAY - (12.5 - half))).toBeLessThan(1e-6);
      expect(Math.abs(found[1].at.getTime() / DAY - (12.5 + half))).toBeLessThan(1e-6);
    }
  });

  it('keeps all three first-return passes for a natal Saturn just below the 2019 station', () => {
    const birth = new Date('1990-02-12T20:13:55.742Z');
    const station = stationNear('Saturn', Date.UTC(2019, 3, 1), Date.UTC(2019, 5, 1));
    // DE440 station offset, recorded in the adoption evidence.
    expect(station.lon - bodyLongitude('Saturn', birth)).toBeCloseTo(0.002816699, 6);
    const { natalLon, seasons } = saturnReturns(birth);
    // A quarter-day scan sees the pair directly; the 5-day scan must agree.
    const reference = findLongitudeCrossingsWith(bodyLongitude, 'Saturn', natalLon,
      new Date(Date.UTC(2018, 11, 1)), new Date(Date.UTC(2020, 2, 1)), 0.25);
    expect(reference.map((c) => c.retrograde)).toEqual([false, true, false]);
    expect(seasons[0].crossings.map((c) => c.retrograde)).toEqual([false, true, false]);
    seasons[0].crossings.forEach((crossing, index) => {
      expect(Math.abs(crossing.at.getTime() - reference[index].at.getTime())).toBeLessThan(1000);
    });
    expect(seasons[0].crossings[1].at.toISOString().slice(0, 10)).toBe('2019-05-01');
    expect(seasons.reduce((n, s) => n + s.crossings.length, 0)).toBe(7);
  }, 60_000);

  it('returns both Jupiter conjunction passes for dips ≤ 0.005° at every scan phase', () => {
    const station = stationNear('Jupiter', Date.UTC(2026, 10, 1), Date.UTC(2027, 0, 15));
    for (const dip of [0.005, 0.001, 0.0001]) {
      for (let k = 0; k < 5; k += 1) {
        const from = new Date(Date.UTC(2026, 6, 1 + k));
        const to = new Date(Date.UTC(2027, 6, 1 + k));
        const events = yearScan({ sunLon: station.lon - dip, moonLon: null, ascLon: null, birthUtc: new Date('1990-06-15T00:00:00Z') }, from, to)
          .aspects.filter((a) => a.body === 'Jupiter' && a.aspect === 'conjunction' && a.natal === 'Sun');
        expect(events.reduce((n, e) => n + e.passes, 0), `dip ${dip} phase ${k}`).toBe(2);
      }
    }
  }, 120_000);

  it('never evaluates outside [from, to], and finds a pair in the first or the last cell', () => {
    for (const center of [1.5, 23.5]) {
      const seen: number[] = [];
      const fn = (day: number) => 100 + 0.001 - 0.001 * (day - center) ** 2;
      const found = findLongitudeCrossingsWith((_b, d) => {
        seen.push(d.getTime());
        return norm(fn(d.getTime() / DAY));
      }, 'Mars', 100, new Date(0), new Date(25 * DAY), 5);
      expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...seen)).toBeLessThanOrEqual(25 * DAY);
      expect(found.map((c) => c.retrograde), `center ${center}`).toEqual([false, true]);
    }
  });

  it('leaves ordinary windows with the same answers and no extra probe', () => {
    let calls = 0;
    const found = findLongitudeCrossingsWith((body, d) => { calls += 1; return bodyLongitude(body, d); },
      'Saturn', 300, new Date(Date.UTC(2018, 0, 1)), new Date(Date.UTC(2023, 0, 1)), 5);
    expect(found.length).toBeGreaterThan(0);
    // One sample per 5-day step and 24 bisection steps per crossing, nothing else.
    expect(calls).toBe(Math.ceil(5 * 365.25 / 5) + 1 + 24 * found.length);
  });
});

