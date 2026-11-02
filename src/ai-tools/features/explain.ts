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
import { SIGNS, type Sign } from '../../lib/signs';
import type { BodyName } from '../../lib/engine/types';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
export const EXPLAIN_NOTE = 'An introduction to how astrology reads these ideas, not a claim that they determine anything.';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const HOUSE_SLUGS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const ASPECTS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

export const explainInput = z.strictObject({
  topic: z.string().trim().min(1).max(80).describe('What to explain, in a few words: a sign (leo), a planet (Mercury), the houses or one house (seventh house), aspects or one aspect (square), retrogrades or Mercury retrograde, Moon phases, the rising sign, the big three, cusps, Saturn return, elements, modalities, transits, synastry, eclipses or the Chinese zodiac.'),
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
const PLANET_IN_HOUSE = new RegExp(`\\b(${PLANET_WORDS}) (?:is )?in (?:the |my )?(?:(${HOUSE_WORDS}) house|house (1[0-2]|[1-9]))\\b`, 'u');
const DIGNITY = /\b(?:in|its|their) (?:fall|detriment|exaltation|domicile)\b/u;

export interface Placement { planet: (typeof PLANETS)[number]; sign: Sign | null; house: number | null }

/** A planet placed in a sign or a house, as in "Moon in Scorpio", "Scorpio Moon" or "Mars in the 10th house"; null otherwise. */
export function matchPlacement(query: string): Placement | null {
  const text = clean(query);
  const planetNamed = (word: string) => PLANETS.find((planet) => planet.toLowerCase() === word)!;
  const house = text.match(PLANET_IN_HOUSE);
  if (house) {
    const word = house[2] ?? house[3];
    const index = HOUSE_SLUGS.indexOf(word);
    return { planet: planetNamed(house[1]), sign: null, house: index >= 0 ? index + 1 : Number.parseInt(word, 10) };
  }
  const inSign = text.match(PLANET_IN_SIGN);
  if (inSign) return { planet: planetNamed(inSign[1]), sign: SIGNS.find((sign) => sign.slug === inSign[2])!, house: null };
  const signFirst = text.match(SIGN_PLANET);
  if (signFirst) return { planet: planetNamed(signFirst[2]), sign: SIGNS.find((sign) => sign.slug === signFirst[1])!, house: null };
  return null;
}

/** The curated topic a query names, or null. A placement names its planet; then exact keys and aliases, then the longest one contained in the query. */
export function matchTopic(query: string): Topic | null {
  const placement = matchPlacement(query);
  if (placement) return TOPICS.find((topic) => topic.key === placement.planet.toLowerCase())!;
  if (DIGNITY.test(clean(query))) return TOPICS.find((topic) => topic.key === 'rulership')!;
  const folded = fold(query);
  if (!folded) return null;
  const names = TOPICS.flatMap((topic) => [topic.key.replace(/-/gu, ' '), fold(topic.title), ...topic.aliases.map(fold)].filter(Boolean).map((name) => ({ name, topic })));
  const exact = names.find((entry) => entry.name === folded);
  if (exact) return exact.topic;
  const contained = names.filter((entry) => !WHOLE_QUERY_ONLY.has(entry.name) && ` ${folded} `.includes(` ${entry.name} `)).sort((a, b) => b.name.length - a.name.length);
  return contained[0]?.topic ?? null;
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

export function explainAstrology(args: ExplainInput, origin = DEFAULT_ORIGIN): { data: ExplainData; links: { title: string; url: string }[] } {
  // Checked on the words as written, so "sidereal astrology" is seen before "astrology" is dropped.
  const words = clean(args.topic);
  const outside = OUT_OF_SCOPE.find((name) => ` ${words} `.includes(` ${name} `));
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
  const paragraphs = [
    ...(lead ? [lead.plainDefinition ? `${lead.plainDefinition} ${lead.definition}` : lead.definition] : []),
    ...(topic.extra?.() ?? []),
  ].filter((paragraph, index, all) => paragraph && all.indexOf(paragraph) === index);
  const placement = matchPlacement(args.topic);
  const placed = placement ? placementParts(placement) : null;
  if (placed) paragraphs.push(...placed.paragraphs);
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
    message: null,
    note: EXPLAIN_NOTE,
  };
  return { data, links: [...pages, { title: 'Glossary', url: `${origin}/learn/glossary/` }] };
}
