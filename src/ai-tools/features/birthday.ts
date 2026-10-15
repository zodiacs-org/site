/**
 * Two link-out tools for the Zodiacs MCP: `get_birthday` states the facts the
 * /birthday/{slug}/ page states for a calendar date (sign or cusp, decan,
 * the Sun's degree span) and, with a full birth date, the solar return for a
 * year; `get_sky_calendar` hands over the public sky calendar feed. Neither
 * picks or ranks dates, and neither predicts anything.
 */
import { z } from 'zod';
import birthdays from '../../data/birthdays.json';
import {
  DAYS_IN_MONTH, MONTH_NAMES, birthdaySlug, boundaryDistance, cuspSummary, cuspYearReading,
  decanOrdinal, decanSpan, type BirthdayEntry,
} from '../../lib/birthdays';
import { ComputeApiError } from '../../lib/compute-api/errors';
import { resolveLocal, type LocalTimeModule } from '../../lib/compute-api/local-time';
import { zoneAt } from '../../lib/compute-api/validate';
import { bodyLongitude } from '../../lib/engine/full';
import { solarReturnInstant } from '../../lib/engine/solar-return';
import { CATALOG_LOCALES, type CatalogLocale } from '../../lib/i18n/core';
import { SUN } from '../../lib/interpretations';
import { skyCalendarEvents } from '../../lib/return-visits/sky-calendar';
import { formatLongitude, signBySlug, signForLongitude, type Sign } from '../../lib/signs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DEFAULT_ORIGIN = 'https://zodiacs.org';
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const MIN_YEAR = 1800;
const MAX_YEAR = 2199;

const DAYS = birthdays.days as Record<string, BirthdayEntry>;
const [YEAR_FROM, YEAR_TO] = birthdays.yearRange as [number, number];

// ── get_birthday ───────────────────────────────────────────────────────

const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);

export const birthdayInput = z.strictObject({
  date: z.string().regex(/^\d{2}-\d{2}$/).optional()
    .describe('A birthday without a year, as MM-DD, such as 05-03 for 3 May. This is enough for general birthday facts. Give this or birthDate.'),
  birthDate: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).optional()
    .describe('The full birth date, such as 1997-05-03. Use only for the solar return or to resolve the sign of a cusp date in that birth year.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional()
    .describe('The birth time on the local clock, if known. Needs zone.'),
  zone: zone.optional().describe("The birthplace's time zone, such as Europe/London."),
  longitude: z.number().min(-180).max(180).optional()
    .describe("Use only for historical birth dates when the birthplace used local mean time, to convert its clock to UTC. Needs zone. Do not request coordinates for modern birthdays."),
  year: z.number().int().min(MIN_YEAR + 1).max(MAX_YEAR).optional()
    .describe('The year of the solar return. Defaults to the current year. Needs birthDate.'),
}).superRefine((args, context) => {
  if ((args.date === undefined) === (args.birthDate === undefined)) {
    context.addIssue({ code: 'custom', message: 'Give either date (MM-DD) or birthDate (YYYY-MM-DD), not both.' });
  }
  if (args.birthDate === undefined && (args.time !== undefined || args.zone !== undefined
    || args.longitude !== undefined || args.year !== undefined)) {
    context.addIssue({ code: 'custom', message: 'A time, place or solar return year needs the full birthDate.' });
  }
  if (args.time !== undefined && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time needs its time zone.' });
  if (args.longitude !== undefined && !args.zone) {
    context.addIssue({ code: 'custom', message: 'Historical longitude needs its time zone.' });
  }
});
export type BirthdayInput = z.infer<typeof birthdayInput>;

const clockTime = z.object({ utc: z.string(), local: z.string() });
const signFacts = z.object({
  slug: z.string(), name: z.string(), element: z.string(), modality: z.string(), ruler: z.string(),
  dates: z.string(), meaning: z.string(),
});
export const BIRTHDAY_NOTE = 'Facts about the Sun on this date and their traditional meanings.';

export const birthdayData = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  label: z.string(),
  /** The Sun's noon-UTC degree span on this date across the years the page covers. */
  sunSpan: z.object({ from: z.string(), to: z.string(), years: z.string(), text: z.string() }),
  sign: signFacts.nullable(),
  /** How the sign was settled: the date alone, the birth year's table row, or the computed birth moment. */
  signFrom: z.enum(['date', 'birth-year', 'birth-time']).nullable(),
  boundary: z.object({ nearestDegrees: z.number(), text: z.string() }).nullable(),
  cusp: z.object({
    signs: z.tuple([z.string(), z.string()]),
    wholeDayYears: z.object({ first: z.number(), second: z.number() }),
    splitYears: z.number(),
    ingressUtcRange: z.tuple([z.string(), z.string()]).nullable(),
    summary: z.string(),
    reading: z.union([
      z.object({ year: z.number(), kind: z.literal('whole'), sign: z.string(), text: z.string() }),
      z.object({ year: z.number(), kind: z.literal('split'), before: z.string(), after: z.string(), atUtc: z.string(), text: z.string() }),
    ]).nullable(),
  }).nullable(),
  decan: z.object({
    first: z.number().int().min(1).max(3),
    last: z.number().int().min(1).max(3),
    rulers: z.array(z.string()).min(1).max(2),
    text: z.string(),
  }).nullable(),
  sunAtBirth: z.object({ longitude: z.number(), position: z.string(), timeKnown: z.boolean() }).nullable(),
  pageUrl: z.url(),
  solarReturn: z.object({
    year: z.number().int(),
    instant: clockTime,
    timeKnown: z.boolean(),
    /** Without a birth time: the returns for a birth at the first and last minute of the birth date. */
    range: z.object({ earliest: clockTime, latest: clockTime }).nullable(),
    note: z.string(),
  }).nullable(),
  note: z.literal(BIRTHDAY_NOTE),
});
export type BirthdayData = z.infer<typeof birthdayData>;

export interface ToolLink { title: string; url: string }

/** A computed instant as UTC and as the place's clock reads it (as src/ai-tools/tools.ts writes it). */
function clock(at: Date, timeZone: string | null): z.infer<typeof clockTime> {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone ?? 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map((part) => [part.type, part.value]));
  const local = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  return { utc: at.toISOString(), local: timeZone ? local : `${local} UTC` };
}

function signRow(sign: Sign): z.infer<typeof signFacts> {
  return {
    slug: sign.slug, name: sign.name, element: sign.element, modality: sign.modality, ruler: sign.ruler,
    dates: sign.dates, meaning: SUN[sign.slug],
  };
}

function parseMonthDay(month: number, day: number): void {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= DAYS_IN_MONTH[month - 1])) {
    throw new RangeError('That is not a calendar date. Give a real month and day, such as 05-03 for 3 May.');
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

async function canonicalZone(name: string, localTime: LocalTimeModule): Promise<string> {
  try {
    return await zoneAt(name, '/zone', (value) => localTime.canonicalZoneName(value));
  } catch (error) {
    if (error instanceof ComputeApiError) throw new RangeError(`${name} is not a time zone Zodiacs knows. Use a name such as Europe/London.`);
    throw error;
  }
}

/** The birth instant: the given clock time, local noon with a zone only, or noon UTC. */
async function birthInstant(
  birthDate: string, time: string | null, timeZone: string | null, longitude: number | null, localTime: LocalTimeModule,
): Promise<Date> {
  if (timeZone) return (await resolveLocal(localTime, { date: birthDate, time: time ?? '12:00', zone: timeZone }, longitude)).utc;
  const [year, month, day] = birthDate.split('-').map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  return new Date(utc.getTime() + DAY / 2);
}

export async function getBirthday(
  input: BirthdayInput,
  localTime: LocalTimeModule,
  now: Date,
  origin = DEFAULT_ORIGIN,
): Promise<{ data: BirthdayData; links: ToolLink[] }> {
  const args = birthdayInput.parse(input);
  let month: number;
  let day: number;
  let birthYear: number | null = null;
  if (args.birthDate) {
    [birthYear, month, day] = args.birthDate.split('-').map(Number);
    parseMonthDay(month, day);
    if (month === 2 && day === 29 && !isLeapYear(birthYear)) throw new RangeError(`${birthYear} was not a leap year, so it had no 29 February.`);
    if (birthYear < MIN_YEAR || birthYear > MAX_YEAR) throw new RangeError(`The birth year must be from ${MIN_YEAR} to ${MAX_YEAR}.`);
  } else {
    [month, day] = args.date!.split('-').map(Number);
    parseMonthDay(month, day);
  }

  const slug = birthdaySlug(month, day);
  const entry = DAYS[slug];
  if (!entry) throw new RangeError('That is not a calendar date.');
  const label = `${day} ${MONTH_NAMES[month - 1]}`;
  const pageLabel = `${MONTH_NAMES[month - 1]} ${day}`;
  const years = `${YEAR_FROM}–${YEAR_TO}`;
  const pageUrl = `${origin}/birthday/${slug}/`;

  // ── The birth moment, when a full date is given ──
  let birthUtc: Date | null = null;
  let timeZone: string | null = null;
  let sunAtBirth: BirthdayData['sunAtBirth'] = null;
  const timeKnown = args.time !== undefined;
  if (args.birthDate) {
    timeZone = args.zone ? await canonicalZone(args.zone, localTime) : null;
    birthUtc = await birthInstant(args.birthDate, args.time ?? null, timeZone, args.longitude ?? null, localTime);
    const lon = bodyLongitude('Sun', birthUtc);
    sunAtBirth = { longitude: Math.round(lon * 1e4) / 1e4, position: formatLongitude(lon), timeKnown };
  }

  // ── Facts the birthday page states ──
  const spanFrom = formatLongitude(entry.lonMin);
  const spanTo = formatLongitude(entry.lonMax);
  const sunSpan = {
    from: spanFrom, to: spanTo, years,
    text: `Between ${spanFrom} and ${spanTo} at noon universal time, depending on the year (${years}).`,
  };

  let sign: Sign | null = entry.sign ? signBySlug(entry.sign) : null;
  let signFrom: BirthdayData['signFrom'] = sign ? 'date' : null;
  let boundary: BirthdayData['boundary'] = null;
  let decan: BirthdayData['decan'] = null;
  let cusp: BirthdayData['cusp'] = null;

  if (entry.sign && sign) {
    const dist = boundaryDistance(entry);
    const inLo = ((entry.lonMin % 360) + 360) % 360 % 30;
    const nearPrev = inLo <= 30 - (((entry.lonMax % 360) + 360) % 360 % 30);
    boundary = {
      nearestDegrees: dist,
      text: dist >= 1.5
        ? `Not a cusp date. Across ${years} the Sun sits at least ${dist}° inside ${sign.name} on ${pageLabel}, so the sign never changes with the year.`
        : `Close to the ${nearPrev ? 'previous' : 'next'} sign's boundary, about ${dist}° at the nearest, but on the ${sign.name} side in every year from ${YEAR_FROM} to ${YEAR_TO}.`,
    };
    const span = decanSpan(entry);
    decan = {
      first: span.lo, last: span.hi,
      rulers: span.hiRuler ? [span.ruler, span.hiRuler] : [span.ruler],
      text: span.lo === span.hi
        ? `The ${decanOrdinal(span.lo)} decan of ${sign.name} (${(span.lo - 1) * 10}°–${span.lo * 10}°), whose traditional ruler is ${span.ruler}.`
        : `The date straddles the ${span.lo * 10}° line: depending on the birth year and hour, the Sun falls in the ${decanOrdinal(span.lo)} or ${decanOrdinal(span.hi)} decan of ${sign.name} (traditional rulers ${span.ruler} and ${span.hiRuler}).`,
    };
  } else if (entry.cusp) {
    const summary = cuspSummary(entry.cusp);
    const splitTimes = summary.splitYears.map((s) => s.at).sort();
    let reading: NonNullable<BirthdayData['cusp']>['reading'] = null;
    if (birthYear !== null) {
      const row = cuspYearReading(entry.cusp, birthYear);
      if (row?.kind === 'whole') {
        reading = { year: birthYear, kind: 'whole', sign: row.sign.slug, text: `In ${birthYear} the Sun was in ${row.sign.name} for the whole of ${pageLabel}.` };
        sign = row.sign;
        signFrom = 'birth-year';
      } else if (row?.kind === 'split') {
        reading = {
          year: birthYear, kind: 'split', before: row.before.slug, after: row.after.slug, atUtc: row.atUtc,
          text: `In ${birthYear} the Sun moved from ${row.before.name} into ${row.after.name} at ${row.atUtc} universal time on ${pageLabel}; the birth time decides.`,
        };
      }
      // A birth time settles the sign from the computed degree, whatever the table's row:
      // its rows are UTC dates, and a local date can reach into the next or previous one.
      if (timeKnown && sunAtBirth) {
        sign = signForLongitude(sunAtBirth.longitude);
        signFrom = 'birth-time';
      }
    }
    cusp = {
      signs: [summary.a.slug, summary.b.slug],
      wholeDayYears: { first: summary.wholeA, second: summary.wholeB },
      splitYears: summary.split,
      ingressUtcRange: splitTimes.length > 0 ? [splitTimes[0], splitTimes[splitTimes.length - 1]] : null,
      summary: `${summary.a.name} or ${summary.b.name}: this date sits on the boundary. In ${summary.wholeA} of the years from ${YEAR_FROM} to ${YEAR_TO} the whole day belonged to ${summary.a.name}; in ${summary.wholeB} it belonged to ${summary.b.name}; in ${summary.split} the Sun crossed over during the day${splitTimes.length > 0 ? `, between ${splitTimes[0]} and ${splitTimes[splitTimes.length - 1]} universal time` : ''}.`,
      reading,
    };
  }

  // ── Solar return ──
  let solarReturn: BirthdayData['solarReturn'] = null;
  if (args.birthDate && birthUtc && birthYear !== null && sunAtBirth) {
    const year = args.year ?? Math.max(now.getUTCFullYear(), birthYear + 1);
    if (year <= birthYear) throw new RangeError('The solar return year must be after the birth year.');
    const natalLon = bodyLongitude('Sun', birthUtc);
    // Noon UTC on the birthday in that year (29 February rolls to 1 March in
    // other years); the search takes the crossing nearest it, a day or two away.
    const nearDate = new Date(0);
    nearDate.setUTCFullYear(year, month - 1, day);
    nearDate.setUTCHours(12, 0, 0, 0);
    const instant = solarReturnInstant(natalLon, nearDate);
    let range: NonNullable<BirthdayData['solarReturn']>['range'] = null;
    let note: string;
    if (timeKnown) {
      note = `Computed from the birth time given${timeZone ? ` in ${timeZone}` : ''}. Times read on the birthplace's clock.`;
    } else {
      // The first and last minute of the birth date: on the zone's clock, or anywhere on Earth without one.
      const [first, last] = timeZone
        ? await Promise.all([
          birthInstant(args.birthDate, '00:00', timeZone, args.longitude ?? null, localTime),
          birthInstant(args.birthDate, '23:59', timeZone, args.longitude ?? null, localTime),
        ])
        : [new Date(birthUtc.getTime() - DAY / 2 - 14 * HOUR), new Date(birthUtc.getTime() + DAY / 2 + 12 * HOUR)];
      const earliest = solarReturnInstant(bodyLongitude('Sun', first), nearDate);
      const latest = solarReturnInstant(bodyLongitude('Sun', last), nearDate);
      range = { earliest: clock(earliest, timeZone), latest: clock(latest, timeZone) };
      note = timeZone
        ? `Without a birth time this uses local noon on the birth date. A birth at another hour of that day puts the return between ${range.earliest.local} and ${range.latest.local}.`
        : `Without a birth time or time zone this uses noon UTC on the birth date. A birth at any hour of that date, anywhere, puts the return between ${range.earliest.local} and ${range.latest.local}.`;
    }
    solarReturn = { year, instant: clock(instant, timeZone), timeKnown, range, note };
  }

  const data = birthdayData.parse({
    month, day, label, sunSpan,
    sign: sign ? signRow(sign) : null,
    signFrom,
    boundary, cusp, decan, sunAtBirth, pageUrl, solarReturn,
    note: BIRTHDAY_NOTE,
  });
  const links: ToolLink[] = [{ title: `${label} birthdays on Zodiacs`, url: pageUrl }];
  if (solarReturn) links.push({ title: 'Solar returns on Zodiacs', url: `${origin}/solar-return/` });
  return { data, links };
}

// ── get_sky_calendar ───────────────────────────────────────────────────

export const SKY_CALENDAR_LOCALES = CATALOG_LOCALES;

export const skyCalendarInput = z.strictObject({
  language: z.enum(CATALOG_LOCALES).optional()
    .describe('The language of the event titles: en (the default), es, pt, fr, it or ru.'),
});
export type SkyCalendarInput = z.infer<typeof skyCalendarInput>;

const nextEvent = z.object({ title: z.string(), start: z.string(), end: z.string().nullable() });
export const skyCalendarData = z.object({
  language: z.enum(CATALOG_LOCALES),
  feedUrl: z.url().refine((url) => url.startsWith('https://') && url.endsWith('.ics')),
  subscribeUrl: z.url().refine((url) => url.startsWith('webcal://')),
  pageUrl: z.url(),
  contains: z.array(z.string()).min(1),
  covers: z.object({ from: z.string(), to: z.string() }),
  next: z.array(nextEvent).max(3),
  howTo: z.object({ google: z.string(), apple: z.string(), outlook: z.string() }),
  note: z.string(),
});
export type SkyCalendarData = z.infer<typeof skyCalendarData>;

const PLANET_ORDER = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function listWords(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

const iso = (value: Date | string) => new Date(value).toISOString();

/** What the feed carries, read from the events themselves. */
function feedContents(): { contains: string[]; covers: { from: string; to: string } } {
  const events = skyCalendarEvents('en');
  const has = (prefix: string) => events.some((event) => event.id.startsWith(prefix));
  const planets = [...new Set(events.filter((event) => event.id.includes('-retrograde-')).map((event) => event.id.split('-retrograde-')[0]))]
    .sort((a, b) => (PLANET_ORDER.indexOf(a) + 1 || 99) - (PLANET_ORDER.indexOf(b) + 1 || 99));
  const contains: string[] = [];
  if (has('new-moon-')) contains.push('New moons');
  if (has('full-moon-')) contains.push('Full moons');
  const eclipses = [has('solar-eclipse-') && 'solar', has('lunar-eclipse-') && 'lunar'].filter(Boolean) as string[];
  if (eclipses.length) contains.push(`${eclipses.length === 2 ? 'Solar and lunar' : eclipses[0] === 'solar' ? 'Solar' : 'Lunar'} eclipse peaks (global, not local visibility)`);
  if (planets.length) contains.push(`Retrograde windows for ${listWords(planets)}`);
  const starts = events.map((event) => iso(event.start)).sort();
  const ends = events.map((event) => iso(event.end ?? event.start)).sort();
  return { contains, covers: { from: starts[0], to: ends[ends.length - 1] } };
}

export function getSkyCalendar(
  input: SkyCalendarInput,
  now: Date,
  origin = DEFAULT_ORIGIN,
): { data: SkyCalendarData; links: ToolLink[] } {
  const args = skyCalendarInput.parse(input);
  const language: CatalogLocale = args.language ?? 'en';
  const prefix = language === 'en' ? '' : `/${language}`;
  const feedUrl = `${origin}${prefix}/sky-calendar.ics`;
  const subscribeUrl = feedUrl.replace(/^https?:/, 'webcal:');
  const pageUrl = `${origin}${prefix}/sky-calendar/`;
  const next = skyCalendarEvents(language)
    .map((event) => ({ title: event.summary, start: iso(event.start), end: event.end ? iso(event.end) : null }))
    .filter((event) => Date.parse(event.start) > now.getTime())
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);
  const data = skyCalendarData.parse({
    language, feedUrl, subscribeUrl, pageUrl, ...feedContents(), next,
    howTo: {
      google: `In Google Calendar on the web, next to Other calendars choose + then From URL, and paste ${feedUrl}.`,
      apple: `On an iPhone, iPad or Mac, open ${subscribeUrl}; or in Calendar on a Mac choose File → New Calendar Subscription and paste ${feedUrl}.`,
      outlook: `In Outlook, choose Add calendar → Subscribe from web, and paste ${feedUrl}.`,
    },
    note: 'A public feed of computed sky events; it takes no personal details. Subscribing keeps it up to date, and times show in your calendar\'s time zone.',
  });
  return { data, links: [{ title: 'Sky calendar on Zodiacs', url: pageUrl }] };
}
