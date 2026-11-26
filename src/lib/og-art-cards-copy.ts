/**
 * The words on the Spanish, French, Italian and Portuguese art share cards,
 * taken from what each localized page prints in its first spread, the way
 * the English cards take theirs (src/lib/og-art-cards.mjs):
 *
 * - the homepage: the hero's headline and the first half of its caption;
 * - a sign guide: the sign's name (the hero's title), the first sentence of
 *   the hero's line (`guide.intro[0]`) and the dates from the facts under it;
 * - a daily horoscope (Spanish and Portuguese publish one): the breadcrumb's
 *   "Horóscopos", the hero's title ("Aries hoy") and the dates from its facts.
 *
 * The same module carries the chart twins card's words in those four
 * languages and in Russian (localizedChartTwinsArtCardCopy, below).
 *
 * scripts/build-og-art-card-copy.ts writes them to og-art-cards.locales.mjs
 * for the plain-Node card generator; og-art-cards.test.ts holds that file to
 * this one.
 */
import { HOME_COPY } from '../components/localized/home-copy';
import { LOCALIZED_HOROSCOPE_COPY } from '../components/localized/horoscope-copy';
import { spanishGuideFor } from '../data/es-guides';
import { frenchGuideFor } from '../data/fr-guides';
import { italianGuideFor } from '../data/it-guides';
import { portugueseGuideFor } from '../data/pt-guides';
import { additionText } from '../strings/additions';
import { signDateRange } from './sign-display';
import { SIGNS, signName, type Sign } from './signs';

export const ART_CARD_COPY_LOCALES = ['es', 'fr', 'it', 'pt'] as const;
export type ArtCardCopyLocale = (typeof ART_CARD_COPY_LOCALES)[number];

const GUIDES: Record<ArtCardCopyLocale, (sign: Sign) => { intro: string[] }> = {
  es: spanishGuideFor,
  fr: frenchGuideFor,
  it: italianGuideFor,
  pt: portugueseGuideFor,
};

export interface LocalizedArtCardCopy {
  home: { title: string; subtitle: string };
  signs: Record<string, { name: string; line: string; sub: string }>;
  horoscopes: Record<string, { kicker: string; name: string; sub: string }>;
}

/** As the localized guides capitalise their facts' values. */
const upperFirst = (value: string, locale: ArtCardCopyLocale) =>
  value.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase(locale));

/** The first sentence of a line: up to the first full stop, question or exclamation mark followed by a space. */
export function firstSentence(line: string): string {
  const match = /^.+?[.!?](?=\s|$)/su.exec(line.trim());
  return (match ? match[0] : line).trim();
}

/** The caption up to its colon, as the English card shows "Free birth charts, moon signs, compatibility, and horoscopes." */
export function captionLead(sub: string): string {
  const lead = sub.split(':')[0].trim();
  return /[.!?]$/u.test(lead) ? lead : `${lead}.`;
}

export function localizedArtCardCopy(locale: ArtCardCopyLocale): LocalizedArtCardCopy {
  const hero = HOME_COPY[locale].hero;
  const guideFor = GUIDES[locale];
  const signs = Object.fromEntries(SIGNS.map((sign) => [sign.slug, {
    name: signName(sign, locale),
    line: firstSentence(guideFor(sign).intro[0]),
    sub: upperFirst(signDateRange(sign, locale), locale),
  }]));
  const horoscope = locale === 'es' || locale === 'pt' ? LOCALIZED_HOROSCOPE_COPY[locale] : null;
  const horoscopes = horoscope
    ? Object.fromEntries(SIGNS.map((sign) => [sign.slug, {
      kicker: horoscope.crumbs,
      name: horoscope.h1(signName(sign, locale)),
      sub: upperFirst(signDateRange(sign, locale), locale),
    }]))
    : {};
  return { home: { title: hero.title, subtitle: captionLead(hero.sub) }, signs, horoscopes };
}

export function allLocalizedArtCardCopy(): Record<ArtCardCopyLocale, LocalizedArtCardCopy> {
  return Object.fromEntries(ART_CARD_COPY_LOCALES.map((locale) => [locale, localizedArtCardCopy(locale)])) as Record<ArtCardCopyLocale, LocalizedArtCardCopy>;
}

/**
 * The chart twins card in the five other languages (2026-11-26), in the
 * English card's layout. Spanish, French, Italian and Portuguese take the
 * headline and line from the chart twins card copy each locale already has
 * (`og.tools.chart-twins.title` and `.sub`), the line without its word for
 * "verified", as the English card's line drops it. Russian has no such copy,
 * so its words are written here. The kicker translates the English card's
 * "Matched by Sun and Moon"; the Spanish and French ones are the page's own
 * label for a Sun and Moon match.
 */
export const CHART_TWINS_COPY_LOCALES = ['es', 'fr', 'it', 'pt', 'ru'] as const;
export type ChartTwinsCopyLocale = (typeof CHART_TWINS_COPY_LOCALES)[number];

export interface ChartTwinsArtCardCopy { kicker: string; title: string; line: string; alt: string }

const CHART_TWINS_KICKERS: Record<ChartTwinsCopyLocale, string> = {
  es: 'Coinciden Sol y Luna',
  fr: 'Soleil et Lune en commun',
  it: 'Sole e Luna in comune',
  pt: 'Sol e Lua em comum',
  ru: 'Совпадение по Солнцу и Луне',
};

/** The word each locale's card line carries for "verified", which the art card leaves out. */
const CHART_TWINS_VERIFIED: Record<Exclude<ChartTwinsCopyLocale, 'ru'>, string> = {
  es: ' verificados',
  fr: ' vérifiés',
  it: ' verificati',
  pt: ' verificados',
};

/** The painting, as the alt text describes it after the words. */
const CHART_TWINS_PAINTING: Record<ChartTwinsCopyLocale, string> = {
  es: 'junto a una pintura de dos retratos en camafeo, uno frente al otro',
  fr: 'à côté d’une peinture de deux portraits en camée qui se font face',
  it: 'accanto a un dipinto di due ritratti a cammeo, uno di fronte all’altro',
  pt: 'ao lado de uma pintura de dois retratos em camafeu, um de frente para o outro',
  ru: 'рядом с картиной, где два портрета в камеях обращены друг к другу',
};

/**
 * "Звёздные близнецы" (star twins) rather than the page's "астрологических
 * близнецов": a long word in the Cyrillic serif would not fit the headline's
 * two lines short of the painting.
 */
const RUSSIAN_CHART_TWINS = { title: 'Звёздные близнецы', line: 'Известные люди с вашими знаками Солнца и Луны.' };

export function localizedChartTwinsArtCardCopy(locale: ChartTwinsCopyLocale): ChartTwinsArtCardCopy {
  let title: string;
  let line: string;
  if (locale === 'ru') {
    ({ title, line } = RUSSIAN_CHART_TWINS);
  } else {
    title = additionText(locale, 'og.tools.chart-twins.title');
    const sub = additionText(locale, 'og.tools.chart-twins.sub');
    const verified = CHART_TWINS_VERIFIED[locale];
    if (!sub.includes(`${verified}.`)) throw new Error(`localizedChartTwinsArtCardCopy: ${locale} line no longer ends with${verified}`);
    line = sub.replace(`${verified}.`, '.');
  }
  const lead = line.replace(/\.$/u, '').replace(/^\p{Lu}/u, (letter) => letter.toLocaleLowerCase(locale));
  // French sets a narrow no-break space before a colon, as the French pages do.
  const colon = locale === 'fr' ? ' :' : ':';
  return { kicker: CHART_TWINS_KICKERS[locale], title, line, alt: `${title}${colon} ${lead}, ${CHART_TWINS_PAINTING[locale]}.` };
}

export function allLocalizedChartTwinsArtCardCopy(): Record<ChartTwinsCopyLocale, ChartTwinsArtCardCopy> {
  return Object.fromEntries(CHART_TWINS_COPY_LOCALES.map((locale) => [locale, localizedChartTwinsArtCardCopy(locale)])) as Record<ChartTwinsCopyLocale, ChartTwinsArtCardCopy>;
}

/** og-art-cards.locales.mjs, as scripts/build-og-art-card-copy.ts writes it. */
export function renderLocalizedArtCardCopyModule(): string {
  return [
    '// Generated by scripts/build-og-art-card-copy.ts from the localized pages\' own',
    '// words (src/lib/og-art-cards-copy.ts). Do not edit by hand.',
    `export const LOCALIZED_ART_CARD_COPY = Object.freeze(${JSON.stringify(allLocalizedArtCardCopy(), null, 2)});`,
    '',
    `export const LOCALIZED_CHART_TWINS_ART_CARD_COPY = Object.freeze(${JSON.stringify(allLocalizedChartTwinsArtCardCopy(), null, 2)});`,
    '',
  ].join('\n');
}
