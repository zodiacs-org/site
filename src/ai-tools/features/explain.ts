/**
 * explain_astrology: short explainers of astrology's basics, from the site's
 * own reference text, with links to the zodiacs.org pages that cover each
 * topic. The words are the glossary's (src/data/glossary.ts), the big-three
 * readings (src/lib/interpretations.ts), the planet and house themes
 * (src/lib/natal-context.ts, src/lib/natal.ts) and the Chinese zodiac guide
 * (src/data/chinese-zodiac.ts). A topic is matched from free text against a
 * curated list; a topic outside it, such as tarot, numerology, horary or
 * Vedic astrology, gets found: false and the list, never an improvised
 * explainer. A placement, such as Moon in Scorpio or Mars in the tenth house,
 * is answered from the planet's topic with the sign or house added and the
 * placement page linked. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { CHINESE_ZODIAC_COPY } from '../../data/chinese-zodiac';
import { GLOSSARY, type GlossaryTerm } from '../../data/glossary';
import { bigThree } from '../../lib/interpretations';
import { NATAL_HOUSE_THEME, planetInHouseLine } from '../../lib/natal';
import { NATAL_BODY_THEME, placementContext } from '../../lib/natal-context';
import { pairPattern } from '../../lib/compat-reading';
import { pairSlug } from '../../lib/compat';
import { SIGNS, type Sign } from '../../lib/signs';
import type { BodyName } from '../../lib/engine/types';
import { softenHealth } from './reading-guards';
import pairPages from './pair-pages.json';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
export const EXPLAIN_NOTE = 'An introduction to how astrology reads these ideas, not a claim that they determine anything.';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const HOUSE_SLUGS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const ASPECTS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

export const explainInput = z.strictObject({
  topic: z.string().trim().min(1).max(80).describe('What to explain, in a few words: a sign (leo), a planet (Mercury), a placement (Moon in Scorpio, Jupiter in the 12th), the houses or one house (seventh house), aspects or one aspect (square), retrogrades or Mercury retrograde, Moon phases, the rising sign or a sign rising (Leo rising), the Midheaven, the big three, cusps, Saturn return, elements, modalities, transits, synastry, eclipses or the Chinese zodiac.'),
});
export type ExplainInput = z.infer<typeof explainInput>;

const link = z.object({ title: z.string(), url: z.url() });
export const explainData = z.object({
  found: z.boolean(),
  query: z.string(),
  /** The curated topic matched, such as mercury-retrograde; null when none matched. */
  topic: z.string().nullable(),
  title: z.string().nullable(),
  /** The explainer, in short plain paragraphs. */
  paragraphs: z.array(z.string()),
  /** Terms the explainer leans on, with the glossary's definitions. */
  terms: z.array(z.object({ term: z.string(), definition: z.string(), url: z.url() })),
  /** Pages on zodiacs.org that cover the topic. */
  pages: z.array(link),
  /** Nearby topics this tool can explain next. */
  related: z.array(z.string()),
  /** When nothing matched: every topic this tool explains. */
  topics: z.array(z.string()),
  message: z.string().nullable(),
  note: z.literal(EXPLAIN_NOTE),
});
export type ExplainData = z.infer<typeof explainData>;

interface Topic {
  key: string;
  title: string;
  /** Extra spellings people use, folded for matching. */
  aliases: string[];
  /** Glossary terms, the first one leading the explainer. */
  glossary: string[];
  /** Paragraphs written from the site's other reference text. */
  extra?: () => string[];
  pages: { title: string; path: string }[];
  related: string[];
}

const GLOSSARY_BY_SLUG = new Map(GLOSSARY.map((term) => [term.slug, term] as const));
const term = (slug: string): GlossaryTerm => {
  const found = GLOSSARY_BY_SLUG.get(slug);
  if (!found) throw new Error(`No glossary term ${slug}`);
  return found;
};
const signRange = (sign: Sign) => `${sign.start[1]} ${MONTHS[sign.start[0] - 1]} to ${sign.end[1]} ${MONTHS[sign.end[0] - 1]}`;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const TOPICS: Topic[] = [
  ...SIGNS.map((sign): Topic => ({
    key: sign.slug, title: sign.name, aliases: [`${sign.slug} sign`, `${sign.slug} traits`, `${sign.slug} personality`], glossary: [sign.slug, 'sun-sign'],
    extra: () => [
      `${sign.name} runs from about ${signRange(sign)} in the tropical zodiac; the exact day the Sun enters it moves by a day or so from year to year. It is a ${sign.modality} ${sign.element} sign ruled by ${sign.ruler}${sign.classicRuler ? ` (traditionally ${sign.classicRuler})` : ''}.`,
      bigThree('sun', sign.slug),
      `As a rising sign: ${bigThree('rising', sign.slug)}`,
    ],
    pages: [{ title: `${sign.name} on Zodiacs`, path: `/${sign.slug}/` }, { title: `${sign.name} rising`, path: `/rising-sign/${sign.slug}/` }, { title: `${sign.name} horoscope`, path: `/horoscopes/${sign.slug}/` }],
    related: ['elements', 'modalities', 'big-three'],
  })),
  ...PLANETS.map((planet): Topic => ({
    key: planet.toLowerCase(), title: planet, aliases: [`planet ${planet.toLowerCase()}`, `the ${planet.toLowerCase()}`], glossary: [planet.toLowerCase()],
    extra: () => [NATAL_BODY_THEME[planet as BodyName].what],
    pages: [{ title: `${planet} on Zodiacs`, path: `/learn/planets/${planet.toLowerCase()}/` }],
    related: ['planets', 'houses', ...(planet === 'Mercury' ? ['mercury-retrograde'] : planet === 'Saturn' ? ['saturn-return'] : planet === 'Moon' ? ['moon-phases', 'moon-sign'] : [])],
  })),
  { key: 'planets', title: 'The planets', aliases: ['planet', 'personal planets', 'outer planets', 'luminaries'], glossary: ['planet', 'luminary', 'personal-planets', 'outer-planets'], pages: [{ title: 'The planets', path: '/learn/planets/' }], related: PLANETS.map((planet) => planet.toLowerCase()) },
  {
    key: 'houses', title: 'The houses', aliases: ['house', 'astrological houses', 'twelve houses', 'house system', 'whole sign houses', 'placidus'], glossary: ['house', 'natural-house', 'house-system', 'whole-sign-houses', 'placidus'],
    extra: () => [`Each house is a life area: ${HOUSE_SLUGS.map((slug, index) => `the ${slug}, ${NATAL_HOUSE_THEME[index + 1]}`).join('; ')}.`],
    pages: [{ title: 'The houses', path: '/learn/houses/' }], related: ['rising-sign', 'birth-chart', ...HOUSE_SLUGS.map((slug) => `${slug}-house`)],
  },
  ...HOUSE_SLUGS.map((slug, index): Topic => ({
    key: `${slug}-house`, title: `The ${cap(slug)} house`, aliases: [`${index + 1} house`, `${index + 1}th house`, `house ${index + 1}`, `${['1st', '2nd', '3rd'][index] ?? `${index + 1}th`} house`], glossary: [`${slug}-house`],
    extra: () => [`In a birth chart, the ${slug} house covers ${NATAL_HOUSE_THEME[index + 1]}.`],
    pages: [{ title: `The ${slug} house`, path: `/learn/houses/${slug}-house/` }], related: ['houses'],
  })),
  { key: 'aspects', title: 'Aspects', aliases: ['aspect', 'major aspects', 'orb', 'orbs'], glossary: ['aspect', 'major-aspect', 'orb', 'exact-aspect', 'applying', 'separating'], pages: [{ title: 'Aspects', path: '/learn/aspects/' }], related: ASPECTS },
  ...ASPECTS.map((aspect): Topic => ({ key: aspect, title: cap(aspect), aliases: [`${aspect} aspect`, `${aspect}s`], glossary: [aspect], pages: [{ title: cap(aspect), path: `/learn/aspects/${aspect}/` }], related: ['aspects'] })),
  { key: 'retrogrades', title: 'Retrogrades', aliases: ['retrograde', 'retrograde planets', 'planet retrograde', 'station', 'stationing', 'direct motion', 'rx'], glossary: ['retrograde', 'station', 'direct', 'retrograde-loop'], pages: [{ title: 'Retrogrades', path: '/retrogrades/' }, { title: 'Mercury retrograde', path: '/mercury-retrograde/' }], related: ['mercury-retrograde', 'transits'] },
  {
    key: 'mercury-retrograde', title: 'Mercury retrograde', aliases: ['mercury in retrograde', 'mercury rx', 'mercury retrograde meaning'], glossary: ['retrograde', 'mercury', 'station'],
    extra: () => ['Mercury turns retrograde three or four times a year, for about three weeks each time. Astrology reads those weeks as a time for reviewing, rechecking and finishing rather than launching, because Mercury rules messages, plans and travel.'],
    pages: [{ title: 'Mercury retrograde', path: '/mercury-retrograde/' }, { title: 'Retrogrades', path: '/retrogrades/' }], related: ['retrogrades', 'mercury'],
  },
  { key: 'moon-phases', title: 'Moon phases', aliases: ['moon phase', 'lunar phases', 'new moon', 'full moon', 'lunation', 'lunar cycle'], glossary: ['moon-phase', 'new-moon', 'full-moon', 'lunation'], pages: [{ title: 'Moon phases', path: '/moon-phase/' }, { title: 'Full Moon calendar', path: '/full-moon-calendar/' }], related: ['moon', 'void-of-course-moon', 'eclipses'] },
  { key: 'void-of-course-moon', title: 'The void-of-course Moon', aliases: ['void of course', 'void of course moon', 'voc moon', 'moon void of course'], glossary: ['void-of-course-moon'], pages: [{ title: 'Void-of-course Moon', path: '/void-of-course-moon/' }], related: ['moon-phases', 'moon'] },
  { key: 'eclipses', title: 'Eclipses', aliases: ['eclipse', 'solar eclipse', 'lunar eclipse', 'eclipse season'], glossary: ['eclipse', 'solar-eclipse', 'lunar-eclipse', 'eclipse-season'], pages: [{ title: 'Eclipses', path: '/eclipses/' }], related: ['moon-phases', 'lunar-nodes'] },
  { key: 'rising-sign', title: 'The rising sign', aliases: ['rising', 'ascendant', 'asc', 'my rising sign', 'chart ruler'], glossary: ['rising-sign', 'ascendant', 'chart-ruler'], pages: [{ title: 'Rising signs', path: '/rising-sign/' }], related: ['big-three', 'houses'] },
  {
    key: 'midheaven', title: 'The Midheaven', aliases: ['mc', 'medium coeli', 'mid heaven', 'midheaven mc'], glossary: ['midheaven', 'ic', 'angle'],
    extra: () => [`The Midheaven needs a birth time and place, because it moves through the whole zodiac in about a day. Astrology reads it with the tenth house, which covers ${NATAL_HOUSE_THEME[10]}; in whole-sign houses, which Zodiacs uses, it does not always fall in the tenth.`],
    pages: [{ title: 'The tenth house', path: '/learn/houses/tenth-house/' }, { title: 'Midheaven in the glossary', path: '/learn/glossary/#midheaven' }], related: ['tenth-house', 'ic', 'rising-sign', 'houses'],
  },
  {
    key: 'ic', title: 'The IC (Imum Coeli)', aliases: ['imum coeli', 'ic', 'ic angle', 'immum coeli'], glossary: ['ic', 'midheaven', 'angle', 'fourth-house'],
    extra: () => [`The IC is the point opposite the Midheaven, at the base of the chart. Like the Midheaven it needs a birth time and place. In quadrant house systems such as Placidus it is the cusp of the fourth house, which covers ${NATAL_HOUSE_THEME[4]}. In whole-sign houses, which Zodiacs uses, it does not always fall in the fourth, so it is read as a point of its own.`],
    pages: [{ title: 'The fourth house', path: '/learn/houses/fourth-house/' }, { title: 'IC in the glossary', path: '/learn/glossary/#ic' }], related: ['midheaven', 'fourth-house', 'houses'],
  },
  { key: 'big-three', title: 'The big three', aliases: ['big 3', 'sun moon rising', 'sun moon and rising'], glossary: ['big-three', 'sun-sign', 'moon-sign', 'rising-sign'], pages: [{ title: 'The big three', path: '/big-three/' }, { title: 'Your birth chart', path: '/birth-chart/' }], related: ['sun-sign', 'moon-sign', 'rising-sign'] },
  { key: 'sun-sign', title: 'The Sun sign', aliases: ['star sign', 'zodiac sign', 'my sign', 'horoscope sign'], glossary: ['sun-sign', 'zodiac-sign', 'zodiac-season'], pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['big-three', 'cusps'] },
  { key: 'moon-sign', title: 'The Moon sign', aliases: ['moon sign meaning', 'my moon sign'], glossary: ['moon-sign', 'moon'], pages: [{ title: 'Moon signs', path: '/moon-sign/' }], related: ['big-three', 'moon-phases'] },
  { key: 'birth-chart', title: 'The birth chart', aliases: ['natal chart', 'chart', 'birth chart', 'read chart', 'chart reading', 'how to read a birth chart', 'reading a chart', 'placements', 'placement', 'no time chart', 'stellium'], glossary: ['birth-chart', 'placement', 'no-time-chart', 'stellium'], pages: [{ title: 'How to read a birth chart', path: '/learn/how-to-read-a-birth-chart/' }, { title: 'Your birth chart', path: '/birth-chart/' }, { title: 'Placements', path: '/learn/placements/' }], related: ['big-three', 'houses', 'aspects'] },
  { key: 'cusps', title: 'Cusps', aliases: ['cusp', 'born on the cusp', 'cusp sign', 'decan', 'decans'], glossary: ['cusp', 'decan', 'sun-sign'], pages: [{ title: 'Birthdays', path: '/birthday/' }, { title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['sun-sign'] },
  { key: 'saturn-return', title: 'The Saturn return', aliases: ['saturn returns', 'my saturn return'], glossary: ['saturn-return', 'return', 'saturn'], pages: [{ title: 'Saturn return', path: '/saturn-return/' }], related: ['solar-return', 'transits', 'saturn'] },
  { key: 'solar-return', title: 'The solar return', aliases: ['solar return chart', 'birthday chart'], glossary: ['solar-return', 'return'], pages: [{ title: 'Solar return', path: '/solar-return/' }], related: ['saturn-return'] },
  {
    key: 'elements', title: 'The elements', aliases: ['element', 'fire signs', 'earth signs', 'air signs', 'water signs', 'fire sign', 'earth sign', 'air sign', 'water sign', 'fire', 'earth', 'air', 'water'], glossary: ['element', 'fire', 'earth', 'air', 'water'],
    extra: () => (['fire', 'earth', 'air', 'water'] as const).map((element) => `${cap(element)} signs: ${SIGNS.filter((sign) => sign.element === element).map((sign) => sign.name).join(', ')}.`),
    pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['modalities', 'polarity'],
  },
  {
    key: 'modalities', title: 'The modalities', aliases: ['modality', 'modes', 'qualities', 'cardinal', 'fixed', 'mutable', 'cardinal signs', 'fixed signs', 'mutable signs'], glossary: ['modality', 'cardinal', 'fixed', 'mutable'],
    extra: () => (['cardinal', 'fixed', 'mutable'] as const).map((modality) => `${cap(modality)} signs: ${SIGNS.filter((sign) => sign.modality === modality).map((sign) => sign.name).join(', ')}.`),
    pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['elements', 'polarity'],
  },
  { key: 'polarity', title: 'Polarity', aliases: ['day signs', 'night signs', 'masculine and feminine signs'], glossary: ['polarity', 'day-sign', 'night-sign'], pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['elements', 'modalities'] },
  { key: 'rulership', title: 'Rulership and dignity', aliases: ['ruler', 'rulers', 'ruling planet', 'dignity', 'dignities', 'domicile', 'exaltation', 'detriment', 'fall'], glossary: ['rulership', 'modern-ruler', 'classical-ruler', 'essential-dignity', 'domicile', 'exaltation', 'detriment', 'fall'], pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }], related: ['planets'] },
  { key: 'transits', title: 'Transits', aliases: ['transit', 'current transits', 'personal transits', 'ingress', 'ingresses', 'sign change'], glossary: ['transit', 'orb', 'ingress'], pages: [{ title: 'Transits', path: '/transits/' }], related: ['retrogrades', 'saturn-return', 'aspects'] },
  { key: 'synastry', title: 'Synastry', aliases: ['compatibility', 'relationship astrology', 'composite chart', 'chart comparison', 'synastry basics'], glossary: ['synastry', 'inter-chart-aspect', 'composite-chart', 'bi-wheel'], pages: [{ title: 'Compatibility', path: '/compatibility/' }], related: ['aspects', 'elements'] },
  { key: 'zodiac', title: 'The zodiac', aliases: ['tropical zodiac', 'sidereal zodiac', 'precession', 'zodiac signs', 'ecliptic'], glossary: ['zodiac', 'tropical-zodiac', 'sidereal-zodiac', 'precession', 'ecliptic'], pages: [{ title: 'Zodiac dates', path: '/learn/zodiac-dates/' }, { title: 'How we calculate', path: '/methodology/' }], related: ['sun-sign', 'elements'] },
  { key: 'lunar-nodes', title: 'The lunar nodes', aliases: ['nodes', 'north node', 'south node', 'true node'], glossary: ['lunar-nodes', 'north-node', 'south-node', 'true-node'], pages: [{ title: 'How we calculate', path: '/methodology/' }], related: ['eclipses'] },
  {
    key: 'chinese-zodiac', title: 'The Chinese zodiac', aliases: ['chinese astrology', 'chinese zodiac basics', 'chinese animal', 'zodiac animals', 'lunar new year', 'chinese new year'], glossary: [],
    extra: () => [CHINESE_ZODIAC_COPY.hubIntro, CHINESE_ZODIAC_COPY.separateBody, CHINESE_ZODIAC_COPY.historyBody, CHINESE_ZODIAC_COPY.boundaryBody],
    pages: [{ title: 'The Chinese zodiac', path: '/learn/chinese-zodiac/' }], related: ['zodiac'],
  },
];

/** Systems this tool does not explain, and what the answer says instead. */
const OUT_OF_SCOPE = ['tarot', 'numerology', 'horary', 'vedic', 'jyotish', 'sidereal astrology', 'human design', 'palmistry', 'i ching', 'crystals', 'kabbalah'];

export const EXPLAIN_TOPICS: readonly string[] = TOPICS.map((topic) => topic.key);

/** Lower case, with accents and punctuation folded; every word kept. */
function clean(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

/** As clean, with "what is" and similar framing dropped. */
function fold(text: string): string {
  return clean(text)
    .replace(/\b(what|whats|is|are|does|do|mean|means|meaning|explain|tell|me|about|the|a|an|in|astrology|my|of|how|work|works)\b/gu, ' ')
    .replace(/\s+/gu, ' ').trim();
}

/**
 * Aliases that are everyday words too (fall, fire, earth, chart): they name a
 * topic only when they are the whole query, so "falling in love" or "is the
 * Earth round" never reaches rulership or the elements.
 */
const WHOLE_QUERY_ONLY = new Set(['fall', 'fire', 'earth', 'air', 'water', 'chart', 'fixed', 'cardinal', 'mutable', 'modes', 'qualities', 'asc', 'rx', 'orb', 'orbs', 'station', 'ruler', 'rulers', 'nodes']);

const PLANET_WORDS = PLANETS.map((planet) => planet.toLowerCase()).join('|');
const SIGN_WORDS = SIGNS.map((sign) => sign.slug).join('|');
const HOUSE_WORDS = `${HOUSE_SLUGS.join('|')}|1[0-2](?:st|nd|rd|th)?|[1-9](?:st|nd|rd|th)?`;
const PLANET_IN_SIGN = new RegExp(`\\b(${PLANET_WORDS}) (?:is )?in (${SIGN_WORDS})\\b`, 'u');
const SIGN_PLANET = new RegExp(`\\b(${SIGN_WORDS}) (${PLANET_WORDS})\\b`, 'u');
// "Jupiter in the 12th house", "Jupiter in 12th", "Jupiter in the twelfth", "Venus in house 7".
// A bare number or ordinal names a house only when no degree, decan or sign follows it:
// "Jupiter in 12 Leo" and "Moon in the first decan of Scorpio" are not house placements.
const NOT_A_HOUSE = `(?! (?:degrees?|deg|decans?|minutes?|of|${SIGN_WORDS})\\b)`;
const PLANET_IN_HOUSE = new RegExp(`\\b(${PLANET_WORDS}) (?:is )?in (?:the |my |your )?(?:(${HOUSE_WORDS})(?: house\\b|\\b${NOT_A_HOUSE})|house (1[0-2]|[1-9])\\b)`, 'u');
// "12th house Jupiter", "Jupiter 12th house".
const HOUSE_PLANET = new RegExp(`\\b(${HOUSE_WORDS}) house (${PLANET_WORDS})\\b`, 'u');
const PLANET_HOUSE = new RegExp(`\\b(${PLANET_WORDS}) (${HOUSE_WORDS}) house\\b`, 'u');
// "Leo rising", "Virgo ascendant", "ascendant in Virgo", "rising sign Leo".
const SIGN_RISING = new RegExp(`\\b(${SIGN_WORDS}) (?:rising|ascendant|asc)\\b`, 'u');
const RISING_SIGN = new RegExp(`\\b(?:rising|ascendant|asc)(?: sign)? (?:is |in |of )?(${SIGN_WORDS})\\b`, 'u');
// "Midheaven in Capricorn", "MC in Capricorn", "Capricorn Midheaven", "IC in Cancer", "imum coeli in Cancer".
const MC_WORDS = 'midheaven|mid heaven|mc|m c|medium coeli';
const IC_WORDS = 'ic|imum coeli';
const ANGLE_IN_SIGN = new RegExp(`\\b(${MC_WORDS}|${IC_WORDS})(?: sign)? (?:is |in |of )+(${SIGN_WORDS})\\b`, 'u');
const SIGN_ANGLE = new RegExp(`\\b(${SIGN_WORDS}) (${MC_WORDS}|${IC_WORDS})\\b`, 'u');
const BEYOND_TWELVE = ['zeroth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
// A house past the twelfth (or a zeroth), with or without the word house after a planet.
const NO_SUCH_HOUSE = new RegExp(`\\b(?:(\\d+(?:st|nd|rd|th)?|${BEYOND_TWELVE.join('|')}) house|house (\\d+)|(?:${PLANET_WORDS}) (?:is )?in (?:the |my |your )?(\\d+(?:st|nd|rd|th)|${BEYOND_TWELVE.join('|')})\\b${NOT_A_HOUSE})\\b`, 'u');
const DIGNITY = /\b(?:in|its|their) (?:fall|detriment|exaltation|domicile)\b/u;

export interface Placement { planet: (typeof PLANETS)[number]; sign: Sign | null; house: number | null }

/** A planet placed in a sign or a house, as in "Moon in Scorpio", "Scorpio Moon" or "Mars in the 10th house"; null otherwise. */
export function matchPlacement(query: string): Placement | null {
  const text = clean(query);
  const planetNamed = (word: string) => PLANETS.find((planet) => planet.toLowerCase() === word)!;
  const houseNumber = (word: string) => (HOUSE_SLUGS.includes(word) ? HOUSE_SLUGS.indexOf(word) + 1 : Number.parseInt(word, 10));
  const house = text.match(PLANET_IN_HOUSE);
  if (house) return { planet: planetNamed(house[1]), sign: null, house: houseNumber(house[2] ?? house[3]) };
  const houseFirst = text.match(HOUSE_PLANET);
  if (houseFirst) return { planet: planetNamed(houseFirst[2]), sign: null, house: houseNumber(houseFirst[1]) };
  const planetHouse = text.match(PLANET_HOUSE);
  if (planetHouse) return { planet: planetNamed(planetHouse[1]), sign: null, house: houseNumber(planetHouse[2]) };
  const inSign = text.match(PLANET_IN_SIGN);
  if (inSign) return { planet: planetNamed(inSign[1]), sign: SIGNS.find((sign) => sign.slug === inSign[2])!, house: null };
  const signFirst = text.match(SIGN_PLANET);
  if (signFirst) return { planet: planetNamed(signFirst[2]), sign: SIGNS.find((sign) => sign.slug === signFirst[1])!, house: null };
  return null;
}

/** The sign a query puts on the ascendant, as in "Leo rising", "Virgo ascendant" or "ascendant in Virgo"; null otherwise. */
export function matchRising(query: string): Sign | null {
  const text = clean(query);
  const slug = text.match(SIGN_RISING)?.[1] ?? text.match(RISING_SIGN)?.[1];
  return slug ? SIGNS.find((sign) => sign.slug === slug)! : null;
}

export interface AnglePlacement { angle: 'midheaven' | 'ic'; sign: Sign }

/** The Midheaven or the IC in a sign, as in "Midheaven in Capricorn", "MC in Capricorn" or "Cancer IC"; null otherwise. */
export function matchAngleSign(query: string): AnglePlacement | null {
  const text = clean(query);
  const inSign = text.match(ANGLE_IN_SIGN);
  const signFirst = inSign ? null : text.match(SIGN_ANGLE);
  const [word, slug] = inSign ? [inSign[1], inSign[2]] : signFirst ? [signFirst[2], signFirst[1]] : [null, null];
  if (!word || !slug) return null;
  return { angle: new RegExp(`^(?:${IC_WORDS})$`, 'u').test(word) ? 'ic' : 'midheaven', sign: SIGNS.find((sign) => sign.slug === slug)! };
}

/** A house the chart does not have, as written ("13th", "thirteenth"), for "Moon in the 13th house"; null otherwise. */
export function matchNoSuchHouse(query: string): string | null {
  const match = clean(query).match(NO_SUCH_HOUSE);
  if (!match) return null;
  const written = match[1] ?? match[2] ?? match[3];
  if (BEYOND_TWELVE.includes(written)) return written;
  const number = Number.parseInt(written, 10);
  return number >= 1 && number <= 12 ? null : written;
}

/** The curated topic a query names, or null. A placement names its planet, a sign rising the rising sign; then exact keys and aliases, then the longest one contained in the query. */
export function matchTopic(query: string): Topic | null {
  if (matchNoSuchHouse(query)) return TOPICS.find((topic) => topic.key === 'houses')!;
  const placement = matchPlacement(query);
  if (placement) return TOPICS.find((topic) => topic.key === placement.planet.toLowerCase())!;
  if (matchRising(query)) return TOPICS.find((topic) => topic.key === 'rising-sign')!;
  const angle = matchAngleSign(query);
  if (angle) return TOPICS.find((topic) => topic.key === angle.angle)!;
  if (DIGNITY.test(clean(query))) return TOPICS.find((topic) => topic.key === 'rulership')!;
  const folded = fold(query);
  if (!folded) return null;
  const names = TOPICS.flatMap((topic) => [topic.key.replace(/-/gu, ' '), fold(topic.title), ...topic.aliases.map(fold)].filter(Boolean).map((name) => ({ name, topic })));
  const exact = names.find((entry) => entry.name === folded);
  if (exact) return exact.topic;
  const contained = names.filter((entry) => !WHOLE_QUERY_ONLY.has(entry.name) && ` ${folded} `.includes(` ${entry.name} `)).sort((a, b) => b.name.length - a.name.length);
  return contained[0]?.topic ?? null;
}

/** What a sign on the ascendant adds to the rising-sign explainer: the site's reading of that rising sign and its page. */
function risingParts(sign: Sign): { title: string; paragraphs: string[]; pages: Topic['pages']; related: string[] } {
  return {
    title: `${sign.name} rising`,
    paragraphs: [bigThree('rising', sign.slug)],
    pages: [{ title: `${sign.name} rising`, path: `/rising-sign/${sign.slug}/` }, { title: `${sign.name} on Zodiacs`, path: `/${sign.slug}/` }],
    related: [sign.slug, 'big-three'],
  };
}

/**
 * What a sign adds to the Midheaven or IC explainer. Zodiacs writes no reading of its own for an angle in a sign, so
 * the answer says so and gives the two parts it is read from: the angle (above) and the sign, in the glossary's words.
 */
function angleParts({ angle, sign }: AnglePlacement): { title: string; paragraphs: string[]; pages: Topic['pages']; related: string[] } {
  const name = angle === 'midheaven' ? 'Midheaven' : 'IC';
  const house = angle === 'midheaven' ? 10 : 4;
  return {
    title: `${name} in ${sign.name}`,
    paragraphs: [
      `Zodiacs has no separate reading for the ${name} in ${sign.name}. Astrology reads it by combining the two: the ${name}'s themes (${NATAL_HOUSE_THEME[house]}) expressed in ${sign.name}'s style.`,
      `${term(sign.slug).definition} For the sign's style, this is how Zodiacs reads ${sign.name} as a Sun sign: ${bigThree('sun', sign.slug)}`,
    ],
    pages: [{ title: `${sign.name} on Zodiacs`, path: `/${sign.slug}/` }],
    related: [sign.slug, 'birth-chart'],
  };
}

/** What a placement adds to its planet's explainer: the sign's style or the house's life area, and their pages. */
function placementParts({ planet, sign, house }: Placement): { title: string; paragraphs: string[]; pages: Topic['pages']; related: string[] } {
  if (sign) {
    return {
      title: `${planet} in ${sign.name}`,
      paragraphs: [placementContext(planet as BodyName, sign.slug, null).how],
      pages: [{ title: `${planet} in ${sign.name}`, path: `/learn/placements/${planet.toLowerCase()}-in-${sign.slug}/` }, { title: `${sign.name} on Zodiacs`, path: `/${sign.slug}/` }],
      related: [sign.slug, 'birth-chart'],
    };
  }
  const slug = HOUSE_SLUGS[house! - 1];
  return {
    title: `${planet} in the ${cap(slug)} house`,
    paragraphs: [planetInHouseLine(planet, house!)],
    pages: [{ title: `The ${slug} house`, path: `/learn/houses/${slug}-house/` }],
    related: [`${slug}-house`, 'houses', 'birth-chart'],
  };
}

/** Two Sun signs in a compatibility question, such as "Leo and Scorpio" or "are leo and scorpio compatible". */
export function matchSignPair(query: string): { a: string; b: string } | null {
  const text = clean(query);
  const joined = text.match(new RegExp(`\\b(${SIGN_WORDS})(?:\\s+(?:and|with)\\s+|-)(${SIGN_WORDS})\\b`, 'u'));
  if (joined) return { a: joined[1], b: joined[2] };
  const signs = [...text.matchAll(new RegExp(`\\b(${SIGN_WORDS})\\b`, 'gu'))].map((match) => match[1]);
  const unique = [...new Set(signs)];
  const compatibility = /\b(?:compatib\w*|synastry)\b/u.test(text);
  const bare = signs.length === 2 && text.split(' ').filter(Boolean).length <= 3;
  if (unique.length === 2 && (compatibility || bare)) return { a: unique[0], b: unique[1] };
  return null;
}

const PAIR_GUIDANCE = 'If either person is under 18, give the element and modality pattern and do not frame the pair as romance or attraction.';

function signPairAnswer(query: string, a: string, b: string, origin: string): { data: ExplainData; links: { title: string; url: string }[] } {
  const slug = pairSlug(a, b);
  const pattern = pairPattern(a, b);
  const names = pattern.facts.same ? `Two ${pattern.facts.a.name} people` : `${pattern.facts.a.name} and ${pattern.facts.b.name}`;
  const essay = (pairPages as Record<string, string[]>)[slug] ?? [];
  const paragraphs = [
    `${names}. ${pattern.elementNote} ${pattern.modalityNote} ${pattern.polarityNote} ${pattern.rulers}.`,
    'Confidence 70%. This is the Sun-sign pattern; the rest of both charts changes how it is lived.',
    ...essay,
  ].map(softenHealth);
  const page = { title: `${names} on Zodiacs`, url: `${origin}/compatibility/${slug}/` };
  const data: ExplainData = {
    found: true,
    query,
    topic: slug,
    title: names,
    paragraphs,
    terms: [],
    pages: [page],
    related: ['synastry', 'elements', 'modalities'].filter((key) => EXPLAIN_TOPICS.includes(key)),
    topics: [],
    message: PAIR_GUIDANCE,
    note: EXPLAIN_NOTE,
  };
  return { data, links: [page, { title: 'Compatibility on Zodiacs', url: `${origin}/compatibility/` }] };
}

export function explainAstrology(args: ExplainInput, origin = DEFAULT_ORIGIN): { data: ExplainData; links: { title: string; url: string }[] } {
  // Checked on the words as written, so "sidereal astrology" is seen before "astrology" is dropped.
  const words = clean(args.topic);
  const outside = OUT_OF_SCOPE.find((name) => ` ${words} `.includes(` ${name} `));
  const pair = outside ? null : matchSignPair(args.topic);
  if (pair) return signPairAnswer(args.topic, pair.a, pair.b, origin);
  const topic = outside ? null : matchTopic(args.topic);
  if (!topic) {
    const data: ExplainData = {
      found: false, query: args.topic, topic: null, title: null, paragraphs: [], terms: [], pages: [], related: [], topics: [...EXPLAIN_TOPICS],
      message: outside
        ? `Zodiacs explains Western tropical astrology and the Chinese zodiac; it does not cover ${outside}. Say so plainly rather than explaining it from Zodiacs.`
        : 'Zodiacs has no explainer for that topic. Choose one of the listed topics, or answer without Zodiacs.',
      note: EXPLAIN_NOTE,
    };
    return { data, links: [{ title: 'Learn astrology on Zodiacs', url: `${origin}/learn/` }, { title: 'Glossary', url: `${origin}/learn/glossary/` }] };
  }
  const terms = topic.glossary.map(term);
  const lead = terms[0];
  // "Moon in the 13th house": say first that there is no such house, then explain the twelve.
  const noSuchHouse = matchNoSuchHouse(args.topic);
  // A bare number reads as "house 0", an ordinal or a word as "13th house" or "zeroth house".
  const noSuchHouseName = noSuchHouse && /^\d+$/u.test(noSuchHouse) ? `house ${noSuchHouse}` : `${noSuchHouse} house`;
  const noSuchHouseLine = noSuchHouse
    ? `There is no ${noSuchHouseName}; houses are numbered 1 to 12. A birth chart in Western astrology has exactly twelve houses, and every planet falls in one of them.`
    : null;
  const paragraphs = [
    ...(noSuchHouseLine ? [noSuchHouseLine] : []),
    ...(lead ? [lead.plainDefinition ? `${lead.plainDefinition} ${lead.definition}` : lead.definition] : []),
    ...(topic.extra?.() ?? []),
  ].filter((paragraph, index, all) => paragraph && all.indexOf(paragraph) === index).map(softenHealth);
  const placement = noSuchHouse ? null : matchPlacement(args.topic);
  const rising = noSuchHouse || placement ? null : matchRising(args.topic);
  const angle = noSuchHouse || placement || rising ? null : matchAngleSign(args.topic);
  const placed = placement ? placementParts(placement) : rising ? risingParts(rising) : angle ? angleParts(angle) : null;
  if (placed) paragraphs.push(...placed.paragraphs.map(softenHealth));
  const pages = [...(placed?.pages ?? []), ...topic.pages].map((page) => ({ title: page.title, url: `${origin}${page.path}` }));
  const data: ExplainData = {
    found: true,
    query: args.topic,
    topic: topic.key,
    title: placed?.title ?? topic.title,
    paragraphs,
    terms: terms.slice(lead ? 1 : 0).map((entry) => ({ term: entry.term, definition: entry.plainDefinition ?? entry.definition, url: `${origin}/learn/glossary/#${entry.slug}` })),
    pages,
    related: [...new Set([...(placed?.related ?? []), ...topic.related])].filter((key) => EXPLAIN_TOPICS.includes(key)),
    topics: [],
    message: noSuchHouse ? `Western astrology has twelve houses, numbered 1 to 12; there is no ${noSuchHouseName}. Say so plainly before explaining the twelve.` : null,
    note: EXPLAIN_NOTE,
  };
  return { data, links: [...pages, { title: 'Glossary', url: `${origin}/learn/glossary/` }] };
}
