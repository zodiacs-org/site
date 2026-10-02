/**
 * The daily layer: turns src/data/daily.json into per-sign lines using
 * the solar-house convention every sun-sign column quietly relies on —
 * your sign becomes the first house and today's planets fall where they
 * fall. Everything here is a pure function of the committed JSON, and
 * every rendered line carries its receipt.
 */
import { SIGN_SLUGS, signBySlug } from './signs';

export interface DailyBody {
  body: string;
  lon: number;
  sign: string;
  degree: number;
  retrograde: boolean;
}

export interface DailyEvent {
  kind: 'ingress' | 'lunation' | 'station' | 'aspect';
  at: string;
  planet?: string;
  sign?: string;
  type?: string;
  degree?: number;
  a?: string;
  b?: string;
  retrograde?: boolean;
  aSign?: string;
  aDegree?: number;
  bSign?: string;
  bDegree?: number;
  /** Exact-hit aspect catalogs use zero; approximate aspects are not accepted. */
  orb?: 0;
}

export interface Daily {
  schema?: 'zodiacs.daily-facts.v1';
  date: string;
  snapshotAt?: string;
  bodies: DailyBody[];
  moon: { phase: string; illumination: number };
  eventsCoverage?: 'complete' | 'unavailable';
  eventsSource?: string | null;
  events: DailyEvent[];
}

export type DailyTemplateId =
  | 'body-house.v1'
  | 'ingress-house.v1'
  | 'lunation-house.v1'
  | 'station-house.v1'
  | 'aspect-collective.v1'
  | 'today-moon-theme.v1';

export type DailyLineScope = 'collective' | 'solar-house' | 'natal-house';

export interface DailyLine {
  text: string;
  receipt: string;
  /** Solar house when this line is specific to the reader's Sun sign. */
  house?: number;
  /** The line's primary body, for the leading receipt glyph. */
  body?: string;
  /** The relevant sign's hue, tinting that glyph (ticker treatment). */
  hue?: string;
  /** Curated renderer responsible for the exact published sentence. */
  templateId?: DailyTemplateId;
  /** Whether the sentence is collective or derived for one reader/sign. */
  scope?: DailyLineScope;
  /** Stable structured facts behind the sentence; never parsed from receipt text. */
  evidenceRefs?: string[];
}

export interface DailyReading {
  headline: string;
  lines: DailyLine[];
}

export const ORDINAL = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
];

/** Whole-sign solar house of a planet for a given sun sign. */
export function solarHouse(planetSign: string, sunSign: string): number {
  const p = SIGN_SLUGS.indexOf(planetSign);
  const s = SIGN_SLUGS.indexOf(sunSign);
  return ((p - s + 12) % 12) + 1;
}

const factToken = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

/** Stable fact ID for a noon-UTC body position. */
export function dailyBodyFactId(date: string, body: DailyBody | string): string {
  const name = typeof body === 'string' ? body : body.body;
  return `fact:${date}:body:${factToken(name)}:1200z`;
}

/** Stable fact ID for a same-day event, independent of array order. */
export function dailyEventFactId(date: string, event: DailyEvent): string {
  const participants = event.kind === 'aspect'
    ? `${event.a ?? 'unknown'}-${event.type ?? 'unknown'}-${event.b ?? 'unknown'}`
    : `${event.planet ?? 'moon'}-${event.type ?? event.sign ?? 'event'}`;
  return `fact:${date}:event:${event.kind}:${event.at}:${factToken(participants)}`;
}

/** Stable derived fact connecting a source position/event to a solar house. */
export function dailyHouseFactId(
  date: string,
  sunSign: string,
  sourceFactId: string,
  house: number,
): string {
  return `derived:${date}:solar-house:${factToken(sunSign)}:h${house}:${factToken(sourceFactId)}`;
}

/**
 * Whole-sign NATAL house of a planet for a given rising sign — the same
 * arithmetic anchored to the ascendant instead of the sun. Valid only
 * when the birth time is known (the asc sets house one).
 */
export function wholeSignHouseFromAsc(planetSign: string, ascSign: string): number {
  const p = SIGN_SLUGS.indexOf(planetSign);
  const a = SIGN_SLUGS.indexOf(ascSign);
  return ((p - a + 12) % 12) + 1;
}

/**
 * One line per planet-in-house — dry, specific, second person. The
 * houses read as life areas, not fortunes; the verbs stay observational.
 */
export const HOUSE_THEME: Record<number, string> = {
  1: 'your identity and how you present yourself',
  2: 'your money, possessions, and priorities',
  3: 'messages, errands, siblings, and your local community',
  4: 'home, family, and your private life',
  5: 'creativity, romance, children, and enjoyment',
  6: 'daily work, health routines, and responsibilities',
  7: 'partners and one-to-one relationships',
  8: 'shared finances, debts, intimacy, and trust',
  9: 'travel, learning, beliefs, and long-term plans',
  10: 'career, reputation, and public responsibilities',
  11: 'friends, groups, and plans for the future',
  12: 'rest, privacy, and unfinished matters',
};

const PLANET_VERB: Record<string, string> = {
  Moon: 'The Moon spends today in',
  Sun: 'The Sun is moving through',
  Mercury: 'Mercury is working',
  Venus: 'Venus is warming',
  Mars: 'Mars is pushing on',
  Jupiter: 'Jupiter is stretching',
  Saturn: 'Saturn is testing',
  Uranus: 'Uranus is unsettling',
  Neptune: 'Neptune is blurring',
  Pluto: 'Pluto is slowly rewiring',
};

export function houseLine(
  body: DailyBody,
  house: number,
  context?: { date: string; sunSign: string },
): DailyLine {
  const rx = body.retrograde ? ', retrograde' : '';
  const sourceFactId = context ? dailyBodyFactId(context.date, body) : null;
  return {
    text: `${PLANET_VERB[body.body] ?? `${body.body} is in`} your ${ORDINAL[house]} house — ${HOUSE_THEME[house]}.`,
    receipt: `${body.body} ${body.degree.toFixed(1)}° ${cap(body.sign)}${rx} · house ${house}`,
    house,
    body: body.body,
    hue: hueForSign(body.sign),
    templateId: 'body-house.v1',
    scope: context ? 'solar-house' : 'natal-house',
    evidenceRefs: sourceFactId && context
      ? [sourceFactId, dailyHouseFactId(context.date, context.sunSign, sourceFactId, house)]
      : [],
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A sign slug's disc hue, for tinting the leading receipt glyph. */
const hueForSign = (slug: string): string | undefined => {
  try {
    return signBySlug(slug).hue;
  } catch {
    return undefined;
  }
};

const utcTime = (at: string) => `${at.slice(11, 16)} UTC`;

function eventLine(e: DailyEvent, sunSign: string, date: string): DailyLine | null {
  const sourceFactId = dailyEventFactId(date, e);
  if (e.kind === 'ingress' && e.planet && e.sign) {
    const house = solarHouse(e.sign, sunSign);
    return {
      text: `${e.planet} enters your ${ORDINAL[house]} house today — ${HOUSE_THEME[house]} picks up ${e.planet === 'Saturn' || e.planet === 'Pluto' ? 'a long-term tenant' : 'new weather'}.`,
      receipt: `${e.planet} → 0° ${cap(e.sign)} · ${utcTime(e.at)}`,
      house,
      body: e.planet,
      hue: hueForSign(e.sign),
      templateId: 'ingress-house.v1',
      scope: 'solar-house',
      evidenceRefs: [sourceFactId, dailyHouseFactId(date, sunSign, sourceFactId, house)],
    };
  }
  if (e.kind === 'lunation' && e.sign) {
    const house = solarHouse(e.sign, sunSign);
    const name = e.type === 'new' ? 'New Moon' : 'Full Moon';
    return {
      text: `${name} in your ${ORDINAL[house]} house — ${e.type === 'new' ? 'a clean line to start something in' : 'something comes due in'} ${HOUSE_THEME[house]}.`,
      receipt: `${name} ${e.degree?.toFixed(1)}° ${cap(e.sign)} · ${utcTime(e.at)}`,
      house,
      body: 'Moon',
      hue: hueForSign(e.sign),
      templateId: 'lunation-house.v1',
      scope: 'solar-house',
      evidenceRefs: [sourceFactId, dailyHouseFactId(date, sunSign, sourceFactId, house)],
    };
  }
  if (e.kind === 'station' && e.planet && e.sign) {
    const house = solarHouse(e.sign, sunSign);
    const dir = e.type === 'retrograde' ? 'stations retrograde' : 'stations direct';
    return {
      text: `${e.planet} ${dir} in your ${ORDINAL[house]} house — ${e.type === 'retrograde' ? 'expect revisions in' : 'forward motion returns to'} ${HOUSE_THEME[house]}.`,
      receipt: `${e.planet} ${dir} ${e.degree?.toFixed(1)}° ${cap(e.sign)} · ${utcTime(e.at)}`,
      house,
      body: e.planet,
      hue: hueForSign(e.sign),
      templateId: 'station-house.v1',
      scope: 'solar-house',
      evidenceRefs: [sourceFactId, dailyHouseFactId(date, sunSign, sourceFactId, house)],
    };
  }
  if (e.kind === 'aspect' && e.a && e.b && e.type) {
    return {
      text: `${e.a} ${e.type} ${e.b} is exact today — sky-wide weather, worth knowing the hour.`,
      receipt: `${e.a} ${e.type} ${e.b} · exact ${utcTime(e.at)}`,
      body: e.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [sourceFactId],
    };
  }
  return null;
}

/**
 * The reading for one sign: the day's most concrete event first, the
 * Moon always, then the personal planets whose houses aren't already
 * covered. Four lines, no filler.
 */
export function dailyReading(sunSign: string, daily: Daily): DailyReading {
  const lines: DailyLine[] = [];
  const usedHouses = new Set<number>();

  for (const e of daily.events) {
    const line = eventLine(e, sunSign, daily.date);
    if (line) {
      lines.push(line);
      if (e.sign) usedHouses.add(solarHouse(e.sign, sunSign));
    }
    if (lines.length >= 2) break;
  }

  const byName = (name: string) => daily.bodies.find((b) => b.body === name);
  const moon = byName('Moon');
  if (moon) {
    const h = solarHouse(moon.sign, sunSign);
    if (!usedHouses.has(h)) {
      lines.push(houseLine(moon, h, { date: daily.date, sunSign }));
      usedHouses.add(h);
    }
  }

  for (const name of ['Mercury', 'Venus', 'Mars', 'Sun']) {
    if (lines.length >= 4) break;
    const b = byName(name);
    if (!b) continue;
    const h = solarHouse(b.sign, sunSign);
    if (usedHouses.has(h)) continue;
    lines.push(houseLine(b, h, { date: daily.date, sunSign }));
    usedHouses.add(h);
  }

  const headline = lines[0]?.text ?? 'A quiet sky today.';
  return { headline, lines };
}

/** One-liner for the hub cards: the sign's single strongest note. */
export function dailyHeadline(sunSign: string, daily: Daily): string {
  const reading = dailyReading(sunSign, daily);
  // Collective aspects still lead the detailed reading, but a hub card should
  // lead with the first fact that actually changes with the reader's sign.
  return reading.lines.find((line) => line.house !== undefined)?.text ?? reading.headline;
}
