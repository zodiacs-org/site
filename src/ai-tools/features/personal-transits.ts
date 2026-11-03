/**
 * get_personal_transits: where the moving planets meet one person's birth
 * chart, as dated contacts with the site's own transit sentences.
 *
 * Two modes:
 * - window: every exact major aspect from the planets to the natal planets
 *   (and the rising degree and Midheaven with a birth time and place) between
 *   two dates up to 366 days apart, from the transit scanner the profile and
 *   Chart Studio use (src/lib/engine/transit-scan.ts). The Sun, Mercury,
 *   Venus and Mars are included for windows up to 92 days; longer windows
 *   keep to Jupiter, Saturn, Uranus, Neptune and Pluto.
 * - year-ahead: the profile's year-ahead timeline (src/lib/year-ahead.ts):
 *   Jupiter and Saturn on the Sun, Moon and rising degree, the solar return,
 *   Jupiter and Saturn's exact contacts to Mercury, Venus and Mars, and
 *   Uranus, Neptune and Pluto's to the Sun, Moon (with a birth time),
 *   Mercury, Venus and Mars (from the transit scanner, so a chart without a
 *   birth time still has a full year),
 *   a Saturn return, Jupiter and Saturn changing sign (with the natal house
 *   the sign falls in when the time and place are known) and eclipses near
 *   natal planets, from the committed ingress and eclipse tables.
 *
 * A window never starts before the birth date: there is no chart to meet yet.
 *
 * The words are astrology's reading of each contact, never a guarantee, and
 * nothing here predicts health or money. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import eclipseTable from '../../data/eclipses.json';
import ingressTable from '../../data/ingresses.json';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { computeChart } from '../../lib/engine/full.js';
import { scanTransitContacts, type NatalPoint, type TransitBody } from '../../lib/engine/transit-scan';
import { DEFAULT_TRANSIT_BODIES, SLOW_TRANSIT_BODIES, TRANSIT_BODY_ORDER } from '../../lib/engine/transit-scan-shared';
import { yearScan } from '../../lib/engine/year-scan';
import { wholeSignHouseFromAsc } from '../../lib/daily';
import { NATAL_HOUSE_THEME } from '../../lib/natal';
import { transitLine } from '../../lib/transits';
import type { EclipseRecord } from '../../lib/upcoming';
import { aspectEvents, assembleYearAhead, eclipseEvents, ingressEvents, saturnSeasonEvents, solarReturnEvents, type IngressWindow, type YearAheadEvent } from '../../lib/year-ahead';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';

const DAY = 86_400_000;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
export const TRANSITS_MAX_DAYS = 366;
export const TRANSITS_DEFAULT_DAYS = 30;
/** Up to this many days, the Sun, Mercury, Venus and Mars are scanned too. */
export const TRANSITS_PERSONAL_DAYS = 92;
export const TRANSITS_LIMIT = 60;
export const TRANSITS_NOTE = 'Astrology’s reading of the sky meeting your birth chart, for reflection: not a guarantee, and not a forecast of health or money.';
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);
export const personalTransitsInput = z.strictObject({
  birthDate: z.string().regex(DATE).describe('The birth date, such as 1990-05-03 (years 1800 to 2199).'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, only if the person knows it. Never guess it. Needs zone. Without it the Moon, rising degree and Midheaven are left out.'),
  zone: zone.optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time or a place."),
  latitude: z.number().min(-90).max(90).optional().describe("Optional. The birthplace's latitude; with a birth time it adds the rising degree and Midheaven. Give it with longitude and zone. Nothing is stored."),
  longitude: z.number().min(-180).max(180).optional().describe("Optional. The birthplace's longitude, with latitude. Nothing is stored."),
  mode: z.enum(['window', 'year-ahead']).optional().describe('window (the default): every exact contact between from and to. year-ahead: the year from today, with Jupiter and Saturn, the solar return, a Saturn return, sign changes and eclipses near the chart.'),
  from: z.string().regex(DATE).optional().describe('For window: the first day, such as 2026-11-01. Defaults to today.'),
  to: z.string().regex(DATE).optional().describe(`For window: the last day, at most ${TRANSITS_MAX_DAYS} days after from. Defaults to ${TRANSITS_DEFAULT_DAYS} days after from.`),
  currentZone: zone.optional().describe("The person's time zone now, such as Asia/Bangkok, so dates read on their clock. Defaults to the birthplace zone, else UTC."),
}).superRefine((args, context) => {
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
  if (args.mode === 'year-ahead' && (args.from !== undefined || args.to !== undefined)) context.addIssue({ code: 'custom', message: 'year-ahead always starts today; leave out from and to.' });
});
export type PersonalTransitsInput = z.infer<typeof personalTransitsInput>;

const transitBody = z.enum(TRANSIT_BODY_ORDER);
const natalPoint = z.enum([...TRANSIT_BODY_ORDER, 'ASC', 'MC']);
export const personalTransitsData = z.object({
  mode: z.enum(['window', 'year-ahead']),
  birthDate: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  from: z.string(),
  to: z.string(),
  zone: z.string(),
  /** The moving planets scanned and the chart points they were measured against. */
  scanned: z.object({ planets: z.array(transitBody), points: z.array(natalPoint) }),
  /** Window mode: exact contacts, soonest first. */
  contacts: z.array(z.object({
    date: z.string(),
    exactUtc: z.string(),
    planet: transitBody,
    aspect: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
    point: natalPoint,
    /** Which exact pass this is, of how many in the window (a retrograde loop makes three). */
    pass: z.number().int().min(1),
    passCount: z.number().int().min(1),
    title: z.string(),
    line: z.string(),
  })).max(TRANSITS_LIMIT),
  /** Contacts found before the list was cut to its limit. */
  found: z.number().int().min(0),
  /** Year-ahead mode: the timeline, soonest first. */
  highlights: z.array(z.object({
    date: z.string(),
    endDate: z.string().nullable(),
    kind: z.enum(['solar-return', 'aspect', 'ingress', 'eclipse', 'saturn-return']),
    planet: z.string(),
    line: z.string(),
    /** With a birth time and place: the natal house a sign change falls in. */
    house: z.object({ number: z.number().int().min(1).max(12), line: z.string() }).nullable(),
  })),
  /** What the answer leaves out from the details given, and where the tables stop. */
  limits: z.array(z.string()),
  pageUrl: z.url(),
  note: z.literal(TRANSITS_NOTE),
});
export type PersonalTransitsData = z.infer<typeof personalTransitsData>;

export type TransitClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

/** The calendar date of an instant in a zone, as YYYY-MM-DD. */
export function dateIn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
/** "Tue 3 Nov 2026" on the given clock. */
function dayLabel(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}
const POINT_NAME: Partial<Record<NatalPoint, string>> = { ASC: 'rising degree', MC: 'Midheaven' };
const pointName = (point: NatalPoint) => POINT_NAME[point] ?? point;
/** The natal planets year-ahead adds Jupiter and Saturn contacts to, beside the profile timeline's Sun, Moon and rising degree. */
const YEAR_AHEAD_PERSONAL_POINTS: NatalPoint[] = ['Mercury', 'Venus', 'Mars'];
/** The slow planets whose contacts to the personal planets (the Moon only with a birth time) year-ahead adds too. */
const YEAR_AHEAD_OUTER: TransitBody[] = ['Uranus', 'Neptune', 'Pluto'];
const YEAR_AHEAD_PLANETS: TransitBody[] = ['Jupiter', 'Saturn', ...YEAR_AHEAD_OUTER];
const BEFORE_BIRTH = 'The window starts before the birth date; give a from date on or after the birth date.';
const YEAR_BEFORE_BIRTH = 'year-ahead starts today, which is before the birth date.';
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The instant a local date starts on a zone's clock. */
async function startOfDay(date: string, timeZone: string, clock: TransitClock): Promise<Date> {
  await clock.prepareLocalTime(date, timeZone);
  return clock.resolveLocalToUtc(date, '00:00', timeZone).utc;
}

export async function getPersonalTransits(args: PersonalTransitsInput, now: Date, clock: TransitClock, origin: string): Promise<{ data: PersonalTransitsData; links: { title: string; url: string }[] }> {
  const birth = parseCivilDate(args.birthDate);
  if (!birth || birth.year < 1800 || birth.year > 2199) throw new RangeError('birthDate must be a real date from 1800 to 2199.');
  if (args.time !== undefined && !parseCivilTime(args.time)) throw new RangeError('time must be HH:MM, such as 08:30.');
  const timeKnown = args.time !== undefined;
  const placed = args.latitude !== undefined && args.longitude !== undefined;
  let birthUtc: Date;
  if (args.zone) {
    await clock.prepareLocalTime(args.birthDate, args.zone);
    const time = args.time ?? '12:00';
    birthUtc = (args.longitude !== undefined ? clock.resolveLocalToUtc(args.birthDate, time, args.zone, { longitude: args.longitude }) : clock.resolveLocalToUtc(args.birthDate, time, args.zone)).utc;
  } else birthUtc = new Date(`${args.birthDate}T12:00:00Z`);
  const chart = computeChart({ utc: birthUtc, ...(placed ? { latitude: args.latitude, longitude: args.longitude } : {}), houseSystem: 'whole', timeKnown });
  const angles = timeKnown && placed && chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null;
  const shownZone = args.currentZone ?? args.zone ?? 'UTC';
  const today = dateIn(now, shownZone);
  const lon = (body: string) => chart.bodies.find((row) => row.body === body)!.lon;
  const limits: string[] = [];
  if (!timeKnown) limits.push('No birth time was given, so the Moon, the rising degree and the Midheaven are left out; contacts to the other planets can shift by about a day.');
  else if (!placed) limits.push('No birthplace coordinates were given, so the rising degree and the Midheaven are left out.');
  const points: NatalPoint[] = [...TRANSIT_BODY_ORDER.filter((body) => timeKnown || body !== 'Moon'), ...(angles ? ['ASC', 'MC'] as const : [])];
  const pageUrl = `${origin}/transits/`;
  const mode = args.mode ?? 'window';

  if (mode === 'window') {
    const fromDate = args.from ?? today;
    const toDate = args.to ?? new Date(Date.parse(`${fromDate}T00:00:00Z`) + TRANSITS_DEFAULT_DAYS * DAY).toISOString().slice(0, 10);
    if (!parseCivilDate(fromDate) || !parseCivilDate(toDate)) throw new RangeError('from and to must be real dates, such as 2026-11-01.');
    const days = Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY);
    if (days < 0) throw new RangeError('to must be on or after from.');
    if (days > TRANSITS_MAX_DAYS) throw new RangeError(`The window is at most ${TRANSITS_MAX_DAYS} days; to is ${days} days after from.`);
    if (fromDate < args.birthDate) throw new RangeError(BEFORE_BIRTH);
    const fromUtc = await startOfDay(fromDate, shownZone, clock);
    const nextDay = new Date(Date.parse(`${toDate}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
    const toUtc = await startOfDay(nextDay, shownZone, clock);
    const planets: TransitBody[] = days <= TRANSITS_PERSONAL_DAYS ? [...DEFAULT_TRANSIT_BODIES] : [...SLOW_TRANSIT_BODIES];
    if (days > TRANSITS_PERSONAL_DAYS) limits.push(`Windows longer than ${TRANSITS_PERSONAL_DAYS} days list only Jupiter, Saturn, Uranus, Neptune and Pluto; ask for a shorter window for the Sun, Mercury, Venus and Mars.`);
    const natal = { bodies: chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon: at }) => ({ body, lon: at })), angles };
    const found = scanTransitContacts(natal, fromUtc, toUtc, { transitBodies: planets, natalPoints: points })
      .sort((a, b) => a.exactUtc.localeCompare(b.exactUtc));
    if (found.length > TRANSITS_LIMIT) limits.push(`${found.length} contacts were found; the first ${TRANSITS_LIMIT} are listed. Ask for a shorter window for the rest.`);
    const contacts = found.slice(0, TRANSITS_LIMIT).map((contact) => ({
      date: dayLabel(contact.exactUtc, shownZone),
      exactUtc: contact.exactUtc,
      planet: contact.transitBody,
      aspect: contact.aspect,
      point: contact.natalPoint,
      pass: contact.pass,
      passCount: contact.passCount,
      title: `${contact.transitBody} ${contact.aspect} your ${pointName(contact.natalPoint)}`,
      line: transitLine(contact.transitBody, contact.aspect, pointName(contact.natalPoint)),
    }));
    return {
      data: { mode, birthDate: args.birthDate, timeKnown, placed, from: fromDate, to: toDate, zone: shownZone, scanned: { planets, points }, contacts, found: found.length, highlights: [], limits, pageUrl, note: TRANSITS_NOTE },
      links: [{ title: 'Transits on Zodiacs', url: pageUrl }, { title: 'Your birth chart on Zodiacs', url: `${origin}/birth-chart/` }],
    };
  }

  // year-ahead: the twelve months from today on the person's clock.
  if (today < args.birthDate) throw new RangeError(YEAR_BEFORE_BIRTH);
  const fromUtc = await startOfDay(today, shownZone, clock);
  const toUtc = new Date(fromUtc.getTime() + 365 * DAY);
  const scan = yearScan({ sunLon: lon('Sun'), moonLon: timeKnown ? lon('Moon') : null, ascLon: angles ? angles.asc : null, birthUtc }, fromUtc, toUtc);
  const sunSign = SIGNS[signIndexForLongitude(lon('Sun'))].slug;
  const risingSign = angles ? SIGNS[signIndexForLongitude(angles.asc)].slug : null;
  const natalBodies = chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body) && (timeKnown || row.body !== 'Moon')).map(({ body, lon: at }) => ({ body, lon: at }));
  const ingressWindows = (ingressTable.windows as IngressWindow[]);
  const ingresses = ingressEvents(ingressWindows, sunSign, risingSign, fromUtc, toUtc);
  const ingressSign = new Map(ingressWindows.map((window) => [`${window.planet}|${window.from}`, window.sign]));
  const natal = { bodies: chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon: at }) => ({ body, lon: at })), angles: null };
  // Jupiter and Saturn on Mercury, Venus and Mars, and Uranus, Neptune and Pluto on those and the Sun and Moon:
  // one entry per contact, from its first exact pass to its last.
  const outerPoints: NatalPoint[] = ['Sun', ...(timeKnown ? ['Moon' as const] : []), ...YEAR_AHEAD_PERSONAL_POINTS];
  const slowContacts = [
    ...scanTransitContacts(natal, fromUtc, toUtc, { transitBodies: ['Jupiter', 'Saturn'], natalPoints: YEAR_AHEAD_PERSONAL_POINTS }),
    ...scanTransitContacts(natal, fromUtc, toUtc, { transitBodies: YEAR_AHEAD_OUTER, natalPoints: outerPoints }),
  ];
  const personal = new Map<string, { first: string; last: string; planet: TransitBody; aspect: string; point: NatalPoint }>();
  for (const contact of slowContacts.sort((a, b) => a.exactUtc.localeCompare(b.exactUtc))) {
    const key = `${contact.transitBody}|${contact.aspect}|${contact.natalPoint}`;
    const entry = personal.get(key);
    if (entry) entry.last = contact.exactUtc;
    else personal.set(key, { first: contact.exactUtc, last: contact.exactUtc, planet: contact.transitBody, aspect: contact.aspect, point: contact.natalPoint });
  }
  const personalEvents: YearAheadEvent[] = [...personal.values()].map((entry) => ({
    at: entry.first,
    ...(entry.last !== entry.first ? { endAt: entry.last } : {}),
    kind: 'aspect' as const,
    body: entry.planet,
    line: transitLine(entry.planet, entry.aspect, entry.point),
    receipt: `${entry.planet} ${entry.aspect} Natal ${entry.point}`,
  }));
  const events: YearAheadEvent[] = assembleYearAhead([
    solarReturnEvents(scan),
    aspectEvents(scan),
    personalEvents,
    saturnSeasonEvents(scan.saturnSeasons, fromUtc, toUtc),
    ingresses,
    eclipseEvents(eclipseTable.eclipses as EclipseRecord[], natalBodies, fromUtc, toUtc),
  ]);
  const highlights = events.map((event) => {
    // A sign change lands in one natal house when the rising sign is known (whole-sign houses).
    const sign = event.kind === 'ingress' ? ingressSign.get(`${event.body}|${event.at}`) : undefined;
    const number = sign && risingSign ? wholeSignHouseFromAsc(sign, risingSign) : null;
    return {
      date: dayLabel(event.at, shownZone),
      endDate: event.endAt ? dayLabel(event.endAt, shownZone) : null,
      kind: event.kind,
      planet: event.body,
      line: event.line,
      house: number ? { number, line: `In your chart, ${cap(sign!)} is your ${ORDINAL[number]} house: ${NATAL_HOUSE_THEME[number]}.` } : null,
    };
  });
  const toDate = dateIn(new Date(toUtc.getTime() - 1), shownZone);
  const eclipsesEnd = dateIn(new Date(Date.parse(eclipseTable.to) - 1), 'UTC');
  if (toDate > eclipsesEnd) limits.push(`Eclipses are listed up to ${dayLabel(`${eclipsesEnd}T12:00:00Z`, 'UTC')}, where the eclipse table ends.`);
  if (scan.rangeClipped) limits.push('The scan stops at the end of 2199.');
  if (!risingSign) limits.push('Without a birth time and place, sign changes are not placed in your houses.');
  return {
    data: { mode, birthDate: args.birthDate, timeKnown, placed, from: today, to: toDate, zone: shownZone, scanned: { planets: [...YEAR_AHEAD_PLANETS], points: (['Sun', ...(timeKnown ? ['Moon'] : []), ...YEAR_AHEAD_PERSONAL_POINTS, ...(angles ? ['ASC'] : [])] as NatalPoint[]) }, contacts: [], found: 0, highlights, limits, pageUrl, note: TRANSITS_NOTE },
    links: [{ title: 'Transits on Zodiacs', url: pageUrl }, { title: 'Your birth chart on Zodiacs', url: `${origin}/birth-chart/` }],
  };
}
