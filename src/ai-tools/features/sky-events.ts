/**
 * search_sky_events: specific kinds of sky events months or years ahead, offered only with
 * ZODIACS_SKY_EVENTS_ENABLED=1 beside the coverage tools. It answers "when is the next eclipse",
 * "when does Mercury next turn retrograde", "when does Saturn enter Taurus" or "every full Moon
 * next year"; what changes over the next days or weeks is get_upcoming_events', and following the
 * events in a calendar app is get_sky_calendar's.
 *
 * Every event comes from the site's own data or engine, nothing new:
 * - eclipses from src/data/eclipses.json (2026 to 2030, astronomy-engine's eclipse searches);
 * - sign changes of the Sun through Pluto from src/data/ingresses.json, within the dates it covers;
 * - stations and new and full Moons from the compute API's event searches (the engine's crossing
 *   solver, as get_upcoming_events runs it), over windows of up to two years;
 * - void-of-course Moon periods from the engine's voidOfCourseWindows under the traditional rule:
 *   from the Moon's last exact Ptolemaic aspect in a sign to the Sun, Mercury, Venus, Mars, Jupiter
 *   or Saturn until it enters the next sign (src/data/conventions/registry.json,
 *   void-of-course-bodies:traditional), searched up to 31 days at a time.
 * An event links to its own page only where the site publishes one (src/data/events-publication.json),
 * else to the page that lists that kind of event. These are calculated facts: no forecast and no
 * reading-confidence label. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { conventionAddress } from '@zodiacs/engine/conventions';
import { VOID_BODIES, VOID_OF_COURSE_CONVENTION, voidOfCourseWindows } from '@zodiacs/engine/techniques';
import eclipseTable from '../../data/eclipses.json';
import ingressTable from '../../data/ingresses.json';
import sky from '../../data/sky.json';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { PHASES, STATION_BODIES } from '../../lib/compute-api/constants';
import { SampleBudget, phaseCrossings, positionsMemo, rowOf, stationCrossings } from '../../lib/compute-api/endpoints';
import { eclipseId, ingressId, isoDay, lunationId, retrogradeId } from '../../lib/events/format';
import { publishedEventById } from '../../lib/events/publication';
import { SIGNS, formatLongitude, signIndexForLongitude } from '../../lib/signs';

const DAY = 86_400_000;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;

export const SKY_EVENT_KINDS = ['solar-eclipse', 'lunar-eclipse', 'station', 'ingress', 'new-moon', 'full-moon', 'void-of-course'] as const;
export type SkyEventKind = typeof SKY_EVENT_KINDS[number];
/** The planets whose stations and sign changes the tool lists. The Moon's sign changes are get_upcoming_events'. */
export const SKY_EVENT_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type SkyEventPlanet = typeof SKY_EVENT_PLANETS[number];
/** The kinds searched when none are named: everything but void-of-course periods, which come only on request. */
export const DEFAULT_SKY_EVENT_KINDS: readonly SkyEventKind[] = SKY_EVENT_KINDS.filter((kind) => kind !== 'void-of-course');
/** A window is at most two years long, from its first day to the same date two years later. */
export const SKY_EVENTS_MAX_YEARS = 2;
/** Void-of-course periods come about every two and a half days, so they are searched a month at a time. */
export const VOID_OF_COURSE_MAX_DAYS = 31;
export const SKY_EVENTS_DEFAULT_LIMIT = 25;
export const SKY_EVENTS_MAX_LIMIT = 100;
/** The rule the void-of-course periods follow: the engine's convention with the traditional bodies, the Sun to Saturn. */
export const SKY_EVENTS_VOID_BODIES = 'traditional' as const;
export const SKY_EVENTS_VOID_CONVENTION_IDS = [
  `void-of-course:${VOID_OF_COURSE_CONVENTION.name}`,
  `void-of-course-bodies:${SKY_EVENTS_VOID_BODIES}`,
] as const;
export const SKY_EVENTS_NOTE = 'Calculated dates and positions, not forecasts. What an event means in astrology is a separate reading.';

export const skyEventsInput = z.strictObject({
  kinds: z.array(z.enum(SKY_EVENT_KINDS)).min(1).max(SKY_EVENT_KINDS.length).optional().describe('Which events to find: solar-eclipse, lunar-eclipse, station (a planet turning retrograde or direct), ingress (a planet changing sign), new-moon, full-moon or void-of-course. Leave it out for every kind but void-of-course, which comes only when named.'),
  planets: z.array(z.enum(SKY_EVENT_PLANETS)).min(1).max(SKY_EVENT_PLANETS.length).optional().describe('Optional: keep the stations and sign changes of these planets, such as Mercury. Without kinds it finds only their stations and sign changes. It does not filter eclipses, new and full Moons or void-of-course periods.'),
  from: z.string().regex(DATE).optional().describe("The first day to search, such as 2027-01-01, on the person's clock. Leave it out for today."),
  to: z.string().regex(DATE).optional().describe('The last day to search, at most two years after from, and at most 30 days after it (31 days in all) when kinds includes void-of-course. Leave it out for a year from from, or a week for void-of-course periods.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional().describe("The person's time zone, such as America/New_York, so the days and times are on their clock. Without it, UTC."),
  limit: z.number().int().min(1).max(SKY_EVENTS_MAX_LIMIT).optional().describe(`How many events to return, soonest first: ${SKY_EVENTS_DEFAULT_LIMIT} unless given, at most ${SKY_EVENTS_MAX_LIMIT}.`),
});
export type SkyEventsInput = z.infer<typeof skyEventsInput>;

const signSlug = z.enum(SIGNS.map((sign) => sign.slug) as [string, ...string[]]);
const moment = z.object({
  /** The instant in UTC, ISO 8601. */
  utc: z.string(),
  /** The same instant on the person's clock, such as Wed 12 Aug 2026, 19:45 (with UTC when no zone was given). */
  local: z.string(),
});
export const skyEvent = z.object({
  kind: z.enum(SKY_EVENT_KINDS),
  /** Such as Total solar eclipse in Leo, Mercury turns retrograde in Sagittarius or Full Moon in Taurus. */
  title: z.string(),
  /** When it happens; for a void-of-course period, when it begins. */
  at: moment,
  /** A void-of-course period: when it ends, as the Moon enters nextSign. Null for every other kind. */
  until: moment.nullable(),
  /** The planet that stations or changes sign; null for eclipses, new and full Moons and void-of-course periods. */
  planet: z.enum(SKY_EVENT_PLANETS).nullable(),
  /** The sign it happens in: the sign entered, the sign of the station, the eclipsed Sun's or Moon's sign, the Moon's sign at a new or full Moon, or the sign the Moon is void in. */
  sign: signSlug,
  /** A void-of-course period: the sign the Moon enters when it ends. Null otherwise. */
  nextSign: signSlug.nullable(),
  /** Degree and minute in the sign at that moment, such as 20°00′ Leo; null for a sign change, which is at the sign's edge, and a void-of-course period. */
  position: z.string().nullable(),
  /** An eclipse: total, annular, partial or penumbral. A station: retrograde or direct. Null otherwise. */
  type: z.enum(['total', 'annular', 'partial', 'penumbral', 'retrograde', 'direct']).nullable(),
  /** One plain sentence about the event, with no forecast. */
  line: z.string(),
  /** The event's page on zodiacs.org where one is published, else the page that lists that kind of event; null when there is none. */
  pageUrl: z.url().nullable(),
});
export type SkyEvent = z.infer<typeof skyEvent>;

export const skyEventsData = z.object({
  /** The first and last day searched, on the person's clock. */
  from: z.string(),
  to: z.string(),
  zone: z.string(),
  /** request: the call named a zone. assistant: the host shared one. default: UTC was assumed, and message says so. */
  zoneSource: z.enum(['request', 'assistant', 'default']),
  kinds: z.array(z.enum(SKY_EVENT_KINDS)),
  planets: z.array(z.enum(SKY_EVENT_PLANETS)).nullable(),
  /** The events found, soonest first, at most limit of them. */
  events: z.array(skyEvent),
  /** How many events the window holds; more than events.length when the limit cut the list. */
  total: z.number().int().min(0),
  truncated: z.boolean(),
  /** The conventions registry entries the answer follows, with their addresses: the void-of-course rule when periods were searched. */
  conventions: z.array(z.object({ id: z.string(), url: z.url() })),
  /** What the answer leaves out or assumes, in plain sentences; null when there is nothing to add. */
  message: z.string().nullable(),
  note: z.literal(SKY_EVENTS_NOTE),
});
export type SkyEventsData = z.infer<typeof skyEventsData>;

/** The resolver methods this module calls; api/_compute/local-time.mjs supplies them. */
export type SkyEventsClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

export interface SkyEventsOptions {
  /** The person's zone, already spelt as tzdb spells it; UTC when none was given or shared. */
  zone: string;
  zoneSource: SkyEventsData['zoneSource'];
  /** Today on the person's clock, YYYY-MM-DD. */
  today: string;
  origin: string;
  /** The hosted boundary's event-search admission, as get_upcoming_events uses it. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)!.name;
const isRealDate = (date: string) => !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
/** The same calendar date `years` later; 29 February becomes 1 March. */
const yearsLater = (date: string, years: number) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDay = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** An instant in UTC and on the zone's clock, built from parts as the other tools build it. */
function momentOf(at: Date, zone: string, zoneSource: SkyEventsData['zoneSource']): z.infer<typeof moment> {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(at).map((part) => [part.type, part.value]));
  const local = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return { utc: at.toISOString(), local: zoneSource === 'default' ? `${local} UTC` : local };
}

/** The sign a planet enters at a boundary, read from the engine a minute after the crossing. */
function signAfter(rows: ReturnType<typeof positionsMemo>, planet: SkyEventPlanet, at: Date): { sign: string; retrograde: boolean } {
  const row = rowOf(rows(new Date(at.getTime() + 60_000)), planet);
  return { sign: SIGNS[signIndexForLongitude(row.lon)].slug, retrograde: row.speed < 0 };
}

interface Raw { kind: SkyEventKind; at: Date; until?: Date; planet?: SkyEventPlanet; sign: string; nextSign?: string; lon?: number; type?: SkyEvent['type']; extra?: { totalMinutes?: number; lastAspect?: { body: string; aspect: string } | null; retrograde?: boolean } }

type EclipseRow = { type: 'solar' | 'lunar'; kind: 'total' | 'annular' | 'partial' | 'penumbral'; peak: string; sign: string; lon: number; totalMinutes?: number };
type IngressWindow = { planet: string; sign: string; from: string; to: string };
type RetroWindow = { planet: string; from: string; to: string | null };

const ECLIPSES = eclipseTable.eclipses as EclipseRow[];
const INGRESS_WINDOWS = ingressTable.windows as IngressWindow[];
const RETROGRADES = sky.retrogrades as RetroWindow[];
/** The windows that open exactly at the sky data's first instant were clamped there, not stationed. */
const SKY_FROM = sky.from;
const STATION_PAGE_PLANETS = ['Mercury', 'Venus', 'Mars'];

/** A published event page's address, or null. */
function published(origin: string, id: string): string | null {
  const page = publishedEventById.get(id);
  return page ? `${origin}${page.path}` : null;
}

/** The retrograde period a station belongs to, from the committed sky data, matched within two days. */
function retrogradeWindowOf(planet: string, at: Date, direction: 'retrograde' | 'direct'): RetroWindow | undefined {
  return RETROGRADES.find((window) => {
    const edge = direction === 'retrograde' ? window.from : window.to;
    return window.planet === planet && edge !== null && !(direction === 'retrograde' && edge === SKY_FROM)
      && Math.abs(Date.parse(edge) - at.getTime()) <= 2 * DAY;
  });
}

/** The page for an event: its own published page, else the page that lists its kind. */
function pageFor(origin: string, event: Raw): string | null {
  switch (event.kind) {
    case 'solar-eclipse':
    case 'lunar-eclipse':
      return published(origin, eclipseId(event.at.toISOString())) ?? `${origin}/eclipses/`;
    case 'new-moon':
    case 'full-moon': {
      const type = event.kind === 'new-moon' ? 'new' : 'full';
      // The page's date is the committed instant's; the engine's own instant can sit a few seconds from it.
      const committed = (sky.moons as { type: string; at: string }[]).find((moon) => moon.type === type && Math.abs(Date.parse(moon.at) - event.at.getTime()) <= 6 * 3_600_000);
      return (committed ? published(origin, lunationId(type, committed.at)) : null) ?? (type === 'full' ? `${origin}/full-moon-calendar/` : `${origin}/moon-phase/`);
    }
    case 'station': {
      const window = retrogradeWindowOf(event.planet!, event.at, event.type as 'retrograde' | 'direct');
      if (!window) return `${origin}/retrogrades/`;
      const own = STATION_PAGE_PLANETS.includes(event.planet!) ? published(origin, retrogradeId(event.planet!, window.from)) : null;
      return own ?? `${origin}/retrogrades/#retrograde-${event.planet!.toLowerCase()}-${isoDay(window.from)}`;
    }
    case 'ingress':
      return published(origin, ingressId(event.planet!, event.sign, event.at.toISOString())) ?? (event.planet === 'Sun' ? `${origin}/learn/zodiac-dates/` : null);
    case 'void-of-course':
      return `${origin}/void-of-course-moon/`;
  }
}

const ECLIPSE_LINE: Record<string, string> = {
  'solar:total': 'the new Moon covers the Sun completely along a narrow path on Earth, and partly on either side of it',
  'solar:annular': 'the new Moon passes centrally over the Sun but is too small to cover it, leaving a ring of sunlight along a narrow path',
  'solar:partial': 'the new Moon covers part of the Sun, seen from part of Earth',
  'lunar:total': 'the full Moon passes completely into Earth\'s shadow',
  'lunar:partial': 'part of the full Moon passes into Earth\'s dark shadow',
  'lunar:penumbral': 'the full Moon passes through Earth\'s faint outer shadow, and the dimming is slight',
};
const ASPECT_VERB: Record<string, string> = { conjunction: 'conjunct', sextile: 'sextile', square: 'square', trine: 'trine', opposition: 'opposite' };

function titleOf(event: Raw): string {
  switch (event.kind) {
    case 'solar-eclipse': return `${cap(event.type!)} solar eclipse in ${signName(event.sign)}`;
    case 'lunar-eclipse': return `${cap(event.type!)} lunar eclipse in ${signName(event.sign)}`;
    case 'station': return `${event.planet} turns ${event.type} in ${signName(event.sign)}`;
    case 'ingress': {
      const planet = event.planet === 'Sun' ? 'The Sun' : event.planet;
      return event.extra?.retrograde ? `${planet} moves back into ${signName(event.sign)}` : `${planet} enters ${signName(event.sign)}`;
    }
    case 'new-moon': return `New Moon in ${signName(event.sign)}`;
    case 'full-moon': return `Full Moon in ${signName(event.sign)}`;
    case 'void-of-course': return `Void-of-course Moon in ${signName(event.sign)}`;
  }
}

function lineOf(event: Raw, at: z.infer<typeof moment>, until: z.infer<typeof moment> | null, eclipseOn: (event: Raw) => Raw | undefined): string {
  const where = event.lon === undefined ? signName(event.sign) : formatLongitude(event.lon);
  switch (event.kind) {
    case 'solar-eclipse':
    case 'lunar-eclipse': {
      const body = event.kind === 'solar-eclipse' ? 'solar' : 'lunar';
      const minutes = event.extra?.totalMinutes;
      return `${cap(event.type!)} ${body} eclipse at ${where}: ${ECLIPSE_LINE[`${body}:${event.type}`]}${minutes ? `, with totality lasting about ${minutes} minutes` : ''}.`;
    }
    case 'station':
      return event.type === 'retrograde'
        ? `${event.planet} stands still at ${where} and turns retrograde: from here it appears to move backward through the zodiac.`
        : `${event.planet} stands still at ${where} and turns direct: from here it moves forward through the zodiac again.`;
    case 'ingress':
      if (event.extra?.retrograde) return `${event.planet} moves back into ${signName(event.sign)} while it is retrograde.`;
      return event.planet === 'Sun' ? `The Sun enters ${signName(event.sign)}, and ${signName(event.sign)} season begins.` : `${event.planet} moves into ${signName(event.sign)}.`;
    case 'new-moon':
    case 'full-moon': {
      const eclipse = eclipseOn(event);
      const base = event.kind === 'new-moon'
        ? `New Moon at ${where}: the Moon and the Sun meet in ${signName(event.sign)}.`
        : `Full Moon at ${where}: the Moon is opposite the Sun.`;
      return eclipse ? `${base} It is also ${eclipse.type === 'annular' ? 'an' : 'a'} ${eclipse.type} ${eclipse.kind === 'solar-eclipse' ? 'solar' : 'lunar'} eclipse.` : base;
    }
    case 'void-of-course': {
      const last = event.extra?.lastAspect;
      const next = `until it enters ${signName(event.nextSign!)} at ${until!.local}`;
      return last
        ? `The Moon is void of course in ${signName(event.sign)} from ${at.local}, after its last major aspect there (Moon ${ASPECT_VERB[last.aspect] ?? last.aspect} ${last.body}), ${next}.`
        : `The Moon is void of course for its whole time in ${signName(event.sign)}, from ${at.local}, as it makes no major aspect to the Sun through Saturn there, ${next}.`;
    }
  }
}

/** What the ingress table covers for a planet: its group's horizon, as the table states it. */
function ingressHorizon(planet: SkyEventPlanet): { from: string; to: string } {
  const horizon = ingressTable.horizons.find((entry) => entry.planets.includes(planet));
  if (!horizon) throw new Error(`The ingress table has no horizon for ${planet}.`);
  return { from: horizon.from, to: horizon.to };
}

/** Every sign change of a planet in the ingress table: each closed window's start, and the last window's end. */
function ingressesOf(planet: SkyEventPlanet, rows: ReturnType<typeof positionsMemo>): Raw[] {
  const own = INGRESS_WINDOWS.filter((window) => window.planet === planet).sort((a, b) => a.from.localeCompare(b.from));
  const out: Raw[] = own.map((window, index) => {
    const previous = own[index - 1]?.sign;
    // A planet that enters the sign before the one it was in is moving backward: a retrograde re-entry.
    const retrograde = previous !== undefined
      ? SIGNS.findIndex((sign) => sign.slug === window.sign) === (SIGNS.findIndex((sign) => sign.slug === previous) + 11) % 12
      : signAfter(rows, planet, new Date(window.from)).retrograde;
    return { kind: 'ingress', at: new Date(window.from), planet, sign: window.sign, extra: { retrograde } };
  });
  const last = own.at(-1);
  if (last) {
    const entered = signAfter(rows, planet, new Date(last.to));
    out.push({ kind: 'ingress', at: new Date(last.to), planet, sign: entered.sign, extra: { retrograde: entered.retrograde } });
  }
  return out;
}

const listWords = (items: string[]) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export async function searchSkyEvents(args: SkyEventsInput, clock: SkyEventsClock, options: SkyEventsOptions): Promise<{ data: SkyEventsData; links: { title: string; url: string }[] } | { refused: 'rate-limited' | 'rate-limit-unavailable' }> {
  const { zone, zoneSource, origin } = options;
  const planets = args.planets ? SKY_EVENT_PLANETS.filter((planet) => args.planets!.includes(planet)) : null;
  const kinds = args.kinds ? SKY_EVENT_KINDS.filter((kind) => args.kinds!.includes(kind)) : planets ? (['station', 'ingress'] as SkyEventKind[]) : [...DEFAULT_SKY_EVENT_KINDS];
  const voids = kinds.includes('void-of-course');
  const from = args.from ?? options.today;
  if (!isRealDate(from)) throw new RangeError('from must be a real date, such as 2027-01-01.');
  const to = args.to ?? (voids ? addDays(from, 6) : addDays(yearsLater(from, 1), -1));
  if (!isRealDate(to)) throw new RangeError('to must be a real date, such as 2027-12-31.');
  if (to < from) throw new RangeError('to must be the same day as from or later.');
  if (to > yearsLater(from, SKY_EVENTS_MAX_YEARS)) throw new RangeError('to must be at most two years after from. Search a longer span in parts.');
  if (voids && daysBetween(from, to) + 1 > VOID_OF_COURSE_MAX_DAYS) throw new RangeError(`Void-of-course Moon periods are searched up to ${VOID_OF_COURSE_MAX_DAYS} days at a time: give a to at most 30 days after from, or ask for them on their own.`);
  const limit = args.limit ?? SKY_EVENTS_DEFAULT_LIMIT;

  // The window runs from the first day's midnight to the midnight after the last day, on the person's clock.
  const midnight = async (day: string) => { await clock.prepareLocalTime(day, zone); return clock.resolveLocalToUtc(day, '00:00', zone).utc; };
  const start = await midnight(from);
  const end = await midnight(addDays(to, 1));
  const inside = (at: Date) => at.getTime() >= start.getTime() && at.getTime() < end.getTime();

  const searches = kinds.some((kind) => kind === 'station' || kind === 'new-moon' || kind === 'full-moon' || kind === 'void-of-course');
  if (searches && options.allowEvents) {
    const verdict = await options.allowEvents();
    if (verdict !== 'allowed') return { refused: verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable' };
  }

  const rows = positionsMemo();
  const raw: Raw[] = [];
  const notes: string[] = [];
  for (const eclipse of ECLIPSES) {
    const kind: SkyEventKind = eclipse.type === 'solar' ? 'solar-eclipse' : 'lunar-eclipse';
    const at = new Date(eclipse.peak);
    if (inside(at)) raw.push({ kind, at, sign: eclipse.sign, lon: eclipse.lon, type: eclipse.kind, extra: { ...(eclipse.totalMinutes ? { totalMinutes: eclipse.totalMinutes } : {}) } });
  }
  const eclipseKinds = kinds.filter((kind) => kind === 'solar-eclipse' || kind === 'lunar-eclipse');
  if (eclipseKinds.length && (start.toISOString() < eclipseTable.from || end.toISOString() > eclipseTable.to)) {
    notes.push(`Eclipses are listed from ${longDay(eclipseTable.from.slice(0, 10))} to ${longDay(addDays(eclipseTable.to.slice(0, 10), -1))}, the years the eclipse table covers.`);
  }
  if (kinds.includes('ingress')) {
    const outside: string[] = [];
    for (const planet of planets ?? SKY_EVENT_PLANETS) {
      for (const ingress of ingressesOf(planet, rows)) if (inside(ingress.at)) raw.push(ingress);
      const horizon = ingressHorizon(planet);
      if (from < horizon.from || to >= horizon.to) outside.push(planet === 'Sun' ? 'the Sun' : planet);
    }
    if (outside.length) {
      const spans = ingressTable.horizons
        .filter((horizon) => horizon.planets.some((planet) => outside.includes(planet === 'Sun' ? 'the Sun' : planet)))
        .map((horizon) => `${listWords(horizon.planets.map((planet) => (planet === 'Sun' ? 'the Sun' : planet)))} from ${longDay(horizon.from)} to ${longDay(addDays(horizon.to, -1))}`);
      notes.push(`Sign changes come from the ingress table, which covers ${listWords(spans)}; outside those dates none are listed.`);
    }
  }
  const budget = new SampleBudget('events.samples');
  if (kinds.includes('station')) {
    for (const body of STATION_BODIES) {
      if (planets && !planets.includes(body)) continue;
      for (const crossing of stationCrossings(body, start, end, budget, rows)) {
        const lon = rowOf(rows(crossing.at), body).lon;
        raw.push({ kind: 'station', at: crossing.at, planet: body, sign: SIGNS[signIndexForLongitude(lon)].slug, lon, type: crossing.retrograde ? 'retrograde' : 'direct' });
      }
    }
  }
  for (const [kind, phase] of [['new-moon', PHASES.new], ['full-moon', PHASES.full]] as const) {
    if (!kinds.includes(kind)) continue;
    for (const crossing of phaseCrossings(phase, start, end, budget)) {
      const lon = rowOf(rows(crossing.at), 'Moon').lon;
      raw.push({ kind, at: crossing.at, sign: SIGNS[signIndexForLongitude(lon)].slug, lon });
    }
  }
  if (voids) {
    // A period ends when the Moon enters the next sign; scanning past the window's end keeps one that begins inside it.
    const periods = voidOfCourseWindows(start, new Date(end.getTime() + 3 * DAY), { bodies: SKY_EVENTS_VOID_BODIES });
    for (const period of periods) {
      if (period.from.getTime() >= end.getTime() || period.to.getTime() <= start.getTime()) continue;
      raw.push({ kind: 'void-of-course', at: period.from, until: period.to, sign: period.sign, nextSign: period.nextSign, extra: { lastAspect: period.lastAspect ? { body: period.lastAspect.body, aspect: period.lastAspect.aspect } : null } });
    }
    notes.push('Void-of-course periods follow the traditional rule: from the Moon\'s last exact major aspect (conjunction, sextile, square, trine or opposition) to the Sun, Mercury, Venus, Mars, Jupiter or Saturn in a sign until it enters the next sign. The calendar page on zodiacs.org also counts Uranus, Neptune and Pluto, so a period there can begin later; both end at the same moment.');
  }

  const wanted = raw.filter((event) => kinds.includes(event.kind))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || SKY_EVENT_KINDS.indexOf(a.kind) - SKY_EVENT_KINDS.indexOf(b.kind) || (a.planet ? SKY_EVENT_PLANETS.indexOf(a.planet) : -1) - (b.planet ? SKY_EVENT_PLANETS.indexOf(b.planet) : -1));
  // A new Moon near a solar eclipse, or a full Moon near a lunar one, is that eclipse: say so on the Moon's line.
  const eclipses = raw.filter((event) => event.kind === 'solar-eclipse' || event.kind === 'lunar-eclipse');
  const eclipseOn = (event: Raw) => eclipses.find((eclipse) => eclipse.kind === (event.kind === 'new-moon' ? 'solar-eclipse' : 'lunar-eclipse') && Math.abs(eclipse.at.getTime() - event.at.getTime()) <= 6 * 3_600_000);
  const events: SkyEvent[] = wanted.slice(0, limit).map((event) => {
    const at = momentOf(event.at, zone, zoneSource);
    const until = event.until ? momentOf(event.until, zone, zoneSource) : null;
    return {
      kind: event.kind,
      title: titleOf(event),
      at,
      until,
      planet: event.planet ?? null,
      sign: event.sign,
      nextSign: event.nextSign ?? null,
      position: event.kind === 'ingress' || event.kind === 'void-of-course' || event.lon === undefined ? null : formatLongitude(event.lon),
      type: event.type ?? null,
      line: lineOf(event, at, until, eclipseOn),
      pageUrl: pageFor(origin, event),
    };
  });
  const truncated = wanted.length > events.length;
  if (truncated) notes.push(`These are the first ${events.length} of ${wanted.length} events; narrow the kinds or planets, shorten the window, or raise limit (at most ${SKY_EVENTS_MAX_LIMIT}) for the rest.`);
  if (!wanted.length) notes.push(`None of these events falls between ${longDay(from)} and ${longDay(to)}.`);
  if (zoneSource === 'default') notes.push('Days and times are in UTC because no time zone was given.');

  const data: SkyEventsData = {
    from, to, zone, zoneSource, kinds, planets, events,
    total: wanted.length,
    truncated,
    conventions: voids ? SKY_EVENTS_VOID_CONVENTION_IDS.map((id) => ({ id, url: conventionAddress(id) })) : [],
    message: notes.length ? notes.join(' ') : null,
    note: SKY_EVENTS_NOTE,
  };
  const links = [
    { title: 'Sky events on Zodiacs', url: `${origin}/events/` },
    ...(eclipseKinds.length ? [{ title: 'Eclipses', url: `${origin}/eclipses/` }] : []),
    ...(kinds.includes('station') ? [{ title: 'Retrogrades', url: `${origin}/retrogrades/` }] : []),
    ...(voids ? [{ title: 'Void-of-course Moon calendar', url: `${origin}/void-of-course-moon/` }] : []),
    { title: 'What changes in the sky over the next days or weeks (get_upcoming_events)', url: `${origin}/today/` },
    { title: 'Follow eclipses, retrogrades and Moons in a calendar app (get_sky_calendar)', url: `${origin}/sky-calendar/` },
    { title: 'How we calculate', url: `${origin}/methodology/` },
  ];
  return { data, links };
}

/** The bodies whose aspects end a void-of-course period here, as the engine names them. */
export const SKY_EVENTS_VOID_BODY_NAMES: readonly string[] = VOID_BODIES[SKY_EVENTS_VOID_BODIES];
