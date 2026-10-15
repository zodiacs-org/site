/**
 * The birth chart behind the chart pages' tools, read as the pages read it: /birth-chart/, /moon-sign/ and
 * /rising-sign/ through ChartCalculator's runChart, /big-three/ through BigThreeQuick, and each person on
 * /compatibility/ and /transits/ through their islands' own resolvers. chart.test.ts runs those islands' code beside
 * this and holds the two to the same chart.
 */
import { computeCalculatorReceipt } from '../../engine/calculator-receipt';
import * as engine from '../../engine/full';
import { houseOf } from '../../engine/houses';
import { moonPhaseNameFromAngle } from '../../engine/lite';
import type { Chart, HouseSystem } from '../../engine/types';
import { SIGNS, signForLongitude } from '../../signs';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { assessLocalDateReference } from '../../time/local-date-reference';
import { ENGINE, fixed, pageUrl, position } from './format';
import type { Birth } from './input';
import { LocalDateReferenceError } from './moon-phase';

export interface NatalReading {
  chart: Chart;
  /** Read on the place's local mean time (before standard time). */
  localMeanTime: boolean;
}

/**
 * ChartCalculator's runChart: without a time, local noon, which must fall within the local date; with `receipt` (the
 * birth chart page), the chart its calculation receipt carries. Without a time no Moon sign is verified.
 */
export async function chartPageNatal(birth: Birth, houseSystem: HouseSystem, { receipt }: { receipt: boolean }): Promise<NatalReading> {
  const { date, place } = birth;
  await prepareLocalTime(date, place.timeZone);
  const timeKnown = birth.time !== null;
  const effectiveTime = birth.time ?? '12:00';
  const resolved = resolveLocalToUtc(date, effectiveTime, place.timeZone, { longitude: place.longitude });
  if (!timeKnown) {
    try {
      if (assessLocalDateReference(date, resolved.utc, place.timeZone).referenceStatus !== 'member') throw new LocalDateReferenceError();
    } catch {
      throw new LocalDateReferenceError();
    }
  }
  const input = {
    utc: resolved.utc,
    latitude: place.latitude,
    longitude: place.longitude,
    houseSystem,
    timeKnown,
    flags: resolved.flags,
  };
  const portable = receipt ? computeCalculatorReceipt(input, {
    date,
    time: effectiveTime,
    timeZone: place.timeZone,
    offsetMinutes: resolved.offsetMinutes,
    reference: timeKnown ? 'supplied-instant' : 'local-noon',
  }) : null;
  const chart = portable ? portable.chart : engine.computeChart(input);
  if (!timeKnown) chart.moonSignCandidates = [];
  return { chart, localMeanTime: resolved.localMeanTime !== undefined };
}

/**
 * The resolver the compatibility, transits, big-three and sharing pages share: local noon without a time (no check
 * that it falls within the date), whole-sign houses.
 */
export async function personNatal(birth: Birth): Promise<NatalReading> {
  const { date, place } = birth;
  await prepareLocalTime(date, place.timeZone);
  const resolved = resolveLocalToUtc(date, birth.time ?? '12:00', place.timeZone, { longitude: place.longitude });
  const chart = engine.computeChart({
    utc: resolved.utc,
    latitude: place.latitude,
    longitude: place.longitude,
    houseSystem: 'whole',
    timeKnown: birth.time !== null,
    flags: resolved.flags,
  });
  return { chart, localMeanTime: resolved.localMeanTime !== undefined };
}

/** src/lib/moon-certainty.ts's moonCandidates, which the pages show the Moon's sign by (chart.test.ts compares). */
export function moonCandidates(chart: Pick<Chart, 'bodies' | 'angles' | 'moonSignCandidates'>): readonly string[] {
  if (chart.moonSignCandidates !== undefined) {
    const candidates = [...new Set(chart.moonSignCandidates)];
    return candidates.length <= 2 && candidates.every((slug) => SIGNS.some((sign) => sign.slug === slug)) ? candidates : [];
  }
  if (chart.angles === null) return [];
  const moon = chart.bodies.find((body) => body.body === 'Moon');
  return moon ? [signForLongitude(moon.lon).slug] : [];
}

const body = (chart: Chart, name: string) => chart.bodies.find((entry) => entry.body === name);

const MOON_UNVERIFIED = 'Without a birth time the Moon\'s sign across the birth date is not verified, so the page '
  + 'does not name it; give the time from the birth record.';

/** What every chart result says about its instant. */
function basis({ chart, localMeanTime }: NatalReading) {
  return {
    timeKnown: chart.input.timeKnown,
    basis: chart.input.timeKnown ? 'birth-time' as const : 'local-noon' as const,
    computedUtc: chart.input.utc.toISOString(),
    flags: [...chart.flags],
    localMeanTime,
  };
}

function moonSign(chart: Chart) {
  const candidates = moonCandidates(chart);
  const moon = body(chart, 'Moon');
  return candidates.length === 1 && moon
    ? { moon: position(moon.lon), moonSignStatus: 'settled' as const }
    : { moon: null, moonSignStatus: 'unverified' as const, moonSignNote: MOON_UNVERIFIED };
}

/** /birth-chart/: the big three, every placement with its house, the angles, the house cusps and the aspects. */
export function birthChartResult(reading: NatalReading, path = '/birth-chart/') {
  const { chart } = reading;
  const sun = body(chart, 'Sun')!;
  const { moon, ...moonStatus } = moonSign(chart);
  return {
    ...basis(reading),
    houseSystem: chart.houses?.system ?? null,
    bigThree: { sun: position(sun.lon), moon, rising: chart.angles ? position(chart.angles.asc) : null },
    ...moonStatus,
    bodies: chart.bodies.map((entry) => ({
      body: entry.body,
      ...position(entry.lon),
      latitude: fixed(entry.lat),
      speed: fixed(entry.speed),
      retrograde: entry.retrograde,
      house: chart.houses ? houseOf(entry.lon, chart.houses.cusps) : null,
    })),
    angles: chart.angles ? {
      ascendant: position(chart.angles.asc),
      midheaven: position(chart.angles.mc),
      descendant: position(chart.angles.dsc),
      imumCoeli: position(chart.angles.ic),
    } : null,
    houses: chart.houses ? chart.houses.cusps.map((cusp, index) => ({ house: index + 1, cusp: position(cusp) })) : null,
    aspects: chart.aspects.map((aspect) => ({
      a: aspect.a, b: aspect.b, type: aspect.type, orb: fixed(aspect.orb), applying: aspect.applying,
    })),
    engine: ENGINE,
    page: pageUrl(path),
  };
}

/** /moon-sign/: the Moon's sign when it is settled, and the Moon's phase at the instant read. */
export function moonSignResult(reading: NatalReading) {
  const { chart } = reading;
  const sun = body(chart, 'Sun')!;
  const moon = body(chart, 'Moon')!;
  return {
    ...basis(reading),
    ...moonSign(chart),
    moonPhase: moonPhaseNameFromAngle((((moon.lon - sun.lon) % 360) + 360) % 360),
    engine: ENGINE,
    page: pageUrl('/moon-sign/'),
  };
}

/** /rising-sign/: the ascendant, which needs the birth time. */
export function risingSignResult(reading: NatalReading) {
  const { chart } = reading;
  return {
    ...basis(reading),
    rising: chart.angles ? position(chart.angles.asc) : null,
    midheaven: chart.angles ? position(chart.angles.mc) : null,
    engine: ENGINE,
    page: pageUrl('/rising-sign/'),
  };
}

/** /big-three/ (BigThreeQuick): Sun, Moon and rising from a timed birth. */
export function bigThreeResult(reading: NatalReading) {
  const { chart } = reading;
  const sun = body(chart, 'Sun');
  const moon = body(chart, 'Moon');
  if (!sun || !moon || !chart.angles) throw new Error('incomplete chart');
  return {
    ...basis(reading),
    sun: position(sun.lon),
    moon: position(moon.lon),
    rising: position(chart.angles.asc),
    engine: ENGINE,
    page: pageUrl('/big-three/'),
  };
}
