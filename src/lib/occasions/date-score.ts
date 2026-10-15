/**
 * How the sky favours a date someone has chosen: a 0–100 rating with a
 * plain verdict and the reasons behind it, read the way electional
 * astrology reads a day. It rates the date it is given; it never searches
 * for other dates. Pure: a function of the occasion and the sky facts.
 */
import type { OccasionKind } from './kinds';
import type { OccasionSkyFacts } from './sky';

export interface DateRating {
  score: number;
  verdict: string;
  reasons: string[];
}

/** Occasions that start something two people or a household share. */
const PARTNERSHIP: ReadonlySet<OccasionKind> = new Set(['wedding', 'anniversary', 'met']);
/** Occasions that start a venture, a move or a new chapter. */
const BEGINNINGS: ReadonlySet<OccasionKind> = new Set(['home', 'job', 'graduation', 'retirement', 'coming-of-age']);

const VENUS_STRONG = new Set(['taurus', 'libra', 'pisces']);
const VENUS_WEAK = new Set(['aries', 'scorpio', 'virgo']);
const MOON_STRONG = new Set(['taurus', 'cancer']);
const MOON_WEAK = new Set(['scorpio', 'capricorn']);
const GENTLE_MOON = new Set(['taurus', 'cancer', 'libra', 'pisces', 'leo']);

const signName = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

/** The verdicts, by the short key a share link carries. */
export const DATE_VERDICTS = {
  excellent: 'An excellent day for it',
  good: 'A good day for it',
  fair: 'A fair day, with a few cautions',
  challenging: 'A challenging day for it',
} as const;
export type DateVerdictKey = keyof typeof DATE_VERDICTS;

export function dateVerdictKey(score: number): DateVerdictKey {
  if (score >= 82) return 'excellent';
  if (score >= 68) return 'good';
  if (score >= 55) return 'fair';
  return 'challenging';
}

const verdictFor = (score: number): string => DATE_VERDICTS[dateVerdictKey(score)];

export function rateOccasionDate(occasion: OccasionKind, sky: OccasionSkyFacts): DateRating {
  let score = 68;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => { score += points; reasons.push(reason); };
  const place = (body: string) => sky.bodies.find((row) => row.body === body);
  const retro = new Set<string>(sky.retrograde);
  const venus = place('Venus');
  const moon = place('Moon');
  const chosen = PARTNERSHIP.has(occasion) || BEGINNINGS.has(occasion);

  if (sky.moon.waxing) add(6, `The Moon is growing (${sky.moon.illuminationPercent}% full): a lucky sign for new beginnings.`);
  else add(-5, `The Moon is shrinking (${sky.moon.illuminationPercent}% full): better for wrapping things up than starting them.`);
  if (sky.moon.phase === 'Full Moon' && PARTNERSHIP.has(occasion)) add(4, 'A full Moon: big feelings and a great night to celebrate together.');
  if (sky.moon.phase === 'New Moon' && BEGINNINGS.has(occasion)) add(4, 'A new Moon: the classic moment for a fresh start.');

  if (moon) {
    if (MOON_STRONG.has(moon.sign)) add(5, `The Moon is in ${signName(moon.sign)}, one of its happiest signs: a calm, easy mood.`);
    else if (MOON_WEAK.has(moon.sign)) add(-4, `The Moon is in ${signName(moon.sign)}: moods run more serious and guarded.`);
    else if (PARTNERSHIP.has(occasion) && GENTLE_MOON.has(moon.sign)) add(3, `The Moon is in ${signName(moon.sign)}: a warm, sociable mood.`);
  }

  if (venus && (PARTNERSHIP.has(occasion) || occasion === 'home')) {
    if (VENUS_STRONG.has(venus.sign)) add(7, `Venus, the planet of love, is strong in ${signName(venus.sign)}: great for romance and harmony.`);
    else if (VENUS_WEAK.has(venus.sign)) add(-5, `Venus, the planet of love, is weak in ${signName(venus.sign)}: romance takes more effort.`);
  }

  if (retro.has('Venus') && PARTNERSHIP.has(occasion)) add(-14, 'Venus is retrograde: astrology’s classic warning against weddings and new commitments.');
  if (retro.has('Mercury') && chosen) add(-8, 'Mercury is retrograde: expect delays and mix-ups, so double-check plans and paperwork.');
  if (retro.has('Mars') && (BEGINNINGS.has(occasion) || PARTNERSHIP.has(occasion))) add(-6, 'Mars is retrograde: energy is low and new starts stall.');
  if (retro.has('Jupiter') && chosen) add(-2, 'Jupiter is retrograde: good luck arrives, but slowly.');

  const clamped = Math.max(20, Math.min(97, Math.round(score)));
  return { score: clamped, verdict: verdictFor(clamped), reasons };
}
