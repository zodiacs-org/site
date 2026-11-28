/**
 * The art share cards (owner-chosen 2026-10-19): the homepage card, cut from
 * the hero film's poster, one card for each sign guide, on the sign's art
 * panel, and one for each of the sign's seven horoscope pages in the same
 * layout. Each is laid out the way its page opens (the homepage hero and the
 * sign guide hero), with the names and the homepage headline in the display
 * serif and, on the sign and horoscope cards, the sign's pastel disc large
 * above the words, so it still reads when a chat app shows the card small.
 * `npm run data:og -- --only-art-cards` draws them, verify-og-cards checks
 * them, and the pages take their addresses from here.
 *
 * Import-free apart from the plain catalogues, like OG_SIGNS, so the
 * plain-Node generator can read it; og-art-cards.test.ts pins every line to
 * what the sign guide's hero prints (signTagline, signOrdinal, guideFacts)
 * and the headline to the homepage's.
 *
 * The Spanish, French, Italian and Portuguese homepages, sign guides and
 * (Spanish and Portuguese) daily horoscopes have the same cards in their own
 * words, which og-art-cards.locales.mjs carries for the generator
 * (`npm run data:og -- --only-localized-art-cards`), as do the chart twins
 * pages in those four languages and in Russian
 * (`--only-localized-chart-twins-cards` draws those alone).
 *
 * The art runs across the whole picture, so the cards are JPEGs: as PNGs
 * they would pass WhatsApp's 600 KB limit for a link preview. They are never
 * redrawn in place once published; a new design takes a new folder, and
 * these stay published for links already shared, as the v2 cards before them do.
 */
import { HOROSCOPE_OG_SURFACES } from '../strings/seo.en.mjs';
import { OG_SIGNS } from '../strings/seo.signs.mjs';
import { LOCALIZED_ART_CARD_COPY, LOCALIZED_CHART_TWINS_ART_CARD_COPY } from './og-art-cards.locales.mjs';

export const ART_CARD_DIR = '/assets/og/v8';

/** The homepage card and the site's global fallback, served immutable under a dated name. */
export const HOME_ART_CARD = `${ART_CARD_DIR}/home-20261019.jpg`;

/** @param {string} slug @param {string} caller */
function knownSign(slug, caller) {
  if (!OG_SIGNS.some((sign) => sign.slug === slug)) throw new Error(`${caller}: unknown sign ${slug}`);
  return slug;
}

/**
 * The Spanish, French, Italian and Portuguese pages share cards in their own
 * words (og-art-cards.locales.mjs, from src/lib/og-art-cards-copy.ts), in
 * `${ART_CARD_DIR}/{locale}/`.
 */
export const ART_CARD_LOCALES = Object.freeze(['es', 'fr', 'it', 'pt']);

/** @param {string} locale @param {string} caller */
function cardLocale(locale, caller) {
  if (locale === 'en') return locale;
  if (!ART_CARD_LOCALES.includes(locale)) throw new Error(`${caller}: no art cards in ${locale}`);
  return locale;
}

/**
 * A sign guide's card: `sign/aries.jpg`, or `es/sign/aries.jpg` for the Spanish guide.
 * @param {string} slug
 * @param {string} [locale]
 */
export function signArtCard(slug, locale = 'en') {
  const sign = knownSign(slug, 'signArtCard');
  return cardLocale(locale, 'signArtCard') === 'en'
    ? `${ART_CARD_DIR}/sign/${sign}.jpg`
    : `${ART_CARD_DIR}/${locale}/sign/${sign}.jpg`;
}

/**
 * A localized homepage's card, and that locale's fallback: `es/home.jpg`. English keeps HOME_ART_CARD.
 * @param {string} [locale]
 */
export function homeArtCard(locale = 'en') {
  return cardLocale(locale, 'homeArtCard') === 'en' ? HOME_ART_CARD : `${ART_CARD_DIR}/${locale}/home.jpg`;
}

/** The locales that publish a daily horoscope page of their own (Spanish and Portuguese). */
export const HOROSCOPE_ART_CARD_LOCALES = Object.freeze(
  ART_CARD_LOCALES.filter((locale) => Object.keys(LOCALIZED_ART_CARD_COPY[locale].horoscopes).length > 0),
);

/**
 * A localized daily horoscope's card: `es/horoscope/aries.jpg`.
 * @param {string} slug
 * @param {string} locale
 */
export function localizedHoroscopeArtCard(slug, locale) {
  const sign = knownSign(slug, 'localizedHoroscopeArtCard');
  if (!HOROSCOPE_ART_CARD_LOCALES.includes(locale)) throw new Error(`localizedHoroscopeArtCard: no horoscope cards in ${locale}`);
  return `${ART_CARD_DIR}/${locale}/horoscope/${sign}.jpg`;
}

/** The horoscope surfaces, keyed as HoroscopeProgramPage names them ('today', 'weekly', 'year'…). */
const SURFACES = new Map(HOROSCOPE_OG_SURFACES.map((surface) => [surface.key, surface]));

/**
 * A sign's horoscope page card: `horoscope/aries.jpg` for today, `horoscope/aries-2027.jpg` for the year.
 * @param {string} slug
 * @param {string} surfaceKey
 */
export function horoscopeArtCard(slug, surfaceKey) {
  const surface = SURFACES.get(surfaceKey);
  if (!surface) throw new Error(`horoscopeArtCard: unknown horoscope ${surfaceKey}`);
  return `${ART_CARD_DIR}/horoscope/${knownSign(slug, 'horoscopeArtCard')}${surface.suffix ? `-${surface.suffix}` : ''}.jpg`;
}

/**
 * The English chart twins page's card (owner-chosen 2026-11-26): the page's
 * own painting, the twin cameos (public/assets/card-art/twins-hero-1200.webp),
 * on the right, and on the left a small Sun and Moon disc, the kicker, the
 * headline and a line. `npm run data:og -- --only-chart-twins-card` draws it
 * alone. The Spanish, French, Italian, Portuguese and Russian chart twins
 * pages have the same card in their own words (chartTwinsArtCard), and the v2
 * cards (/assets/og/v2/tool/chart-twins.png and its Russian twin,
 * /assets/og/v2/ru/tool/chart-twins.png) stay published for links already shared.
 */
export const CHART_TWINS_ART_CARD = `${ART_CARD_DIR}/tool/chart-twins.jpg`;

/**
 * The locales whose chart twins page has the card in its own words
 * (2026-11-26): the four art card locales and Russian, whose other cards are
 * the 16-colour v2 family; a painting cannot go through that palette, so its
 * chart twins card sits here with the other art cards, in `ru/`.
 */
export const CHART_TWINS_ART_CARD_LOCALES = Object.freeze([...ART_CARD_LOCALES, 'ru']);

/** @param {string} locale @param {string} caller */
function chartTwinsLocale(locale, caller) {
  if (locale !== 'en' && !CHART_TWINS_ART_CARD_LOCALES.includes(locale)) throw new Error(`${caller}: no chart twins card in ${locale}`);
  return locale;
}

/**
 * A chart twins page's card: CHART_TWINS_ART_CARD in English, `es/tool/chart-twins.jpg` in Spanish.
 * @param {string} [locale]
 */
export function chartTwinsArtCard(locale = 'en') {
  return chartTwinsLocale(locale, 'chartTwinsArtCard') === 'en' ? CHART_TWINS_ART_CARD : `${ART_CARD_DIR}/${locale}/tool/chart-twins.jpg`;
}

/** The words on the chart twins card. */
export const CHART_TWINS_ART_CARD_COPY = Object.freeze({
  kicker: 'Matched by Sun and Moon',
  title: 'Your chart twins',
  line: 'Public figures who share your Sun and Moon signs.',
});

export const CHART_TWINS_ART_CARD_ALT = 'Your chart twins: public figures who share your Sun and Moon signs, beside a painting of two cameo portraits facing each other.';

/**
 * A chart twins card's words and alt text, in English or in the page's own
 * language (og-art-cards.locales.mjs, from src/lib/og-art-cards-copy.ts).
 * @param {string} [locale]
 * @returns {{ kicker: string, title: string, line: string, alt: string }}
 */
export function chartTwinsArtCardCopy(locale = 'en') {
  if (chartTwinsLocale(locale, 'chartTwinsArtCardCopy') === 'en') return Object.freeze({ ...CHART_TWINS_ART_CARD_COPY, alt: CHART_TWINS_ART_CARD_ALT });
  const copy = LOCALIZED_CHART_TWINS_ART_CARD_COPY[locale];
  if (!copy) throw new Error(`chartTwinsArtCardCopy: no words for ${locale}`);
  return Object.freeze({ ...copy });
}

/**
 * The thesis's card (owner-chosen 2026-11-27): the page's own painting, the
 * old astronomical clock (public/assets/art/zodiac-clock-1280.jpg), on the
 * right, and on the left the twelve sign discs in a row, the kicker, the
 * headline and a line. The kicker and the line are the first scene of the
 * thesis film, word for word (filmScript() in scripts/build-thesis-film.mjs,
 * which checks each sentence against its data), and og-art-cards.test.ts holds
 * them to it. `npm run data:og -- --only-thesis-art-card` draws it alone. The
 * v2 card (/assets/og/v2/thesis.png) stays published for links already shared.
 */
export const THESIS_ART_CARD = `${ART_CARD_DIR}/thesis.jpg`;

/** The words on the thesis card: the page's headline between the film's first two sentences. */
export const THESIS_ART_CARD_COPY = Object.freeze({
  kicker: 'The twelve signs are about 2,400 years old.',
  title: 'Why Zodiacs Matter',
  line: 'They outlived every medium that carried them.',
});

export const THESIS_ART_CARD_ALT = 'Why Zodiacs Matter: the twelve signs are about 2,400 years old and outlived every medium that carried them. The twelve sign discs in a row beside a painting of an old astronomical clock with the zodiac on its dial.';

/** Every art card's public path: the homepage, the signs in zodiac order, each sign's horoscopes, the chart twins card, then the thesis card. */
export const ART_CARDS = Object.freeze([
  HOME_ART_CARD,
  ...OG_SIGNS.map((sign) => signArtCard(sign.slug)),
  ...OG_SIGNS.flatMap((sign) => HOROSCOPE_OG_SURFACES.map((surface) => horoscopeArtCard(sign.slug, surface.key))),
  CHART_TWINS_ART_CARD,
  THESIS_ART_CARD,
]);

/**
 * Every localized card: each locale's homepage, its twelve sign guides, its
 * daily horoscopes and its chart twins card, then the Russian chart twins card.
 */
export const LOCALIZED_ART_CARDS = Object.freeze([
  ...ART_CARD_LOCALES.flatMap((locale) => [
    homeArtCard(locale),
    ...OG_SIGNS.map((sign) => signArtCard(sign.slug, locale)),
    ...(HOROSCOPE_ART_CARD_LOCALES.includes(locale) ? OG_SIGNS.map((sign) => localizedHoroscopeArtCard(sign.slug, locale)) : []),
    chartTwinsArtCard(locale),
  ]),
  ...CHART_TWINS_ART_CARD_LOCALES.filter((locale) => !ART_CARD_LOCALES.includes(locale)).map((locale) => chartTwinsArtCard(locale)),
]);

/**
 * Each card stays well under WhatsApp's 600 KB link-preview limit, the
 * English cards under 12 MiB together and the localized ones under 12 MiB.
 */
export const ART_CARD_MAX_BYTES = 300 * 1024;
export const ART_CARDS_MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const LOCALIZED_ART_CARDS_MAX_TOTAL_BYTES = 12 * 1024 * 1024;

/** The sign's disc on a sign or horoscope card, in px: large enough to read with the card shown a quarter size. */
export const ART_CARD_DISC = 144;

/** The homepage hero's own headline, and the first half of its line. */
export const HOME_ART_CARD_COPY = Object.freeze({
  title: 'Explore the stars behind your story.',
  subtitle: 'Free birth charts, moon signs, compatibility, and horoscopes.',
});

export const HOME_ART_CARD_ALT = 'Zodiacs homepage preview: the zodiac band from the hero film, with its pastel sign discs, and the headline “Explore the stars behind your story.”';

/**
 * The homepage card's cut of the poster (public/assets/hero/zodiacs-hero-poster.jpg,
 * 1600 × 900), in the poster's own pixels: 1200 × 630 from (300, 150), drawn
 * at full size, so the sign discs from Virgo to Aquarius run across the top.
 */
export const HOME_ART_CARD_CROP = Object.freeze({ x: 300, y: 150, width: 1200, height: 630 });

/** The homepage hero's scrim (src/pages/index.astro, `.hero__scrim`), layer by layer. */
export const HOME_ART_CARD_SCRIM = Object.freeze([
  'linear-gradient(90deg, rgba(6, 7, 9, 0.92) 0%, rgba(6, 7, 9, 0.72) 30%, rgba(6, 7, 9, 0.18) 62%, rgba(6, 7, 9, 0) 80%)',
  'linear-gradient(0deg, rgba(6, 7, 9, 0.85) 0%, rgba(6, 7, 9, 0) 42%)',
  'linear-gradient(180deg, rgba(6, 7, 9, 0.42) 0%, rgba(6, 7, 9, 0) 16%)',
]);

/** The sign guide hero's art and shade (src/components/SignGuideHero.astro, wide screens). */
export const SIGN_ART_CARD_ART = Object.freeze({
  width: '72%',
  position: '50% 56%',
  filter: 'saturate(0.94) brightness(0.92)',
  mask: 'linear-gradient(90deg, transparent 0, #000 24%)',
});
export const SIGN_ART_CARD_SHADE = Object.freeze([
  'radial-gradient(ellipse 30% 46% at 63% 53%, rgba(6, 7, 9, 0) 0 40%, rgba(6, 7, 9, 0.32) 100%)',
  'linear-gradient(90deg, rgba(6, 7, 9, 0.9) 0%, rgba(6, 7, 9, 0.62) 30%, rgba(6, 7, 9, 0) 52%)',
  'linear-gradient(0deg, rgba(6, 7, 9, 0.7) 0%, rgba(6, 7, 9, 0) 34%)',
  'linear-gradient(180deg, rgba(6, 7, 9, 0.55) 0%, rgba(6, 7, 9, 0) 22%)',
]);

/**
 * The chart twins card's painting (1200 × 800, drawn at 810 × 540 from 480 px
 * in, 8 px above the top) in the sign cards' filter, fading in from the left
 * and up from the bottom, and the shade over it, in the sign cards' manner.
 */
export const CHART_TWINS_ART_CARD_ART = Object.freeze({
  src: 'public/assets/card-art/twins-hero-1200.webp',
  left: 480,
  top: -8,
  width: 810,
  height: 540,
  filter: SIGN_ART_CARD_ART.filter,
  mask: 'linear-gradient(90deg, transparent 0, #000 9%), linear-gradient(0deg, transparent 0, #000 14%)',
});
export const CHART_TWINS_ART_CARD_SHADE = Object.freeze([
  'linear-gradient(90deg, rgba(6, 7, 9, 0.92) 0%, rgba(6, 7, 9, 0.7) 36%, rgba(6, 7, 9, 0) 50%)',
  'linear-gradient(0deg, rgba(6, 7, 9, 0.78) 0%, rgba(6, 7, 9, 0) 30%)',
  'linear-gradient(180deg, rgba(6, 7, 9, 0.5) 0%, rgba(6, 7, 9, 0) 20%)',
]);

/** @param {string} slug */
function signHue(slug) {
  const sign = OG_SIGNS.find((entry) => entry.slug === slug);
  if (!sign) throw new Error(`signHue: unknown sign ${slug}`);
  return sign.hue;
}

/** The Sun's and the Moon's discs on the chart twins card: their size in px and the sign hues they take. */
export const CHART_TWINS_ART_CARD_DISCS = Object.freeze({
  size: 64,
  sun: signHue('leo'),
  moon: signHue('cancer'),
});

/**
 * The thesis card's painting (1280 × 720, drawn at 1260 × 709 from 500 px in,
 * 40 px above the top, so the clock's dial fills the right of the card),
 * fading in from the left, and the shade over it.
 */
export const THESIS_ART_CARD_ART = Object.freeze({
  src: 'public/assets/art/zodiac-clock-1280.jpg',
  left: 500,
  top: -40,
  width: 1260,
  height: 709,
  filter: 'saturate(0.9) brightness(0.95)',
  mask: 'linear-gradient(90deg, transparent 0, #000 22%)',
});
export const THESIS_ART_CARD_SHADE = Object.freeze([
  'linear-gradient(90deg, rgba(6, 7, 9, 0.94) 0%, rgba(6, 7, 9, 0.72) 38%, rgba(6, 7, 9, 0) 56%)',
  'linear-gradient(0deg, rgba(6, 7, 9, 0.85) 0%, rgba(6, 7, 9, 0) 28%)',
  'linear-gradient(180deg, rgba(6, 7, 9, 0.45) 0%, rgba(6, 7, 9, 0) 18%)',
]);

/**
 * The twelve sign discs above the thesis card's kicker, Aries to Pisces in one
 * row (the canonical icons' 128px tier): each disc's size and the gap between
 * them, in px.
 */
export const THESIS_ART_CARD_DISCS = Object.freeze({ size: 32, gap: 7 });

const ORDINALS = Object.freeze(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']);

const MONTHS = Object.freeze({
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
});

/** The table essences whose wording carries a dash, as the pages print them (sign-display.ts). */
const TAGLINES = Object.freeze({
  aries: 'First out of the gate. Direct, fast, unafraid to start.',
});

/** 'Mar 21 – Apr 19' as the guide writes it: 'March 21 to April 19'. */
function longRange(dates) {
  const days = dates.split(' – ');
  if (days.length !== 2) throw new Error(`signArtCardCopy: unexpected dates ${dates}`);
  return days.map((day) => {
    const [month, date] = day.split(' ');
    if (!MONTHS[month] || !/^\d{1,2}$/u.test(date ?? '')) throw new Error(`signArtCardCopy: unexpected day ${day}`);
    return `${MONTHS[month]} ${date}`;
  }).join(' to ');
}

/**
 * The words on a sign's card, as its guide's hero prints them: the kicker,
 * the name, the one line, and the first sentence under it.
 * @param {string} slug
 * @returns {{ kicker: string, name: string, line: string, sub: string }}
 */
export function signArtCardCopy(slug) {
  const index = OG_SIGNS.findIndex((sign) => sign.slug === slug);
  if (index < 0) throw new Error(`signArtCardCopy: unknown sign ${slug}`);
  const sign = OG_SIGNS[index];
  return Object.freeze({
    kicker: `The ${ORDINALS[index]} sign of the zodiac`,
    name: sign.name,
    line: TAGLINES[slug] ?? sign.essence,
    sub: `The Sun sign for birthdays from ${longRange(sign.dates)}.`,
  });
}

/**
 * The words on a sign's horoscope card: the horoscope's kicker and line, as
 * its v2 card had them, with the sign card's name and birthday sentence.
 * @param {string} slug
 * @param {string} surfaceKey
 * @returns {{ kicker: string, name: string, line: string, sub: string }}
 */
export function horoscopeArtCardCopy(slug, surfaceKey) {
  const surface = SURFACES.get(surfaceKey);
  if (!surface) throw new Error(`horoscopeArtCardCopy: unknown horoscope ${surfaceKey}`);
  const sign = signArtCardCopy(slug);
  return Object.freeze({ kicker: surface.kicker, name: sign.name, line: surface.subtitle, sub: sign.sub });
}

/** @param {string} locale */
function localizedCopy(locale) {
  const copy = LOCALIZED_ART_CARD_COPY[cardLocale(locale, 'localizedArtCardCopy')];
  if (!copy) throw new Error(`localizedArtCardCopy: no words for ${locale}`);
  return copy;
}

/**
 * A localized homepage card's words: the hero's headline and the first half of its caption.
 * @param {string} locale
 * @returns {{ title: string, subtitle: string }}
 */
export function localizedHomeArtCardCopy(locale) {
  return Object.freeze({ ...localizedCopy(locale).home });
}

/**
 * A localized sign card's words, as the localized guide's hero prints them:
 * the name, the first sentence of its line and the dates. No kicker: the
 * localized heroes carry none.
 * @param {string} slug
 * @param {string} locale
 * @returns {{ name: string, line: string, sub: string }}
 */
export function localizedSignArtCardCopy(slug, locale) {
  const copy = localizedCopy(locale).signs[knownSign(slug, 'localizedSignArtCardCopy')];
  return Object.freeze({ ...copy });
}

/**
 * A localized daily horoscope card's words: the breadcrumb's "Horóscopos",
 * the hero's title ("Aries hoy") and the dates.
 * @param {string} slug
 * @param {string} locale
 * @returns {{ kicker: string, name: string, sub: string }}
 */
export function localizedHoroscopeArtCardCopy(slug, locale) {
  const copy = localizedCopy(locale).horoscopes[knownSign(slug, 'localizedHoroscopeArtCardCopy')];
  if (!copy) throw new Error(`localizedHoroscopeArtCardCopy: no horoscope in ${locale}`);
  return Object.freeze({ ...copy });
}
