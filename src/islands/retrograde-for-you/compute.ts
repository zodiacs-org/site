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
  dateOn, dayLabel, isUnder13, natalBasis, retrogradeReading, stationHouse,
  type RetrogradePeriod, type RetrogradePlanet,
} from '../../lib/retrograde-for-you/reading';
import { loopsFromSky, type SkySpan } from '../../lib/retrograde-for-you/sky';
import { publishedRetrogradeDate, retrogradeForYouShareQuery } from '../../lib/retrograde-for-you/share';
import sky from '../../data/sky.json';

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
  | { refused: 'under-13' }
  | {
    refused?: undefined;
    periods: (RetrogradePeriod & { shareQuery: string | null; skyDate: string | null })[];
    /** Planets whose next loop lies past the committed sky data. */
    unavailable: RetrogradePlanet[];
    /** "Thu 1 Jan 2031", the first day the data does not cover. */
    dataEnds: string;
    summary: string;
    limits: string[];
    timeKnown: boolean;
    now: string;
    zone: string;
  };

/** Await prepareLocalTime(input.birthDate, input.place.tz) first. */
export function computeRetrogradeForYou(input: RetrogradeForYouInput): RetrogradeForYouOutcome {
  const today = dateOn(input.now, input.zone);
  if (isUnder13(input.birthDate, today)) return { refused: 'under-13' };
  const timeKnown = input.birthTime !== null;
  const birthUtc = resolveLocalToUtc(input.birthDate, input.birthTime ?? '12:00', input.place.tz, { longitude: input.place.lon }).utc;
  const chart = computeChart({ utc: birthUtc, latitude: input.place.lat, longitude: input.place.lon, houseSystem: 'whole', timeKnown });
  const angles = timeKnown && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  let sunHeld = true;
  if (!timeKnown) {
    // The Sun counts the houses without a birth time only if it kept its sign all the birth day.
    const dayStart = resolveLocalToUtc(input.birthDate, '00:00', input.place.tz, { longitude: input.place.lon }).utc;
    const dayEnd = resolveLocalToUtc(input.birthDate, '23:59', input.place.tz, { longitude: input.place.lon }).utc;
    const sign = (at: Date) => Math.floor((((bodyLongitude('Sun', at) % 360) + 360) % 360) / 30);
    sunHeld = sign(dayStart) === sign(dayEnd);
  }
  const basis = natalBasis({ timeKnown, placed: true, angles, bodies: chart.bodies, sunHeld, birthDate: input.birthDate, today });
  const span = sky as SkySpan;
  const reading = retrogradeReading({
    planets: input.planets, now: input.now, zone: input.zone, basis,
    loopsFor: (planet) => loopsFromSky(planet, input.now, span, (body, at) => bodyLongitude(body, at)),
  });
  return {
    periods: reading.periods.map((period) => ({
      ...period,
      skyDate: publishedRetrogradeDate(period.planet, period.stationRetrograde.utc, span.retrogrades),
      shareQuery: retrogradeForYouShareQuery({
        planet: period.planet, stationRetrogradeUtc: period.stationRetrograde.utc, house: stationHouse(period),
        countedFrom: period.housesCountedFrom, confidence: period.confidence,
      }, span.retrogrades),
    })),
    unavailable: reading.unavailable,
    dataEnds: dayLabel(sky.to, 'UTC'),
    summary: reading.summary,
    limits: reading.limits,
    timeKnown,
    now: input.now.toISOString(),
    zone: input.zone,
  };
}
