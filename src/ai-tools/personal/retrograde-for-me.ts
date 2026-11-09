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
 * retrograde station. The words are pre-written here; nothing is generated.
 *
 * Houses are whole-sign, counted from the rising sign with a birth time and
 * place, as the site counts them; otherwise from the Sun sign, labelled so.
 * Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { findLongitudeCrossings, positions } from '@zodiacs/engine';
import { SampleBudget, positionsMemo, rowOf, stationCrossings } from '../../lib/compute-api/endpoints';
import { wholeSignHouseFromAsc } from '../../lib/daily';
import type { Chart } from '../../lib/engine/types';
import { NATAL_HOUSE_THEME } from '../../lib/natal';
import { SIGNS, signBySlug, signIndexForLongitude } from '../../lib/signs';
import { MINOR_NOTE, isUnder18, softenMinor } from '../features/reading-guards';
import { readingConfidence, readingConfidenceLabel } from '../reading-confidence';
import { ORDINAL, birthDayEnds, birthFields, castNatal, currentClock, dateOn, dayLabel, definePersonalTool, refineBirth, zoneField, type BirthArgs, type PersonalToolContext } from './shared';

export const RETROGRADE_PLANETS = ['Mercury', 'Venus', 'Mars'] as const;
export type RetrogradePlanet = typeof RETROGRADE_PLANETS[number];

const DAY = 86_400_000;
/** Back far enough to find the retrograde station behind a current loop and the one before a post-shadow (Mars's longest loop is about 81 days, its post-shadow about 70). */
const LOOK_BACK_DAYS = 250;
/** Forward far enough for Mars's next loop to begin and end (its stations come about 780 days apart). */
const LOOK_AHEAD_DAYS = 860;
/** A shadow is shorter than this for all three planets (Mars's runs about 70 days). */
const SHADOW_SEARCH_DAYS = 150;

/** What each planet's retrograde is traditionally read as, in general. */
export const RETROGRADE_LINE: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'Mercury retrograde is traditionally a time to review, revise and reconnect rather than launch: check the details, back up what matters, reread contracts before signing them, and leave room for delays in travel and messages.',
  Venus: 'Venus retrograde traditionally asks you to revisit what you value: relationships, money and what you find beautiful. It is read as a good window to review finances and old ties, and a poor one for big purchases or a sudden change of look.',
  Mars: 'Mars retrograde traditionally slows drive and ambition: plans stall, tempers run shorter and old disputes come back. It asks you to rework a strategy rather than force it, and to take rest seriously when energy dips.',
};

/** What each planet's retrograde traditionally asks for in the area of life a house covers. */
export const RETROGRADE_ASK: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'review plans, recheck the paperwork and reopen conversations that were left unfinished',
  Venus: 'look again at what you value there and what you spend on it, and to mend rather than replace',
  Mars: 'rework plans rather than push them, and to pace your effort',
};

/** Why a natal point inside the loop matters, said once per point. */
const CONTACT_LINE = 'traditionally the most felt part of a retrograde, since the planet crosses that degree three times (before the turn, while retrograde and again after it)';

const POINT_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

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

const round2 = (value: number) => Math.round(value * 100) / 100;
const minute = (at: Date) => new Date(Math.round(at.getTime() / 60_000) * 60_000);
const norm = (value: number) => ((value % 360) + 360) % 360;

/** Such as "20°56' Scorpio", rounded down to the minute of arc, as the sign pages print it. */
export function formatPosition(lon: number): string {
  const index = signIndexForLongitude(lon);
  const minutes = Math.floor((norm(lon) - index * 30) * 60);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}' ${SIGNS[index].name}`;
}

function instantOn(at: Date, timeZone: string) {
  const rounded = minute(at);
  return { utc: rounded.toISOString(), date: dateOn(rounded, timeZone), label: dayLabel(rounded, timeZone) };
}

function stationOn(at: Date, lon: number, timeZone: string) {
  const index = signIndexForLongitude(lon);
  return { ...instantOn(at, timeZone), sign: SIGNS[index].slug, degree: Math.min(29.99, round2(norm(lon) - index * 30)), position: formatPosition(lon) };
}

export interface RetrogradeLoop {
  planet: RetrogradePlanet;
  stationRetrograde: { at: Date; lon: number };
  stationDirect: { at: Date; lon: number };
  preShadowStart: Date | null;
  postShadowEnd: Date | null;
}

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

/** The signs a loop covers, in zodiac order from the direct station to the retrograde station. */
function loopSigns(loop: RetrogradeLoop): number[] {
  const first = signIndexForLongitude(loop.stationDirect.lon);
  const last = signIndexForLongitude(loop.stationRetrograde.lon);
  const out = [first];
  for (let index = first; index !== last;) {
    index = (index + 1) % 12;
    out.push(index);
  }
  return out;
}

/** True when `lon` lies on the loop's degrees, from the direct station forward to the retrograde station. */
function inLoop(loop: RetrogradeLoop, lon: number): boolean {
  return norm(lon - loop.stationDirect.lon) <= norm(loop.stationRetrograde.lon - loop.stationDirect.lon);
}

/** A natal body's longitude (the site's chart type, which rowOf's engine rows do not cover). */
const natalLon = (chart: Chart, name: string) => chart.bodies.find((row) => row.body === name)!.lon;

/** The retrogrades for one person. Throws RangeError for details it cannot use. */
export async function retrogradeForMe(args: BirthArgs & { planets?: readonly RetrogradePlanet[] | undefined; currentZone?: string | undefined }, context: Pick<PersonalToolContext, 'now' | 'localTime' | 'resolveZone' | 'hostZone' | 'origin'>): Promise<{ data: RetrogradeForMeData; links: { title: string; url: string }[] }> {
  const natal = await castNatal(args, context.localTime);
  const clock = await currentClock(args.currentZone, args.zone, context as PersonalToolContext);
  const now = context.now;
  const today = dateOn(now, clock.zone);
  const minor = isUnder18(args.birthDate, today);
  const soften = (text: string) => (minor ? softenMinor(text) : text);
  const planets = RETROGRADE_PLANETS.filter((planet) => !args.planets || args.planets.includes(planet));
  const limits: string[] = [];
  if (clock.note) limits.push(clock.note);

  // The house basis: the rising sign with a time and place; else the Sun sign, if the birth day keeps it.
  let countedFrom: 'rising sign' | 'Sun sign' | null = null;
  let baseSign: string | null = null;
  if (natal.angles) {
    countedFrom = 'rising sign';
    baseSign = SIGNS[signIndexForLongitude(natal.angles.asc)].slug;
  } else {
    const sunIndex = signIndexForLongitude(natalLon(natal.chart, 'Sun'));
    let held = true;
    if (!natal.timeKnown) {
      const ends = await birthDayEnds(args, context.localTime);
      held = ends.every((end) => signIndexForLongitude(rowOf(positions(end), 'Sun').lon) === sunIndex);
    }
    if (held) {
      countedFrom = 'Sun sign';
      baseSign = SIGNS[sunIndex].slug;
      limits.push(natal.timeKnown
        ? 'No birthplace coordinates were given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.'
        : 'No birth time was given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.');
    } else limits.push('No birth time was given and the Sun changed sign on the birth day, so there are no houses. A birth time settles it.');
  }

  // Natal points: the Moon only with a birth time (it moves about 13 degrees a day), the angles only with a place too.
  const points: { name: string; lon: number }[] = POINT_NAMES
    .filter((name) => name !== 'Moon' || natal.timeKnown)
    .map((name) => ({ name, lon: natalLon(natal.chart, name) }));
  if (natal.angles) points.push({ name: 'Ascendant', lon: natal.angles.asc }, { name: 'Midheaven', lon: natal.angles.mc });
  if (!natal.timeKnown) limits.push('Without a birth time the natal Moon is left out of the points each loop passes over.');

  const confidence = readingConfidence(natal.detail);
  const confidenceLabel = readingConfidenceLabel(natal.detail);
  const rowsAt = positionsMemo();
  const openings: string[] = [];
  const periods = planets.map((planet) => {
    const { current: loop, previous, retrogradeNow } = retrogradeLoops(planet, now, rowsAt);
    const retro = stationOn(loop.stationRetrograde.at, loop.stationRetrograde.lon, clock.zone);
    const direct = stationOn(loop.stationDirect.at, loop.stationDirect.lon, clock.zone);
    const preShadowStart = loop.preShadowStart ? instantOn(loop.preShadowStart, clock.zone) : null;
    const postShadowEnd = loop.postShadowEnd ? instantOn(loop.postShadowEnd, clock.zone) : null;
    const status = retrogradeNow ? 'retrograde' as const
      : previous?.postShadowEnd && previous.postShadowEnd.getTime() > now.getTime() ? 'post-shadow' as const
        : loop.preShadowStart && loop.preShadowStart.getTime() <= now.getTime() ? 'pre-shadow' as const
          : 'direct' as const;
    const signs = loopSigns(loop).map((index) => SIGNS[index].slug);
    const houses = baseSign ? signs.map((sign) => {
      const house = wholeSignHouseFromAsc(sign, baseSign!);
      const theme = NATAL_HOUSE_THEME[house];
      const where = countedFrom === 'rising sign' ? `your ${ORDINAL[house]} house` : `the ${ORDINAL[house]} house counted from your Sun sign`;
      return { house, sign, theme, line: soften(`In ${signBySlug(sign).name} it falls in ${where}, which covers ${theme}. There it traditionally asks you to ${RETROGRADE_ASK[planet]}.`) };
    }) : [];
    const contacts = points.filter((point) => inLoop(loop, point.lon)).map((point) => ({
      point: point.name, sign: SIGNS[signIndexForLongitude(point.lon)].slug, position: formatPosition(point.lon),
      line: `The loop passes over your natal ${point.name} at ${formatPosition(point.lon)}: ${CONTACT_LINE}.`,
    }));
    const opening = retrogradeNow
      ? `${planet} is retrograde now. It turned retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`
      : `${planet} is not retrograde now. It next turns retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`;
    openings.push(soften(opening));
    const shadowLine = status === 'post-shadow'
      ? ` It turned direct on ${instantOn(previous!.stationDirect.at, clock.zone).label} and is in the post-shadow of that loop until ${instantOn(previous!.postShadowEnd!, clock.zone).label}, going back over the degrees it covered while retrograde.`
      : status === 'pre-shadow' && preShadowStart
        ? ` It is already in the pre-shadow, which began on ${preShadowStart.label}, crossing the degrees the retrograde will revisit.`
        : preShadowStart && !retrogradeNow ? ` Its pre-shadow begins on ${preShadowStart.label}.` : '';
    const after = postShadowEnd ? ` The post-shadow runs until ${postShadowEnd.label}, when it is back at the degree where it turned retrograde.` : '';
    const reading = soften([
      `${opening}${shadowLine}${after}`,
      RETROGRADE_LINE[planet],
      ...houses.map((entry) => entry.line),
      ...contacts.map((entry) => entry.line),
      `${confidenceLabel}.`,
    ].join(' '));
    return {
      planet, retrogradeNow, status, stationRetrograde: retro, stationDirect: direct, preShadowStart, postShadowEnd, signs,
      housesCountedFrom: countedFrom, houses, contacts, reading, confidence, confidenceLabel,
    };
  });
  if (minor) limits.push(MINOR_NOTE);
  const summary = `${openings.join(' ')} ${confidenceLabel}.`;
  return {
    data: {
      birthDate: args.birthDate, timeKnown: natal.timeKnown, placed: natal.placed, now: minute(now).toISOString(), timeZone: clock.zone,
      periods, summary, limits, pageUrl: `${context.origin}/retrogrades/`,
    },
    links: [
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
