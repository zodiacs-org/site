/**
 * The /retrogrades/for-you/ page's calculation, on this device. The loops are
 * the committed sky data's (src/data/sky.json, the windows the /retrogrades/
 * page lists, with their shadows); the stations' degrees and the birth chart
 * come from the chart engine (src/lib/engine/full.ts), and the birth instant
 * from the site's local-time resolver. The houses, natal points and words are
 * src/lib/retrograde-for-you/reading.ts, shared with get_retrograde_for_me; a
 * test holds the two to the same answer. Nothing here leaves the browser.
 */
import { bodyLongitude, computeChart } from '../../lib/engine/full';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';
import {
  POINT_NAMES, dayLabel, dayTurns, natalBasis, retrogradeReading,
  type RetrogradePeriod, type RetrogradePlanet,
} from '../../lib/retrograde-for-you/reading';
import { isGeographicPole } from '../../lib/geo/coordinates';
import { readsOnDate } from '../../lib/time/local-day';
import { birthDaySpan } from '../../lib/time/birth-day-span';
import { loopsFromSky, skyCoverageStart, type SkySpan } from '../../lib/retrograde-for-you/sky';
import { publishedRetrogradeDate, retrogradeForYouShareQuery } from '../../lib/retrograde-for-you/share';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import type { ShareSign } from '../../lib/share-results';
import sky from '../../data/sky.json';
import { birthDateRefusal } from '../../lib/birth-date-policy';
import { SkippedBirthDateError, SkippedBirthTimeError, birthTimeOnClock, withClockLimit } from '../../lib/vedic-signs/clock';

export { prepareLocalTime } from '../../lib/time/localToUtc';

export interface RetrogradeForYouInput {
  birthDate: string;
  /** HH:MM, or null when the birth time is not known. */
  birthTime: string | null;
  place: { lat: number; lon: number; tz: string };
  planets: readonly RetrogradePlanet[];
  now: Date;
  /** The clock "now" and the dates are read on: the browser's own. */
  zone: string;
}

export type RetrogradeForYouOutcome =
  | { refused: 'under-13' | 'future-birth-date' }
  | {
    refused?: undefined;
    periods: (RetrogradePeriod & { shareQuery: string | null; skyDate: string | null; nextLine: string | null })[];
    /** Planets whose next loop lies past the committed sky data. */
    unavailable: RetrogradePlanet[];
    /** Planets the committed sky data cannot place yet on this clock's date: it is before the data settles where they stand. */
    notCovered: RetrogradePlanet[];
    /** "Thu 1 Jan 2026", the first day the data covers. */
    dataStarts: string;
    /** "Thu 1 Jan 2031", the first day the data does not cover. */
    dataEnds: string;
    summary: string;
    limits: string[];
    timeKnown: boolean;
    now: string;
    zone: string;
  };

/**
 * Why the page refuses a (Gregorian) birth date, or null: the shared policy
 * (src/lib/birth-date-policy.ts), which reads today at UTC-12 whatever this
 * device's clock and zone say, so nobody is read before their 13th birthday
 * has begun everywhere.
 */
export function retrogradeForYouRefusal(birthDate: string, now: Date): Extract<RetrogradeForYouOutcome, { refused: string }> | null {
  const refusal = birthDateRefusal(birthDate, now);
  if (refusal === 'under_13') return { refused: 'under-13' };
  if (refusal === 'future_birth_date') return { refused: 'future-birth-date' };
  return null;
}

/** Await prepareLocalTime(input.birthDate, input.place.tz) first. */
export function computeRetrogradeForYou(input: RetrogradeForYouInput): RetrogradeForYouOutcome {
  // The shared birth date policy, before any chart resolution.
  const refused = retrogradeForYouRefusal(input.birthDate, input.now);
  if (refused) return refused;
  const timeKnown = input.birthTime !== null;
  // A date the birthplace clock skipped whole has no day to read: refused before any chart, never read as the next date.
  const midnight = resolveLocalToUtc(input.birthDate, '00:00', input.place.tz, { longitude: input.place.lon });
  if (!readsOnDate(input.birthDate, midnight)) throw new SkippedBirthDateError();
  const resolved = resolveLocalToUtc(input.birthDate, input.birthTime ?? '12:00', input.place.tz, { longitude: input.place.lon });
  // A birth time the clock skipped is refused, never read at the time the clock jumped to; a repeated one is read at
  // its first pass, and the limits say so (src/lib/vedic-signs/clock.ts, as get_retrograde_for_me does).
  const onClock = birthTimeOnClock(resolved.flags, timeKnown);
  if (onClock.skipped) throw new SkippedBirthTimeError();
  const birthUtc = resolved.utc;
  const chart = computeChart({ utc: birthUtc, latitude: input.place.lat, longitude: input.place.lon, houseSystem: 'whole', timeKnown });
  const angles = timeKnown && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  // A birth time the clocks showed twice: the rising degree at the later pass, the size of the change on, for the fold limit.
  const foldAsc = angles && resolved.flags.includes('dst-fold') && resolved.jumpMinutes
    ? computeChart({ utc: new Date(birthUtc.getTime() + resolved.jumpMinutes * 60_000), latitude: input.place.lat, longitude: input.place.lon, houseSystem: 'whole', timeKnown: true }).angles?.asc ?? null
    : null;
  let sunHeld = true;
  let dayEnds: Parameters<typeof natalBasis>[0]['dayEnds'];
  let turns: Parameters<typeof natalBasis>[0]['dayTurns'];
  if (!timeKnown) {
    // Without a birth time a placement holds only if it is the same at both ends of the birth day, its whole span on
    // the birthplace clock up to the instant before the next local midnight: a repeated last minute at its later pass,
    // a skipped end at the nearest minute shown.
    const [dayStart, dayEnd] = birthDaySpan(input.birthDate, input.place.tz, input.place.lon, resolveLocalToUtc);
    const rows = (at: Date) => POINT_NAMES.map((body) => ({ body, lon: bodyLongitude(body, at) }));
    dayEnds = [rows(dayStart), rows(dayEnd)];
    // A planet that stationed that day can leave a loop's degrees between the two ends: where it turned counts too.
    turns = dayTurns((body, at) => bodyLongitude(body as (typeof POINT_NAMES)[number], at), dayStart, dayEnd);
    const sign = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
    const sunAt = (end: readonly { body: string; lon: number }[]) => sign(end.find((row) => row.body === 'Sun')!.lon);
    sunHeld = sunAt(dayEnds[0]) === sunAt(dayEnds[1]);
  }
  const basis = natalBasis({ timeKnown, placed: true, atGeographicPole: isGeographicPole(input.place.lat), angles, bodies: chart.bodies, sunHeld, birthDate: input.birthDate, now: input.now, dayEnds, dayTurns: turns, foldAsc });
  const span = sky as SkySpan;
  const reading = withClockLimit(retrogradeReading({
    planets: input.planets, now: input.now, zone: input.zone, basis,
    loopsFor: (planet) => loopsFromSky(planet, input.now, span, (body, at) => bodyLongitude(body, at)),
  }), onClock.limit);
  const sunSign = sunHeld
    ? (SIGNS[signIndexForLongitude(chart.bodies.find((row) => row.body === 'Sun')!.lon)].slug as ShareSign)
    : null;
  const beforeData = (planet: RetrogradePlanet) => {
    const covered = skyCoverageStart(planet, span);
    return !covered || input.now.getTime() < covered.getTime();
  };
  return {
    periods: reading.periods.map((period) => ({
      ...period,
      skyDate: publishedRetrogradeDate(period.planet, period.stationRetrograde.utc, span.retrogrades),
      nextLine: period.next ? `Next retrograde: ${dayLabel(period.next.stationRetrograde, input.zone)} to ${dayLabel(period.next.stationDirect, input.zone)}.` : null,
      shareQuery: retrogradeForYouShareQuery({
        planet: period.planet, stationRetrogradeUtc: period.stationRetrograde.utc, sun: sunSign,
      }, span.retrogrades),
    })),
    // Before the data settles where a planet stands it is not covered, never read as direct; past the data, unavailable.
    unavailable: reading.unavailable.filter((planet) => !beforeData(planet)),
    notCovered: reading.unavailable.filter(beforeData),
    dataStarts: dayLabel(sky.from, 'UTC'),
    dataEnds: dayLabel(sky.to, 'UTC'),
    summary: reading.summary,
    limits: reading.limits,
    timeKnown,
    now: input.now.toISOString(),
    zone: input.zone,
  };
}
