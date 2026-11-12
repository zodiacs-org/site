/**
 * The Monday Note: one command writes the week's email draft from the sky
 * data and readings the site already publishes.
 *
 *   npx vite-node --script scripts/build-monday-note.ts --week 2026-11-23
 *
 * It writes `.monday-note/<week>.html` and `.monday-note/<week>.txt` (both
 * ignored by git) to paste into the provider's broadcast tool. It sends
 * nothing, calls no model and makes no network request. The same data files
 * and the same week give the same bytes: nothing reads the clock.
 *
 * Sources, all committed:
 * - src/data/transits-YYYY-MM.json: the week's ingresses, lunations, stations
 *   and exact aspects, as the /transits/ pages publish them
 * - src/data/eclipses.json: which lunations are eclipses, and their kind
 * - the event pages (src/lib/events/site-publication.ts, which joins
 *   src/data/events-publication.json with the 2028 to 2030 file): an event
 *   with its own page weighs more
 * - src/data/sky.json: retrograde spans and the new Moons a full Moon follows
 * - src/data/ingresses.json: the Sun's sign in a week with no exact event
 * - src/data/horoscope-program.json: when its weekly readings cover the
 *   requested week, each sign's line is the opening sentence of that
 *   published reading; otherwise the line is composed from the week's
 *   strongest event and the sign's solar house
 *
 * Every forecast line ends with the label from src/ai-tools/reading-confidence.ts.
 * The note knows no reader's chart, only a Sun sign at most, so the rule
 * gives 40 everywhere.
 *
 * The links go to /today/, /good-days/ and /your-2027-sky/, each with
 * ref=note, and only when the page is on: its route exists under src/pages
 * and its launch flag (src/lib/launch-flags.ts), if it has one, is exactly
 * '1' in the shell, as the sitemap and the plain Node generators read it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import eclipsesData from '../src/data/eclipses.json';
import ingressesData from '../src/data/ingresses.json';
import programData from '../src/data/horoscope-program.json';
import skyData from '../src/data/sky.json';
import {
  readingConfidence,
  readingConfidenceText,
  readingDetail,
} from '../src/ai-tools/reading-confidence';
import {
  renderEmailHtml,
  renderEmailText,
  type EmailDocument,
  type EmailLink,
  type EmailRow,
  type EmailSection,
} from '../src/lib/email/template';
import { eventsPublication, type EventsPublication } from '../src/lib/events/site-publication';
import type { HoroscopeProgram } from '../src/lib/horoscope-program-types';
import { launchFlagOn, type LaunchFlag } from '../src/lib/launch-flags';
import { SIGNS, signBySlug } from '../src/lib/signs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUT_DIR = resolve(ROOT, '.monday-note');
export const SITE_ORIGIN = 'https://zodiacs.org';
const BRAND_RING_URL = `${SITE_ORIGIN}/assets/brand/tilted-ring@3x.png`;

/** Resend's broadcast tag for the recipient's unsubscribe link. The provider fills it in at send time. */
export const UNSUBSCRIBE_TAG = '{{{RESEND_UNSUBSCRIBE_URL}}}';
/** Left for the owner to fill in before sending; the law asks for a postal address in every broadcast. */
export const POSTAL_ADDRESS_PLACEHOLDER = '[POSTAL ADDRESS]';
/** The template only lets absolute http(s) URLs into an href, so the tag goes in after rendering. */
const UNSUBSCRIBE_SENTINEL = 'https://unsubscribe.invalid/monday-note';

/** The rule's value for a reading that knows a Sun sign at most: 40. */
export const NOTE_CONFIDENCE = readingConfidence(readingDetail({ hasDate: false, hasTime: false, hasPlace: false }));
export const CONFIDENCE_LABEL = readingConfidenceText(NOTE_CONFIDENCE);

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

// ---------------------------------------------------------------------------
// Copy guard

/**
 * Words the note never prints: outcome promises, health, money, investment,
 * markets, and token language. Matched as whole words, case-insensitively.
 */
export const BANNED_WORDS: readonly string[] = [
  'guarantee', 'guaranteed', 'guarantees', 'promise', 'promises', 'promised', 'certain', 'certainly', 'definitely', 'will', 'destiny', 'destined', 'fate',
  'health', 'healthy', 'heal', 'healing', 'illness', 'ill', 'sick', 'sickness', 'disease', 'medical', 'medicine', 'medication', 'doctor', 'diet', 'symptom', 'symptoms', 'cure', 'diagnosis',
  'money', 'cash', 'finance', 'finances', 'financial', 'debt', 'debts', 'loan', 'loans', 'income', 'salary', 'wealth', 'wealthy', 'rich', 'profit', 'profits', 'price', 'prices', 'spend', 'spending', 'buy', 'sell', 'luck', 'lucky',
  'invest', 'investing', 'investment', 'investments', 'investor', 'market', 'markets', 'stock', 'stocks', 'trade', 'trading', 'bet', 'bets', 'betting', 'gamble', 'gambling', 'lottery', 'jackpot',
  'crypto', 'cryptocurrency', 'token', 'tokens', 'coin', 'coins', 'bitcoin', 'wallet', 'nft',
];

const BANNED_PATTERN = new RegExp(`\\b(?:${BANNED_WORDS.join('|')})\\b`, 'giu');
/** Em dash, en dash, figure dash and horizontal bar. */
const DASH_PATTERN = /[\u2012\u2013\u2014\u2015]/gu;

/** What is wrong with a piece of copy, if anything: banned words and dashes. */
export function copyProblems(text: string): string[] {
  const problems = new Set<string>();
  for (const match of text.matchAll(BANNED_PATTERN)) problems.add(`banned word "${match[0].toLowerCase()}"`);
  for (const match of text.matchAll(DASH_PATTERN)) problems.add(`dash U+${match[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
  return [...problems].sort();
}

function forecast(text: string): string {
  return `${text} ${CONFIDENCE_LABEL}`;
}

// ---------------------------------------------------------------------------
// Dates

export function isWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function parts(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return { weekday: WEEKDAYS[date.getUTCDay()], month: MONTHS[date.getUTCMonth()], day: date.getUTCDate(), year: date.getUTCFullYear() };
}

/** "Tuesday, November 24" */
function dayLabel(day: string): string {
  const p = parts(day);
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** "November 9" */
function shortDate(day: string): string {
  const p = parts(day);
  return `${p.month} ${p.day}`;
}

/** "November 23 to 29, 2026", "November 30 to December 6, 2026", "December 28, 2026 to January 3, 2027" */
export function weekRangeLabel(start: string): string {
  const a = parts(start);
  const b = parts(addDays(start, 6));
  if (a.year !== b.year) return `${a.month} ${a.day}, ${a.year} to ${b.month} ${b.day}, ${b.year}`;
  if (a.month !== b.month) return `${a.month} ${a.day} to ${b.month} ${b.day}, ${b.year}`;
  return `${a.month} ${a.day} to ${b.day}, ${b.year}`;
}

function utcTime(at: string): string {
  return `${at.slice(11, 16)} UTC`;
}

/** 2.34 becomes 2°20′: whole degrees and minutes within the sign, truncated. */
function degreeLabel(degree: number): string {
  const minutes = Math.floor(degree * 60 + 1e-9);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, '0')}′`;
}

function signName(slug: string): string {
  return signBySlug(slug).name;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Sky events

interface TransitsMonth {
  month: string;
  ingresses: { planet: string; at: string; sign: string; retrograde: boolean }[];
  lunations: { type: 'new' | 'full'; at: string; sign: string; degree: number }[];
  stations: { planet: string; at: string; type: 'retrograde' | 'direct'; sign: string; degree: number }[];
  aspects: { a: string; b: string; type: string; at: string; aSign: string; aDegree: number; bSign: string; bDegree: number }[];
}

interface Eclipse { type: 'solar' | 'lunar'; kind: string; peak: string; sign: string; degree: number }
interface Retrograde { planet: string; from: string; to: string }
interface SkyFile { from: string; to: string; retrogrades: Retrograde[]; moons: { type: 'new' | 'full'; at: string }[] }
interface IngressWindow { planet: string; sign: string; from: string; to: string }

export type NoteEvent =
  | { kind: 'lunation'; at: string; phase: 'new' | 'full'; sign: string; degree: number }
  | { kind: 'eclipse'; at: string; phase: 'new' | 'full'; eclipse: 'solar' | 'lunar'; eclipseKind: string; sign: string; degree: number }
  | { kind: 'station'; at: string; planet: string; direction: 'retrograde' | 'direct'; sign: string; degree: number }
  | { kind: 'ingress'; at: string; planet: string; sign: string; retrograde: boolean }
  | { kind: 'aspect'; at: string; a: string; b: string; aspect: string; aSign: string; aDegree: number; bSign: string; bDegree: number };

export interface NoteSources {
  transitsForMonth: (month: string) => TransitsMonth | null;
  eclipses: Eclipse[];
  sky: SkyFile;
  ingressWindows: IngressWindow[];
  events: EventsPublication;
  program: HoroscopeProgram;
  /** The environment launch flags are read from; the shell's by default. */
  env: Readonly<Record<string, string | undefined>>;
  /** Whether a route's source exists under src/pages. */
  routeExists: (route: string) => boolean;
}

const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const PERSONAL = new Set(['Mercury', 'Venus', 'Mars']);
const HARD = new Set(['conjunction', 'opposition', 'square']);

function eventBodies(event: NoteEvent): string[] {
  switch (event.kind) {
    case 'lunation':
    case 'eclipse':
      return ['Moon', 'Sun'];
    case 'station':
    case 'ingress':
      return [event.planet];
    case 'aspect':
      return [event.a, event.b].sort();
  }
}

/** True when the site publishes a standalone page for this event. */
function hasEventPage(event: NoteEvent, events: EventsPublication): boolean {
  const day = event.at.slice(0, 10);
  const bodies = eventBodies(event).join('|');
  return events.pages.some((page) => page.anchor.slice(0, 10) === day
    && page.family === event.kind
    && [...page.bodies].sort().join('|') === bodies);
}

/** How much an event matters to a general reader's week. Higher first. */
export function eventWeight(event: NoteEvent, events: EventsPublication): number {
  let weight: number;
  switch (event.kind) {
    case 'eclipse': weight = 100; break;
    case 'lunation': weight = 80; break;
    case 'station': weight = PERSONAL.has(event.planet) ? 72 : 66; break;
    case 'ingress': weight = event.planet === 'Sun' ? 62 : SLOW.has(event.planet) ? 64 : 45; break;
    case 'aspect':
      weight = SLOW.has(event.a) && SLOW.has(event.b) ? 50 : HARD.has(event.aspect) ? 32 : 24;
      break;
  }
  return weight + (hasEventPage(event, events) ? 15 : 0);
}

function monthsBetween(from: string, through: string): string[] {
  const months: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  while (cursor.slice(0, 7) <= through.slice(0, 7)) {
    months.push(cursor.slice(0, 7));
    const date = new Date(`${cursor}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    cursor = date.toISOString().slice(0, 10);
  }
  return months;
}

/** Every published event from `from` (inclusive) to `to` (exclusive), UTC days, in time order. */
export function eventsBetween(from: string, to: string, sources: NoteSources): NoteEvent[] {
  const events: NoteEvent[] = [];
  const inside = (at: string) => at >= `${from}T00:00:00.000Z` && at < `${to}T00:00:00.000Z`;
  for (const month of monthsBetween(from, addDays(to, -1))) {
    const data = sources.transitsForMonth(month);
    if (!data) throw new Error(`No published transits for ${month}; the note can only cover weeks the site has data for.`);
    for (const row of data.lunations) {
      if (!inside(row.at)) continue;
      const eclipse = sources.eclipses.find((item) => item.type === (row.type === 'new' ? 'solar' : 'lunar')
        && Math.abs(Date.parse(item.peak) - Date.parse(row.at)) < 1.5 * DAY_MS);
      events.push(eclipse
        ? { kind: 'eclipse', at: row.at, phase: row.type, eclipse: eclipse.type, eclipseKind: eclipse.kind, sign: row.sign, degree: row.degree }
        : { kind: 'lunation', at: row.at, phase: row.type, sign: row.sign, degree: row.degree });
    }
    for (const row of data.stations) {
      if (inside(row.at)) events.push({ kind: 'station', at: row.at, planet: row.planet, direction: row.type, sign: row.sign, degree: row.degree });
    }
    for (const row of data.ingresses) {
      if (inside(row.at)) events.push({ kind: 'ingress', at: row.at, planet: row.planet, sign: row.sign, retrograde: row.retrograde });
    }
    for (const row of data.aspects) {
      if (inside(row.at)) {
        events.push({ kind: 'aspect', at: row.at, a: row.a, b: row.b, aspect: row.type, aSign: row.aSign, aDegree: row.aDegree, bSign: row.bSign, bDegree: row.bDegree });
      }
    }
  }
  return events.sort((x, y) => x.at.localeCompare(y.at) || x.kind.localeCompare(y.kind));
}

export interface NoteDay {
  day: string;
  weight: number;
  event: NoteEvent;
}

/** The strongest event on each UTC day, the strongest days first; ties go to the earlier day. */
export function rankDays(events: NoteEvent[], sources: NoteSources): NoteDay[] {
  const byDay = new Map<string, NoteDay>();
  for (const event of events) {
    const day = event.at.slice(0, 10);
    const weight = eventWeight(event, sources.events);
    const current = byDay.get(day);
    if (!current || weight > current.weight) byDay.set(day, { day, weight, event });
  }
  return [...byDay.values()].sort((a, b) => b.weight - a.weight || a.day.localeCompare(b.day));
}

// ---------------------------------------------------------------------------
// Words for events

const PLANET_THEME: Record<string, string> = {
  Sun: 'purpose',
  Moon: 'feelings',
  Mercury: 'plans',
  Venus: 'affection',
  Mars: 'drive',
  Jupiter: 'growth',
  Saturn: 'structure',
  Uranus: 'change',
  Neptune: 'imagination',
  Pluto: 'renewal',
};

const PLANET_STEP: Record<string, string> = {
  Sun: 'pick one thing to put your name to this month',
  Mercury: 'clear one message or plan you have left hanging',
  Venus: 'make time for one person or pleasure you have let slide',
  Mars: 'put real effort into one task you have been circling',
  Jupiter: 'name one long aim you want to grow',
  Saturn: 'firm up one commitment you mean to keep',
  Uranus: 'try one change you have been considering',
  Neptune: 'give one idea room to breathe',
  Pluto: 'let go of one thing you have outgrown',
};

/** Something a reader might have paused while the planet was retrograde. */
const PAUSED: Record<string, string> = {
  Mercury: 'a plan or message',
  Venus: 'a plan with someone close',
  Mars: 'a project',
  Jupiter: 'a long aim',
  Saturn: 'a commitment',
  Uranus: 'a change',
  Neptune: 'an idea',
  Pluto: 'a hard choice',
};

const ASPECT_MEETING: Record<string, string> = {
  conjunction: 'meet in one place',
  opposition: 'pull from opposite sides',
  square: 'press against each other',
  trine: 'work together easily',
  sextile: 'open a door for each other',
};

/** Solar houses counted from the reader's Sun sign, in the site's whole-sign way. */
const HOUSE_AREA: Record<number, string> = {
  1: 'you, and how you start things',
  2: 'what you value and keep',
  3: 'messages, errands and the people nearby',
  4: 'home and family',
  5: 'play, romance and the things you make',
  6: 'daily routines and work',
  7: 'partners and one-to-one agreements',
  8: 'shared commitments and trust',
  9: 'study, travel and the wider view',
  10: 'career and your public role',
  11: 'friends, groups and plans for the future',
  12: 'rest, privacy and unfinished matters',
};

const HOUSE_STEP: Record<number, string> = {
  1: 'Make one decision for yourself first.',
  2: 'Sort one thing you keep out of habit.',
  3: 'Answer the message you have been putting off.',
  4: 'Fix one small thing at home.',
  5: 'Make time for something you enjoy for its own sake.',
  6: 'Clear one snag from your routine.',
  7: 'Say plainly what you need from one person.',
  8: 'Check one shared commitment and who holds which part.',
  9: 'Read or ask about one thing outside your usual view.',
  10: 'Finish one visible piece of work.',
  11: 'Get back in touch with one friend or group.',
  12: 'Close one loose end quietly.',
};

/** "the full Moon in Gemini", "Uranus trine Pluto", "Mars enters Virgo" */
export function eventName(event: NoteEvent): string {
  switch (event.kind) {
    case 'lunation': return `the ${event.phase} Moon in ${signName(event.sign)}`;
    case 'eclipse': return `the ${event.eclipseKind} ${event.eclipse} eclipse in ${signName(event.sign)}`;
    case 'station': return `${event.planet} turning ${event.direction} in ${signName(event.sign)}`;
    case 'ingress': return `${event.planet} entering ${signName(event.sign)}`;
    case 'aspect': return `${event.a} ${event.aspect} ${event.b}`;
  }
}

/** The computed fact, for the monospace receipt under a day. */
function eventReceipt(event: NoteEvent): string {
  switch (event.kind) {
    case 'lunation':
      return `${capitalize(event.phase)} Moon at ${degreeLabel(event.degree)} ${signName(event.sign)}, ${utcTime(event.at)}`;
    case 'eclipse':
      return `${capitalize(event.eclipseKind)} ${event.eclipse} eclipse at ${degreeLabel(event.degree)} ${signName(event.sign)}, ${utcTime(event.at)}`;
    case 'station':
      return `${event.planet} stations ${event.direction} at ${degreeLabel(event.degree)} ${signName(event.sign)}, ${utcTime(event.at)}`;
    case 'ingress':
      return `${event.planet} enters ${signName(event.sign)}${event.retrograde ? ' (retrograde)' : ''}, ${utcTime(event.at)}`;
    case 'aspect':
      return `${event.a} ${event.aspect} ${event.b}, exact at ${utcTime(event.at)}: ${event.a} ${degreeLabel(event.aDegree)} ${signName(event.aSign)}, ${event.b} ${degreeLabel(event.bDegree)} ${signName(event.bSign)}`;
  }
}

function previousNewMoon(event: NoteEvent, sky: SkyFile): string | null {
  const at = Date.parse(event.at);
  const moon = [...sky.moons].reverse().find((item) => item.type === 'new' && Date.parse(item.at) < at && at - Date.parse(item.at) < 20 * DAY_MS);
  return moon ? moon.at.slice(0, 10) : null;
}

/** The retrograde span a station opens or closes, with the sky file's own edges left out. */
function retrogradeSpan(event: Extract<NoteEvent, { kind: 'station' }>, sky: SkyFile): { since?: string; until?: string } {
  const at = Date.parse(event.at);
  const near = (value: string) => Math.abs(Date.parse(value) - at) < 2 * DAY_MS;
  const span = sky.retrogrades.find((item) => item.planet === event.planet
    && (event.direction === 'retrograde' ? near(item.from) : near(item.to)));
  if (!span) return {};
  if (event.direction === 'retrograde') return span.to === sky.to ? {} : { until: span.to.slice(0, 10) };
  return span.from === sky.from ? {} : { since: span.from.slice(0, 10) };
}

/** The meaning line under one of the two days. */
function dayMeaning(event: NoteEvent, sky: SkyFile): string {
  switch (event.kind) {
    case 'lunation': {
      if (event.phase === 'new') return `The new Moon in ${signName(event.sign)} opens a fresh month. Start one small thing and note the date.`;
      const since = previousNewMoon(event, sky);
      return `The full Moon in ${signName(event.sign)} brings to a head what began ${since ? `at the new Moon on ${shortDate(since)}` : 'at the last new Moon'}. Finish rather than start.`;
    }
    case 'eclipse':
      return event.eclipse === 'solar'
        ? `A ${event.eclipseKind} solar eclipse in ${signName(event.sign)}: a new Moon with more weight. Start small and give it weeks, not days.`
        : `A ${event.eclipseKind} lunar eclipse in ${signName(event.sign)}: a full Moon with more weight. Let one finished thing go.`;
    case 'station': {
      const span = retrogradeSpan(event, sky);
      const theme = capitalize(PLANET_THEME[event.planet] ?? 'this area');
      return event.direction === 'retrograde'
        ? `${event.planet} turns retrograde in ${signName(event.sign)}${span.until ? ` until ${shortDate(span.until)}` : ''}. ${theme} asks for review before anything new.`
        : `${event.planet} turns direct in ${signName(event.sign)}${span.since ? `, ending the retrograde that began on ${shortDate(span.since)}` : ''}. ${theme} can move forward again, slowly.`;
    }
    case 'ingress':
      if (event.planet === 'Sun') return `The Sun enters ${signName(event.sign)} and ${signName(event.sign)} season begins. The month's tone changes with it.`;
      return `${event.planet} enters ${signName(event.sign)}${event.retrograde ? ', moving backwards' : ''}. ${capitalize(PLANET_THEME[event.planet] ?? 'this area')} takes on the tone of ${signName(event.sign)} for the stretch ahead.`;
    case 'aspect':
      return `${event.a} ${event.aspect} ${event.b}: ${PLANET_THEME[event.a]} and ${PLANET_THEME[event.b]} ${ASPECT_MEETING[event.aspect] ?? 'meet'}.`;
  }
}

function thingToDo(event: NoteEvent | null, day: string | null, sky: SkyFile): string {
  if (!event || !day) return 'Pick one task you have put off and finish it this week.';
  const weekday = parts(day).weekday;
  switch (event.kind) {
    case 'lunation':
    case 'eclipse': {
      if (event.phase === 'new') return `On ${weekday}, write down one small thing to start this month and take its first step the same day.`;
      const since = previousNewMoon(event, sky);
      return `On ${weekday}, finish or hand off one task you started around ${since ? `the new Moon on ${shortDate(since)}` : 'the last new Moon'}, and say that it is done.`;
    }
    case 'station': {
      const paused = PAUSED[event.planet] ?? 'one plan';
      if (event.direction === 'direct') {
        const since = retrogradeSpan(event, sky).since;
        return `After ${weekday}, pick up ${paused} you paused${since ? ` around ${shortDate(since)}` : ''}.`;
      }
      return event.planet === 'Mercury'
        ? `Before ${weekday}, back up and reread anything you plan to send or agree to while Mercury is retrograde.`
        : `Before ${weekday}, note ${paused} you want to revisit while ${event.planet} is retrograde.`;
    }
    case 'ingress':
      return `On ${weekday}, as ${event.planet} enters ${signName(event.sign)}, ${PLANET_STEP[event.planet] ?? 'take one first step'}.`;
    case 'aspect': {
      const a = PLANET_THEME[event.a];
      const b = PLANET_THEME[event.b];
      if (event.aspect === 'conjunction') return `On ${weekday}, notice where ${a} and ${b} show up together and act on one of them.`;
      return HARD.has(event.aspect)
        ? `On ${weekday}, name one place where ${a} and ${b} pull against each other before you choose.`
        : `On ${weekday}, use the easy link between ${a} and ${b} on something you have put off.`;
    }
  }
}

function dayToProtect(event: NoteEvent | null, day: string): string {
  const label = dayLabel(day);
  if (!event) return `Protect ${label}: nothing is exact, so keep it for rest and catching up.`;
  const time = utcTime(event.at);
  switch (event.kind) {
    case 'lunation':
    case 'eclipse':
      return `Protect ${label}: ${eventName(event)} peaks at ${time}. Keep the evening clear and the big conversations short.`;
    case 'station':
      return `Protect ${label}: ${event.planet} stands still at ${time}. Keep it for checking, not launching.`;
    case 'ingress':
      return `Protect ${label}: ${event.planet} enters ${signName(event.sign)} at ${time}. Give the change a day before you act on it.`;
    case 'aspect':
      return HARD.has(event.aspect) && event.aspect !== 'conjunction'
        ? `Protect ${label}: ${event.a} ${event.aspect} ${event.b} is exact at ${time}. Leave slack in the plan for friction.`
        : `Protect ${label}: ${event.a} ${event.aspect} ${event.b} is exact at ${time}. Keep a few hours free to use it.`;
  }
}

function questionFor(event: NoteEvent | null): string {
  if (!event) return 'What did you finish this week?';
  switch (event.kind) {
    case 'lunation':
    case 'eclipse':
      return event.phase === 'full' ? 'What did you finish or hand off at the full Moon?' : 'What one small thing did you start?';
    case 'station':
      return event.direction === 'retrograde' ? `What did you go back to once ${event.planet} turned retrograde?` : 'Which paused plan did you pick up again?';
    case 'ingress':
      return `What was your first step once ${event.planet} entered ${signName(event.sign)}?`;
    case 'aspect':
      return `Where did ${PLANET_THEME[event.a]} and ${PLANET_THEME[event.b]} meet for you this week?`;
  }
}

/** The sign and the phrase a composed sign line counts its solar house from. */
function signLineAnchor(event: NoteEvent | null, weekStart: string, windows: IngressWindow[]): { sign: string; phrase: string } {
  if (event) {
    switch (event.kind) {
      case 'lunation':
      case 'eclipse':
        return { sign: event.sign, phrase: eventName(event) };
      case 'station':
        return { sign: event.sign, phrase: `${event.planet}'s station in ${signName(event.sign)}` };
      case 'ingress':
        return { sign: event.sign, phrase: `${event.planet} entering ${signName(event.sign)}` };
      case 'aspect':
        return { sign: event.aSign, phrase: `${event.a === 'Sun' ? 'the Sun' : event.a} in ${signName(event.aSign)}, at its ${event.aspect} with ${event.b},` };
    }
  }
  const noon = `${weekStart}T12:00:00.000Z`;
  const sun = windows.find((item) => item.planet === 'Sun' && item.from <= noon && noon < item.to);
  if (!sun) throw new Error(`No Sun sign for ${weekStart} in ingresses.json.`);
  return { sign: sun.sign, phrase: `the Sun in ${signName(sun.sign)}` };
}

function solarHouse(eventSign: string, sunSign: string): number {
  const index = (slug: string) => SIGNS.findIndex((sign) => sign.slug === slug);
  return ((index(eventSign) - index(sunSign) + 12) % 12) + 1;
}

export type SignLineSource = 'published-weekly' | 'composed';

/**
 * The opening sentence of the sign's published weekly reading for exactly
 * this week, when the committed program holds one that passes the copy guard.
 */
function publishedWeeklyLine(program: HoroscopeProgram, sign: string, weekStart: string): string | null {
  const reading = program.signs.find((entry) => entry.sign === sign)?.readings.weekly;
  if (!reading || reading.status !== 'publishable') return null;
  if (reading.period.from !== weekStart || reading.period.through !== addDays(weekStart, 6)) return null;
  const first = reading.passages[0]?.text.split(/(?<=[.!?])\s+/u)[0]?.trim();
  if (!first || copyProblems(first).length) return null;
  return first;
}

// ---------------------------------------------------------------------------
// Links

interface NoteLinkSpec {
  route: string;
  label: string;
  flag?: LaunchFlag;
}

/** The only pages the note links to, in order. */
export const NOTE_LINKS: readonly NoteLinkSpec[] = [
  { route: '/today/', label: "Open today's sky" },
  { route: '/good-days/', label: 'Find your good days', flag: 'PUBLIC_GOOD_DAYS_ENABLED' },
  { route: '/your-2027-sky/', label: 'See your 2027 sky' },
];

/** A route is on when its page exists under src/pages and its launch flag, if any, is exactly '1'. */
export function routeExistsInSource(route: string): boolean {
  const dir = resolve(ROOT, 'src/pages', route.replace(/^\/+|\/+$/gu, ''));
  return existsSync(resolve(dir, 'index.astro')) || existsSync(`${dir}.astro`);
}

export function noteLinks(sources: Pick<NoteSources, 'env' | 'routeExists'>): EmailLink[] {
  return NOTE_LINKS
    .filter((link) => sources.routeExists(link.route) && (!link.flag || launchFlagOn(link.flag, sources.env)))
    .map((link) => ({ label: link.label, url: `${SITE_ORIGIN}${link.route}?ref=note` }));
}

// ---------------------------------------------------------------------------
// The note

export interface MondayNote {
  week: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  signLineSource: SignLineSource;
  links: EmailLink[];
  days: NoteDay[];
}

function sortChronologically(days: NoteDay[]): NoteDay[] {
  return [...days].sort((a, b) => a.day.localeCompare(b.day));
}

export function buildMondayNote(week: string, sources: NoteSources): MondayNote {
  if (!isWeekStart(week)) throw new Error(`--week must be a Monday as YYYY-MM-DD; got ${JSON.stringify(week)}.`);
  const nextWeek = addDays(week, 7);
  const ranked = rankDays(eventsBetween(week, nextWeek, sources), sources);
  const chosen = ranked.slice(0, 2);
  const lead = chosen[0] ?? null;
  // The second day carries the day to protect; a week with one exact event or none protects its Sunday.
  const sunday = addDays(week, 6);
  const protectDay = chosen[1] ?? null;
  const fallbackProtect = lead?.day === sunday ? addDays(week, 5) : sunday;

  const dayRows: EmailRow[] = sortChronologically(chosen).map((item) => ({
    label: dayLabel(item.day),
    body: forecast(dayMeaning(item.event, sources.sky)),
    receipt: eventReceipt(item.event),
  }));

  const coming = sortChronologically(rankDays(eventsBetween(nextWeek, addDays(nextWeek, 7), sources), sources).slice(0, 3));
  const comingRows: EmailRow[] = coming.map((item) => ({ label: dayLabel(item.day), body: `${eventReceipt(item.event)}.` }));

  const published = SIGNS.map((sign) => publishedWeeklyLine(sources.program, sign.slug, week));
  const signLineSource: SignLineSource = published.every(Boolean) ? 'published-weekly' : 'composed';
  const anchor = signLineAnchor(lead?.event ?? null, week, sources.ingressWindows);
  const signRows: EmailRow[] = SIGNS.map((sign, index) => {
    if (signLineSource === 'published-weekly') return { label: sign.name, body: forecast(published[index]!) };
    const house = solarHouse(anchor.sign, sign.slug);
    return {
      label: sign.name,
      body: forecast(`${capitalize(anchor.phrase)} falls in your ${ORDINALS[house - 1]} solar house: ${HOUSE_AREA[house]}. ${HOUSE_STEP[house]}`),
    };
  });

  const range = weekRangeLabel(week);
  const sections: EmailSection[] = [
    {
      heading: chosen.length === 2 ? 'Two days that matter' : chosen.length === 1 ? 'The day that matters' : 'This week',
      rows: dayRows,
      empty: 'No planet changes sign or direction this week, and no aspect is exact.',
    },
    { heading: 'One thing to do', paragraphs: [forecast(thingToDo(lead?.event ?? null, lead?.day ?? null, sources.sky))] },
    { heading: 'One day to protect', paragraphs: [forecast(dayToProtect(protectDay?.event ?? null, protectDay?.day ?? fallbackProtect))] },
    { heading: 'Coming next week', rows: comingRows, empty: 'Nothing is exact next week.' },
    { heading: 'Your Sun sign this week', rows: signRows },
    { heading: 'A question for next week', paragraphs: [questionFor(lead?.event ?? null), 'Reply with one line.'] },
  ];

  const links = noteLinks(sources);
  const subjectEvents = sortChronologically(chosen).map((item) => eventName(item.event));
  const subject = subjectEvents.length ? `This week: ${subjectEvents.join(' and ')}` : `This week: a quiet sky, ${range}`;
  const doc: EmailDocument = {
    preheader: 'Two dates, one thing to do, one day to protect, and a line for your Sun sign.',
    eyebrow: `Monday Note · ${shortDate(week)}, ${parts(week).year}`,
    title: `Your week, ${range}`,
    intro: 'The week in a few minutes, from the sky data and readings published at zodiacs.org. Times are UTC.',
    sections,
    cta: links[0],
    links: links.slice(1),
    footerLines: [
      'You get the Monday Note because you asked for it at zodiacs.org.',
      POSTAL_ADDRESS_PLACEHOLDER,
    ],
    unsubscribeUrl: UNSUBSCRIBE_SENTINEL,
  };

  const withTag = (value: string) => value.replaceAll(UNSUBSCRIBE_SENTINEL, UNSUBSCRIBE_TAG);
  const html = withTag(renderEmailHtml(doc, SITE_ORIGIN, { ring: BRAND_RING_URL }));
  const text = `${withTag(renderEmailText(doc))}\n`;

  const problems = copyProblems(`${subject}\n${doc.preheader}\n${text}`);
  if (problems.length) throw new Error(`The draft for ${week} breaks the copy rules: ${problems.join(', ')}.`);

  return { week, subject, preheader: doc.preheader, html, text, signLineSource, links, days: chosen };
}

// ---------------------------------------------------------------------------
// Command line

function readTransits(month: string): TransitsMonth | null {
  const file = resolve(ROOT, 'src/data', `transits-${month}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as TransitsMonth : null;
}

export function committedSources(env: Readonly<Record<string, string | undefined>> = process.env): NoteSources {
  return {
    transitsForMonth: readTransits,
    eclipses: (eclipsesData as { eclipses: Eclipse[] }).eclipses,
    sky: skyData as SkyFile,
    ingressWindows: (ingressesData as { windows: IngressWindow[] }).windows,
    events: eventsPublication,
    program: programData as unknown as HoroscopeProgram,
    env,
    routeExists: routeExistsInSource,
  };
}

export function parseArgs(argv: string[]): { week: string; outDir: string } {
  let week = '';
  let outDir = DEFAULT_OUT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--week') week = argv[++i] ?? '';
    else if (arg.startsWith('--week=')) week = arg.slice('--week='.length);
    else if (arg === '--out') outDir = resolve(argv[++i] ?? '');
    else if (arg.startsWith('--out=')) outDir = resolve(arg.slice('--out='.length));
    else throw new Error(`Unknown argument ${JSON.stringify(arg)}. Usage: npx vite-node --script scripts/build-monday-note.ts --week YYYY-MM-DD [--out DIR]`);
  }
  if (!week) throw new Error('Usage: npx vite-node --script scripts/build-monday-note.ts --week YYYY-MM-DD [--out DIR] (the week\'s Monday)');
  return { week, outDir };
}

export function writeMondayNote(note: MondayNote, outDir: string): { html: string; text: string } {
  mkdirSync(outDir, { recursive: true });
  const html = resolve(outDir, `${note.week}.html`);
  const text = resolve(outDir, `${note.week}.txt`);
  writeFileSync(html, note.html);
  writeFileSync(text, note.text);
  return { html, text };
}

function main(): void {
  const { week, outDir } = parseArgs(process.argv.slice(2));
  const note = buildMondayNote(week, committedSources());
  const files = writeMondayNote(note, outDir);
  console.log(`Monday Note for ${weekRangeLabel(week)}: nothing sent.`);
  console.log(`  subject:   ${note.subject}`);
  console.log(`  preheader: ${note.preheader}`);
  console.log(`  sign lines: ${note.signLineSource === 'published-weekly' ? 'the published weekly readings' : 'composed from the week\'s sky (the committed program\'s weekly readings cover another week)'}`);
  console.log(`  links: ${note.links.map((link) => link.url).join(', ') || 'none'}`);
  console.log(`  wrote ${files.html}`);
  console.log(`  wrote ${files.text}`);
  console.log(`  Before sending: replace ${POSTAL_ADDRESS_PLACEHOLDER}; the provider fills ${UNSUBSCRIBE_TAG}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
