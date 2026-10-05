/**
 * The election search, POST /api/v1/elections (the brief's B5.b): the span
 * algebra that combines the conditions, each kind of condition against a
 * reading of the engine made here by other steps, the house search against a
 * scan every minute, the request's validation and the budgets. The search
 * against a brute-force scan every 10 seconds on 100 random requests is in
 * docs/platform/evidence/election-search-v0/.
 */
import { describe, expect, it } from 'vitest';
import { houseOf, moonPhase, natalChart, positions, type BodyName } from '@zodiacs/engine';
import { VOID_BODIES, voidOfCourseWindows } from '@zodiacs/engine/techniques';
import { BUDGETS, ELECTION_STEPS, FULL_CALCULATION_COST } from '../../src/lib/compute-api/constants';
import {
  VOID_BODIES_MODERN, angularSpans, complementSpans, computeElections, houseSamplesAtLeast, intersectSpans, normalizeSpans,
  resolveSpans, searchElections, spansFromChanges, type Span,
} from '../../src/lib/compute-api/elections';
import { SampleBudget } from '../../src/lib/compute-api/endpoints';
import { ComputeApiError } from '../../src/lib/compute-api/errors';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { VALIDATION_MESSAGES as TEXT, parseElectionsRequest } from '../../src/lib/compute-api/validate';
import { run } from '../../scripts/lib/compute-api-harness';

const SECOND = 1_000;
const MINUTE = 60_000;
const DAY = 86_400_000;
const TOLERANCE = 2 * SECOND;
const LONDON = { latitude: 51.5072, longitude: -0.1276, houseSystem: 'placidus' } as const;
const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });

/** A budget with no ceiling, for searches longer than one request may run. */
class Unbounded extends SampleBudget {
  override get max(): number {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** The request as parseElectionsRequest reads it. */
const request = (from: string, to: string, conditions: unknown[], place?: unknown) =>
  parseElectionsRequest({ from, to, conditions, ...(place ? { place } : {}) });

/** The same spans, each end within the tolerance. */
function expectSpans(actual: readonly Span[], expected: readonly Span[], label: string) {
  const show = (spans: readonly Span[]) => spans.map((span) => `${new Date(span.from).toISOString()}–${new Date(span.to).toISOString()}`);
  expect(actual.length, `${label}: ${show(actual).join(', ')} against ${show(expected).join(', ')}`).toBe(expected.length);
  actual.forEach((span, index) => {
    expect(Math.abs(span.from - expected[index].from), `${label} window ${index} start`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(span.to - expected[index].to), `${label} window ${index} end`).toBeLessThanOrEqual(TOLERANCE);
  });
}

/**
 * The spans in which `holds` is true, read by sampling every `step` and
 * narrowing each change by halves to half a second: the scan this file holds
 * the search to, which shares nothing with it but the engine.
 */
function scan(holds: (ms: number) => boolean, from: number, to: number, step: number): Span[] {
  const out: Span[] = [];
  let state = holds(from);
  let since = from;
  for (let t = from + step; ; t += step) {
    const end = Math.min(t, to);
    const now = holds(end);
    if (now !== state) {
      let a = end - step;
      let b = end;
      while (b - a > SECOND / 2) {
        const mid = Math.floor((a + b) / 2);
        if (holds(mid) === state) a = mid;
        else b = mid;
      }
      if (state) out.push({ from: since, to: b });
      state = now;
      since = b;
    }
    if (end >= to) break;
  }
  if (state) out.push({ from: since, to });
  return resolveSpans(out, ELECTION_STEPS.resolutionSeconds * SECOND);
}

const lonOf = (body: BodyName, ms: number) => positions(new Date(ms)).find((row) => row.body === body)!;
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

describe('span algebra', () => {
  it('joins, intersects and complements half-open spans', () => {
    expect(normalizeSpans([{ from: 5, to: 9 }, { from: 0, to: 5 }, { from: 12, to: 12 }, { from: 8, to: 10 }])).toEqual([{ from: 0, to: 10 }]);
    expect(intersectSpans([{ from: 0, to: 10 }, { from: 20, to: 30 }], [{ from: 5, to: 25 }])).toEqual([{ from: 5, to: 10 }, { from: 20, to: 25 }]);
    expect(intersectSpans([{ from: 0, to: 10 }], [{ from: 10, to: 20 }])).toEqual([]);
    expect(complementSpans([{ from: 2, to: 4 }, { from: 6, to: 8 }], { from: 0, to: 10 })).toEqual([{ from: 0, to: 2 }, { from: 4, to: 6 }, { from: 8, to: 10 }]);
    expect(complementSpans([], { from: 0, to: 10 })).toEqual([{ from: 0, to: 10 }]);
    expect(complementSpans([{ from: -5, to: 15 }], { from: 0, to: 10 })).toEqual([]);
  });

  it('reads a state from the changes that set it, ignoring one that sets the state it already has', () => {
    expect(spansFromChanges(false, [{ at: 3, to: true }, { at: 5, to: true }, { at: 7, to: false }], { from: 0, to: 10 })).toEqual([{ from: 3, to: 7 }]);
    expect(spansFromChanges(true, [{ at: 6, to: false }, { at: 2, to: false }], { from: 0, to: 10 })).toEqual([{ from: 0, to: 2 }]);
    // A change at either end of the window is not inside it.
    expect(spansFromChanges(true, [{ at: 0, to: false }, { at: 10, to: false }], { from: 0, to: 10 })).toEqual([{ from: 0, to: 10 }]);
  });

  it('closes gaps and drops windows shorter than the resolution, so one instant found twice is one boundary', () => {
    const ms = ELECTION_STEPS.resolutionSeconds * SECOND;
    expect(ms).toBe(2 * ELECTION_STEPS.houseBoundarySeconds * SECOND);
    expect(resolveSpans([{ from: 0, to: 10_000 }, { from: 11_500, to: 20_000 }], ms)).toEqual([{ from: 0, to: 20_000 }]);
    expect(resolveSpans([{ from: 0, to: 10_000 }, { from: 12_000, to: 20_000 }], ms)).toEqual([{ from: 0, to: 10_000 }, { from: 12_000, to: 20_000 }]);
    expect(resolveSpans([{ from: 0, to: 1_999 }], ms)).toEqual([]);
    expect(resolveSpans([{ from: 0, to: 2_000 }], ms)).toEqual([{ from: 0, to: 2_000 }]);
    // Slivers that run together into a window longer than the resolution make that window.
    expect(resolveSpans([{ from: 0, to: 900 }, { from: 1_000, to: 1_900 }, { from: 2_000, to: 2_900 }], ms)).toEqual([{ from: 0, to: 2_900 }]);
  });
});

describe('each condition against its own reading of the engine', () => {
  it("finds the Moon's void periods that the engine's voidOfCourseWindows finds, to within 2 seconds, over a year and in two other eras", () => {
    expect([...VOID_BODIES_MODERN]).toEqual([...VOID_BODIES.modern]);
    const months = [
      ...Array.from({ length: 12 }, (_, month) => [Date.UTC(2026, month, 1), Date.UTC(2026, month + 1, 1)]),
      [Date.UTC(1952, 2, 1), Date.UTC(1952, 3, 1)],
      [Date.UTC(2041, 6, 1), Date.UTC(2041, 7, 1)],
    ];
    let periods = 0;
    for (const [from, to] of months) {
      const label = new Date(from).toISOString().slice(0, 7);
      // A month of void periods can pass one request's allowance; this test is of the periods, not of the allowance.
      const { windows } = searchElections(request(new Date(from).toISOString(), new Date(to).toISOString(), [{ kind: 'void-of-course' }]), new Unbounded('elections.samples'));
      const engine = voidOfCourseWindows(new Date(from - 4 * DAY), new Date(to + 4 * DAY), { bodies: 'modern' })
        .map((window) => ({ from: Math.max(from, window.from.getTime()), to: Math.min(to, window.to.getTime()) }));
      const expected = resolveSpans(engine, ELECTION_STEPS.resolutionSeconds * SECOND);
      expectSpans(windows, expected, label);
      periods += windows.length;
    }
    expect(periods).toBeGreaterThan(150);
  }, 120_000);

  it('finds the Moon in a sign, a planet retrograde and the Moon waxing where a scan of positions every 10 minutes does', () => {
    const from = Date.UTC(2026, 9, 1);
    const to = Date.UTC(2026, 10, 1);
    const window = [new Date(from).toISOString(), new Date(to).toISOString()] as const;
    const cases: Array<[string, unknown, (ms: number) => boolean]> = [
      ['the Moon in Taurus', { kind: 'sign', body: 'Moon', sign: 'taurus' }, (ms) => SIGNS[Math.floor(lonOf('Moon', ms).lon / 30)] === 'taurus'],
      ['Mercury retrograde', { kind: 'retrograde', body: 'Mercury' }, (ms) => lonOf('Mercury', ms).speed < 0],
      ['the Moon waxing', { kind: 'phase', phase: 'waxing' }, (ms) => moonPhase(new Date(ms)).angle < 180],
      ['the Moon not in Taurus', { kind: 'sign', body: 'Moon', sign: 'taurus', not: true }, (ms) => SIGNS[Math.floor(lonOf('Moon', ms).lon / 30)] !== 'taurus'],
      ['the Moon waning', { kind: 'phase', phase: 'waning' }, (ms) => moonPhase(new Date(ms)).angle >= 180],
    ];
    for (const [label, condition, holds] of cases) {
      const { windows } = searchElections(request(window[0], window[1], [condition]));
      const expected = scan(holds, from, to, 10 * MINUTE);
      expect(expected.length, label).toBeGreaterThan(0);
      expectSpans(windows, expected, label);
    }
  }, 120_000);

  it('combines conditions as the intersection of each one alone', () => {
    const from = '2026-11-01T00:00:00Z';
    const to = '2026-12-01T00:00:00Z';
    const parts = [{ kind: 'phase', phase: 'waxing' }, { kind: 'void-of-course', not: true }, { kind: 'sign', body: 'Moon', sign: 'scorpio', not: true }];
    const together = searchElections(request(from, to, parts)).windows;
    const alone = parts.map((condition) => searchElections(request(from, to, [condition])).windows);
    const expected = resolveSpans(alone.reduce((acc, spans) => intersectSpans(acc, spans)), ELECTION_STEPS.resolutionSeconds * SECOND);
    expectSpans(together, expected, 'three conditions');
    expect(together.length).toBeGreaterThan(0);
  }, 60_000);
});

describe('the house search', () => {
  const places: Array<[string, BodyName, { latitude: number; longitude: number; houseSystem: string }]> = [
    ['the Moon in London, Placidus', 'Moon', LONDON],
    ['the Sun at 59.5° north, Koch', 'Sun', { latitude: 59.5, longitude: 30.3, houseSystem: 'koch' }],
    ['Venus at 45° south, whole signs', 'Venus', { latitude: -45, longitude: 170, houseSystem: 'whole' }],
  ];
  const angularAt = (body: BodyName, place: { latitude: number; longitude: number; houseSystem: string }, ms: number) => {
    const chart = natalChart({ utc: new Date(ms), latitude: place.latitude, longitude: place.longitude, houseSystem: place.houseSystem as never });
    return [1, 4, 7, 10].includes(houseOf(chart.bodies.find((row) => row.body === body)!.lon, chart.houses!.cusps));
  };
  const angularScan = (body: BodyName, place: { latitude: number; longitude: number; houseSystem: string }, from: number, to: number) =>
    scan((ms) => angularAt(body, place, ms), from, to, MINUTE);

  it("finds the spans in an angular house that a scan every minute finds, to within 2 seconds, sampled hourly and every six hours", () => {
    const from = Date.UTC(2026, 11, 1);
    const to = from + DAY;
    for (const [label, body, place] of places) {
      const expected = angularScan(body, place, from, to);
      expect(expected.length, label).toBeGreaterThanOrEqual(3);
      // Every six hours a step passes three houses or more, so each is cut in two until it crosses one cusp.
      for (const step of [ELECTION_STEPS.houseSampleMinutes * MINUTE, 6 * 60 * MINUTE]) {
        const spans = resolveSpans(angularSpans(body as never, place as never, { from, to }, new Unbounded('elections.samples'), step), ELECTION_STEPS.resolutionSeconds * SECOND);
        expectSpans(spans, expected, `${label}, every ${step / MINUTE} minutes`);
      }
    }
  }, 180_000);

  it('samples hourly, narrows each change of house by interpolation, and searches only where the other conditions hold', () => {
    expect(ELECTION_STEPS.houseSampleMinutes).toBe(60);
    const from = Date.UTC(2026, 11, 1);
    const budget = new Unbounded('elections.samples');
    angularSpans('Moon', LONDON, { from, to: from + DAY }, budget);
    // 25 hourly samples and about 8 changes of house, each narrowed to a second in a handful of samples, not 12 halvings.
    // Each sample is a natalChart, a full calculation, and counts as FULL_CALCULATION_COST evaluations.
    expect(budget.used % FULL_CALCULATION_COST).toBe(0);
    const charts = budget.used / FULL_CALCULATION_COST;
    expect(charts).toBeGreaterThanOrEqual(houseSamplesAtLeast([{ from, to: from + DAY }]));
    expect(charts).toBeLessThan(25 + 8 * 8);
    // The new moon of 9 December falls in this week, so the Moon waxes for under half of it and the house search samples
    // about half as much; the phase search's own samples are the same either way.
    const week = ['2026-12-05T00:00:00Z', '2026-12-12T00:00:00Z'] as const;
    // A week of an angular condition passes one request's allowance; this is of the narrowing, not of the allowance.
    const alone = searchElections(request(week[0], week[1], [{ kind: 'angular', body: 'Jupiter' }], LONDON), new Unbounded('elections.samples'));
    const phase = searchElections(request(week[0], week[1], [{ kind: 'phase', phase: 'waxing' }]), new Unbounded('elections.samples'));
    const narrowed = searchElections(request(week[0], week[1], [{ kind: 'angular', body: 'Jupiter' }, { kind: 'phase', phase: 'waxing' }], LONDON), new Unbounded('elections.samples'));
    expect(phase.windows.reduce((sum, span) => sum + span.to - span.from, 0)).toBeLessThan(3.5 * DAY);
    expect(narrowed.samples - phase.samples).toBeLessThan(0.75 * alone.samples);
    expect(narrowed.windows.every((window) => phase.windows.some((span) => span.from <= window.from && window.to <= span.to))).toBe(true);
  }, 60_000);

  it('negates an angular condition within the stretches the other conditions leave, as a scan every minute finds', () => {
    // The new moon of 9 December falls in these two days, so the waxing Moon leaves one stretch, from it to the end.
    const from = Date.UTC(2026, 11, 8, 12);
    const to = from + 2 * DAY;
    const resolution = ELECTION_STEPS.resolutionSeconds * SECOND;
    const waxing = scan((ms) => moonPhase(new Date(ms)).angle < 180, from, to, MINUTE);
    expect(waxing.length).toBe(1);
    expect(waxing[0].from).toBeGreaterThan(from);
    const expected = resolveSpans(intersectSpans(waxing, scan((ms) => !angularAt('Moon', LONDON, ms), from, to, MINUTE)), resolution);
    const { windows } = searchElections(
      request(new Date(from).toISOString(), new Date(to).toISOString(), [{ kind: 'angular', body: 'Moon', not: true }, { kind: 'phase', phase: 'waxing' }], LONDON),
      new Unbounded('elections.samples'),
    );
    expect(expected.length).toBeGreaterThanOrEqual(3);
    expectSpans(windows, expected, 'the Moon waxing and not angular');
  }, 60_000);

  it('refuses before sampling a house when the stretches left need more samples than the request has', () => {
    class Small extends SampleBudget {
      override get max(): number {
        return 100;
      }
    }
    const budget = new Small('elections.samples');
    expect(houseSamplesAtLeast([{ from: 0, to: 31 * DAY }])).toBe(31 * 24 + 1);
    expect(() => searchElections(request('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z', [{ kind: 'angular', body: 'Moon' }], LONDON), budget))
      .toThrow(ComputeApiError);
    expect(budget.used).toBe(0);
  });
});

describe('the request', () => {
  const FROM = '2026-12-01T00:00:00Z';
  const TO = '2026-12-08T00:00:00Z';

  it('takes a window, one to five distinct conditions, and a place exactly when a condition is angular', () => {
    expect(request(FROM, TO, [{ kind: 'void-of-course' }])).toEqual({
      from: new Date(FROM), to: new Date(TO), conditions: [{ kind: 'void-of-course', not: false }], place: null,
    });
    const angular = request(FROM, TO, [{ kind: 'angular', body: 'Venus', not: true }, { kind: 'retrograde', body: 'Mars' }], { latitude: -60, longitude: 179.5 });
    expect(angular.place).toEqual({ latitude: -60, longitude: 179.5, houseSystem: 'placidus' });
    expect(angular.conditions).toEqual([{ kind: 'angular', body: 'Venus', not: true }, { kind: 'retrograde', body: 'Mars', not: false }]);
    const five = ['aries', 'taurus', 'gemini', 'cancer', 'leo'].map((sign) => ({ kind: 'sign', body: 'Moon', sign, not: true }));
    expect(request(FROM, '2027-01-01T00:00:00Z', five).conditions).toHaveLength(5);
  });

  it('refuses each malformed request with the field it names and a fixed sentence', async () => {
    const cases: Array<[unknown, string, string]> = [
      [{ from: FROM, to: TO, conditions: [{ kind: 'void-of-course' }], at: 'noon' }, '', TEXT.unknownField],
      [{ from: TO, to: FROM, conditions: [{ kind: 'void-of-course' }] }, '/to', TEXT.window],
      [{ from: FROM, to: TO, conditions: [] }, '/conditions', TEXT.conditions],
      [{ from: FROM, to: TO, conditions: Array.from({ length: 6 }, (_, n) => ({ kind: 'sign', body: 'Moon', sign: SIGNS[n] })) }, '/conditions', TEXT.conditions],
      [{ from: FROM, to: TO, conditions: [{ kind: 'void-of-course' }, { kind: 'void-of-course', not: false }] }, '/conditions/1', TEXT.repeatedCondition],
      [{ from: FROM, to: TO, conditions: [{ kind: 'aspect' }] }, '/conditions/0/kind', TEXT.conditionKind],
      [{ from: FROM, to: TO, conditions: [{ kind: 'phase', phase: 'waxing', body: 'Moon' }] }, '/conditions/0', TEXT.unknownField],
      [{ from: FROM, to: TO, conditions: [{ kind: 'phase', phase: 'full' }] }, '/conditions/0/phase', TEXT.moonHalf],
      [{ from: FROM, to: TO, conditions: [{ kind: 'void-of-course', not: 'yes' }] }, '/conditions/0/not', TEXT.not],
      [{ from: FROM, to: TO, conditions: [{ kind: 'retrograde', body: 'Sun' }] }, '/conditions/0/body', TEXT.stationBody],
      [{ from: FROM, to: TO, conditions: [{ kind: 'sign', body: 'Moon' }] }, '/conditions/0/sign', TEXT.required],
      [{ from: FROM, to: TO, conditions: ['void'] }, '/conditions/0', TEXT.object],
      [{ from: FROM, to: TO, conditions: [{ kind: 'void-of-course' }], place: LONDON }, '/place', TEXT.placeWithoutAngular],
      [{ from: FROM, to: TO, conditions: [{ kind: 'angular', body: 'Sun' }] }, '/place', TEXT.placeRequired],
      [{ from: FROM, to: TO, conditions: [{ kind: 'angular', body: 'Sun' }], place: { latitude: 60.5, longitude: 0 } }, '/place/latitude', TEXT.angularLatitude],
      [{ from: FROM, to: TO, conditions: [{ kind: 'angular', body: 'Sun' }], place: { latitude: 10, longitude: 0, houseSystem: 'Placidus' } }, '/place/houseSystem', TEXT.houseSystem],
      [{ from: FROM, to: TO, conditions: [{ kind: 'angular', body: 'Sun' }], place: { latitude: 10, longitude: 0, elevation: 30 } }, '/place', TEXT.unknownField],
    ];
    for (const [body, pointer, message] of cases) {
      const response = await run(handler, { endpoint: 'elections', body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.json, JSON.stringify(body)).toEqual({ error: { code: 'invalid-request', message, pointer } });
    }
  });

  it('answers a window of exactly 31 days, and refuses one a second longer, and a search that would pass its samples, as a whole', async () => {
    expect(BUDGETS['elections.windowDays']).toBe(31);
    const exact = await run(handler, { endpoint: 'elections', body: { from: FROM, to: '2027-01-01T00:00:00Z', conditions: [{ kind: 'phase', phase: 'waxing' }] } });
    expect(exact.status).toBe(200);
    const long = await run(handler, { endpoint: 'elections', body: { from: FROM, to: '2027-01-01T00:00:01Z', conditions: [{ kind: 'void-of-course' }] } });
    expect(long.status).toBe(422);
    expect(long.json.error).toMatchObject({ code: 'budget-exhausted', limit: 'elections.windowDays', max: BUDGETS['elections.windowDays'] });
    const heavy = await run(handler, {
      endpoint: 'elections',
      body: { from: FROM, to: '2027-01-01T00:00:00Z', conditions: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'].map((body) => ({ kind: 'angular', body, not: true })), place: LONDON },
    });
    expect(heavy.status).toBe(422);
    expect(heavy.json).toEqual({ error: {
      code: 'budget-exhausted',
      message: `The searches would need more than ${BUDGETS['elections.samples']} evaluations; shorten the window or add a condition that rules out more of it.`,
      limit: 'elections.samples',
      max: BUDGETS['elections.samples'],
    } });
  }, 120_000);
});

describe('the response', () => {
  it('gives the windows, the request as read, and a receipt that says how the search ran and that it is not proven complete', () => {
    const body = computeElections(request('2026-12-09T00:00:00Z', '2026-12-12T00:00:00Z', [
      { kind: 'phase', phase: 'waxing' }, { kind: 'void-of-course', not: true }, { kind: 'retrograde', body: 'Mercury', not: true }, { kind: 'angular', body: 'Jupiter' },
    ], LONDON)) as any;
    expect(body.schema).toBe('zodiacs.compute-api.elections.v1');
    expect(body.result.conditions).toEqual([
      { kind: 'phase', phase: 'waxing', not: false }, { kind: 'void-of-course', not: true },
      { kind: 'retrograde', body: 'Mercury', not: true }, { kind: 'angular', body: 'Jupiter', not: false },
    ]);
    expect(body.result.place).toEqual(LONDON);
    expect(body.result.windows.length).toBeGreaterThan(0);
    for (const window of body.result.windows) {
      expect(Date.parse(window.to) - Date.parse(window.from)).toBeGreaterThanOrEqual(ELECTION_STEPS.resolutionSeconds * SECOND);
      expect(window.from >= body.result.from && window.to <= body.result.to).toBe(true);
    }
    expect(body.receipt.electionSearch).toEqual({
      solver: 'engine-longitude-crossings-and-sampled-houses',
      stepDays: { default: 5, moon: 1, elongation: 1 },
      voidOfCourse: { convention: 'last-exact-ptolemaic-aspect-to-sign-exit', bodies: 'modern', scanHours: 3 },
      houseSampleMinutes: 60,
      boundarySeconds: 1,
      resolutionSeconds: 2,
      fullCalculationCost: FULL_CALCULATION_COST,
      samples: expect.any(Number),
      maxSamples: BUDGETS['elections.samples'],
      window: 'start-inclusive-end-exclusive',
      completeness: 'tested-not-proven',
    });
    expect(body.receipt.electionSearch.samples).toBeLessThanOrEqual(BUDGETS['elections.samples']);
  }, 60_000);
});
