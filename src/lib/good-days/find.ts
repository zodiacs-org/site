/**
 * The good day finder: every day in a window of up to a year, read for one
 * goal by the traditional rules of electional astrology (./goals.ts), with the
 * best days ranked and the days to avoid named, each with one plain reason.
 *
 * What it reads, all from the site's own engine and tables:
 * - the Moon's phase and sign at local noon (@zodiacs/engine);
 * - void-of-course Moon periods, under the rule of the site's void-of-course
 *   calendar (src/data/void-of-course.ts): from the Moon's last exact major
 *   aspect to the Sun or a planet through Pluto in a sign until it enters the
 *   next sign. They are rebuilt here from the engine's own Moon aspects and
 *   sign changes, which gives the calendar's periods to the second
 *   (find.test.ts holds the two together) at half the work;
 * - Mercury, Venus and Mars retrograde, and the days they stand still;
 * - eclipses, from src/data/eclipses.json (2026 to 2030);
 * - the Moon's exact aspects through the day to the planets a goal leans on,
 *   and to Mars and Saturn;
 * - optionally, the person's own chart (./personal.ts), for that request only.
 *
 * It ranks days by astrology's traditional reading of them, stated plainly. It
 * makes no price or market call, no medical timing and no prediction of who
 * wins a legal matter. Pure apart from the injected local-time resolver: no network,
 * storage or logging, and nothing it is given leaves the call.
 */
import { moonPhase, positions } from '@zodiacs/engine';
import { moonAspects, moonIngresses } from '@zodiacs/engine/techniques';
import eclipseTable from '../../data/eclipses.json';
import { SIGNS } from '../signs';
import { GOAL_RULES, GOOD_DAYS_NOTE, PARTNERSHIP_GOALS, type GoodDayGoal, type Significator } from './goals';
import { personalFactors, preparePersonal, type BirthDetails, type PersonalChart } from './personal';
import { isUnder13, isUnder18 } from '../../ai-tools/features/reading-guards';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** The longest window, in days, counting both ends: a year. */
export const GOOD_DAYS_MAX_DAYS = 366;
/** The window when none is given: 90 days from today. */
export const GOOD_DAYS_DEFAULT_DAYS = 90;
export const GOOD_DAYS_DEFAULT_COUNT = 5;
export const GOOD_DAYS_MAX_COUNT = 10;
/** How many days to avoid are named, at most. */
export const AVOID_COUNT = 8;
/** The dates the search covers: the years of the eclipse table. */
export const GOOD_DAYS_FIRST = eclipseTable.from.slice(0, 10);
export const GOOD_DAYS_LAST = new Date(Date.parse(eclipseTable.to) - DAY).toISOString().slice(0, 10);
/** The waking hours a void-of-course Moon is weighed over, on the local clock. */
export const WAKING = { from: '08:00', to: '20:00' } as const;

export const UNDER_13_SENTENCE = 'Zodiacs is not directed at children under 13, so it gives no reading from a birth date less than 13 years ago.';
export const UNDER_18_PARTNERSHIP_SENTENCE = 'Zodiacs gives no relationship or wedding timing from a birth date under 18. Leave the birth date out for the general sky, or choose another goal.';

/** The resolver methods the finder calls: src/lib/time/localToUtc.ts on the site, the compute API's on the server. */
export interface GoodDaysClock {
  prepareLocalTime(date: string, timeZone: string): Promise<void>;
  resolveLocalToUtc(date: string, time: string, timeZone: string): { utc: Date };
}

export interface GoodDaysInput {
  goal: GoodDayGoal;
  /** First and last day, YYYY-MM-DD on the person's clock, both included: today and 90 days on when left out. */
  from?: string;
  to?: string;
  /** The person's time zone, as tzdb spells it, or UTC. */
  zone: string;
  /** How many best days to return. */
  count?: number;
  /** The person's own birth details, for this request only. */
  birth?: BirthDetails | null;
  /** Today on the person's clock, for the age rules. */
  today: string;
}

export interface Factor {
  points: number;
  /** One plain sentence. */
  text: string;
  /** The same, as a clause to join into a day's one-line reason. */
  clause: string;
  /** A traditional reason to keep the day clear, whatever else it has. */
  avoid?: boolean;
}

export interface VoidSpan {
  /** Local clock times, with the day named when it is not this one: "14:10" or "Mon 11 Jan, 22:05". */
  from: string;
  to: string;
}

export interface GoodDay {
  date: string;
  /** "Tue 12 Jan 2027". */
  label: string;
  score: number;
  verdict: string;
  /** One plain line: the day's strongest reasons. */
  reason: string;
  /** Every reason found, strongest first. */
  factors: string[];
  /** The void-of-course Moon periods that touch the day's waking hours. */
  voidOfCourse: VoidSpan[];
}

export interface AvoidDay {
  date: string;
  label: string;
  score: number;
  reason: string;
}

export interface GoodDaysPeriod {
  kind: 'mercury-retrograde' | 'venus-retrograde' | 'mars-retrograde' | 'eclipse';
  from: string;
  to: string;
  line: string;
}

export interface GoodDaysResult {
  goal: GoodDayGoal;
  goalLabel: string;
  from: string;
  to: string;
  days: number;
  zone: string;
  best: GoodDay[];
  avoid: AvoidDay[];
  periods: GoodDaysPeriod[];
  /** With birth details: the natal Sun sign (null when the day of birth spans two signs and no time was given) and whether a time was given. */
  personal: { sun: string | null; timeKnown: boolean } | null;
  /** What the reading leaves out or assumes, in plain sentences. */
  messages: string[];
  care: string;
  note: typeof GOOD_DAYS_NOTE;
}

export const GOOD_DAY_VERDICTS = {
  strong: 'A strong day for it',
  good: 'A good day for it',
  mixed: 'A mixed day',
  avoid: 'A day tradition would avoid for it',
} as const;

export function goodDayVerdict(score: number): string {
  if (score >= 80) return GOOD_DAY_VERDICTS.strong;
  if (score >= 66) return GOOD_DAY_VERDICTS.good;
  if (score >= 48) return GOOD_DAY_VERDICTS.mixed;
  return GOOD_DAY_VERDICTS.avoid;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => dateOf(dayNumber(date) + days);
const isRealDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/u.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && dateOf(dayNumber(date)) === date;
/** "Tue 12 Jan 2027". */
export function dayLabel(date: string): string {
  const at = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS_SHORT[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}
/** "12 January 2027". */
export function longDay(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS_LONG[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)?.name ?? cap(slug);
const signOf = (lon: number) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)].slug;

/** The calendar date and the HH:MM of an instant on a zone's clock. */
function localParts(at: Date, zone: string): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(at).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
/** A clock time on the day being read, or with its own day named when it falls on another. */
function clockOn(at: Date, zone: string, date: string): string {
  const local = localParts(at, zone);
  if (local.date === date) return local.time;
  const label = dayLabel(local.date);
  return `${label.slice(0, label.lastIndexOf(' '))}, ${local.time}`;
}

/**
 * Checks a window and fills in its defaults; throws RangeError with a plain sentence for one the finder cannot take.
 */
export function goodDaysWindow(from: string | undefined, to: string | undefined, today: string): { from: string; to: string; days: number } {
  const start = from ?? today;
  if (!isRealDate(start)) throw new RangeError('from must be a real date, such as 2027-01-01.');
  const end = to ?? addDays(start, GOOD_DAYS_DEFAULT_DAYS - 1);
  if (!isRealDate(end)) throw new RangeError('to must be a real date, such as 2027-03-31.');
  if (end < start) throw new RangeError('to must be the same day as from or later.');
  const days = dayNumber(end) - dayNumber(start) + 1;
  if (days > GOOD_DAYS_MAX_DAYS) throw new RangeError(`The window is at most ${GOOD_DAYS_MAX_DAYS} days, about twelve months. Search a longer span in parts.`);
  if (start < GOOD_DAYS_FIRST || end > GOOD_DAYS_LAST) throw new RangeError(`The good day finder covers ${longDay(GOOD_DAYS_FIRST)} to ${longDay(GOOD_DAYS_LAST)}, the years its eclipse table covers. Choose dates inside them.`);
  return { from: start, to: end, days };
}

type EclipseRow = { type: 'solar' | 'lunar'; kind: string; peak: string; sign: string };
const ECLIPSES = (eclipseTable.eclipses as EclipseRow[]).map((row) => ({ ...row, at: Date.parse(row.peak) }));
const ASPECT_VERB: Record<string, string> = { conjunction: 'meets', sextile: 'sextiles', square: 'squares', trine: 'trines', opposition: 'opposes' };
const HARMONIOUS = new Set(['conjunction', 'sextile', 'trine']);
const bodyName = (body: string) => (body === 'Sun' ? 'the Sun' : body);
const RETROGRADE_LINE: Record<Significator, string> = {
  Mercury: 'Mercury is retrograde, which tradition reads as delays and second thoughts in plans, messages and paperwork.',
  Venus: 'Venus is retrograde, astrology’s traditional caution against new commitments of the heart.',
  Mars: 'Mars is retrograde, which tradition reads as a time to hold back on decisive moves.',
};
const SIGNIFICATORS: readonly Significator[] = ['Mercury', 'Venus', 'Mars'];

/** One void-of-course period: from the Moon's last exact aspect in a sign (or its entry, with none) to its next sign. */
interface VoidPeriod { from: Date; to: Date; sign: string; nextSign: string }

/**
 * The void-of-course periods whose ending ingress falls in (from, to], as src/data/void-of-course.ts gives them: the
 * same engine aspects and sign changes, under the same rule (the default modern bodies, Sun through Pluto).
 */
export function voidPeriods(from: Date, to: Date): VoidPeriod[] {
  // The Moon spends at most about two and a half days in a sign, so four days back finds the sign it is in at `from`.
  const lead = new Date(from.getTime() - 4 * DAY);
  const ingresses = moonIngresses(lead, to);
  const aspects = moonAspects(lead, to);
  const out: VoidPeriod[] = [];
  let cursor = 0;
  for (let index = 1; index < ingresses.length; index += 1) {
    const previous = ingresses[index - 1];
    const current = ingresses[index];
    let last: Date | null = null;
    while (cursor < aspects.length && aspects[cursor].at.getTime() < current.at.getTime()) {
      if (aspects[cursor].at.getTime() > previous.at.getTime()) last = aspects[cursor].at;
      cursor += 1;
    }
    if (current.at.getTime() <= from.getTime() || current.at.getTime() > to.getTime()) continue;
    out.push({ from: last ?? previous.at, to: current.at, sign: previous.sign, nextSign: current.sign });
  }
  return out;
}

interface DaySky {
  date: string;
  start: Date;
  end: Date;
  noon: Date;
  wakeFrom: Date;
  wakeTo: Date;
  moonSign: string;
  phaseAngle: number;
  litPercent: number;
  retrograde: Record<Significator, boolean>;
  /** A significator that stands still inside the day, with the way it turns. */
  stations: { planet: Significator; turns: 'retrograde' | 'direct' }[];
}

const retroFlags = (at: Date): Record<Significator, boolean> => {
  const rows = positions(at);
  return Object.fromEntries(SIGNIFICATORS.map((planet) => [planet, rows.find((row) => row.body === planet)!.speed < 0])) as Record<Significator, boolean>;
};

/** The sky of every day in the window, on the person's clock. */
async function daySkies(from: string, days: number, zone: string, clock: GoodDaysClock): Promise<DaySky[]> {
  const at = async (date: string, time: string) => { await clock.prepareLocalTime(date, zone); return clock.resolveLocalToUtc(date, time, zone).utc; };
  const out: DaySky[] = [];
  let start = await at(from, '00:00');
  let startFlags = retroFlags(start);
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const end = await at(addDays(date, 1), '00:00');
    const endFlags = retroFlags(end);
    const noon = await at(date, '12:00');
    const rows = positions(noon);
    const phase = moonPhase(noon);
    out.push({
      date, start, end, noon,
      wakeFrom: await at(date, WAKING.from),
      wakeTo: await at(date, WAKING.to),
      moonSign: signOf(rows.find((row) => row.body === 'Moon')!.lon),
      phaseAngle: phase.angle,
      litPercent: Math.round(phase.illumination * 100),
      retrograde: Object.fromEntries(SIGNIFICATORS.map((planet) => [planet, rows.find((row) => row.body === planet)!.speed < 0])) as Record<Significator, boolean>,
      stations: SIGNIFICATORS.filter((planet) => startFlags[planet] !== endFlags[planet]).map((planet) => ({ planet, turns: endFlags[planet] ? 'retrograde' as const : 'direct' as const })),
    });
    start = end;
    startFlags = endFlags;
  }
  return out;
}

type MoonPhaseBand = 'dark' | 'waxing' | 'full' | 'waning';
/** The dark Moon runs from 30° before the new Moon to 12° after it; the full Moon 12° either side of 180°. */
export function phaseBand(angle: number): MoonPhaseBand {
  if (angle >= 330 || angle < 12) return 'dark';
  if (angle < 168) return 'waxing';
  if (angle < 192) return 'full';
  return 'waning';
}

function phaseFactor(goal: GoodDayGoal, day: DaySky): Factor | null {
  const rule = GOAL_RULES[goal];
  const band = phaseBand(day.phaseAngle);
  const lit = `${day.litPercent}% lit`;
  if (band === 'full') {
    if (rule.fullMoon > 0) return { points: rule.fullMoon, text: 'The Moon is full, a bright night to celebrate under.', clause: 'a full Moon to celebrate under' };
    if (rule.fullMoon < 0) return { points: rule.fullMoon, text: `The Moon is full, a phase tradition sets aside ${rule.forWhat}.`, clause: 'a full Moon' };
    return null;
  }
  if (rule.phase === 'waxing') {
    if (band === 'waxing') return { points: 8, text: `The Moon is waxing (${lit}), the phase tradition prefers for a beginning.`, clause: `a waxing Moon (${lit})` };
    if (band === 'dark') return { points: -8, text: 'The Moon is dark, around the new Moon: tradition waits for the first crescent before a beginning.', clause: 'a dark Moon' };
    return { points: -5, text: `The Moon is waning (${lit}): tradition saves it for finishing rather than starting.`, clause: `a waning Moon (${lit})` };
  }
  if (band === 'waning') return { points: 8, text: `The Moon is waning (${lit}), the phase tradition prefers ${rule.forWhat}.`, clause: `a waning Moon (${lit})` };
  if (band === 'waxing') return { points: -4, text: `The Moon is waxing (${lit}); tradition prefers a waning Moon ${rule.forWhat}.`, clause: `a waxing Moon (${lit})` };
  return null;
}

function moonSignFactor(goal: GoodDayGoal, sign: string): Factor | null {
  const rule = GOAL_RULES[goal];
  const name = signName(sign);
  if (rule.moonGood.includes(sign)) return { points: 8, text: `The Moon is in ${name}, a sign ${rule.moonWhy}.`, clause: `the Moon in ${name}` };
  if (rule.moonPoor.includes(sign)) return { points: -6, text: `The Moon is in ${name}, a sign tradition sets aside ${rule.forWhat}.`, clause: `the Moon in ${name}` };
  return null;
}

function eclipseFactor(day: DaySky): Factor | null {
  const within = ECLIPSES.filter((row) => row.at >= day.start.getTime() && row.at < day.end.getTime());
  const describe = (row: EclipseRow) => `${row.kind === 'annular' ? 'an' : 'a'} ${row.kind} ${row.type} eclipse in ${signName(row.sign)}`;
  if (within.length) {
    return { points: -30, avoid: true, text: `${cap(describe(within[0]))} falls today: tradition keeps important beginnings away from eclipses.`, clause: `${describe(within[0])} today` };
  }
  const near = ECLIPSES
    .map((row) => ({ row, gap: Math.round(Math.abs(row.at - day.noon.getTime()) / DAY) }))
    .filter(({ gap }) => gap >= 1 && gap <= 3)
    .sort((a, b) => a.gap - b.gap)[0];
  if (!near) return null;
  const when = near.row.at > day.noon.getTime() ? `${near.gap} ${near.gap === 1 ? 'day' : 'days'} away` : `${near.gap} ${near.gap === 1 ? 'day' : 'days'} ago`;
  return {
    points: near.gap === 1 ? -16 : -10, avoid: near.gap === 1,
    text: `${cap(describe(near.row))} is ${when}: tradition keeps important beginnings clear of the days around it.`,
    clause: `${describe(near.row)} ${when}`,
  };
}

function retrogradeFactors(goal: GoodDayGoal, day: DaySky): Factor[] {
  const rule = GOAL_RULES[goal];
  const out: Factor[] = [];
  for (const station of day.stations) {
    const weight = rule.retrograde[station.planet];
    if (weight === undefined) continue;
    out.push({ points: -20, avoid: true, text: `${station.planet} stands still today and turns ${station.turns}: tradition keeps important beginnings away from a station day.`, clause: `${station.planet} stationing` });
  }
  for (const planet of SIGNIFICATORS) {
    const weight = rule.retrograde[planet];
    if (weight === undefined || !day.retrograde[planet] || day.stations.some((station) => station.planet === planet)) continue;
    out.push({ points: weight, text: RETROGRADE_LINE[planet], clause: `${planet} retrograde` });
  }
  // A significator moving forward is worth saying when it would otherwise count against the day.
  const main = (Object.entries(rule.retrograde) as [Significator, number][]).sort((a, b) => a[1] - b[1])[0]?.[0];
  if (main && !day.retrograde[main] && !day.stations.length) out.push({ points: 2, text: `${main} is moving forward, as tradition prefers ${rule.forWhat}.`, clause: `${main} direct` });
  return out;
}

function voidFactor(day: DaySky, periods: readonly VoidPeriod[], zone: string): { factor: Factor | null; spans: VoidSpan[] } {
  const touching = periods.filter((period) => period.from.getTime() < day.wakeTo.getTime() && period.to.getTime() > day.wakeFrom.getTime());
  const spans = touching.map((period) => ({ from: clockOn(period.from, zone, day.date), to: clockOn(period.to, zone, day.date) }));
  if (!touching.length) return { factor: null, spans };
  const hours = touching.reduce((sum, period) => sum + (Math.min(period.to.getTime(), day.wakeTo.getTime()) - Math.max(period.from.getTime(), day.wakeFrom.getTime())) / HOUR, 0);
  const first = spans[0];
  if (hours >= 8) return { factor: { points: -12, text: `The Moon is void of course for most of the day (from ${first.from} to ${first.to}), when tradition says new beginnings drift.`, clause: 'a void-of-course Moon most of the day' }, spans };
  if (hours >= 2) return { factor: { points: -4, text: `The Moon is void of course from ${first.from} to ${first.to}; tradition would begin outside those hours.`, clause: 'a void-of-course Moon for part of the day' }, spans };
  return { factor: null, spans };
}

function aspectFactors(goal: GoodDayGoal, day: DaySky, aspects: readonly { at: Date; body: string; aspect: string }[], zone: string): Factor[] {
  const rule = GOAL_RULES[goal];
  const inDay = aspects.filter((row) => row.at.getTime() >= day.start.getTime() && row.at.getTime() < day.end.getTime());
  const good = inDay.filter((row) => HARMONIOUS.has(row.aspect) && (rule.helpers as readonly string[]).includes(row.body)).slice(0, 2);
  const hard = inDay.filter((row) => (row.body === 'Mars' || row.body === 'Saturn') && row.aspect !== 'sextile' && row.aspect !== 'trine').slice(0, 2);
  return [
    ...good.map((row) => {
      const clause = `the Moon ${ASPECT_VERB[row.aspect]} ${bodyName(row.body)} at ${clockOn(row.at, zone, day.date)}`;
      return { points: 5, text: `${cap(clause)}, a supportive contact tradition welcomes ${rule.forWhat}.`, clause };
    }),
    ...hard.map((row) => {
      const clause = `the Moon ${ASPECT_VERB[row.aspect]} ${bodyName(row.body)} at ${clockOn(row.at, zone, day.date)}`;
      return { points: -5, text: `${cap(clause)}, a contact tradition reads as friction.`, clause };
    }),
  ];
}

/** The day's one-line reason: its two strongest supports, else its strongest caution. */
export function oneLine(factors: readonly Factor[], positive: boolean): string {
  if (positive) {
    const supports = factors.filter((factor) => factor.points > 0).sort((a, b) => b.points - a.points);
    if (!supports.length) return 'No strong contacts either way; the quietest day the window offers.';
    if (supports.length === 1) return `${cap(supports[0].clause)}.`;
    return `${cap(supports[0].clause)}, and ${supports[1].clause}.`;
  }
  const caution = [...factors].sort((a, b) => a.points - b.points)[0];
  return caution && caution.points < 0 ? caution.text : 'Nothing in particular counts for it.';
}

/** Days apart, so the best days spread over the window rather than bunch on one run of the Moon. */
const SPREAD_DAYS = 2;

function pick<T extends { date: string }>(sorted: readonly T[], count: number): T[] {
  const chosen: T[] = [];
  for (const item of sorted) {
    if (chosen.length >= count) break;
    if (chosen.every((other) => Math.abs(dayNumber(other.date) - dayNumber(item.date)) >= SPREAD_DAYS)) chosen.push(item);
  }
  // A short window may not hold enough days that far apart; fill from the rest in order.
  for (const item of sorted) {
    if (chosen.length >= count) break;
    if (!chosen.includes(item)) chosen.push(item);
  }
  return chosen;
}

function retrogradePeriods(goal: GoodDayGoal, skies: readonly DaySky[], from: string, to: string): GoodDaysPeriod[] {
  const rule = GOAL_RULES[goal];
  const out: GoodDaysPeriod[] = [];
  for (const planet of SIGNIFICATORS) {
    if (rule.retrograde[planet] === undefined) continue;
    let runStart: string | null = null;
    const flush = (last: string) => {
      if (!runStart) return;
      const before = runStart === from ? ' (it began before this window)' : '';
      const after = last === to ? ' (it carries on after this window)' : '';
      out.push({
        kind: `${planet.toLowerCase()}-retrograde` as GoodDaysPeriod['kind'], from: runStart, to: last,
        line: `${planet} is retrograde from ${longDay(runStart)}${before} to ${longDay(last)}${after}. ${RETROGRADE_LINE[planet]}`,
      });
      runStart = null;
    };
    skies.forEach((day, index) => {
      if (day.retrograde[planet] && runStart === null) runStart = day.date;
      if (!day.retrograde[planet] && runStart !== null) flush(skies[index - 1].date);
    });
    flush(skies.at(-1)!.date);
  }
  return out;
}

export async function findGoodDays(input: GoodDaysInput, clock: GoodDaysClock): Promise<GoodDaysResult> {
  const rule = GOAL_RULES[input.goal];
  if (!rule) throw new RangeError('goal must be one of the goals the finder knows.');
  const { from, to, days } = goodDaysWindow(input.from, input.to, input.today);
  const count = Math.max(1, Math.min(GOOD_DAYS_MAX_COUNT, Math.round(input.count ?? GOOD_DAYS_DEFAULT_COUNT)));
  const messages: string[] = [];
  let chart: PersonalChart | null = null;
  if (input.birth) {
    // A child's birth date is refused before anything is worked out; nothing about it is kept.
    if (isUnder13(input.birth.date, input.today)) throw new RangeError(UNDER_13_SENTENCE);
    if (PARTNERSHIP_GOALS.has(input.goal) && isUnder18(input.birth.date, input.today)) throw new RangeError(UNDER_18_PARTNERSHIP_SENTENCE);
    chart = await preparePersonal(input.birth, clock);
    if (!input.birth.time) messages.push('No birth time was given, so the natal Moon is left out of the personal reading.');
    if (chart.sun === null) messages.push('The Sun changed sign on the day of birth, so without a birth time the personal reading leaves out your Sun sign.');
  }

  const skies = await daySkies(from, days, input.zone, clock);
  const windowStart = skies[0].start;
  const windowEnd = skies.at(-1)!.end;
  // Void periods end at an ingress; scanning three days past the window keeps one that begins inside it.
  const periods = voidPeriods(new Date(windowStart.getTime() - DAY), new Date(windowEnd.getTime() + 3 * DAY));
  const aspects = moonAspects(windowStart, windowEnd);
  const personal = chart ? personalFactors(chart, skies.map((day) => ({ date: day.date, start: day.start, end: day.end, moonSign: day.moonSign })), input.zone) : null;

  const rated = skies.map((day, index) => {
    const voids = voidFactor(day, periods, input.zone);
    const factors = [
      eclipseFactor(day),
      ...retrogradeFactors(input.goal, day),
      phaseFactor(input.goal, day),
      moonSignFactor(input.goal, day.moonSign),
      voids.factor,
      ...aspectFactors(input.goal, day, aspects, input.zone),
      ...(personal ? personal[index] : []),
    ].filter((factor): factor is Factor => factor !== null);
    const score = Math.max(5, Math.min(98, Math.round(60 + factors.reduce((sum, factor) => sum + factor.points, 0))));
    const ordered = [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    return { day, factors, ordered, score, avoid: factors.some((factor) => factor.avoid), spans: voids.spans };
  });

  const best = pick([...rated].filter((row) => !row.avoid).sort((a, b) => b.score - a.score || a.day.date.localeCompare(b.day.date)).map((row) => ({ ...row, date: row.day.date })), count)
    .map((row): GoodDay => ({
      date: row.day.date, label: dayLabel(row.day.date), score: row.score, verdict: goodDayVerdict(row.score),
      reason: oneLine(row.factors, true), factors: row.ordered.map((factor) => factor.text), voidOfCourse: row.spans,
    }));
  const avoid = pick([...rated].filter((row) => row.avoid || row.score < 45).sort((a, b) => Number(b.avoid) - Number(a.avoid) || a.score - b.score || a.day.date.localeCompare(b.day.date)).map((row) => ({ ...row, date: row.day.date })), AVOID_COUNT)
    .sort((a, b) => a.day.date.localeCompare(b.day.date))
    .map((row): AvoidDay => ({ date: row.day.date, label: dayLabel(row.day.date), score: row.score, reason: oneLine(row.factors, false) }));

  const eclipsePeriods: GoodDaysPeriod[] = ECLIPSES.filter((row) => row.at >= windowStart.getTime() - 3 * DAY && row.at < windowEnd.getTime() + 3 * DAY).map((row) => {
    const date = localParts(new Date(row.at), input.zone).date;
    return { kind: 'eclipse', from: addDays(date, -3), to: addDays(date, 3), line: `${cap(row.kind)} ${row.type} eclipse in ${signName(row.sign)} on ${longDay(date)}: tradition keeps the three days either side clear for beginnings.` };
  });
  if (best.length && best[0].score < 66) messages.push('No day in this window reads as clearly good for it; these are the best the window offers. A wider window may hold better days.');
  if (best.length < count) messages.push('Every other day in the window falls on a day tradition would avoid.');
  if (input.zone === 'UTC') messages.push('Days and times are in UTC because no time zone was given.');

  return {
    goal: input.goal, goalLabel: rule.label, from, to, days, zone: input.zone,
    best, avoid,
    periods: [...retrogradePeriods(input.goal, skies, from, to), ...eclipsePeriods].sort((a, b) => a.from.localeCompare(b.from)),
    personal: chart ? { sun: chart.sun, timeKnown: !!input.birth?.time } : null,
    messages, care: rule.care, note: GOOD_DAYS_NOTE,
  };
}
