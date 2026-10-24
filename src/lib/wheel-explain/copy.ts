/**
 * Tap-to-explain copy for the chart wheel: one plain sentence for what each
 * planet, sign and house stands for, and the second sentence that places it
 * in the chart on screen. Beginner level, reflective, never a forecast: the
 * lines describe what a placement is read as, not what will happen.
 *
 * English only for now. A localized page asks for its locale and gets the
 * English table back with `fallback: true`; the repo's rule is that English
 * text is never shown silently on a localized page, so only English pages
 * opt in until a locale has its own table here.
 *
 * Build-time module: pages call it from their frontmatter and the finished
 * sentences ride in the markup, so no copy ships to the browser as JS.
 */
import type { Locale } from '../i18n/core';
import { SIGNS, signForLongitude } from '../signs';

export type ExplainKind = 'planet' | 'sign' | 'house';

export interface WheelExplainCopy {
  /** What each body stands for, as a full sentence. Keyed by body name. */
  planets: Readonly<Record<string, string>>;
  /** What each sign leans toward, as a clause after "which leans toward". Keyed by slug. */
  signLeans: Readonly<Record<string, string>>;
  /** What each sign is about, as a full sentence. Keyed by slug. */
  signs: Readonly<Record<string, string>>;
  /** The area of life each house covers, read after "the 10th house of". Keyed 1 to 12. */
  houseAreas: Readonly<Record<number, string>>;
  /** Idle panel heading and hint, shown before anything is chosen. */
  idleTitle: string;
  hint: string;
  /** Spoken once for the group of hotspots: how to move and choose. */
  keyHint: string;
  close: string;
  groupLabel: string;
}

const EN: WheelExplainCopy = {
  planets: {
    Sun: 'The Sun is your core self: what gives you energy and what you are growing into.',
    Moon: 'The Moon is your emotional side: what you need to feel safe and settled.',
    Mercury: 'Mercury is how you think, talk and take in information.',
    Venus: 'Venus is what you value and enjoy, and how you show affection.',
    Mars: 'Mars is your drive: how you go after what you want and how you handle conflict.',
    Jupiter: 'Jupiter is where you look for growth, meaning and a wider view.',
    Saturn: 'Saturn is where you build patience and structure, often slowly and with effort.',
    Uranus: 'Uranus is your independent streak: where you want room to do things differently.',
    Neptune: 'Neptune is your imagination: where you dream and where edges can blur.',
    Pluto: 'Pluto is depth and change: where you dig deep and let old patterns go.',
    'North Node': 'The North Node is a point, not a planet, read as a direction to grow toward.',
    'South Node': 'The South Node is a point, not a planet, read as what already comes easily.',
  },
  signLeans: {
    aries: 'directness and making a start',
    taurus: 'steadiness and comfort',
    gemini: 'curiosity and conversation',
    cancer: 'care and protection',
    leo: 'warmth and self-expression',
    virgo: 'care and being useful',
    libra: 'balance and fairness',
    scorpio: 'depth and privacy',
    sagittarius: 'honesty and wide horizons',
    capricorn: 'patience and long-term goals',
    aquarius: 'independence and fresh ideas',
    pisces: 'imagination and empathy',
  },
  signs: {
    aries: 'Aries is a fire sign about beginnings, courage and acting on instinct.',
    taurus: 'Taurus is an earth sign about steadiness, the senses and what lasts.',
    gemini: 'Gemini is an air sign about curiosity, words and making connections.',
    cancer: 'Cancer is a water sign about home, feeling and looking after people.',
    leo: 'Leo is a fire sign about warmth, creativity and being seen.',
    virgo: 'Virgo is an earth sign about care, skill and getting the details right.',
    libra: 'Libra is an air sign about balance, partnership and fairness.',
    scorpio: 'Scorpio is a water sign about depth, trust and what lies under the surface.',
    sagittarius: 'Sagittarius is a fire sign about exploring, learning and saying what is true.',
    capricorn: 'Capricorn is an earth sign about patience, responsibility and building over time.',
    aquarius: 'Aquarius is an air sign about independence, friendship and new ideas.',
    pisces: 'Pisces is a water sign about imagination, compassion and quiet intuition.',
  },
  houseAreas: {
    1: 'self and first impressions',
    2: 'money, belongings and what you value',
    3: 'everyday talk, learning and siblings',
    4: 'home, family and your roots',
    5: 'creativity, play and romance',
    6: 'daily routines, work and health',
    7: 'partners and close one-to-one bonds',
    8: 'trust, intimacy and what you share',
    9: 'travel, study and beliefs',
    10: 'work, reputation and your public role',
    11: 'friends, groups and hopes',
    12: 'rest, solitude and the inner life',
  },
  idleTitle: 'Explore the wheel',
  hint: 'Tap a planet, a sign or a house number to read what it means in this chart.',
  keyHint: 'Use the arrow keys to move between planets, signs and house numbers, then press Enter or Space to read about one. Escape closes it.',
  close: 'Close',
  groupLabel: 'Parts of the chart wheel',
};

const TABLES: Partial<Record<Locale, WheelExplainCopy>> = { en: EN };

/** The copy for a locale, falling back to English (and saying so). */
export function wheelExplainCopy(locale: Locale = 'en'): { copy: WheelExplainCopy; fallback: boolean } {
  const table = TABLES[locale];
  return table ? { copy: table, fallback: false } : { copy: EN, fallback: true };
}

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** "the Sun and Mercury", "Venus, Mars and Pluto". */
function listBodies(names: readonly string[]): string {
  const named = names.map((name) => (name === 'Sun' || name === 'Moon' || name.endsWith('Node') ? `the ${name}` : name));
  if (named.length <= 1) return named.join('');
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

export interface Explanation {
  kind: ExplainKind;
  /** Stable id, matching the scene's entity ids: body:Sun, sign:aries, house:10. */
  id: string;
  /** Short heading for the panel, e.g. "Sun in Libra". */
  title: string;
  /** One or two sentences. */
  text: string;
  /** Accessible name for the hotspot button. */
  label: string;
}

export interface PlanetPlacement {
  body: string;
  lon: number;
  /** House number in this chart, when the birth time and place give houses. */
  house?: number | null;
  retrograde?: boolean;
}

export function explainPlanet(placement: PlanetPlacement, copy: WheelExplainCopy = EN): Explanation {
  const sign = signForLongitude(placement.lon);
  const about = copy.planets[placement.body] ?? `${placement.body} is one of the bodies on the wheel.`;
  const where = placement.house
    ? `Here it is in ${sign.name}, which leans toward ${copy.signLeans[sign.slug]}, in the ${ordinal(placement.house)} house of ${copy.houseAreas[placement.house]}.`
    : `Here it is in ${sign.name}, which leans toward ${copy.signLeans[sign.slug]}.`;
  const place = placement.house ? `${sign.name}, ${ordinal(placement.house)} house` : sign.name;
  return {
    kind: 'planet',
    id: `body:${placement.body}`,
    title: `${placement.body} in ${sign.name}`,
    text: `${about} ${where}`,
    label: `${placement.body} in ${place}${placement.retrograde ? ', retrograde' : ''}`,
  };
}

/** Bodies on the wheel, used to say what a sign or house holds in this chart. */
export interface ChartContext {
  bodies: readonly PlanetPlacement[];
}

export function explainSign(slug: string, chart?: ChartContext | null, copy: WheelExplainCopy = EN): Explanation {
  const sign = SIGNS.find((s) => s.slug === slug);
  if (!sign) throw new Error(`wheel-explain: unknown sign ${slug}`);
  const held = chart?.bodies.filter((b) => signForLongitude(b.lon).slug === slug).map((b) => b.body) ?? [];
  const context = !chart
    ? ''
    : held.length
      ? ` In this chart it holds ${listBodies(held)}.`
      : ' No planets sit in it in this chart, which is common.';
  return {
    kind: 'sign',
    id: `sign:${slug}`,
    title: sign.name,
    text: `${copy.signs[slug]}${context}`,
    label: `${sign.name}, sign`,
  };
}

export function explainHouse(house: number, chart?: ChartContext | null, copy: WheelExplainCopy = EN): Explanation {
  if (!Number.isInteger(house) || house < 1 || house > 12) throw new Error(`wheel-explain: house ${house} is outside 1 to 12`);
  const about = `The ${ordinal(house)} house is the part of the chart about ${copy.houseAreas[house]}.`;
  const held = chart?.bodies.filter((b) => b.house === house).map((b) => b.body) ?? [];
  const context = !chart
    ? ''
    : held.length
      ? ` In this chart it holds ${listBodies(held)}.`
      : ' It is empty in this chart, which is common and does not mean that area is missing.';
  return {
    kind: 'house',
    id: `house:${house}`,
    title: `${ordinal(house)} house`,
    text: `${about}${context}`,
    label: `${ordinal(house)} house`,
  };
}
