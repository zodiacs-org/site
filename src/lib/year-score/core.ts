/**
 * The Year Ahead Score: one number from 0 to 10 for the twelve months from a
 * start date, the best and hardest months inside them, and the transits that
 * move the number.
 *
 * What it measures: the five slow planets (Jupiter, Saturn, Uranus, Neptune
 * and Pluto) in major aspect to the natal Sun, Moon (only with a birth time),
 * Mercury, Venus and Mars. Each contact is sampled once a day while it is in
 * orb; how much it counts depends on the planet, the natal point, the aspect
 * and how close it is to exact. Supportive contacts add, pressing contacts
 * subtract, and the year's average lands on the 0 to 10 scale through a fixed
 * curve (see YEAR_SCORE_SCALE). Every weight is written down below, chosen
 * from the tradition before any person was scored, and pinned by
 * core.test.ts so a change to them is a reviewed change.
 *
 * Engine-free on purpose: the caller injects `longitude(body, date)` (the
 * browser passes engine/full.ts, the server the server ephemeris), so this
 * module never pulls astronomy-engine into a bundle by itself. Pure: no
 * network, storage or logging, and it never sees a birth date, only natal
 * longitudes.
 */

export const YEAR_SCORE_VERSION = 'year-score.v1';

export type SlowPlanet = 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
export type ScorePoint = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars';
export type ScoreAspect = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export const SLOW_PLANETS: readonly SlowPlanet[] = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const SCORE_POINTS: readonly ScorePoint[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
export const SCORE_ASPECTS: readonly ScoreAspect[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

const ASPECT_ANGLE: Record<ScoreAspect, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };

/** The widest orb, in degrees, at which a contact counts at all. The site's transit orb is 3 degrees; a sextile gets 2. */
export const ASPECT_ORB: Record<ScoreAspect, number> = { conjunction: 3, sextile: 2, square: 3, trine: 3, opposition: 3 };

/** How much each natal point weighs: the Sun and Moon carry the year, the personal planets less. */
export const POINT_WEIGHT: Record<ScorePoint, number> = { Sun: 1, Moon: 0.9, Mercury: 0.6, Venus: 0.7, Mars: 0.7 };

/** How strongly each slow planet registers when it touches a point. */
export const PLANET_WEIGHT: Record<SlowPlanet, number> = { Jupiter: 1, Saturn: 1, Uranus: 0.9, Neptune: 0.7, Pluto: 0.9 };

/**
 * The direction of each contact, from +1 (fully supportive) to -1 (fully
 * pressing). Jupiter's growth stays mildly positive even in hard aspect
 * (overreach rather than loss); Saturn's soft aspects reward work already
 * done; Uranus, Neptune and Pluto press in hard aspect and conjunction and
 * help a little in soft aspect.
 */
export const VALENCE: Record<SlowPlanet, Record<ScoreAspect, number>> = {
  Jupiter: { conjunction: 1, trine: 1, sextile: 0.6, square: 0.2, opposition: 0.2 },
  Saturn: { conjunction: -1, square: -1, opposition: -0.9, trine: 0.4, sextile: 0.3 },
  Uranus: { conjunction: -0.5, square: -0.7, opposition: -0.6, trine: 0.4, sextile: 0.3 },
  Neptune: { conjunction: -0.4, square: -0.6, opposition: -0.5, trine: 0.3, sextile: 0.2 },
  Pluto: { conjunction: -0.7, square: -0.9, opposition: -0.8, trine: 0.4, sextile: 0.3 },
};

/**
 * The curve from the year's average daily balance to the 0 to 10 score:
 * score = 5 + 5 * tanh((balance - SCORE_CENTER) / YEAR_SCORE_SCALE). Center and
 * scale come from a fixed population, never from a named person: 4,000
 * synthetic birth dates (1940 to 2008) scored for twelve start dates (2020 to
 * 2031). The center is the population's average balance, so an ordinary year
 * reads 5; the scale is twice its spread, so about 19 years in 20 land
 * between 1.2 and 8.8. scripts/calibrate-year-score.ts reproduces both
 * (mean -0.054, standard deviation 0.237 for a year and 0.365 for a month).
 */
export const SCORE_CENTER = -0.05;
export const YEAR_SCORE_SCALE = 0.47;
/** The same curve for a month, whose balance swings wider than a year's average. */
export const MONTH_SCORE_SCALE = 0.73;

export const YEAR_DAYS = 365;
const DAY = 86_400_000;

export interface NatalPoints {
  Sun: number;
  /** Null when the birth time is unknown: the Moon moves about 13 degrees a day. */
  Moon: number | null;
  Mercury: number;
  Venus: number;
  Mars: number;
}

export type LongitudeAt = (body: SlowPlanet, date: Date) => number;

export interface ContactSample {
  planet: SlowPlanet;
  aspect: ScoreAspect;
  point: ScorePoint;
  /** Signed contribution for the day: positive supports, negative presses. */
  value: number;
  orb: number;
}

export interface Driver {
  planet: SlowPlanet;
  aspect: ScoreAspect;
  point: ScorePoint;
  /** support or pressure, from the sign of the contact's valence. */
  tone: 'support' | 'pressure';
  /** The contact's share of everything that moved the year, 0 to 1. */
  share: number;
  /** Total signed weight over the year. */
  weight: number;
  /** First and last day the contact is in orb, YYYY-MM-DD (UTC). */
  inOrbFrom: string;
  inOrbTo: string;
  /** The day it comes closest inside the window, and how close. */
  peak: string;
  peakOrb: number;
}

export interface MonthScore {
  /** YYYY-MM. */
  month: string;
  /** Days of the month inside the window. */
  days: number;
  score: number;
  /** Average daily support and pressure, before the curve. */
  support: number;
  pressure: number;
  /** The contact that weighed most in the month, or null for a quiet month. */
  lead: { planet: SlowPlanet; aspect: ScoreAspect; point: ScorePoint; tone: 'support' | 'pressure' } | null;
}

export interface YearScore {
  version: typeof YEAR_SCORE_VERSION;
  /** First and last day of the window, YYYY-MM-DD (UTC). */
  from: string;
  to: string;
  /** 0 to 10, one decimal. */
  score: number;
  /** Average daily support and pressure (both 0 or more), before the curve. */
  support: number;
  pressure: number;
  /** The share of days with any slow-planet contact in orb. */
  activeDays: number;
  months: MonthScore[];
  /** The month with the highest score and the one with the lowest, among months with at least 10 days in the window. */
  best: MonthScore | null;
  hardest: MonthScore | null;
  /** The contacts that moved the year most, heaviest first. */
  drivers: Driver[];
  /** Natal points the score used. */
  points: ScorePoint[];
}

const norm = (lon: number) => ((lon % 360) + 360) % 360;
/** Smallest angle between two longitudes, 0 to 180. */
const separation = (a: number, b: number) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round = (value: number, places: number) => { const f = 10 ** places; return Math.round(value * f) / f; };

/** The 0 to 10 curve, one decimal. */
export function curve(balance: number, scale: number): number {
  return round(Math.min(10, Math.max(0, 5 + 5 * Math.tanh((balance - SCORE_CENTER) / scale))), 1);
}

/** Every slow-planet contact in orb on one day, with its signed value. */
export function contactsOn(natal: NatalPoints, longitudeAt: LongitudeAt, date: Date): ContactSample[] {
  const out: ContactSample[] = [];
  for (const planet of SLOW_PLANETS) {
    const lon = longitudeAt(planet, date);
    for (const point of SCORE_POINTS) {
      const natalLon = natal[point];
      if (natalLon === null) continue;
      const sep = separation(lon, natalLon);
      for (const aspect of SCORE_ASPECTS) {
        const orb = Math.abs(sep - ASPECT_ANGLE[aspect]);
        const max = ASPECT_ORB[aspect];
        if (orb > max) continue;
        const closeness = 1 - orb / max;
        out.push({ planet, aspect, point, orb, value: PLANET_WEIGHT[planet] * POINT_WEIGHT[point] * VALENCE[planet][aspect] * closeness });
      }
    }
  }
  return out;
}

/** The YYYY-MM-DD of the day `start` begins, at 00:00 UTC. */
function dayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const key = (sample: Pick<ContactSample, 'planet' | 'aspect' | 'point'>) => `${sample.planet}|${sample.aspect}|${sample.point}`;

/**
 * Score the 365 days from `start` (its UTC date). Each day is sampled at
 * 12:00 UTC. Throws RangeError for an invalid start.
 */
export function scoreYear(natal: NatalPoints, longitudeAt: LongitudeAt, start: Date, options: { maxDrivers?: number } = {}): YearScore {
  if (!Number.isFinite(start.getTime())) throw new RangeError('The start date must be a real date.');
  for (const point of SCORE_POINTS) {
    const lon = natal[point];
    if (lon !== null && !Number.isFinite(lon)) throw new RangeError('Natal longitudes must be finite.');
  }
  const first = dayStart(start);
  const monthOrder: string[] = [];
  const monthAcc = new Map<string, { days: number; support: number; pressure: number; byContact: Map<string, number> }>();
  const drivers = new Map<string, { sample: ContactSample; weight: number; abs: number; from: number; to: number; peak: number; peakOrb: number }>();
  let support = 0;
  let pressure = 0;
  let active = 0;
  for (let index = 0; index < YEAR_DAYS; index++) {
    const ms = first + index * DAY;
    const month = isoDay(ms).slice(0, 7);
    let acc = monthAcc.get(month);
    if (!acc) { acc = { days: 0, support: 0, pressure: 0, byContact: new Map() }; monthAcc.set(month, acc); monthOrder.push(month); }
    acc.days++;
    const samples = contactsOn(natal, longitudeAt, new Date(ms + DAY / 2));
    if (samples.length) active++;
    for (const sample of samples) {
      const k = key(sample);
      if (sample.value >= 0) { support += sample.value; acc.support += sample.value; } else { pressure -= sample.value; acc.pressure -= sample.value; }
      acc.byContact.set(k, (acc.byContact.get(k) ?? 0) + sample.value);
      const entry = drivers.get(k);
      if (!entry) drivers.set(k, { sample, weight: sample.value, abs: Math.abs(sample.value), from: ms, to: ms, peak: ms, peakOrb: sample.orb });
      else {
        entry.weight += sample.value;
        entry.abs += Math.abs(sample.value);
        entry.to = ms;
        if (sample.orb < entry.peakOrb) { entry.peak = ms; entry.peakOrb = sample.orb; }
      }
    }
  }
  const months: MonthScore[] = monthOrder.map((month) => {
    const acc = monthAcc.get(month)!;
    let lead: MonthScore['lead'] = null;
    let leadAbs = 0;
    for (const [k, value] of acc.byContact) {
      if (Math.abs(value) <= leadAbs) continue;
      leadAbs = Math.abs(value);
      const [planet, aspect, point] = k.split('|') as [SlowPlanet, ScoreAspect, ScorePoint];
      lead = { planet, aspect, point, tone: VALENCE[planet][aspect] >= 0 ? 'support' : 'pressure' };
    }
    const s = acc.support / acc.days;
    const p = acc.pressure / acc.days;
    return { month, days: acc.days, score: curve(s - p, MONTH_SCORE_SCALE), support: round(s, 4), pressure: round(p, 4), lead };
  });
  const eligible = months.filter((month) => month.days >= 10);
  // Ties go to the earlier month, so the answer is stable.
  const best = eligible.reduce<MonthScore | null>((top, month) => (!top || month.score > top.score ? month : top), null);
  const hardest = eligible.reduce<MonthScore | null>((low, month) => (!low || month.score < low.score ? month : low), null);
  const total = [...drivers.values()].reduce((sum, entry) => sum + entry.abs, 0);
  const ranked = [...drivers.values()]
    .sort((a, b) => b.abs - a.abs || a.from - b.from)
    .slice(0, options.maxDrivers ?? 6)
    .map((entry): Driver => ({
      planet: entry.sample.planet,
      aspect: entry.sample.aspect,
      point: entry.sample.point,
      tone: VALENCE[entry.sample.planet][entry.sample.aspect] >= 0 ? 'support' : 'pressure',
      share: total ? round(entry.abs / total, 3) : 0,
      weight: round(entry.weight, 3),
      inOrbFrom: isoDay(entry.from),
      inOrbTo: isoDay(entry.to),
      peak: isoDay(entry.peak),
      peakOrb: round(entry.peakOrb, 2),
    }));
  const s = support / YEAR_DAYS;
  const p = pressure / YEAR_DAYS;
  return {
    version: YEAR_SCORE_VERSION,
    from: isoDay(first),
    to: isoDay(first + (YEAR_DAYS - 1) * DAY),
    score: curve(s - p, YEAR_SCORE_SCALE),
    support: round(s, 4),
    pressure: round(p, 4),
    activeDays: round(active / YEAR_DAYS, 3),
    months,
    best,
    hardest,
    drivers: ranked,
    points: SCORE_POINTS.filter((point) => natal[point] !== null),
  };
}
