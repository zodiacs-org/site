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
 * placement page linked. Two Sun signs in a compatibility question, such as
 * "Leo and Scorpio", are answered from the sign-pair page's own essay
 * (pair-pages.json, built by scripts/build-pair-pages.mjs from
 * src/content/pairs/); asked about them as friends, it gives the pattern alone,
 * with no romantic wording, because the pair pages are written about romance.
 * An explainer explains; it carries no reading-confidence label. Pure: no
 * network, storage or logging.
 *
 * With ZODIACS_SKY_EVENTS_ENABLED=1 (options.skyEvents) it explains, in plain
 * words first, the lunar nodes, the void-of-course Moon, Placidus and
 * whole-sign houses, eclipses, stations and retrograde loops, new and full
 * Moons, ingresses and Chiron, each with its pages and the tool that dates it
 * (search_sky_events, get_natal_chart). Any question naming Chiron is Chiron's,
 * with its sign or house added when one is named. Switched off, it answers as
 * before.
 */
import { z } from 'zod';
import { CHINESE_ZODIAC_COPY } from '../../data/chinese-zodiac';
import { GLOSSARY, type GlossaryTerm } from '../../data/glossary';
import { bigThree } from '../../lib/interpretations';
import { NATAL_HOUSE_THEME, planetInHouseLine } from '../../lib/natal';
import { NATAL_BODY_THEME, placementContext } from '../../lib/natal-context';
import { pairPattern, type PairPattern } from '../../lib/compat-reading';
import { pairSlug } from '../../lib/compat';
import { SIGNS, type Sign } from '../../lib/signs';
import type { BodyName } from '../../lib/engine/types';
import { MOON_MONTH_NAMES } from '../../lib/events/format';
import { softenHealth, softenMinor } from './reading-guards';
import { chironHouseLine, chironSignLine } from './chiron';
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
/** With ZODIACS_SKY_EVENTS_ENABLED=1: the same field, naming the topics the switch adds. */
export const explainInputWithSkyEvents = z.strictObject({
  topic: z.string().trim().min(1).max(80).describe('What to explain, in a few words: a sign (leo), a planet (Mercury), a placement (Moon in Scorpio, Jupiter in the 12th), Chiron or Chiron in a sign or house, the houses or one house (seventh house), Placidus or whole-sign houses, aspects or one aspect (square), retrogrades, stations or Mercury retrograde, Moon phases, new and full Moons, the void-of-course Moon, eclipses, the lunar nodes, ingresses (sign changes), the rising sign or a sign rising (Leo rising), the Midheaven, the big three, cusps, Saturn return, elements, modalities, transits, synastry or the Chinese zodiac.'),
});

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
  /** The plain-word paragraphs lead, before the glossary's definition. */
  plainFirst?: boolean;
}

/** Which topic list to answer from: ZODIACS_SKY_EVENTS_ENABLED=1 adds the event and house topics. */
export interface ExplainOptions { skyEvents?: boolean }

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
  {
    key: 'saturn-return', title: 'The Saturn return', aliases: ['saturn returns', 'my saturn return'], glossary: ['saturn-return', 'return', 'saturn'],
    extra: () => ['A Saturn return is when Saturn comes back to the zodiac degree it occupied at birth. Saturn takes about 29.5 years to go around the zodiac, so the first return falls around age 29, the second around 58 and the third around 88. Astrology reads it as a reckoning with responsibility, work and the structures a person has built: a season of sorting what still holds. Retrograde motion can make Saturn cross that degree more than once, and each crossing is kept as its own date. For the dates, use get_life_milestones or get_personal_transits.'],
    pages: [{ title: 'Saturn return', path: '/saturn-return/' }], related: ['solar-return', 'transits', 'saturn'],
  },
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
    extra: () => [CHINESE_ZODIAC_COPY.hubIntro, CHINESE_ZODIAC_COPY.separateBody, CHINESE_ZODIAC_COPY.historyBody, CHINESE_ZODIAC_COPY.boundaryBody, 'For one person\'s animal from a birth date, use get_chinese_zodiac.'],
    pages: [{ title: 'The Chinese zodiac', path: '/learn/chinese-zodiac/' }], related: ['zodiac'],
  },
];

/** Systems this tool does not explain, and what the answer says instead. */
const OUT_OF_SCOPE = ['tarot', 'numerology', 'horary', 'vedic', 'jyotish', 'sidereal astrology', 'human design', 'palmistry', 'i ching', 'crystals', 'kabbalah'];

export const EXPLAIN_TOPICS: readonly string[] = TOPICS.map((topic) => topic.key);

/**
 * The topics ZODIACS_SKY_EVENTS_ENABLED=1 adds or rewrites, in plain words first. Each points to the tool that dates
 * the events or reads them in a chart, which the switch offers.
 */
const SKY_EVENTS_REWRITTEN: Record<string, Topic> = {
  'lunar-nodes': {
    key: 'lunar-nodes', title: 'The lunar nodes', aliases: ['nodes', 'north node', 'south node', 'true node', 'mean node', 'lunar node', 'moon nodes', 'nodes of the moon', 'north and south node'],
    glossary: ['lunar-nodes', 'north-node', 'south-node', 'true-node'], plainFirst: true,
    extra: () => [
      'The lunar nodes are the two points where the Moon\'s path around the sky crosses the Sun\'s. The North Node is where the Moon crosses going north, and the South Node sits exactly opposite it. The nodes drift backward through the zodiac and go all the way round in about 18.6 years, so they stay about a year and a half in each sign.',
      'Astrology reads the North Node as a direction of growth, what a person is learning to reach for, and the South Node as familiar patterns and existing strengths, what comes easily. It is a symbolic reading, not a fixed destiny.',
      'Eclipses happen when a new or full Moon falls near the nodes, so each year\'s eclipses fall in or near the signs the nodes are passing through.',
      'Zodiacs uses the true node, where the Moon\'s orbit crosses the ecliptic at that moment. Some astrologers use the mean node, an averaged position that can differ from it by up to about two degrees. For a person\'s own North and South Node, with their signs and houses, use get_natal_chart.',
    ],
    pages: [{ title: 'Eclipses', path: '/eclipses/' }, { title: 'How we calculate', path: '/methodology/' }, { title: 'Lunar nodes in the glossary', path: '/learn/glossary/#lunar-nodes' }],
    related: ['eclipses', 'birth-chart'],
  },
  'void-of-course-moon': {
    key: 'void-of-course-moon', title: 'The void-of-course Moon', aliases: ['void of course', 'void of course moon', 'voc moon', 'moon void of course', 'void moon'],
    glossary: ['void-of-course-moon'], plainFirst: true,
    extra: () => [
      'The Moon is void of course between its last major aspect in a sign and its entry into the next sign. Once it has made that last contact, a conjunction, sextile, square, trine or opposition to the Sun or a planet, it makes no other until it changes sign. These stretches come every two to three days, as the Moon changes sign, and last from a few minutes to a day or two.',
      'Astrology reads a void-of-course Moon as a pause: a poor moment to start something that needs to go somewhere, and a fair one for finishing, resting or routine.',
      'Which bodies count differs between astrologers: traditional astrologers stop at Saturn, so under their rule some periods begin earlier. Zodiacs counts the Sun and every planet through Pluto, on its void-of-course calendar and in search_sky_events alike, so both give the same times. For the periods in the coming weeks, use search_sky_events.',
    ],
    pages: [{ title: 'Void-of-course Moon calendar', path: '/void-of-course-moon/' }, { title: 'The void-of-course rule in the conventions registry', path: '/developers/conventions/#void-of-course-bodies:modern' }],
    related: ['moon-phases', 'moon', 'new-and-full-moons'],
  },
  eclipses: {
    key: 'eclipses', title: 'Eclipses', aliases: ['eclipse', 'solar eclipse', 'lunar eclipse', 'eclipse season', 'solar eclipses', 'lunar eclipses', 'blood moon'],
    glossary: ['eclipse', 'solar-eclipse', 'lunar-eclipse', 'eclipse-season'], plainFirst: true,
    extra: () => [
      'An eclipse is a new or full Moon that falls close to the lunar nodes, so the Sun, Earth and Moon line up. At a solar eclipse the new Moon passes in front of the Sun and hides some or all of it from people in its path. At a lunar eclipse the full Moon passes through Earth\'s shadow and dims, turning red when the eclipse is total.',
      'Eclipses come in seasons about six months apart, usually a solar and a lunar eclipse two weeks from each other, so there are four to seven a year.',
      'Astrology reads eclipses as stronger new and full Moons: a solar eclipse as a fresh start, a lunar eclipse as something coming to a head, in the area of life where it falls in a chart.',
      'For the dates, signs and local times of the eclipses from 2026 to 2030, use search_sky_events.',
    ],
    pages: [{ title: 'Eclipses', path: '/eclipses/' }, { title: 'Eclipses in 2027', path: '/eclipses/2027/' }],
    related: ['moon-phases', 'lunar-nodes', 'new-and-full-moons'],
  },
};
/** New topics, each placed after the topic it was part of, which gives up the aliases that now lead to it. */
const SKY_EVENTS_ADDED: Record<string, { topic: Topic; drop: string[] }> = {
  planets: {
    drop: [],
    topic: {
      key: 'chiron', title: 'Chiron',
      aliases: ['planet chiron', 'chiron placement', 'chiron sign', 'my chiron', 'wounded healer', 'the wounded healer', 'chiron return', 'chiron retrograde', 'chiron in my chart', '2060 chiron', 'centaur chiron'],
      glossary: [], plainFirst: true,
      extra: () => [
        'Chiron is a small body, part asteroid and part comet, that orbits the Sun between Saturn and Uranus once about every 50 years. It was found in 1977 and named after the centaur of Greek myth, a teacher and healer who could not cure his own wound.',
        'Astrology reads Chiron as an old hurt or sensitive spot, and the understanding that grows from living with it, which a person can later offer others. Its sign describes the style of that sensitive spot, and its house the area of life where it shows. It is a symbolic reading, not a prediction or a fixed destiny.',
        'Its orbit is long and stretched, so Chiron spends anything from little more than a year in Virgo or Libra to eight or nine years in Aries. It turns retrograde for four to five months each year, and comes back to the degree it held at birth at about age 50, which astrologers call the Chiron return.',
        'Zodiacs takes Chiron\'s positions from NASA JPL Horizons, for 1800 to 2199. For a person\'s own Chiron, with its sign, house and aspects, use get_natal_chart; for the dates Chiron turns retrograde or direct or changes sign, use search_sky_events.',
      ],
      pages: [{ title: 'The planets', path: '/learn/planets/' }, { title: 'How to read a birth chart', path: '/learn/how-to-read-a-birth-chart/' }, { title: 'Retrogrades', path: '/retrogrades/' }],
      related: ['planets', 'saturn', 'uranus', 'retrogrades', 'birth-chart'],
    },
  },
  houses: {
    drop: ['house system', 'whole sign houses', 'placidus'],
    topic: {
      key: 'house-systems', title: 'Placidus and whole-sign houses',
      aliases: ['house system', 'house systems', 'placidus', 'placidus houses', 'placidus house system', 'whole sign', 'whole sign houses', 'whole sign house system', 'placidus vs whole sign', 'placidus or whole sign', 'whole sign vs placidus', 'whole sign or placidus', 'placidus and whole sign', 'quadrant houses', 'polar fallback'],
      glossary: ['house-system', 'whole-sign-houses', 'placidus', 'polar-fallback'], plainFirst: true,
      extra: () => [
        'A house system decides where each of the twelve houses begins. In whole-sign houses each house is one whole sign: the sign rising at birth is the first house, the next sign the second, and so on round the chart. It is the oldest way of drawing houses and the simplest to read, and Zodiacs uses it unless asked for another.',
        'Placidus divides the sky by time instead: it splits the time each degree takes to travel from the horizon to the top of the sky, and from the bottom of the sky back up to the horizon, into thirds. Its houses come in different sizes and usually begin partway through a sign. It is the most common system in modern Western astrology.',
        'The two can put a planet near the start or end of a sign in different houses, so the same chart can read a little differently. The rising sign and the Midheaven are the same in both; in whole-sign houses the Midheaven need not fall in the tenth house.',
        'Placidus cannot be drawn far from the equator: from about 66.6 degrees north or south, some degrees of the zodiac never rise or set, so Zodiacs uses whole-sign houses there and says so. For Placidus houses in a chart, give get_natal_chart houseSystem placidus.',
      ],
      pages: [{ title: 'Compare house systems on the birth chart page', path: '/birth-chart/' }, { title: 'The houses', path: '/learn/houses/' }, { title: 'How we calculate', path: '/methodology/' }],
      related: ['houses', 'rising-sign', 'midheaven', 'birth-chart'],
    },
  },
  retrogrades: {
    drop: ['station', 'stationing'],
    topic: {
      key: 'stations', title: 'Stations and retrograde loops',
      aliases: ['station', 'stations', 'stationing', 'stationary', 'planet stationing', 'stations retrograde', 'stations direct', 'station retrograde', 'station direct', 'stationing retrograde', 'stationing direct', 'turns direct', 'turning direct', 'goes direct', 'going direct', 'retrograde station', 'direct station', 'retrograde loop', 'retrograde loops', 'retrograde shadow', 'shadow period', 'pre shadow', 'post shadow'],
      glossary: ['station', 'retrograde-loop', 'direct', 'retrograde'], plainFirst: true,
      extra: () => [
        'A planet stations when it seems to stand still in the sky before it changes direction. At its retrograde station it starts to move backward through the zodiac; at its direct station, weeks or months later, it moves forward again. The planet\'s orbit does not change: this is how it looks from a moving Earth.',
        'The path between the two stations is the retrograde loop. The planet crosses the same few degrees three times, forward, back and forward again, so a degree in that stretch can be met three times. Astrologers call that stretch the shadow: the planet enters it before the retrograde station and leaves it after the direct one.',
        'Astrology treats a station as the turning point of a retrograde and the station degree as its most sensitive point. The days around it, when the planet barely moves, are read as the time its themes are strongest.',
        'For the dates and degrees of the stations of Mercury through Pluto, months or years ahead, use search_sky_events.',
      ],
      pages: [{ title: 'Retrogrades', path: '/retrogrades/' }, { title: 'Mercury retrograde', path: '/mercury-retrograde/' }],
      related: ['retrogrades', 'mercury-retrograde', 'transits'],
    },
  },
  'moon-phases': {
    drop: ['new moon', 'full moon', 'lunation'],
    topic: {
      key: 'new-and-full-moons', title: 'New and full Moons',
      aliases: ['new moon', 'full moon', 'new moons', 'full moons', 'new and full moon', 'new and full moons', 'lunation', 'lunations', 'blue moon', 'full moon names'],
      glossary: ['new-moon', 'full-moon', 'lunation'], plainFirst: true,
      extra: () => [
        'At a new Moon the Moon and the Sun are at the same degree of the same sign, so the Moon\'s lit side faces away from Earth and it cannot be seen. About two weeks later, at the full Moon, the Moon is opposite the Sun and fully lit. One new Moon to the next takes about 29.5 days, so a year has twelve or thirteen of each.',
        'Astrology reads a new Moon as a time to begin and set intentions, and a full Moon as a time when something comes to a head, is finished or is seen clearly. Each is read through its sign: a full Moon in Taurus touches Taurus themes. When one falls near the lunar nodes it is also an eclipse.',
        `Full Moons also carry traditional names, one for each month, from the ${MOON_MONTH_NAMES[0]} Moon in January to the ${MOON_MONTH_NAMES[11]} Moon in December; a second full Moon in one calendar month is a blue moon.`,
        'For the dates, signs and local times of the new and full Moons months or years ahead, use search_sky_events.',
      ],
      pages: [{ title: 'Full Moon calendar', path: '/full-moon-calendar/' }, { title: 'Moon phases', path: '/moon-phase/' }],
      related: ['moon-phases', 'eclipses', 'moon'],
    },
  },
  transits: {
    drop: ['ingress', 'ingresses', 'sign change'],
    topic: {
      key: 'ingresses', title: 'Ingresses: planets changing sign',
      aliases: ['ingress', 'ingresses', 'sign change', 'sign changes', 'changes sign', 'changing signs', 'changing sign', 'enters a sign', 'entering a sign', 'planet changes sign', 'planets changing signs'],
      glossary: ['ingress', 'zodiac-season'], plainFirst: true,
      extra: () => [
        'An ingress is the moment a planet moves into a new sign. The Sun changes sign about once a month, which is why each sign has its season. The Moon changes sign every two to three days. Mercury, Venus and Mars take weeks to months, Jupiter about a year, Saturn about two and a half years, and Uranus, Neptune and Pluto from seven to more than twenty years.',
        'Astrology reads an ingress as a change of tone: the planet\'s themes start to take on the style of the new sign. A planet that turns retrograde can slip back into the sign it just left and enter the new one again, so a slow planet\'s change of sign often comes in two or three steps.',
        'For the dates of the sign changes of the Sun through Pluto, months or years ahead, use search_sky_events; the Moon\'s are in get_upcoming_events.',
      ],
      pages: [{ title: 'Zodiac dates: when the Sun changes sign', path: '/learn/zodiac-dates/' }, { title: 'Sky events', path: '/events/' }, { title: 'Transits', path: '/transits/' }],
      related: ['transits', 'sun-sign', 'retrogrades', 'stations'],
    },
  },
};
const SKY_EVENTS_TOPICS: Topic[] = TOPICS.flatMap((topic) => {
  const added = SKY_EVENTS_ADDED[topic.key];
  const kept = SKY_EVENTS_REWRITTEN[topic.key]
    ?? (added ? { ...topic, aliases: topic.aliases.filter((alias) => !added.drop.includes(alias)), related: [...topic.related, added.topic.key] } : topic);
  return added ? [kept, added.topic] : [kept];
});
/** Every topic explain_astrology explains with ZODIACS_SKY_EVENTS_ENABLED=1. */
export const EXPLAIN_TOPICS_SKY_EVENTS: readonly string[] = SKY_EVENTS_TOPICS.map((topic) => topic.key);
/** Everyday words among the added aliases, which name a topic only as the whole question ("train stations"). */
const WHOLE_QUERY_ONLY_SKY_EVENTS = new Set(['stations', 'stationary', 'whole sign']);

const topicsFor = (options: ExplainOptions) => (options.skyEvents ? SKY_EVENTS_TOPICS : TOPICS);
const keysFor = (options: ExplainOptions) => (options.skyEvents ? EXPLAIN_TOPICS_SKY_EVENTS : EXPLAIN_TOPICS);

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
export function matchTopic(query: string, options: ExplainOptions = {}): Topic | null {
  const topics = topicsFor(options);
  if (matchNoSuchHouse(query)) return topics.find((topic) => topic.key === 'houses')!;
  // With the sky events switch, a question naming Chiron is Chiron's, whatever sign or house it names with it.
  if (options.skyEvents && CHIRON.test(clean(query))) return topics.find((topic) => topic.key === 'chiron')!;
  const placement = matchPlacement(query);
  if (placement) return topics.find((topic) => topic.key === placement.planet.toLowerCase())!;
  if (matchRising(query)) return topics.find((topic) => topic.key === 'rising-sign')!;
  const angle = matchAngleSign(query);
  if (angle) return topics.find((topic) => topic.key === angle.angle)!;
  if (DIGNITY.test(clean(query))) return topics.find((topic) => topic.key === 'rulership')!;
  const folded = fold(query);
  if (!folded) return null;
  const names = topics.flatMap((topic) => [topic.key.replace(/-/gu, ' '), fold(topic.title), ...topic.aliases.map(fold)].filter(Boolean).map((name) => ({ name, topic })));
  const exact = names.find((entry) => entry.name === folded);
  if (exact) return exact.topic;
  const wholeQueryOnly = (name: string) => WHOLE_QUERY_ONLY.has(name) || (!!options.skyEvents && WHOLE_QUERY_ONLY_SKY_EVENTS.has(name));
  const contained = names.filter((entry) => !wholeQueryOnly(entry.name) && ` ${folded} `.includes(` ${entry.name} `)).sort((a, b) => b.name.length - a.name.length);
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

const CHIRON = /\bchiron\b/u;
// "Chiron in Aries", "Aries Chiron", "Chiron in the 12th house", "12th house Chiron", "Chiron 12th house".
const CHIRON_IN_SIGN = new RegExp(`\\bchiron (?:is )?in (${SIGN_WORDS})\\b|\\b(${SIGN_WORDS}) chiron\\b`, 'u');
const CHIRON_IN_HOUSE = new RegExp(`\\bchiron (?:is )?in (?:the |my |your )?(?:(${HOUSE_WORDS})(?: house\\b|\\b${NOT_A_HOUSE})|house (1[0-2]|[1-9])\\b)|\\b(${HOUSE_WORDS}) house chiron\\b|\\bchiron (${HOUSE_WORDS}) house\\b`, 'u');

/** What a sign or a house adds to the Chiron explainer, in the words get_natal_chart gives them; null when neither is named. */
function chironParts(query: string): { title: string; paragraphs: string[]; pages: Topic['pages']; related: string[] } | null {
  const text = clean(query);
  const inSign = text.match(CHIRON_IN_SIGN);
  const slug = inSign?.[1] ?? inSign?.[2];
  if (slug) {
    const sign = SIGNS.find((entry) => entry.slug === slug)!;
    return { title: `Chiron in ${sign.name}`, paragraphs: [chironSignLine(sign.slug, 'Chiron')], pages: [{ title: `${sign.name} on Zodiacs`, path: `/${sign.slug}/` }], related: [sign.slug, 'birth-chart'] };
  }
  const word = text.match(CHIRON_IN_HOUSE)?.slice(1).find(Boolean);
  if (!word) return null;
  const house = HOUSE_SLUGS.includes(word) ? HOUSE_SLUGS.indexOf(word) + 1 : Number.parseInt(word, 10);
  const name = HOUSE_SLUGS[house - 1];
  return { title: `Chiron in the ${cap(name)} house`, paragraphs: [chironHouseLine(house, 'Chiron')], pages: [{ title: `The ${name} house`, path: `/learn/houses/${name}-house/` }], related: [`${name}-house`, 'houses', 'birth-chart'] };
}

/** A friendship question about two signs: "Leo and Scorpio friendship", "are a Leo and a Scorpio good friends". */
const FRIENDSHIP = /\b(?:friend\w*|platonic)\b/u;

/** Two Sun signs in a compatibility or friendship question, such as "Leo and Scorpio" or "are leo and scorpio compatible". */
export function matchSignPair(query: string): { a: string; b: string; friendship: boolean } | null {
  const text = clean(query);
  const friendship = FRIENDSHIP.test(text);
  const joined = text.match(new RegExp(`\\b(${SIGN_WORDS})\\s+(?:and|with)\\s+(${SIGN_WORDS})\\b`, 'u'));
  if (joined) return { a: joined[1], b: joined[2], friendship };
  const signs = [...text.matchAll(new RegExp(`\\b(${SIGN_WORDS})\\b`, 'gu'))].map((match) => match[1]);
  const unique = [...new Set(signs)];
  const compatibility = /\b(?:compatib\w*|synastry)\b/u.test(text);
  const bare = signs.length === 2 && text.split(' ').filter(Boolean).length <= 3;
  if (unique.length === 2 && (compatibility || friendship || bare)) return { a: unique[0], b: unique[1], friendship };
  return null;
}

/**
 * How two Sun signs' elements get along as friends, by element pair. The pair pages' taglines (compat.ts) are
 * written about couples, and a friendship reading is also the one given for anyone under 18, so it never uses
 * them: these lines are about energy, pace, plans and how the two talk.
 */
const FRIENDSHIP_ELEMENTS: Record<string, string> = {
  'fire+fire': 'Full speed. You both bring lots of energy and bold plans, and your quick quarrels are soon forgotten.',
  'earth+fire': 'Quick and careful. One rushes ahead and the other checks the plan: together you get a lot done, though you may disagree about pace.',
  'air+fire': 'Big plans. Lively talk and big ideas: one asks the questions, the other gets things moving, and there is rarely a dull day.',
  'fire+water': 'Bold and gentle. One acts fast and the other feels deeply: you can learn a lot from each other if you are patient with each other’s moods.',
  'earth+earth': 'Steady friends. Reliable and loyal: you can count on each other, though your plans can settle into a routine.',
  'air+earth': 'Dreamer and planner. One brings the ideas and the other makes them practical: you balance each other, though one may find the other too dreamy or too careful.',
  'earth+water': 'Trusted friends. One listens closely and the other keeps things steady, and your trust in each other grows over time.',
  'air+air': 'Endless talk. The conversation never runs out and you both give each other space, though deeper worries can go unsaid.',
  'air+water': 'Head and heart. One wants to talk things through and the other wants to feel them out: with patience, you understand each other well.',
  'water+water': 'Kindred spirits. You understand each other quickly and notice each other’s moods, so small kindnesses go a long way.',
};

/** The same for outgoing (day) and private (night) signs. */
const FRIENDSHIP_POLARITY: Record<string, string> = {
  'day+day': 'Both outgoing: active, sociable friends who are rarely still.',
  'night+night': 'Both private: a quiet, loyal friendship that grows with time.',
  'day+night': 'One outgoing, one private: you balance each other, as one talks it out and the other thinks it through.',
};

const pairKey = (a: string, b: string) => [a, b].sort().join('+');

/** The Sun-sign pattern in a friendship's words: the lines above, and the modality line with a friendship in it. */
function asFriends(pattern: PairPattern): string {
  const { a, b } = pattern.facts;
  const modality = pattern.modalityNote.replace(/\bpartnership\b/gu, 'friendship');
  return softenMinor(softenHealth(`${FRIENDSHIP_ELEMENTS[pairKey(a.element, b.element)]} ${modality} ${FRIENDSHIP_POLARITY[pairKey(a.polarity, b.polarity)]} ${pattern.rulers}.`));
}

const PAIR_GUIDANCE = 'If either person is under 18, give the friendship reading instead: the same two signs with the word friendship in the topic. Do not frame the pair as romance or attraction.';
const FRIENDSHIP_GUIDANCE = 'A friendship reading: the element and modality pattern of the two Sun signs only, with each sign\'s page. The sign-pair essays and their links are left out.';

/**
 * A Sun-sign pair from its compatibility page: the pattern, then the page's essay. As friends: the pattern alone,
 * in friendship words (asFriends), linking the two sign pages rather than the pair page.
 */
function signPairAnswer(query: string, a: string, b: string, friendship: boolean, origin: string): { data: ExplainData; links: { title: string; url: string }[] } {
  const slug = pairSlug(a, b);
  const pattern = pairPattern(a, b);
  const names = pattern.facts.same ? `Two ${pattern.facts.a.name} people` : `${pattern.facts.a.name} and ${pattern.facts.b.name}`;
  if (friendship) {
    const signPages = [...new Set([pattern.facts.a, pattern.facts.b])].map((sign) => ({ title: `${sign.name} on Zodiacs`, url: `${origin}/${sign.slug}/` }));
    const data: ExplainData = {
      found: true,
      query,
      topic: slug,
      title: `${names} as friends`,
      paragraphs: [
        `${names} as friends. ${asFriends(pattern)}`,
        'This is the Sun-sign pattern; the rest of both charts changes how a friendship is lived.',
      ],
      terms: [],
      pages: signPages,
      related: ['elements', 'modalities'].filter((key) => EXPLAIN_TOPICS.includes(key)),
      topics: [],
      message: FRIENDSHIP_GUIDANCE,
      note: EXPLAIN_NOTE,
    };
    return { data, links: signPages };
  }
  const essay = (pairPages as Record<string, string[]>)[slug] ?? [];
  const paragraphs = [
    `${names}. ${pattern.elementNote} ${pattern.modalityNote} ${pattern.polarityNote} ${pattern.rulers}.`,
    'This is the Sun-sign pattern; the rest of both charts changes how it is lived.',
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

export function explainAstrology(args: ExplainInput, origin = DEFAULT_ORIGIN, options: ExplainOptions = {}): { data: ExplainData; links: { title: string; url: string }[] } {
  const keys = keysFor(options);
  // Checked on the words as written, so "sidereal astrology" is seen before "astrology" is dropped.
  const words = clean(args.topic);
  const outside = OUT_OF_SCOPE.find((name) => ` ${words} `.includes(` ${name} `));
  const pair = outside ? null : matchSignPair(args.topic);
  if (pair) return signPairAnswer(args.topic, pair.a, pair.b, pair.friendship, origin);
  const topic = outside ? null : matchTopic(args.topic, options);
  if (!topic) {
    const data: ExplainData = {
      found: false, query: args.topic, topic: null, title: null, paragraphs: [], terms: [], pages: [], related: [], topics: [...keys],
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
  const glossaryLead = lead ? [lead.plainDefinition ? `${lead.plainDefinition} ${lead.definition}` : lead.definition] : [];
  const extra = topic.extra?.() ?? [];
  // The Saturn return's meaning leads, and so do the plain words of the topics the sky events switch adds. The glossary line follows.
  const body = topic.key === 'saturn-return' || topic.plainFirst ? [...extra, ...glossaryLead] : [...glossaryLead, ...extra];
  const paragraphs = [
    ...(noSuchHouseLine ? [noSuchHouseLine] : []),
    ...body,
  ].filter((paragraph, index, all) => paragraph && all.indexOf(paragraph) === index).map(softenHealth);
  // Chiron's explainer adds the sign or house its question names, and no planet's (the topic exists only with the switch).
  const chiron = topic.key === 'chiron';
  const placement = noSuchHouse || chiron ? null : matchPlacement(args.topic);
  const rising = noSuchHouse || placement || chiron ? null : matchRising(args.topic);
  const angle = noSuchHouse || placement || rising || chiron ? null : matchAngleSign(args.topic);
  const placed = chiron ? chironParts(args.topic) : placement ? placementParts(placement) : rising ? risingParts(rising) : angle ? angleParts(angle) : null;
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
    related: [...new Set([...(placed?.related ?? []), ...topic.related])].filter((key) => keys.includes(key)),
    topics: [],
    message: noSuchHouse ? `Western astrology has twelve houses, numbered 1 to 12; there is no ${noSuchHouseName}. Say so plainly before explaining the twelve.` : null,
    note: EXPLAIN_NOTE,
  };
  return { data, links: [...pages, { title: 'Glossary', url: `${origin}/learn/glossary/` }] };
}
