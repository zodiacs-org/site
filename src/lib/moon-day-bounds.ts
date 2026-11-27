/**
 * The Moon's possible signs across a local civil birth date, for a chart
 * without a birth time. The date's limits come from the host's complete
 * transitions (the coverage assessLocalDateReference already found) or,
 * where the host has none to give, from the engine's reading of the date's
 * two midnights with the host's clock confirming both edges. A date whose
 * limits cannot be established gets no signs: the existing unresolved state.
 *
 * Engine-free: the caller passes the Moon's longitude from the chart's own
 * ephemeris, so importing this module loads none. The Moon never turns
 * retrograde and moves between about 11.8 and 15.4 degrees a day, so over a
 * span its signs are the forward run from its sign at the start to its sign
 * at the end; samples at most 12 hours apart keep each step under a third of
 * a sign, so a date of 48 hours cannot skip a sign or wrap around.
 */
import { SIGNS, signIndexForLongitude } from './signs';
import { parseCivilDate } from './time/civil-date';
import type { LocalDateReferenceAssessment } from './time/local-date-reference';
import {
  birthplaceTimeCanApply,
  localDateContainsUtc,
  prepareLocalTime,
  resolveLocalToUtc,
  type LocalTimeResolution,
} from './time/localToUtc';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STEP = 12 * HOUR;
/** Generous limits on the Moon's motion, degrees per millisecond. */
const SLOWEST = 10 / DAY;
const FASTEST = 17 / DAY;
/** Far below a real ephemeris's step, degrees. */
const SLACK = 1e-6;
/** Flags under which the date's own limits are not settled. */
const UNSETTLED: readonly string[] = ['calendar-unknown', 'host-zone-data-differs'];

export interface LocalDateMoonInput {
  /** The birth date, YYYY-MM-DD (proleptic Gregorian). */
  date: string;
  /** The birthplace: its zone, and the longitude the chart's own wall-time reading used. */
  place: { tz: string; lon: number };
  /** The chart's reference assessment of this date (assessLocalDateReference). */
  assessment: LocalDateReferenceAssessment;
  /** The flags of the chart's own reference resolution. */
  referenceFlags: readonly string[];
  /** The Moon's ecliptic longitude at an instant, degrees. */
  moonLongitude: (utc: Date) => number;
}

/** First and last millisecond of a run of the date, both inclusive. */
type Span = readonly [first: number, last: number];

/**
 * One sign when the Moon held it through the whole date, the two signs in
 * the order the Moon took them when it changed sign at an instant of the
 * date, otherwise none. Never rejects: any failure, a failed history
 * download included, is the unresolved state.
 */
export async function localDateMoonSigns(input: LocalDateMoonInput): Promise<string[]> {
  try {
    if (input.referenceFlags.some((flag) => UNSETTLED.includes(flag))) return [];
    const spans = await dateSpans(input);
    return spans ? moonSignsOver(spans, input.moonLongitude) : [];
  } catch {
    return [];
  }
}

async function dateSpans(input: LocalDateMoonInput): Promise<Span[] | null> {
  const { coverage } = input.assessment;
  if (coverage.status === 'existing') {
    const { intervals } = coverage;
    // The date's runs: more than one where a clock turned back across
    // midnight (St. John's, 28 and 29 October 1989).
    const runs = intervals.map(({ start, endExclusive }) => [start, endExclusive - 1] as const);
    // From 1971 the engine reads the host's clock, so the host's intervals
    // are the date, however many there are.
    if (!birthplaceTimeCanApply(input.date)) return runs;
    // Up to 1970 it reads the zone's shipped history and, before standard
    // time, the birthplace's own mean time. The host's coverage is the date
    // only where the engine's two midnights meet its ends exactly.
    const first = intervals[0].start;
    const end = intervals[intervals.length - 1].endExclusive;
    const midnights = await engineMidnights(input);
    const startAt = midnights?.start.flags.includes('dst-gap')
      ? midnights.start.transitionAt?.getTime()
      : midnights?.start.utc.getTime();
    const endAt = midnights?.end.flags.includes('dst-gap')
      ? midnights.end.transitionAt?.getTime()
      : midnights?.end.utc.getTime();
    if (!midnights || startAt !== first || endAt !== end
      // A repeated next midnight can bring the date back after it.
      || midnights.end.flags.includes('dst-fold')) return null;
    return runs;
  }
  // Without the host's transitions (no Temporal), only from 1970, when the
  // engine reads the host's own clock, and only an ordinary date: no repeated
  // midnight, the length of a day, and the host's clock confirming that the
  // date starts and ends exactly at the two midnights.
  if (coverage.status !== 'unresolved' || coverage.reason !== 'provider-unavailable'
    || !(input.date >= '1970-01-01')) return null;
  const midnights = await engineMidnights(input);
  if (!midnights || midnights.start.flags.includes('dst-fold') || midnights.end.flags.includes('dst-fold')) return null;
  const start = midnights.start.utc.getTime();
  const end = midnights.end.utc.getTime();
  if (!(end - start >= 22 * HOUR && end - start <= 26 * HOUR)) return null;
  const member = (instant: number) => localDateContainsUtc(input.date, new Date(instant), input.place.tz);
  if (!member(start) || member(start - 1) || !member(end - 1) || member(end)) return null;
  return [[start, end - 1]];
}

/** The engine's readings of 00:00 on the date and on the next, or null when either is unsettled. */
async function engineMidnights(
  { date, place }: LocalDateMoonInput,
): Promise<{ start: LocalTimeResolution; end: LocalTimeResolution } | null> {
  const next = nextCivilDate(date);
  if (!next) return null;
  await Promise.all([prepareLocalTime(date, place.tz), prepareLocalTime(next, place.tz)]);
  const start = resolveLocalToUtc(date, '00:00', place.tz, { longitude: place.lon });
  const end = resolveLocalToUtc(next, '00:00', place.tz, { longitude: place.lon });
  const settled = (reading: LocalTimeResolution) => reading.localMeanTime === undefined
    && !reading.flags.some((flag) => UNSETTLED.includes(flag));
  return settled(start) && settled(end) && end.utc.getTime() > start.utc.getTime() ? { start, end } : null;
}

function nextCivilDate(date: string): string | null {
  const civil = parseCivilDate(date);
  if (!civil) return null;
  const next = new Date(0);
  next.setUTCFullYear(civil.year, civil.month - 1, civil.day + 1);
  const year = next.getUTCFullYear();
  if (year > 9999) return null;
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(next.getUTCMonth() + 1, 2)}-${pad(next.getUTCDate(), 2)}`;
}

function longitudeAt(moonLongitude: (utc: Date) => number, instant: number): number {
  const value = moonLongitude(new Date(instant));
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError('Moon longitude unavailable.');
  return ((value % 360) + 360) % 360;
}

function moonSignsOver(spans: readonly Span[], moonLongitude: (utc: Date) => number): string[] {
  const order: number[] = [];
  const add = (sign: number) => { if (!order.includes(sign)) order.push(sign); };
  // Whether the Moon changed sign at an instant of the date (inside a run,
  // or at the inclusive start of a later disjoint run rather than in the gap).
  let changedInRun = false;
  let prevSign: number | null = null;
  for (const [first, last] of spans) {
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first) return [];
    let at = first;
    let lon = longitudeAt(moonLongitude, at);
    let sign = signIndexForLongitude(lon);
    if (
      prevSign !== null
      && sign === (prevSign + 1) % 12
      && first > Number.MIN_SAFE_INTEGER
      && signIndexForLongitude(longitudeAt(moonLongitude, first - 1)) === prevSign
    ) {
      changedInRun = true;
    }
    add(sign);
    while (at < last) {
      const next = Math.min(at + STEP, last);
      const nextLon = longitudeAt(moonLongitude, next);
      // Forward motion only, at the Moon's own pace: anything else is not
      // the Moon and settles nothing.
      const moved = (nextLon - lon + 360) % 360;
      if (!(moved >= SLOWEST * (next - at) - SLACK && moved <= FASTEST * (next - at) + SLACK)) return [];
      const nextSign = signIndexForLongitude(nextLon);
      if (nextSign !== sign) {
        if (nextSign !== (sign + 1) % 12) return [];
        add(nextSign);
        changedInRun = true;
      }
      at = next;
      lon = nextLon;
      sign = nextSign;
    }
    prevSign = sign;
  }
  if (order.length === 1) return [SIGNS[order[0]].slug];
  // Two signs only as one ingress the date saw: neighbours, in the order the
  // Moon took them, the change inside one of the date's runs. Between two
  // runs the clock showed another date: the Moon entered Scorpio in St.
  // John's repeated hour of 28 October 1989, between the 29th's two runs,
  // so the 29th names no sign.
  if (order.length === 2 && changedInRun && order[1] === (order[0] + 1) % 12) return order.map((index) => SIGNS[index].slug);
  return [];
}
