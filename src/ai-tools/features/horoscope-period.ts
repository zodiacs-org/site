/**
 * get_horoscope_period: Sun-sign horoscopes for a month, a year or a week,
 * from the readings the site publishes, with the period's sky for the sign.
 *
 * - month: the published monthly reading (src/content/horoscopes, the
 *   /horoscopes/{sign}/monthly/ page's text, as src/data/horoscope-months.json),
 *   served from the month's first day as the page is.
 * - year: the yearly reading the horoscope program publishes
 *   (src/data/horoscope-program.json, the /horoscopes/{sign}/2027/ page).
 * - week: the weekly reading get_horoscope gives (the horoscope window), and
 *   for love or career that focus's daily readings in the same week.
 *
 * Alongside the reading, the period's sky: planets changing sign, turning
 * retrograde or direct, new and full Moons and eclipses, each placed in the
 * sign's whole-sign solar house with the daily horoscope's house wording
 * (src/lib/daily.ts HOUSE_THEME). For love or career the sky keeps the events
 * that bear on that focus. The sky comes from the compute API's event search
 * (months and weeks) and the committed ingress and eclipse tables (years);
 * nothing is invented when a reading is not published, and the answer says so.
 */
import { z } from 'zod';
import eclipseTable from '../../data/eclipses.json';
import ingressTable from '../../data/ingresses.json';
import { computeEvents } from '../../lib/compute-api/endpoints';
import { parseEventsRequest } from '../../lib/compute-api/validate';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { HOUSE_THEME, solarHouse } from '../../lib/daily';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';
import { HOROSCOPE_DISCLOSURE, HOROSCOPE_FOCUSES, HOROSCOPE_SIGNS, resolveHoroscope, type HoroscopeFocus } from '../horoscope/reading';
import type { HoroscopeWindow } from '../horoscope/window';

const DAY = 86_400_000;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const HOROSCOPE_PERIOD_KINDS = ['month', 'year', 'week'] as const;
/** The planets whose sign changes a year's sky lists: the slow ones, whose changes set a year's tone. */
const YEAR_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
/** Which events bear on a focus: the planets that rule it, and the solar houses it lives in. */
const FOCUS_RULE: Record<Exclude<HoroscopeFocus, 'general'>, { planets: string[]; houses: number[]; words: string }> = {
  love: { planets: ['Venus', 'Mars'], houses: [5, 7, 8], words: 'Venus and Mars, and events in your fifth, seventh and eighth solar houses (romance, partners and intimacy)' },
  career: { planets: ['Saturn', 'Jupiter', 'Mars'], houses: [6, 10, 11], words: 'Saturn, Jupiter and Mars, and events in your sixth, tenth and eleventh solar houses (daily work, career and long-term plans)' },
};

export interface HoroscopeMonths {
  months: Record<string, Record<string, { published: string; updated: string; paragraphs: string[] }>>;
}

export const horoscopePeriodInput = z.strictObject({
  sign: z.enum(HOROSCOPE_SIGNS).describe('Sun sign. Never guess it; ask the person if they have not said.'),
  period: z.enum(HOROSCOPE_PERIOD_KINDS).describe('month, year or week.'),
  focus: z.enum(HOROSCOPE_FOCUSES).optional().describe('general (the default), love or career. For a week it adds that focus\'s daily readings; for every period it keeps the sky events that bear on it.'),
  date: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/).optional().describe("Any day in the month, year or week wanted, such as 2026-12-01 for December 2026. Leave it out for the person's current month, year or week."),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional().describe("The person's time zone, such as America/New_York, so the period and dates are their own. Without it, UTC."),
});
export type HoroscopePeriodInput = z.infer<typeof horoscopePeriodInput>;

const paragraph = z.object({ heading: z.string().optional(), text: z.string() });
export const horoscopePeriodData = z.object({
  status: z.enum(['available', 'sky-only']),
  sign: z.enum(HOROSCOPE_SIGNS),
  signName: z.string(),
  period: z.enum(HOROSCOPE_PERIOD_KINDS),
  focus: z.enum(HOROSCOPE_FOCUSES),
  /** The period's first and last day on the person's clock, and its name. */
  from: z.string(),
  to: z.string(),
  label: z.string(),
  zone: z.string(),
  /** The published reading for the period; null when none is published, and message says why. */
  reading: z.object({ title: z.string(), paragraphs: z.array(paragraph), published: z.string().nullable() }).nullable(),
  /** For a week with love or career: that focus's daily readings published for days in the week. */
  focusReadings: z.array(z.object({ date: z.string(), title: z.string(), paragraphs: z.array(paragraph) })),
  /** The period's sky for the sign: dated events in the sign's solar houses, soonest first. */
  sky: z.array(z.object({
    date: z.string(),
    utc: z.string(),
    kind: z.enum(['ingress', 'station', 'lunation', 'eclipse']),
    planet: z.string(),
    sign: z.string(),
    house: z.number().int().min(1).max(12),
    line: z.string(),
  })),
  message: z.string().nullable(),
  /** What else is published: monthly readings by month and yearly readings by year. */
  available: z.object({ months: z.array(z.string()), years: z.array(z.number().int()) }),
  pageUrl: z.url(),
  disclosure: z.string(),
});
export type HoroscopePeriodData = z.infer<typeof horoscopePeriodData>;

export interface HoroscopePeriodSources {
  window: () => Promise<HoroscopeWindow>;
  months: () => Promise<HoroscopeMonths>;
  program: () => Promise<HoroscopeProgram>;
  /** Hosted event-search admission, as get_upcoming_events uses it. */
  allowEvents?: () => Promise<'allowed' | 'limited' | 'unavailable'>;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const shortDay = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** "Tue 3 Nov" on a zone's clock, built from parts as the other tools do. */
function dayOn(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

/** One sky event in the sign's solar house, in the daily horoscope's house wording. */
function skyLine(kind: string, planet: string, type: string | undefined, sign: string, house: number, day: string): string {
  const where = `your ${ORDINAL[house]} solar house, ${HOUSE_THEME[house]}`;
  if (kind === 'ingress') return `${planet} enters ${cap(sign)} on ${day}, moving into ${where}.`;
  if (kind === 'station') return `${planet} turns ${type} in ${cap(sign)} on ${day}, in ${where}: ${type === 'retrograde' ? 'a time for revisions there' : 'forward motion returns there'}.`;
  if (kind === 'lunation') return `${type === 'new' ? 'New' : 'Full'} Moon in ${cap(sign)} on ${day}, in ${where}: ${type === 'new' ? 'a clean line to start something' : 'something comes due'}.`;
  return `${cap(type ?? '')} eclipse in ${cap(sign)} on ${day}, in ${where}: a marker the year turns on.`;
}

export async function getHoroscopePeriod(
  args: HoroscopePeriodInput,
  today: string,
  zone: string,
  clock: Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>,
  sources: HoroscopePeriodSources,
  origin: string,
): Promise<{ data: HoroscopePeriodData; links: { title: string; url: string }[] } | { refused: 'rate-limited' | 'rate-limit-unavailable' }> {
  const focus = args.focus ?? 'general';
  const date = args.date ?? today;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new RangeError('date must be a real date, such as 2026-12-01.');
  const sign = args.sign;
  const signName = cap(sign);
  const months = await sources.months();
  // A month written ahead is served from its first day, as the monthly page is.
  const servedMonths = Object.keys(months.months).filter((month) => month <= today.slice(0, 7)).sort();
  const program = args.period === 'year' ? await sources.program() : null;
  const years = program ? Object.keys(program.signs[0]?.readings ?? {}).map((surface) => /^yearly-(\d{4})$/u.exec(surface)?.[1]).filter((year): year is string => !!year).map(Number) : [2027];
  const start = async (day: string) => { await clock.prepareLocalTime(day, zone); return clock.resolveLocalToUtc(day, '00:00', zone).utc; };

  let from: string;
  let to: string;
  let label: string;
  if (args.period === 'month') { from = `${date.slice(0, 7)}-01`; to = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1); label = monthLabel(from); }
  else if (args.period === 'year') { from = `${date.slice(0, 4)}-01-01`; to = `${date.slice(0, 4)}-12-31`; label = date.slice(0, 4); }
  else {
    // The week runs Monday to Sunday, as the published weekly readings do.
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    from = addDays(date, -weekday); to = addDays(from, 6); label = `Week of ${shortDay(from)}`;
  }
  const fromUtc = await start(from);
  const toUtc = await start(addDays(to, 1));

  let reading: HoroscopePeriodData['reading'] = null;
  const focusReadings: HoroscopePeriodData['focusReadings'] = [];
  const notes: string[] = [];
  let pageUrl = `${origin}/horoscopes/${sign}/`;
  if (args.period === 'month') {
    const month = from.slice(0, 7);
    const entry = servedMonths.includes(month) ? months.months[month][sign] : undefined;
    if (entry) {
      reading = { title: `${signName} · ${label}`, paragraphs: entry.paragraphs.map((text) => ({ text })), published: entry.published };
      if (month === servedMonths.at(-1)) pageUrl = `${origin}/horoscopes/${sign}/monthly/`;
    } else notes.push(month > today.slice(0, 7)
      ? `The ${label} reading for ${signName} isn't published yet; monthly readings appear on the first of the month.`
      : `Zodiacs has no published ${label} reading for ${signName} to give here.`);
  } else if (args.period === 'year') {
    const yearly = program!.signs.find((entry) => entry.sign === sign)?.readings[`yearly-${label}` as keyof HoroscopeProgram['signs'][number]['readings']];
    if (yearly && yearly.status === 'publishable') {
      reading = { title: yearly.title, paragraphs: yearly.passages.map((passage) => (passage.heading ? { heading: passage.heading, text: passage.text } : { text: passage.text })), published: null };
      pageUrl = `${origin}/horoscopes/${sign}/${label}/`;
    } else notes.push(`Zodiacs publishes the yearly reading for ${years.join(' and ')}; there is none for ${label}.`);
  } else {
    const window = await sources.window();
    const weekly = resolveHoroscope(window, { sign, period: 'week', focus: 'general', date }, zone, 'request', today);
    if (weekly.status === 'available' && weekly.reading) {
      // The window's own title writes the week as a range with a dash; the label here has none.
      reading = { title: `${signName} · ${label}`, paragraphs: weekly.reading.paragraphs, published: null };
      pageUrl = `${origin}/horoscopes/${sign}/weekly/`;
    } else notes.push(`The weekly reading for ${label} isn't kept here; Zodiacs keeps the current week's.`);
    if (focus !== 'general') {
      for (const edition of window.editions.filter((candidate) => candidate.anchorDate >= from && candidate.anchorDate <= to)) {
        const daily = resolveHoroscope(window, { sign, period: 'day', focus, date: edition.anchorDate }, zone, 'request', today);
        if (daily.status === 'available' && daily.reading) focusReadings.push({ date: edition.anchorDate, title: daily.reading.title, paragraphs: daily.reading.paragraphs });
      }
      notes.push(focusReadings.length
        ? `Zodiacs writes ${focus} readings by the day; these are the ones published for days in this week.`
        : `Zodiacs writes ${focus} readings by the day, and none is kept for days in this week.`);
      pageUrl = `${origin}/horoscopes/${sign}/${focus}/`;
    }
  }

  // The sky: the compute API's event search for a month or week, the committed tables for a year.
  type Raw = { kind: 'ingress' | 'station' | 'lunation' | 'eclipse'; at: string; planet: string; sign: string; type?: string };
  let raw: Raw[] = [];
  if (args.period === 'year') {
    raw = (ingressTable.windows as { planet: string; sign: string; from: string }[])
      .filter((window) => YEAR_PLANETS.includes(window.planet) && window.from >= fromUtc.toISOString() && window.from < toUtc.toISOString())
      .map((window) => ({ kind: 'ingress' as const, at: window.from, planet: window.planet, sign: window.sign }));
    const yearsCovered = ingressTable.horizons.filter((horizon) => horizon.planets.some((planet) => YEAR_PLANETS.includes(planet)));
    if (yearsCovered.some((horizon) => to > horizon.to || from < horizon.from)) notes.push('Sign changes are listed only within the years the ingress table covers.');
  } else {
    if (sources.allowEvents) {
      const verdict = await sources.allowEvents();
      if (verdict !== 'allowed') return { refused: verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable' };
    }
    const calculation = computeEvents(parseEventsRequest({ from: fromUtc.toISOString(), to: toUtc.toISOString() }));
    raw = calculation.result.events.map((event: { kind: 'ingress' | 'station' | 'lunation'; at: string; body?: string; sign: string; type?: string }) => ({
      kind: event.kind, at: event.at, planet: event.kind === 'lunation' ? 'Moon' : event.body!, sign: event.sign, ...(event.type ? { type: event.type } : {}),
    }));
  }
  const eclipses = (eclipseTable.eclipses as { type: string; peak: string; sign: string }[])
    .filter((eclipse) => eclipse.peak >= fromUtc.toISOString() && eclipse.peak < toUtc.toISOString())
    .map((eclipse) => ({ kind: 'eclipse' as const, at: eclipse.peak, planet: eclipse.type === 'solar' ? 'Sun' : 'Moon', sign: eclipse.sign, type: eclipse.type }));
  if (to > eclipseTable.to.slice(0, 10) || from < eclipseTable.from.slice(0, 10)) notes.push('Eclipses are listed for 2026 to 2030, the years the eclipse table covers.');
  let sky = [...raw, ...eclipses].sort((a, b) => a.at.localeCompare(b.at)).map((event) => {
    const house = solarHouse(event.sign, sign);
    const day = dayOn(event.at, zone);
    return { date: day, utc: event.at, kind: event.kind, planet: event.planet, sign: event.sign, house, line: skyLine(event.kind, event.planet, event.type, event.sign, house, day) };
  });
  if (focus !== 'general') {
    const rule = FOCUS_RULE[focus];
    sky = sky.filter((event) => rule.planets.includes(event.planet) || rule.houses.includes(event.house));
    notes.push(`For ${focus}, the sky keeps ${rule.words}.`);
  }
  if (args.period !== 'week' && focus !== 'general' && reading) notes.push(`The ${args.period === 'month' ? 'monthly' : 'yearly'} reading itself is written for the whole sign, not only ${focus}.`);

  const data: HoroscopePeriodData = {
    status: reading || focusReadings.length ? 'available' : 'sky-only',
    sign, signName, period: args.period, focus, from, to, label, zone,
    reading, focusReadings, sky,
    message: notes.length ? notes.join(' ') : null,
    available: { months: servedMonths, years },
    pageUrl,
    disclosure: HOROSCOPE_DISCLOSURE,
  };
  return { data, links: [{ title: `${signName} horoscopes on Zodiacs`, url: pageUrl }, { title: 'Transits this month', url: `${origin}/transits/` }] };
}
