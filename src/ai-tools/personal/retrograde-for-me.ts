/**
 * get_retrograde_for_me: whether Mercury, Venus and Mars are retrograde now on
 * the person's clock, and if not, when each next turns; the stations' signs and
 * degrees, the shadow on either side, the natal house the loop falls in and
 * the natal points it passes over.
 *
 * Every instant is the engine's, by the code the compute API and
 * search_sky_events already use: stationCrossings (src/lib/compute-api/endpoints.ts)
 * finds where the engine's longitude speed crosses zero, and the shadows are
 * the engine's own longitude crossings (findLongitudeCrossings), defined as
 * scripts/build-sky.mjs defines them for the /retrogrades/ page: the pre-shadow
 * begins when the direct planet first reaches the degree of its coming direct
 * station, and the post-shadow ends when it gets back to the degree of the
 * retrograde station. The houses, natal points and pre-written words are
 * src/lib/retrograde-for-you/reading.ts, shared with the /retrogrades/for-you/
 * page, which reads the same loops from the committed sky data; nothing is
 * generated.
 *
 * Houses are whole-sign, counted from the rising sign with a birth time and
 * place, as the site counts them; otherwise from the Sun sign, labelled so.
 * Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { findLongitudeCrossings, positions } from '@zodiacs/engine';
import { SampleBudget, positionsMemo, rowOf, stationCrossings } from '../../lib/compute-api/endpoints';
import {
  RETROGRADE_ASK, RETROGRADE_LINE, RETROGRADE_PLANETS, formatPosition, natalBasis, retrogradeReading, stationHouse,
  type RetrogradeLoop, type RetrogradePlanet,
} from '../../lib/retrograde-for-you/reading';
import { RETROGRADE_FOR_YOU_PAGE_PATH, retrogradeForYouShareQuery, retrogradeForYouShareUrl } from '../../lib/retrograde-for-you/share';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import sky from '../../data/sky.json';
import { birthDayEnds, birthFields, castNatal, currentClock, dateOn, definePersonalTool, refineBirth, zoneField, type BirthArgs, type PersonalToolContext } from './shared';

export { RETROGRADE_ASK, RETROGRADE_LINE, RETROGRADE_PLANETS, formatPosition, type RetrogradeLoop, type RetrogradePlanet };

const DAY = 86_400_000;
/** Back far enough to find the retrograde station behind a current loop and the one before a post-shadow (Mars's longest loop is about 81 days, its post-shadow about 70). */
const LOOK_BACK_DAYS = 250;
/** Forward far enough for Mars's next loop to begin and end (its stations come about 780 days apart). */
const LOOK_AHEAD_DAYS = 860;
/** A shadow is shorter than this for all three planets (Mars's runs about 70 days). */
const SHADOW_SEARCH_DAYS = 150;

export const retrogradeForMeInput = z.strictObject({
  ...birthFields,
  latitude: birthFields.latitude.describe("Optional. The birthplace's latitude; with a birth time it places the retrogrades in the natal houses. Give it with longitude and zone. Nothing is stored."),
  planets: z.array(z.enum(RETROGRADE_PLANETS)).min(1).max(RETROGRADE_PLANETS.length).optional().describe('Which planets to read: Mercury, Venus or Mars. Leave it out for all three.'),
  currentZone: zoneField.optional().describe('Where the person lives now, such as Asia/Bangkok, so "now" and the dates fall on their own clock. Without it, the dates use the birthplace clock, or UTC if that is missing too, and the answer says which.'),
}).superRefine(refineBirth);
export type RetrogradeForMeInput = z.infer<typeof retrogradeForMeInput>;

const signSlug = z.enum(SIGNS.map((entry) => entry.slug) as [string, ...string[]]);
const instant = z.object({
  /** UTC, to the minute. */
  utc: z.string(),
  /** The date on the person's clock, YYYY-MM-DD. */
  date: z.string(),
  /** Such as "Sat 24 Oct 2026". */
  label: z.string(),
});
const station = instant.extend({
  sign: signSlug,
  /** Degrees into the sign, 0 to 30, to two decimals. */
  degree: z.number().min(0).max(30),
  /** Such as "20°56' Scorpio". */
  position: z.string(),
});
const housePlacement = z.object({
  house: z.number().int().min(1).max(12),
  sign: signSlug,
  theme: z.string(),
  line: z.string(),
});
const contact = z.object({
  point: z.string(),
  sign: signSlug,
  position: z.string(),
  line: z.string(),
});
const period = z.object({
  planet: z.enum(RETROGRADE_PLANETS),
  retrogradeNow: z.boolean(),
  /** retrograde now; in the pre-shadow of the coming loop; in the post-shadow of the last one; or direct and clear of both. */
  status: z.enum(['retrograde', 'pre-shadow', 'post-shadow', 'direct']),
  stationRetrograde: station,
  stationDirect: station,
  preShadowStart: instant.nullable(),
  postShadowEnd: instant.nullable(),
  /** The signs the loop covers, from the direct station's to the retrograde station's. */
  signs: z.array(signSlug),
  /** "rising sign" with a birth time and place, "Sun sign" otherwise, null when neither is settled. */
  housesCountedFrom: z.enum(['rising sign', 'Sun sign']).nullable(),
  houses: z.array(housePlacement),
  /** Natal planets and angles inside the loop's degrees. */
  contacts: z.array(contact),
  /** One plain paragraph: when, where, and what it traditionally asks for. */
  reading: z.string(),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  /** A link to this retrograde's share card: the planet, the window's start date, the house and its basis and the confidence. Null when the window is past the site's published sky data. */
  shareUrl: z.url().nullable(),
});
export const retrogradeForMeData = z.object({
  birthDate: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  /** The instant "now" was read at, UTC, and the clock its dates are on. */
  now: z.string(),
  timeZone: z.string(),
  periods: z.array(period),
  summary: z.string(),
  limits: z.array(z.string()),
  pageUrl: z.url(),
});
export type RetrogradeForMeData = z.infer<typeof retrogradeForMeData>;

/** The loop's shadows, by the engine's longitude crossings in direct motion. */
function shadows(planet: RetrogradePlanet, retro: { at: Date; lon: number }, direct: { at: Date; lon: number }) {
  const pre = findLongitudeCrossings(planet, direct.lon, new Date(retro.at.getTime() - SHADOW_SEARCH_DAYS * DAY), retro.at).filter((crossing) => !crossing.retrograde).at(-1)?.at ?? null;
  const post = findLongitudeCrossings(planet, retro.lon, direct.at, new Date(direct.at.getTime() + SHADOW_SEARCH_DAYS * DAY)).find((crossing) => !crossing.retrograde)?.at ?? null;
  return { preShadowStart: pre, postShadowEnd: post };
}

/**
 * The loop a planet is in at `now`, or else its next one, and the one before
 * (for a post-shadow still running). Stations come from the compute API's
 * station search over the engine's speeds.
 */
export function retrogradeLoops(planet: RetrogradePlanet, now: Date, rowsAt = positionsMemo()): { current: RetrogradeLoop; previous: RetrogradeLoop | null; retrogradeNow: boolean } {
  const budget = new SampleBudget('events.samples');
  const from = new Date(now.getTime() - LOOK_BACK_DAYS * DAY);
  const to = new Date(now.getTime() + LOOK_AHEAD_DAYS * DAY);
  const stations = stationCrossings(planet, from, to, budget, rowsAt).map((crossing) => ({ at: crossing.at, retrograde: crossing.retrograde, lon: rowOf(rowsAt(crossing.at), planet).lon }));
  const retrogradeNow = rowOf(rowsAt(now), planet).speed < 0;
  const loops: RetrogradeLoop[] = [];
  for (let index = 0; index < stations.length - 1; index += 1) {
    const [retro, direct] = [stations[index], stations[index + 1]];
    if (!retro.retrograde || direct.retrograde) continue;
    loops.push({ planet, stationRetrograde: { at: retro.at, lon: retro.lon }, stationDirect: { at: direct.at, lon: direct.lon }, preShadowStart: null, postShadowEnd: null });
  }
  const at = now.getTime();
  const position = retrogradeNow
    ? loops.findIndex((loop) => loop.stationRetrograde.at.getTime() <= at && loop.stationDirect.at.getTime() > at)
    : loops.findIndex((loop) => loop.stationRetrograde.at.getTime() > at);
  if (position < 0) throw new RangeError(`Zodiacs could not find ${planet}'s retrograde around that date.`);
  const fill = (loop: RetrogradeLoop): RetrogradeLoop => ({ ...loop, ...shadows(planet, loop.stationRetrograde, loop.stationDirect) });
  const previous = !retrogradeNow && position > 0 ? fill(loops[position - 1]) : null;
  return { current: fill(loops[position]), previous, retrogradeNow };
}

/** The retrogrades for one person. Throws RangeError for details it cannot use. */
export async function retrogradeForMe(args: BirthArgs & { planets?: readonly RetrogradePlanet[] | undefined; currentZone?: string | undefined }, context: Pick<PersonalToolContext, 'now' | 'localTime' | 'resolveZone' | 'hostZone' | 'origin'>): Promise<{ data: RetrogradeForMeData; links: { title: string; url: string }[] }> {
  const natal = await castNatal(args, context.localTime);
  const clock = await currentClock(args.currentZone, args.zone, context as PersonalToolContext);
  const now = context.now;
  const planets = RETROGRADE_PLANETS.filter((planet) => !args.planets || args.planets.includes(planet));

  // The Sun sign counts the houses without a rising sign only if the birth day keeps it.
  let sunHeld = true;
  if (!natal.angles && !natal.timeKnown) {
    const sunIndex = signIndexForLongitude(natal.chart.bodies.find((row) => row.body === 'Sun')!.lon);
    const ends = await birthDayEnds(args, context.localTime);
    sunHeld = ends.every((end) => signIndexForLongitude(rowOf(positions(end), 'Sun').lon) === sunIndex);
  }
  const basis = natalBasis({
    timeKnown: natal.timeKnown, placed: natal.placed, angles: natal.angles, bodies: natal.chart.bodies, sunHeld,
    birthDate: args.birthDate, today: dateOn(now, clock.zone),
  });
  const rowsAt = positionsMemo();
  const reading = retrogradeReading({
    planets, now, zone: clock.zone, basis,
    loopsFor: (planet) => retrogradeLoops(planet, now, rowsAt),
    leadingLimits: clock.note ? [clock.note] : [],
  });
  const periods = reading.periods.map((period) => {
    const query = retrogradeForYouShareQuery({
      planet: period.planet, stationRetrogradeUtc: period.stationRetrograde.utc, house: stationHouse(period),
      countedFrom: period.housesCountedFrom, confidence: period.confidence,
    }, sky.retrogrades);
    return { ...period, shareUrl: query ? retrogradeForYouShareUrl(context.origin, query) : null };
  });
  return {
    data: {
      birthDate: args.birthDate, timeKnown: natal.timeKnown, placed: natal.placed, now: new Date(Math.round(now.getTime() / 60_000) * 60_000).toISOString(), timeZone: clock.zone,
      periods, summary: reading.summary, limits: reading.limits, pageUrl: `${context.origin}${RETROGRADE_FOR_YOU_PAGE_PATH}`,
    },
    links: [
      { title: 'Retrogrades in your chart on Zodiacs', url: `${context.origin}${RETROGRADE_FOR_YOU_PAGE_PATH}` },
      { title: 'Retrogrades on Zodiacs', url: `${context.origin}/retrogrades/` },
      ...planets.map((planet) => ({ title: `${planet} retrograde`, url: `${context.origin}/${planet.toLowerCase()}-retrograde/` })),
      { title: 'Your birth chart on Zodiacs', url: `${context.origin}/birth-chart/` },
    ],
  };
}

export const retrogradeForMeTool = definePersonalTool({
  name: 'get_retrograde_for_me',
  title: 'Retrogrades for you',
  summary: 'whether Mercury, Venus or Mars is retrograde now or when it next is, with its stations, shadows and the natal house it falls in',
  description: "Says whether Mercury, Venus and Mars are retrograde now, and if not when each next turns retrograde, with the dates and degrees of both stations, the pre-shadow and post-shadow, the natal house the retrograde falls in, what that house traditionally covers and what the retrograde traditionally asks for there, and any natal planet or angle the loop passes over. Use it for questions such as how Mercury retrograde affects me or where the next Venus retrograde falls in my chart, once the person has given a birth date. For the dates of every station across the sky, with no birth chart, use search_sky_events; for all transits to the birth chart over a span, use get_personal_transits. Give the birth date, and the time, birthplace time zone and coordinates only as the person gives them; never guess a birth time. Without a birth time and place, the houses are counted from the Sun sign and the answer says so. When they name a town or city instead of coordinates, use find_birthplace first. Give currentZone so the dates fall on their own clock. Share the reading plainly as astrology's reading, with the reading-confidence label.",
  input: retrogradeForMeInput,
  data: retrogradeForMeData,
  clockDependent: true,
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, currentZone: 'Europe/Madrid' },
  run: (args, context) => retrogradeForMe(args, context),
});
