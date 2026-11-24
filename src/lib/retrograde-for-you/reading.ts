/**
 * Retrogrades in one person's chart: the pure parts shared by the
 * /retrogrades/for-you/ page (which computes on the device from the committed
 * sky data, src/data/sky.json) and the get_retrograde_for_me tool (which finds
 * the stations with the engine's station search, server-side).
 *
 * Given a planet's loop (its retrograde and direct stations with their
 * longitudes, and the shadow on either side), the instant "now" and the clock
 * the dates are read on, this works out the status, the signs the loop
 * covers, the whole-sign house each sign falls in, the natal points inside
 * the loop's degrees and the pre-written reading. Nothing here is generated,
 * stored, logged or sent anywhere.
 *
 * Houses are whole-sign, counted from the rising sign with a birth time and
 * place, as the site counts them; otherwise from the Sun sign, labelled so.
 */
import { wholeSignHouseFromAsc } from '../daily';
import { NATAL_HOUSE_THEME } from '../natal';
import { SIGNS, signBySlug, signIndexForLongitude } from '../signs';
import { MINOR_NOTE, isUnder13, isUnderAge, softenHealth, softenMinor } from '../../ai-tools/features/reading-guards';
import { readingConfidence, readingConfidenceLabel, readingDetail, type ReadingDetail } from '../../ai-tools/reading-confidence';
import { earliestToday } from '../birth-date-policy';

export { isUnder13, MINOR_NOTE };

export const RETROGRADE_PLANETS = ['Mercury', 'Venus', 'Mars'] as const;
export type RetrogradePlanet = typeof RETROGRADE_PLANETS[number];

/** Each planet wears the hue of the sign it rules, as the site's other planet drawings do. */
export const RETROGRADE_HUE_SIGN: Readonly<Record<RetrogradePlanet, string>> = { Mercury: 'gemini', Venus: 'taurus', Mars: 'aries' };

/** What each planet's retrograde is traditionally read as, in general. */
export const RETROGRADE_LINE: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'Mercury retrograde is traditionally a time to review, revise and reconnect rather than launch: check the details, back up what matters, reread contracts before signing them, and leave room for delays in travel and messages.',
  Venus: 'Venus retrograde traditionally asks you to revisit what you value: relationships, money and what you find beautiful. It is read as a time to reflect on what you spend on and why, to look again at old ties, and to notice what still feels like you.',
  Mars: 'Mars retrograde traditionally slows drive and ambition: plans stall, tempers run shorter and old disputes come back. It asks you to rework a strategy rather than force it, and to take rest seriously when energy dips.',
};

/** What each planet's retrograde traditionally asks for in the area of life a house covers. */
export const RETROGRADE_ASK: Readonly<Record<RetrogradePlanet, string>> = {
  Mercury: 'review plans, recheck the paperwork and reopen conversations that were left unfinished',
  Venus: 'look again at what you value there and what you spend on it, and to mend rather than replace',
  Mars: 'rework plans rather than push them, and to pace your effort',
};

/** Why a natal point inside the loop matters, said once per point. */
export const CONTACT_LINE = 'traditionally the most felt part of a retrograde, since the planet crosses that degree three times (before the turn, while retrograde and again after it)';

export const POINT_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

export const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'] as const;

export type HouseBasis = 'rising sign' | 'Sun sign';
export type RetrogradeStatus = 'retrograde' | 'pre-shadow' | 'post-shadow' | 'direct';

export interface RetrogradeLoop {
  planet: RetrogradePlanet;
  stationRetrograde: { at: Date; lon: number };
  stationDirect: { at: Date; lon: number };
  preShadowStart: Date | null;
  postShadowEnd: Date | null;
}

/**
 * The loop a planet is in at "now", or else its next one, and the one before (for a post-shadow still running).
 * `current` is null only when the data holds no later loop and `previous`'s post-shadow is still running.
 */
export interface LoopSet { current: RetrogradeLoop | null; previous: RetrogradeLoop | null; retrogradeNow: boolean }

export interface Instant { utc: string; date: string; label: string }
export interface Station extends Instant { sign: string; degree: number; position: string }

export interface RetrogradePeriod {
  planet: RetrogradePlanet;
  retrogradeNow: boolean;
  status: RetrogradeStatus;
  stationRetrograde: Station;
  stationDirect: Station;
  preShadowStart: Instant | null;
  postShadowEnd: Instant | null;
  signs: string[];
  housesCountedFrom: HouseBasis | null;
  houses: { house: number; sign: string; theme: string; line: string }[];
  contacts: { point: string; sign: string; position: string; line: string }[];
  /** Without a birth time: natal points inside the loop at one end of the birth day and outside it at the other. */
  possibleContacts: { point: string; line: string }[];
  /** The next loop's stations (UTC, to the minute) while this period is the post-shadow of the loop just ended, else null. */
  next: { stationRetrograde: string; stationDirect: string } | null;
  reading: string;
  confidence: number;
  confidenceLabel: string;
}

/** What the reading takes from the birth chart. */
export interface NatalBasis {
  countedFrom: HouseBasis | null;
  baseSign: string | null;
  /**
   * The natal points. Without a birth time `lon` is the noon chart's and
   * `ends` holds the longitude at each end of the birth day, so a contact is
   * claimed only when both ends agree.
   */
  points: { name: string; lon: number; ends?: readonly [number, number] }[];
  /** True without a birth time: natal positions are printed in whole degrees, with "about". */
  approximate: boolean;
  detail: ReadingDetail;
  minor: boolean;
  /** Plain sentences on what the details could not settle, in the order the answer gives them. */
  limits: string[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const minute = (at: Date) => new Date(Math.round(at.getTime() / 60_000) * 60_000);
const norm = (value: number) => ((value % 360) + 360) % 360;

/** The calendar date of an instant on a zone's clock, as YYYY-MM-DD. */
export function dateOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "Tue 3 Nov 2026" on a zone's clock. */
export function dayLabel(at: Date | string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

/** Such as "about 14° Scorpio", the whole degree, for a natal point without a birth time. */
export function formatApproximatePosition(lon: number): string {
  const index = signIndexForLongitude(lon);
  return `about ${Math.floor(norm(lon) - index * 30)}° ${SIGNS[index].name}`;
}

/** Such as "20°56' Scorpio", rounded down to the minute of arc, as the sign pages print it. */
export function formatPosition(lon: number): string {
  const index = signIndexForLongitude(lon);
  const minutes = Math.floor((norm(lon) - index * 30) * 60);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}' ${SIGNS[index].name}`;
}

export function instantOn(at: Date, timeZone: string): Instant {
  const rounded = minute(at);
  return { utc: rounded.toISOString(), date: dateOn(rounded, timeZone), label: dayLabel(rounded, timeZone) };
}

function stationOn(at: Date, lon: number, timeZone: string): Station {
  const index = signIndexForLongitude(lon);
  return { ...instantOn(at, timeZone), sign: SIGNS[index].slug, degree: Math.min(29.99, round2(norm(lon) - index * 30)), position: formatPosition(lon) };
}

/** The signs a loop covers, in zodiac order from the direct station to the retrograde station. */
export function loopSigns(loop: RetrogradeLoop): number[] {
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
export function inLoop(loop: RetrogradeLoop, lon: number): boolean {
  return norm(lon - loop.stationDirect.lon) <= norm(loop.stationRetrograde.lon - loop.stationDirect.lon);
}

/** The limit for a birth time in an hour the clocks repeated, when the two passes give different rising signs. */
export function foldRisingLimit(earlier: string, later: string): string {
  return `Clocks repeated that hour where you were born. This reading uses the earlier pass, with ${earlier} rising; the later pass would give ${later} rising and change every house.`;
}

/**
 * The house basis and the natal points, from a chart cast with whole-sign
 * houses. `sunHeld` says whether the Sun's sign is the same at both ends of an
 * untimed birth day (always true with a birth time). `now` is the instant
 * of the reading. The under-18 rule reads the age on the calendar date at
 * UTC-12 (earliestToday), as the shared under-13 policy does, so nobody is
 * read as 18 early in any time zone; the clock the dates are shown on (the
 * device's, the current zone's or the birthplace's) never moves it.
 */
export function natalBasis(input: {
  timeKnown: boolean;
  placed: boolean;
  angles: { asc: number; mc: number } | null;
  bodies: readonly { body: string; lon: number }[];
  sunHeld: boolean;
  birthDate: string;
  now: Date;
  /** Without a birth time: the bodies at the start and the end of the birth day. */
  dayEnds?: readonly [readonly { body: string; lon: number }[], readonly { body: string; lon: number }[]];
  /**
   * When the birth time fell in a stretch the clocks repeated: the rising degree at the later pass, the size of the
   * change after the earlier one. The chart uses the earlier pass; a limit says so only when the rising sign, and so
   * every house, differs between the two.
   */
  foldAsc?: number | null;
}): NatalBasis {
  const lonOf = (name: string) => input.bodies.find((row) => row.body === name)!.lon;
  const limits: string[] = [];
  let countedFrom: HouseBasis | null = null;
  let baseSign: string | null = null;
  if (input.angles) {
    countedFrom = 'rising sign';
    baseSign = SIGNS[signIndexForLongitude(input.angles.asc)].slug;
    const later = input.foldAsc == null ? null : SIGNS[signIndexForLongitude(input.foldAsc)];
    if (later && later.slug !== baseSign) limits.push(foldRisingLimit(signBySlug(baseSign).name, later.name));
  } else if (input.sunHeld) {
    countedFrom = 'Sun sign';
    baseSign = SIGNS[signIndexForLongitude(lonOf('Sun'))].slug;
    limits.push(input.timeKnown
      ? 'No birthplace coordinates were given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.'
      : 'No birth time was given, so there is no rising sign: the houses are counted from your Sun sign, a rougher guide than your own houses.');
  } else limits.push('No birth time was given and the Sun changed sign on the birth day, so there are no houses. A birth time settles it.');

  // The Moon only with a birth time (it moves about 13 degrees a day), the angles only with a place too.
  const endLon = (rows: readonly { body: string; lon: number }[], name: string) => rows.find((row) => row.body === name)!.lon;
  const ends = !input.timeKnown ? input.dayEnds : undefined;
  const points: NatalBasis['points'] = POINT_NAMES.filter((name) => name !== 'Moon' || input.timeKnown).map((name) => ({
    name: name as string, lon: lonOf(name), ...(ends ? { ends: [endLon(ends[0], name), endLon(ends[1], name)] as const } : {}),
  }));
  if (input.angles) points.push({ name: 'Ascendant', lon: input.angles.asc }, { name: 'Midheaven', lon: input.angles.mc });
  if (!input.timeKnown) limits.push('Without a birth time the natal Moon is left out of the points each loop passes over.');

  return {
    countedFrom, baseSign, points, approximate: !input.timeKnown,
    detail: readingDetail({ hasDate: true, hasTime: input.timeKnown, hasPlace: input.placed }),
    // isUnderAge keeps 29 February as 29 February, so someone born on 1 March is still under 18 that day.
    minor: isUnderAge(input.birthDate, earliestToday(input.now), 18),
    limits,
  };
}

/** One planet's period: status, stations, shadows, houses, natal points and the reading, on the given clock. */
export function retrogradePeriod(planet: RetrogradePlanet, loops: LoopSet, now: Date, zone: string, basis: NatalBasis): { period: RetrogradePeriod; opening: string } {
  // The sixth house never reads as health beside a dated window; the romance wording goes for someone under 18.
  const soften = (text: string) => softenHealth(basis.minor ? softenMinor(text) : text);
  const { current: loop, previous, retrogradeNow } = loops;
  const confidence = readingConfidence(basis.detail);
  const confidenceLabel = readingConfidenceLabel(basis.detail);
  const status: RetrogradeStatus = retrogradeNow ? 'retrograde'
    : previous?.postShadowEnd && previous.postShadowEnd.getTime() > now.getTime() ? 'post-shadow'
      : loop?.preShadowStart && loop.preShadowStart.getTime() <= now.getTime() ? 'pre-shadow'
        : 'direct';
  // In the post-shadow the period is the loop that just ended; the next one, when the data holds it, gets a line of its own.
  const subject = status === 'post-shadow' && previous ? previous : loop;
  if (!subject) throw new RangeError(`Zodiacs could not find ${planet}'s retrograde around that date.`);
  const afterLoop = subject !== loop;
  const retro = stationOn(subject.stationRetrograde.at, subject.stationRetrograde.lon, zone);
  const direct = stationOn(subject.stationDirect.at, subject.stationDirect.lon, zone);
  const preShadowStart = subject.preShadowStart ? instantOn(subject.preShadowStart, zone) : null;
  const postShadowEnd = subject.postShadowEnd ? instantOn(subject.postShadowEnd, zone) : null;
  const next = afterLoop && loop ? { stationRetrograde: instantOn(loop.stationRetrograde.at, zone).utc, stationDirect: instantOn(loop.stationDirect.at, zone).utc } : null;
  const signs = loopSigns(subject).map((index) => SIGNS[index].slug);
  const houses = basis.baseSign ? signs.map((sign) => {
    const house = wholeSignHouseFromAsc(sign, basis.baseSign!);
    const theme = NATAL_HOUSE_THEME[house];
    const where = basis.countedFrom === 'rising sign' ? `your ${ORDINAL[house]} house` : `the ${ORDINAL[house]} house counted from your Sun sign`;
    return { house, sign, theme: soften(theme), line: soften(`In ${signBySlug(sign).name} it falls in ${where}, which covers ${theme}. There it traditionally asks you to ${RETROGRADE_ASK[planet]}.`) };
  }) : [];
  const position = basis.approximate ? formatApproximatePosition : formatPosition;
  const contacts: RetrogradePeriod['contacts'] = [];
  const possibleContacts: RetrogradePeriod['possibleContacts'] = [];
  for (const point of basis.points) {
    const inside = point.ends ? point.ends.map((lon) => inLoop(subject, lon)) : [inLoop(subject, point.lon)];
    if (inside.every(Boolean)) {
      contacts.push({
        point: point.name, sign: SIGNS[signIndexForLongitude(point.lon)].slug, position: position(point.lon),
        line: `The loop passes over your natal ${point.name} at ${position(point.lon)}: ${CONTACT_LINE}.`,
      });
    } else if (inside.some(Boolean)) {
      possibleContacts.push({ point: point.name, line: `The loop may also pass over your natal ${point.name}; a birth time settles it.` });
    }
  }
  const opening = retrogradeNow
    ? `${planet} is retrograde now. It turned retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`
    : afterLoop
      ? `${planet} turned direct on ${direct.label} at ${direct.position} and is in the post-shadow until ${postShadowEnd!.label}, going back over the degrees it covered while retrograde.`
      : `${planet} is not retrograde now. It next turns retrograde on ${retro.label} at ${retro.position} and turns direct on ${direct.label} at ${direct.position}.`;
  const shadowLine = afterLoop ? ''
    : status === 'pre-shadow' && preShadowStart
      ? ` It is already in the pre-shadow, which began on ${preShadowStart.label}, crossing the degrees the retrograde will revisit.`
      : preShadowStart && !retrogradeNow ? ` Its pre-shadow begins on ${preShadowStart.label}.` : '';
  const after = postShadowEnd && !afterLoop ? ` The post-shadow runs until ${postShadowEnd.label}, when it is back at the degree where it turned retrograde.` : '';
  const paragraph = soften([
    `${opening}${shadowLine}${after}`,
    RETROGRADE_LINE[planet],
    ...houses.map((entry) => entry.line),
    ...contacts.map((entry) => entry.line),
  ].join(' '));
  const reading = [paragraph, ...possibleContacts.map((entry) => entry.line)].join('\n');
  return {
    period: {
      planet, retrogradeNow, status, stationRetrograde: retro, stationDirect: direct, preShadowStart, postShadowEnd, signs,
      housesCountedFrom: basis.countedFrom, houses, contacts, possibleContacts, next, reading, confidence, confidenceLabel,
    },
    opening: soften(opening),
  };
}

/**
 * Every asked-for planet's period, the one-paragraph summary and the limits.
 * `loopsFor` returns null when its data does not reach that planet's next
 * loop (the page's committed sky data ends); that planet is listed in
 * `unavailable` and left out of the summary rather than guessed.
 */
export function retrogradeReading(input: {
  planets: readonly RetrogradePlanet[];
  loopsFor: (planet: RetrogradePlanet) => LoopSet | null;
  now: Date;
  zone: string;
  basis: NatalBasis;
  /** Sentences that come before the chart's own limits, such as which clock "today" is read on. */
  leadingLimits?: readonly string[];
}): { periods: RetrogradePeriod[]; unavailable: RetrogradePlanet[]; summary: string; limits: string[] } {
  const periods: RetrogradePeriod[] = [];
  const unavailable: RetrogradePlanet[] = [];
  const openings: string[] = [];
  for (const planet of RETROGRADE_PLANETS.filter((entry) => input.planets.includes(entry))) {
    const loops = input.loopsFor(planet);
    if (!loops) { unavailable.push(planet); continue; }
    const { period, opening } = retrogradePeriod(planet, loops, input.now, input.zone, input.basis);
    periods.push(period);
    openings.push(opening);
  }
  const limits = [...(input.leadingLimits ?? []), ...input.basis.limits];
  if (input.basis.minor) limits.push(MINOR_NOTE);
  const summary = `${openings.join(' ')} ${readingConfidenceLabel(input.basis.detail)}.`;
  return { periods, unavailable, summary, limits };
}

/** The house the loop begins in (the retrograde station's sign), for a share link and its card. */
export function stationHouse(period: Pick<RetrogradePeriod, 'houses' | 'stationRetrograde'>): number | null {
  return period.houses.find((entry) => entry.sign === period.stationRetrograde.sign)?.house ?? null;
}
