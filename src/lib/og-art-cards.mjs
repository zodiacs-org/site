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

// ── The art page cards (owner-delegated decisions, 2026-11-27) ─────────────
//
// One layout for the tool, hub and guide pages that open on a painting of
// their own: the painting on the right, placed so one point of it lands on
// one point of the card, fading in from the left and out above the footer
// row under one shade; on the left a small accent drawn in the sign hues (or
// the canonical sign discs), the kicker, the headline and a line, with the
// lockup in the footer row. The 78 sign pair pages take the pair template
// (the two sign paintings facing each other), the 29 cusp birthday pages one
// template over their dates, and the 12 Chinese zodiac animal pages the
// animal's own painting. `npm run data:og -- --only-art-page-cards`,
// `--only-pair-art-cards`, `--only-birthday-art-cards` and
// `--only-chinese-zodiac-art-cards` draw each family alone; `--only-art-cards`
// draws them with the rest. The v2 cards these pages showed stay published,
// byte for byte, for links already shared.

/** The shade over every art page card: the column side, the footer row and the top edge. */
export const ART_PAGE_CARD_SHADE = Object.freeze([
  'linear-gradient(90deg, rgba(6, 7, 9, 0.94) 0%, rgba(6, 7, 9, 0.74) 40%, rgba(6, 7, 9, 0) 58%)',
  'linear-gradient(0deg, rgba(6, 7, 9, 0.82) 0%, rgba(6, 7, 9, 0) 30%)',
  'linear-gradient(180deg, rgba(6, 7, 9, 0.48) 0%, rgba(6, 7, 9, 0) 20%)',
]);

/** The paintings the cards are cut from: each page's own art, at its published size. */
export const ART_PAGE_PAINTINGS = Object.freeze({
  astrolabe: Object.freeze({ src: 'public/assets/art/birth-chart-astrolabe-1200.webp', width: 1200, height: 675 }),
  orrery: Object.freeze({ src: 'public/assets/art/today-orrery-1200.webp', width: 1200, height: 675 }),
  horizon: Object.freeze({ src: 'public/assets/art/rising-horizon-1200.webp', width: 1200, height: 675 }),
  lens: Object.freeze({ src: 'public/assets/art/tools-lens-1200.webp', width: 1200, height: 750 }),
  atlas: Object.freeze({ src: 'public/assets/art/learn-atlas-1200.webp', width: 1200, height: 900 }),
  sundial: Object.freeze({ src: 'public/assets/art/birthday-sundial-1200.webp', width: 1200, height: 525 }),
  hourglass: Object.freeze({ src: 'public/assets/card-art/milestones-hero-1200.webp', width: 1200, height: 800 }),
  skyDial: Object.freeze({ src: 'public/assets/card-art/sky-calendar-hero-1200.webp', width: 1200, height: 800 }),
  invitation: Object.freeze({ src: 'public/assets/art/profile-invitation-1200.webp', width: 1200, height: 800 }),
  poster: Object.freeze({ src: 'public/assets/hero/zodiacs-hero-poster.jpg', width: 1600, height: 900 }),
  // The 2026-11-28 round's art, made for the cards: three generated photographs
  // (Higgsfield, 2528 × 1696, cut to 1200 px webp) and the compatibility hub's
  // two chart wheels, the site's own <Wheel> with two published People charts
  // (scripts/build-wheel-art.ts).
  crescent: Object.freeze({ src: 'public/assets/art/moon-crescent-1200.webp', width: 1200, height: 805 }),
  chartWheels: Object.freeze({ src: 'public/assets/art/compatibility-wheels-1200.webp', width: 1200, height: 800 }),
  veniceClock: Object.freeze({ src: 'public/assets/art/venice-clock-1200.webp', width: 1200, height: 805 }),
  numerologyDial: Object.freeze({ src: 'public/assets/art/numerology-dial-1200.webp', width: 1200, height: 805 }),
  // The third round's art (owner-approved mockups, 2026-11-28): ten generated
  // photographs (Higgsfield, 2528 × 1696, cut to 1200 px webp) and two
  // pictures of the site's own chart wheels from published People charts
  // (scripts/build-wheel-art.ts).
  moonPhases: Object.freeze({ src: 'public/assets/art/moon-phases-1200.webp', width: 1200, height: 805 }),
  fullMoon: Object.freeze({ src: 'public/assets/art/full-moon-1200.webp', width: 1200, height: 805 }),
  retrogradeLoop: Object.freeze({ src: 'public/assets/art/retrograde-loop-1200.webp', width: 1200, height: 805 }),
  solarEclipse: Object.freeze({ src: 'public/assets/art/solar-eclipse-1200.webp', width: 1200, height: 805 }),
  sunLimb: Object.freeze({ src: 'public/assets/art/sun-limb-1200.webp', width: 1200, height: 805 }),
  moonriseSea: Object.freeze({ src: 'public/assets/art/moonrise-sea-1200.webp', width: 1200, height: 805 }),
  jupiterSaturn: Object.freeze({ src: 'public/assets/art/jupiter-saturn-1200.webp', width: 1200, height: 805 }),
  starAtlas: Object.freeze({ src: 'public/assets/art/star-atlas-loupe-1200.webp', width: 1200, height: 805 }),
  duskCrescent: Object.freeze({ src: 'public/assets/art/dusk-crescent-1200.webp', width: 1200, height: 805 }),
  dayWheel: Object.freeze({ src: 'public/assets/art/chart-of-the-day-wheel-1200.webp', width: 1200, height: 800 }),
  groupWheels: Object.freeze({ src: 'public/assets/art/group-charts-wheels-1200.webp', width: 1200, height: 800 }),
  instantPhotos: Object.freeze({ src: 'public/assets/art/people-instant-photos-1200.webp', width: 1200, height: 805 }),
  // The fourth round's art (owner-approved, 2026-11-28), for the thirteen
  // first-round cards redrawn: twelve generated photographs (Higgsfield,
  // 2528 × 1696, cut to 1200 px webp) and the birth chart card's full wheel
  // (scripts/build-wheel-art.ts).
  birthChartWheel: Object.freeze({ src: 'public/assets/art/birth-chart-wheel-1200.webp', width: 1200, height: 800 }),
  sunOverEarth: Object.freeze({ src: 'public/assets/art/sun-over-earth-1200.webp', width: 1200, height: 805 }),
  starOverSea: Object.freeze({ src: 'public/assets/art/star-over-sea-1200.webp', width: 1200, height: 805 }),
  threeWorlds: Object.freeze({ src: 'public/assets/art/three-worlds-1200.webp', width: 1200, height: 805 }),
  analemma: Object.freeze({ src: 'public/assets/art/analemma-1200.webp', width: 1200, height: 805 }),
  armillarySphere: Object.freeze({ src: 'public/assets/art/armillary-sphere-1200.webp', width: 1200, height: 805 }),
  celestialGlobe: Object.freeze({ src: 'public/assets/art/celestial-globe-1200.webp', width: 1200, height: 805 }),
  moonMonthGrid: Object.freeze({ src: 'public/assets/art/moon-month-grid-1200.webp', width: 1200, height: 805 }),
  saturnRings: Object.freeze({ src: 'public/assets/art/saturn-rings-1200.webp', width: 1200, height: 805 }),
  twoCrescents: Object.freeze({ src: 'public/assets/art/two-crescents-1200.webp', width: 1200, height: 805 }),
  starNursery: Object.freeze({ src: 'public/assets/art/star-nursery-1200.webp', width: 1200, height: 805 }),
  mercuryCratered: Object.freeze({ src: 'public/assets/art/mercury-cratered-1200.webp', width: 1200, height: 805 }),
  jupiterMoonShadow: Object.freeze({ src: 'public/assets/art/jupiter-moon-shadow-1200.webp', width: 1200, height: 805 }),
});

/** The sign art panels' filter, as on the sign cards; the poster is drawn brighter, as the pages' hero crops show it. */
const PAINTING_FILTER = SIGN_ART_CARD_ART.filter;
const POSTER_FILTER = 'saturate(1.05) brightness(1.24)';

/**
 * A painting placed on the card: its point (fx, fy), in its own pixels, lands
 * on the card's (cx, cy) at `scale`; it fades in from the left between
 * fade[0] and fade[1] px.
 * @param {keyof typeof ART_PAGE_PAINTINGS} name
 */
function placed(name, fx, fy, scale, more = {}) {
  return Object.freeze({ painting: name, ...ART_PAGE_PAINTINGS[name], fx, fy, scale, cx: 890, cy: 290, fade: [500, 740], filter: PAINTING_FILTER, ...more });
}

/**
 * A whole picture laid as the 2026-11-28 cards' mockups lay it: 820 px wide
 * across the right of the card, its centre at (790, 273), fading in from the
 * left between 400 and 660 px. Generated photographs keep their own colour.
 * @param {keyof typeof ART_PAGE_PAINTINGS} name
 */
function framed(name, more = {}) {
  const { width, height } = ART_PAGE_PAINTINGS[name];
  return placed(name, width / 2, height / 2, 820 / width, { cx: 790, cy: 273, fade: [400, 660], filter: 'none', ...more });
}

/** A region of the hero film's poster, as the pages' hero crops cut it (x, y and width in the poster's pixels). */
function posterRegion(x, y, width, more = {}) {
  const height = (width * 350) / 560;
  return placed('poster', x + width / 2, y + height / 2, Math.min(1.42, 720 / width), { filter: POSTER_FILTER, ...more });
}

/**
 * The thirteen first-round single page cards, redrawn on new art (owner,
 * 2026-11-28). A published card keeps the design it was published with, so
 * each redrawn card takes a new dated name beside the old one, as the
 * homepage card's does (`tool/{key}-20261128.jpg`); the cards they replace,
 * `tool/{key}.jpg`, stay published, byte for byte, for links already shared
 * (REPLACED_ART_PAGE_CARDS), and count toward the same folder's ceiling.
 */
export const REDRAWN_ART_CARD_STAMP = '20261128';
export const REDRAWN_ART_PAGE_CARD_KEYS = Object.freeze(['birth-chart', 'today', 'rising-sign', 'big-three', 'birthday', 'tools', 'learn', 'sky-calendar', 'saturn-return', 'compatibility-invite', 'baby-zodiac', 'mercury-retrograde', 'transits']);
const PAGE_CARD = (name) => `${ART_CARD_DIR}/tool/${name}${REDRAWN_ART_PAGE_CARD_KEYS.includes(name) ? `-${REDRAWN_ART_CARD_STAMP}` : ''}.jpg`;

/**
 * The single page cards. `title` is the headline's lines; `size` its type
 * size in px and `fit` the widest its longest line may run before it steps
 * down. `accent` names the mark above the kicker: a wheel of the twelve sign
 * hues, two wheels, the Moon's phases, a Sun, Moon, rising or Saturn disc, a
 * planet's retrograde loop, or the twelve canonical sign discs (the thesis
 * card's row, THESIS_ART_CARD_DISCS).
 */
const ART_PAGE_CARD_SPECS = Object.freeze([
  {
    key: 'birth-chart', routes: ['/birth-chart/', '/birth-chart/someone-else/', '/birth-chart/three-dimensions/'],
    art: framed('birthChartWheel'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your birth', 'chart'], line: 'Your Sun, Moon and rising sign, every planet and house.',
    alt: 'Your birth chart: your Sun, Moon and rising sign, every planet and house. The twelve sign discs in a row beside a full chart wheel with its houses, its ascendant and midheaven, and the transiting sky on the outer ring.',
  },
  {
    key: 'today', routes: ['/today/'],
    art: framed('sunOverEarth'), accent: { kind: 'signDiscs' },
    kicker: 'Planets, Moon phase and retrogrades', title: ['The sky', 'today'], line: 'Where every planet is, and what comes next on the calendar.',
    alt: 'The sky today: where every planet is, and what comes next on the calendar. The twelve sign discs in a row beside the Sun breaking over the edge of the Earth, seen from orbit.',
  },
  {
    key: 'rising-sign', routes: ['/rising-sign/'],
    art: framed('starOverSea'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your rising', 'sign'], line: 'How people first read you, from your birth time and place.',
    alt: 'Your rising sign: how people first read you, from your birth time and place. The twelve sign discs in a row beside one bright star rising over a dark sea.',
  },
  {
    key: 'big-three', routes: ['/big-three/'],
    art: framed('threeWorlds'), accent: { kind: 'signDiscs' },
    kicker: 'Sun, Moon and Rising', title: ['Your big', 'three'], line: 'Three signs in seconds, with a card to share.',
    alt: 'Your big three: Sun, Moon and Rising, three signs in seconds, with a card to share. The twelve sign discs in a row beside three worlds in a row: the Sun in violet light, the Moon and the blue edge of the Earth.',
  },
  {
    key: 'birthday', routes: ['/birthday/'],
    art: framed('analemma'), accent: { kind: 'signDiscs' },
    kicker: 'Birthday astrology', title: ['Your birthday,', 'read closely'], size: 96, line: 'Choose a date for a reading of character, love, work, and growth.',
    alt: 'Your birthday, read closely: choose a date for a reading of character, love, work, and growth. The twelve sign discs in a row beside the Sun’s yearly figure of eight across the sky.',
  },
  {
    key: 'tools', routes: ['/tools/'],
    art: framed('armillarySphere'), accent: { kind: 'signDiscs' },
    kicker: 'Free, no signup', title: ['Free astrology', 'tools'], size: 98, line: 'Sorted by what you want to know. New here? Start with your birth chart.',
    alt: 'Free astrology tools, no signup: sorted by what you want to know. The twelve sign discs in a row beside a silver armillary sphere.',
  },
  {
    key: 'learn', routes: ['/learn/'],
    art: framed('celestialGlobe'), accent: { kind: 'signDiscs' },
    kicker: 'Learn astrology', title: ['What does your', 'chart say about you?'], size: 76, fit: 560, line: 'Short guides to the signs, planets, houses and aspects.',
    alt: 'Learn astrology: what does your chart say about you? Short guides to the signs, planets, houses and aspects. The twelve sign discs in a row beside an old celestial globe.',
  },
  {
    key: 'sky-calendar', routes: ['/sky-calendar/'],
    art: framed('moonMonthGrid'), accent: { kind: 'signDiscs' },
    kicker: 'The calendar', title: ['Subscribe', 'to the sky'], line: 'New and full moons, eclipse peaks, and retrograde windows in your calendar.',
    alt: 'Subscribe to the sky: new and full moons, eclipse peaks, and retrograde windows in your calendar. The twelve sign discs in a row beside a month of Moons in a grid.',
  },
  {
    key: 'saturn-return', routes: ['/saturn-return/'],
    art: framed('saturnRings'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your Saturn', 'return'], line: 'Every pass and retrograde loop, from your birth date alone.',
    alt: 'Your Saturn return: every pass and retrograde loop, from your birth date alone. The twelve sign discs in a row beside Saturn and its rings.',
  },
  {
    key: 'compatibility-invite', routes: ['/c/'],
    art: framed('twoCrescents'), accent: { kind: 'signDiscs' },
    kicker: 'A private compatibility reading', title: ['An', 'invitation'], line: 'Their side is entered. Yours stays in your browser.',
    alt: 'An invitation to a private compatibility reading: their side is entered, yours stays in your browser. The twelve sign discs in a row beside two crescent Moons, a small one against a large one.',
  },
  {
    key: 'baby-zodiac', routes: ['/baby-zodiac/'],
    art: framed('starNursery'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['What sign will', 'the baby be?'], size: 92, line: 'The due date’s near-certain Sun, and the week’s possible Moons.',
    alt: 'What sign will the baby be? The due date’s near-certain Sun, and the week’s possible Moons. The twelve sign discs in a row beside a soft pastel star nursery.',
  },
  {
    key: 'mercury-retrograde', routes: ['/mercury-retrograde/', '/mercury-retrograde/2027/'],
    art: framed('mercuryCratered'), accent: { kind: 'signDiscs' },
    kicker: 'The calendar', title: ['Mercury', 'retrograde'], line: 'Every window through 2030, with station dates.',
    alt: 'Mercury retrograde: every window through 2030, with station dates. The twelve sign discs in a row beside Mercury, cratered and lit from the side.',
  },
  {
    key: 'transits', routes: ['/transits/'],
    art: framed('jupiterMoonShadow'), accent: { kind: 'signDiscs' },
    kicker: 'Free tracker', title: ['What is active', 'in your chart?'], size: 90, fit: 470, line: 'Move the date to watch each transit build, peak, and release.',
    alt: 'What is active in your chart? Move the date to watch each transit build, peak, and release. The twelve sign discs in a row beside Jupiter with a moon’s shadow crossing it.',
  },
  // The 2026-11-28 round (owner-chosen from mockups): the three astrology cards
  // carry the twelve canonical sign discs in a row above the kicker, as the
  // thesis card does. The numerology card carries none (owner, 2026-11-28):
  // numerology is a separate tradition from astrology.
  {
    key: 'moon-sign', routes: ['/moon-sign/'],
    art: framed('crescent'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your moon', 'sign'], size: 96, line: 'How you feel, what soothes you, and what you need to feel safe.',
    alt: 'Your moon sign: how you feel, what soothes you, and what you need to feel safe. The twelve sign discs in a row beside a close view of a crescent Moon.',
  },
  {
    key: 'compatibility', routes: ['/compatibility/'],
    art: framed('chartWheels'), accent: { kind: 'signDiscs' },
    kicker: 'Compatibility', title: ['Two charts,', 'compared'], size: 96, line: 'Whole-chart synastry, plus guides to all 78 sign pairings.',
    alt: 'Two charts, compared: whole-chart synastry, plus guides to all 78 sign pairings. The twelve sign discs in a row beside two of the site’s chart wheels, a small one set against a large one.',
  },
  {
    key: 'horoscopes', routes: ['/horoscopes/'],
    art: framed('veniceClock'), accent: { kind: 'signDiscs' },
    kicker: 'Horoscopes', title: ['All twelve', 'signs'], size: 96, line: 'Daily through yearly readings with clear themes and one useful next move.',
    alt: 'All twelve signs: daily through yearly horoscopes with clear themes and one useful next move. The twelve sign discs in a row beside a clock dial with gilded zodiac figures on blue enamel.',
  },
  {
    key: 'numerology', routes: ['/numerology/'],
    art: framed('numerologyDial'), accent: null,
    kicker: 'Numerology', title: ['Find your', 'Life Path number'], size: 96, fit: 520, line: 'Discover your Life Path from your birth date, or add your name to explore more numbers.',
    alt: 'Find your Life Path number: discover it from your birth date, or add your name to explore more numbers. Numerology is a separate tradition from astrology. Beside the words, a silver dial with a dark numbered ring, its needle on 7.',
  },
  // The third round (owner-approved mockups, 2026-11-28): eleven astrology
  // pages and the People hub, each with the twelve canonical sign discs above the kicker.
  {
    key: 'moon-phase', routes: ['/moon-phase/'],
    art: framed('moonPhases'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['The moon,', 'any night'], size: 96, line: 'Tonight’s phase, and the moon of any date that matters to you.',
    alt: 'The moon, any night: tonight’s phase, and the moon of any date that matters to you. The twelve sign discs in a row beside the Moon in its successive phases along an arc.',
  },
  {
    key: 'full-moon-calendar', routes: ['/full-moon-calendar/', '/full-moon-calendar/2027/'],
    art: framed('fullMoon'), accent: { kind: 'signDiscs' },
    kicker: 'The calendar', title: ['Every full', 'moon'], size: 96, line: 'Through 2030, with each moon’s sign, degree, and name.',
    alt: 'Every full moon through 2030, with each moon’s sign, degree, and name. The twelve sign discs in a row beside a close view of a full Moon.',
  },
  {
    key: 'retrogrades', routes: ['/retrogrades/'],
    art: framed('retrogradeLoop'), accent: { kind: 'signDiscs' },
    kicker: 'The calendar', title: ['Every', 'retrograde'], size: 96, line: 'All eight planets, with every station window through 2030.',
    alt: 'Every retrograde: all eight planets, with every station window through 2030. The twelve sign discs in a row beside a planet’s retrograde loop traced against the stars.',
  },
  {
    key: 'eclipses', routes: ['/eclipses/', '/eclipses/2027/'],
    art: framed('solarEclipse'), accent: { kind: 'signDiscs' },
    kicker: 'The calendar', title: ['Eclipses,', 'dated'], size: 96, line: 'Every solar and lunar eclipse through 2030, with peak times and signs.',
    alt: 'Eclipses, dated: every solar and lunar eclipse through 2030, with peak times and signs. The twelve sign discs in a row beside a total solar eclipse and its corona.',
  },
  {
    key: 'solar-return', routes: ['/solar-return/'],
    art: framed('sunLimb'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your solar', 'return'], size: 96, line: 'The chart of your next birthday, and the year’s main themes.',
    alt: 'Your solar return: the chart of your next birthday, and the year’s main themes. The twelve sign discs in a row beside the edge of the Sun in violet light, with a sunspot.',
  },
  {
    key: 'lunar-return', routes: ['/lunar-return/'],
    art: framed('moonriseSea'), accent: { kind: 'signDiscs' },
    kicker: 'Free calculator', title: ['Your lunar', 'return'], size: 96, line: 'Find the next time the Moon returns to its place in your birth chart.',
    alt: 'Your lunar return: find the next time the Moon returns to its place in your birth chart. The twelve sign discs in a row beside a full Moon rising from a dark sea.',
  },
  {
    key: 'your-sky-wrapped', routes: ['/your-sky-wrapped/'],
    art: framed('jupiterSaturn'), accent: { kind: 'signDiscs' },
    kicker: 'Your year', title: ['Your sky,', 'wrapped'], size: 96, line: 'The year’s Jupiter and Saturn contacts to your chart, on one card.',
    alt: 'Your sky, wrapped: the year’s Jupiter and Saturn contacts to your chart, on one card. The twelve sign discs in a row beside Jupiter and Saturn on the dark.',
  },
  {
    key: 'how-to-read-a-birth-chart', routes: ['/learn/how-to-read-a-birth-chart/'],
    art: framed('starAtlas'), accent: { kind: 'signDiscs' },
    kicker: 'Learn astrology', title: ['How to read', 'a birth chart'], size: 96, line: 'Big three, planets room by room, the working aspects, then the weather, in order.',
    alt: 'How to read a birth chart: big three, planets room by room, the working aspects, then the weather, in order. The twelve sign discs in a row beside an old star atlas open under a loupe.',
  },
  {
    key: 'occasions', routes: ['/occasions/'],
    art: framed('duskCrescent'), accent: { kind: 'signDiscs' },
    kicker: 'Wedding and birthday sky cards', title: ['The sky on', 'your day'], size: 96, lineCh: 26, line: 'A card of the sky on a wedding day, a birthday, a new home or any day that matters.',
    alt: 'The sky on your day: a card of the sky on a wedding day, a birthday, a new home or any day that matters. The twelve sign discs in a row beside a crescent Moon and the evening star at dusk.',
  },
  {
    key: 'chart-of-the-day', routes: ['/chart-of-the-day/'],
    art: framed('dayWheel'), accent: { kind: 'signDiscs' },
    kicker: 'In the news', title: ['Chart of', 'the day'], size: 96, line: 'A public figure’s chart, with sourced birth data and its limits stated.',
    alt: 'Chart of the day: a public figure’s chart, with sourced birth data and its limits stated. The twelve sign discs in a row beside one of the site’s chart wheels, running off the edge.',
  },
  {
    key: 'group-charts', routes: ['/group-charts/'],
    art: framed('groupWheels'), accent: { kind: 'signDiscs' },
    kicker: 'Free group reading', title: ['Who’s the spark,', 'who’s the glue?'], size: 80, fit: 540, line: 'Three to eight charts, each given a role.',
    alt: 'Who’s the spark, who’s the glue? Three to eight charts, each given a role. The twelve sign discs in a row beside five of the site’s chart wheels, overlapping.',
  },
  {
    key: 'people', routes: ['/people/'],
    art: framed('instantPhotos'), accent: { kind: 'signDiscs' },
    kicker: 'People', title: ['Sourced', 'birth charts'], size: 96, line: 'Charts for people whose birth dates are a matter of public record.',
    alt: 'Sourced birth charts: charts for people whose birth dates are a matter of public record. The twelve sign discs in a row beside four instant photographs of anonymous people with their faces hidden, scattered with star stickers.',
  },
].map((spec) => Object.freeze({ ...spec, card: PAGE_CARD(spec.key), size: spec.size ?? 104, fit: spec.fit ?? 500, lineCh: spec.lineCh ?? 23 })));

/** The single page cards' keys, in the order they are drawn. */
export const ART_PAGE_CARD_KEYS = Object.freeze(ART_PAGE_CARD_SPECS.map((spec) => spec.key));

/** @param {string} key */
export function artPageCardSpec(key) {
  const spec = ART_PAGE_CARD_SPECS.find((entry) => entry.key === key);
  if (!spec) throw new Error(`artPageCardSpec: no art page card ${key}`);
  return spec;
}

/** A page's art card: `tool/birth-chart.jpg`. @param {string} key */
export function artPageCard(key) {
  return artPageCardSpec(key).card;
}

/** A page's art card's alt text. @param {string} key */
export function artPageCardAlt(key) {
  return artPageCardSpec(key).alt;
}

/** Every single page card's path. */
export const ART_PAGE_CARDS = Object.freeze(ART_PAGE_CARD_SPECS.map((spec) => spec.card));

/** The mark above a sign pair's or a cusp birthday's kicker: the two canonical sign discs, in px. */
export const ART_PAGE_CARD_ACCENT = 64;

// ── The 78 sign pair cards ─────────────────────────────────────────────────

/** The sign pair cards' folder and its own ceiling. */
export const PAIR_ART_CARD_DIR = `${ART_CARD_DIR}/pair`;
export const PAIR_ART_CARDS_MAX_TOTAL_BYTES = 10 * 1024 * 1024;

/** What each sign's painting shows, for the alt text. */
const SIGN_FIGURES = Object.freeze({
  aries: 'ram', taurus: 'bull', gemini: 'twins', cancer: 'crab', leo: 'lion', virgo: 'maiden with a sheaf of wheat',
  libra: 'figure holding the scales', scorpio: 'scorpion', sagittarius: 'centaur archer', capricorn: 'sea-goat',
  aquarius: 'water bearer', pisces: 'two fish',
});

/** The 78 pairs in zodiac order, each written as its page's slug ('aries-leo', 'aries-aries'). */
export const PAIR_SLUGS = Object.freeze(OG_SIGNS.flatMap((a, i) => OG_SIGNS.slice(i).map((b) => `${a.slug}-${b.slug}`)));

/** @param {string} slug */
function pairSigns(slug) {
  if (!PAIR_SLUGS.includes(slug)) throw new Error(`pairArtCard: unknown pair ${slug}`);
  const [a, b] = slug.split('-').map((part) => OG_SIGNS.find((sign) => sign.slug === part));
  return /** @type {[typeof OG_SIGNS[number], typeof OG_SIGNS[number]]} */ ([a, b]);
}

/** A sign pair page's card: `pair/aries-leo.jpg`. @param {string} slug */
export function pairArtCard(slug) {
  pairSigns(slug);
  return `${PAIR_ART_CARD_DIR}/${slug}.jpg`;
}

export const PAIR_ART_CARDS = Object.freeze(PAIR_SLUGS.map((slug) => pairArtCard(slug)));

/** The line on every pair card. */
export const PAIR_ART_CARD_LINE = 'What works, what strains, what makes it last.';

/**
 * A pair card's words and alt text: the kicker names the two elements, the
 * headline the two signs on two lines.
 * @param {string} slug
 * @returns {{ a: string, b: string, kicker: string, title: string[], line: string, alt: string }}
 */
export function pairArtCardCopy(slug) {
  const [a, b] = pairSigns(slug);
  const kicker = `Compatibility, ${a.element} with ${b.element}`;
  const figures = a.slug === b.slug
    ? `The ${a.name} ${SIGN_FIGURES[a.slug]} and their mirror image face each other.`
    : `The ${a.name} ${SIGN_FIGURES[a.slug]} and the ${b.name} ${SIGN_FIGURES[b.slug]} face each other.`;
  return Object.freeze({
    a: a.slug,
    b: b.slug,
    kicker,
    title: Object.freeze([a.name, `and ${b.name}`]),
    line: PAIR_ART_CARD_LINE,
    alt: `${a.name} and ${b.name} compatibility, ${a.element} with ${b.element}: what works, what strains, what makes it last. ${figures}`,
  });
}

/**
 * The pair template's art: each sign's 1200 × 800 panel drawn at `scale` with
 * its figure's point (fx, fy) on the middle of its pane, the first sign's
 * mirrored so the two face each other; each pane feathers into the next.
 */
export const PAIR_ART_CARD_ART = Object.freeze({
  srcFor: (slug) => `public/assets/sign-art/${slug}-1200.webp`,
  width: 1200,
  height: 800,
  scale: 0.74,
  fx: 600,
  fy: 440,
  cy: 292,
  panes: Object.freeze([
    Object.freeze({ x0: 470, x1: 870, flip: true, featherLeft: 200, featherRight: 70 }),
    Object.freeze({ x0: 810, x1: 1200, flip: false, featherLeft: 70, featherRight: 0 }),
  ]),
  filter: PAINTING_FILTER,
  seam: 'linear-gradient(90deg, rgba(6, 7, 9, 0) 62%, rgba(6, 7, 9, 0.25) 68.5%, rgba(6, 7, 9, 0) 75%)',
});

// ── The 29 cusp birthday cards ─────────────────────────────────────────────

/** The cusp birthday cards' folder and its own ceiling. */
export const BIRTHDAY_ART_CARD_DIR = `${ART_CARD_DIR}/birthday`;
export const BIRTHDAY_ART_CARDS_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/**
 * The dates whose Sun sign depends on the year (src/data/birthdays.json, the
 * days with a `cusp` table), with the sign it leaves and the sign it enters.
 * og-art-cards.test.ts holds the list to the data.
 */
export const BIRTHDAY_CUSP_DATES = Object.freeze([
  ['january-19', 'capricorn', 'aquarius'], ['january-20', 'capricorn', 'aquarius'], ['january-21', 'capricorn', 'aquarius'],
  ['february-18', 'aquarius', 'pisces'], ['february-19', 'aquarius', 'pisces'],
  ['march-20', 'pisces', 'aries'], ['march-21', 'pisces', 'aries'],
  ['april-19', 'aries', 'taurus'], ['april-20', 'aries', 'taurus'],
  ['may-20', 'taurus', 'gemini'], ['may-21', 'taurus', 'gemini'],
  ['june-20', 'gemini', 'cancer'], ['june-21', 'gemini', 'cancer'], ['june-22', 'gemini', 'cancer'],
  ['july-22', 'cancer', 'leo'], ['july-23', 'cancer', 'leo'],
  ['august-22', 'leo', 'virgo'], ['august-23', 'leo', 'virgo'], ['august-24', 'leo', 'virgo'],
  ['september-22', 'virgo', 'libra'], ['september-23', 'virgo', 'libra'],
  ['october-22', 'libra', 'scorpio'], ['october-23', 'libra', 'scorpio'], ['october-24', 'libra', 'scorpio'],
  ['november-21', 'scorpio', 'sagittarius'], ['november-22', 'scorpio', 'sagittarius'], ['november-23', 'scorpio', 'sagittarius'],
  ['december-21', 'sagittarius', 'capricorn'], ['december-22', 'sagittarius', 'capricorn'],
].map(([slug, a, b]) => Object.freeze({ slug, a: knownSign(a, 'BIRTHDAY_CUSP_DATES'), b: knownSign(b, 'BIRTHDAY_CUSP_DATES') })));

/** @param {string} slug */
function cuspDate(slug) {
  const date = BIRTHDAY_CUSP_DATES.find((entry) => entry.slug === slug);
  if (!date) throw new Error(`birthdayArtCard: ${slug} is not a cusp date`);
  return date;
}

/** A cusp birthday page's card: `birthday/march-21.jpg`. @param {string} slug */
export function birthdayArtCard(slug) {
  return `${BIRTHDAY_ART_CARD_DIR}/${cuspDate(slug).slug}-${REDRAWN_ART_CARD_STAMP}.jpg`;
}

export const BIRTHDAY_ART_CARDS = Object.freeze(BIRTHDAY_CUSP_DATES.map((date) => birthdayArtCard(date.slug)));

/** The line on every cusp birthday card. */
export const BIRTHDAY_ART_CARD_LINE = 'The year table and birth hour settle it. Both signs sketched.';

/**
 * A cusp birthday card's words, as its page prints them: the two signs "by
 * year" (the page's own fact line), "Born on" and the date (its headline).
 * @param {string} slug
 * @returns {{ a: string, b: string, label: string, kicker: string, title: string[], line: string, alt: string }}
 */
export function birthdayArtCardCopy(slug) {
  const date = cuspDate(slug);
  const [month, day] = date.slug.split('-');
  const label = `${month[0].toUpperCase()}${month.slice(1)} ${day}`;
  const a = OG_SIGNS.find((sign) => sign.slug === date.a);
  const b = OG_SIGNS.find((sign) => sign.slug === date.b);
  return Object.freeze({
    a: date.a,
    b: date.b,
    label,
    kicker: `${a.name} or ${b.name}, by year`,
    title: Object.freeze(['Born on', label]),
    line: BIRTHDAY_ART_CARD_LINE,
    alt: `Born on ${label}: ${a.name} or ${b.name}, by year. The year table and birth hour settle it. The two sign discs beside the Sun’s yearly figure of eight across the sky.`,
  });
}

/** The cusp birthday cards' picture, the birthday hub's analemma (since 2026-11-28; the sundial before), placed as on its card. */
export const BIRTHDAY_ART_CARD_ART = artPageCardSpec('birthday').art;

/**
 * The cards the 2026-11-28 redraw replaced, kept published byte for byte for
 * links already shared: the thirteen first-round single page cards (in the
 * English art cards' folder and ceiling) and the 29 cusp birthday cards on the
 * brass sundial (in the birthday folder and its ceiling).
 */
export const REPLACED_ART_PAGE_CARDS = Object.freeze(REDRAWN_ART_PAGE_CARD_KEYS.map((key) => `${ART_CARD_DIR}/tool/${key}.jpg`));
export const REPLACED_BIRTHDAY_ART_CARDS = Object.freeze(BIRTHDAY_CUSP_DATES.map((date) => `${BIRTHDAY_ART_CARD_DIR}/${date.slug}.jpg`));

// ── The 12 Chinese zodiac animal cards ─────────────────────────────────────

/** The Chinese zodiac animal cards' folder and its own ceiling. */
export const CHINESE_ZODIAC_ART_CARD_DIR = `${ART_CARD_DIR}/learn/chinese-zodiac`;
export const CHINESE_ZODIAC_ART_CARDS_MAX_TOTAL_BYTES = 2 * 1024 * 1024;

/** The kicker on every animal card, the guide's own (CHINESE_ZODIAC_COPY.animalKicker). */
export const CHINESE_ZODIAC_ART_CARD_KICKER = 'Animal year guide';

/**
 * The twelve animals in cycle order, each with the guide's line about it
 * (src/data/chinese-zodiac.ts, `association`, which og-art-cards.test.ts
 * holds word for word) and where its painting
 * (public/assets/art/chinese-zodiac/{animal}-1280.webp, 1280 × 720) sits on the card.
 */
/**
 * Where an animal's painting fades in: from 500 px, or, where the painting's
 * own left edge falls further right, from 40 px past that edge, so the edge
 * never shows (and the seal in the painting's corner stays out of sight).
 */
function animalFade({ fx, scale, cx = 860, fadeFrom = 0 }) {
  const from = Math.max(500, Math.ceil(cx - fx * scale) + 40, fadeFrom);
  return Object.freeze([from, from + 240]);
}

export const CHINESE_ZODIAC_ART_CARD_ANIMALS = Object.freeze([
  { slug: 'rat', name: 'Rat', line: 'Traditionally associated with alertness, adaptability, and finding a way through constrained circumstances.', fx: 900, fy: 300, scale: 0.96 },
  { slug: 'ox', name: 'Ox', line: 'Traditionally associated with steady labor, endurance, and practical responsibility.', fx: 640, fy: 420, scale: 0.96 },
  { slug: 'tiger', name: 'Tiger', line: 'Traditionally associated with courage, force, and protection.', fx: 520, fy: 340, scale: 0.84, cx: 920, fadeFrom: 540 },
  { slug: 'rabbit', name: 'Rabbit', line: 'Traditionally associated with vigilance, grace, and careful movement.', fx: 440, fy: 360, scale: 0.92 },
  { slug: 'dragon', name: 'Dragon', line: 'Traditionally associated with auspicious power, vitality, and authority.', fx: 760, fy: 380, scale: 0.96 },
  { slug: 'snake', name: 'Snake', line: 'Traditionally associated with perception, reserve, and transformation.', fx: 720, fy: 320, scale: 0.96 },
  { slug: 'horse', name: 'Horse', line: 'Traditionally associated with effort, bravery, resilience, and movement.', fx: 860, fy: 360, scale: 0.96 },
  { slug: 'goat', name: 'Goat', line: 'Traditionally associated with care, harmony, and creative cultivation.', fx: 600, fy: 330, scale: 0.96 },
  { slug: 'monkey', name: 'Monkey', line: 'Traditionally associated with ingenuity, play, and quick adjustment.', fx: 330, fy: 280, scale: 0.96 },
  { slug: 'rooster', name: 'Rooster', line: 'Traditionally associated with diligence, timekeeping, and industriousness.', fx: 320, fy: 340, scale: 0.96, cx: 900 },
  { slug: 'dog', name: 'Dog', line: 'Traditionally associated with loyalty, watchfulness, and protection.', fx: 600, fy: 420, scale: 0.96 },
  { slug: 'pig', name: 'Pig', line: 'Traditionally associated with plenty, generosity, and completion.', fx: 420, fy: 380, scale: 0.96 },
].map((animal) => Object.freeze({
  ...animal,
  art: Object.freeze({
    src: `public/assets/art/chinese-zodiac/${animal.slug}-1280.webp`, width: 1280, height: 720,
    fx: animal.fx, fy: animal.fy, scale: animal.scale, cx: animal.cx ?? 860, cy: 290, fade: animalFade(animal), filter: 'saturate(0.96) brightness(0.95)',
  }),
})));

/** @param {string} slug */
function chineseAnimal(slug) {
  const animal = CHINESE_ZODIAC_ART_CARD_ANIMALS.find((entry) => entry.slug === slug);
  if (!animal) throw new Error(`chineseZodiacArtCard: unknown animal ${slug}`);
  return animal;
}

/** An animal page's card: `learn/chinese-zodiac/dragon.jpg`. @param {string} slug */
export function chineseZodiacArtCard(slug) {
  return `${CHINESE_ZODIAC_ART_CARD_DIR}/${chineseAnimal(slug).slug}.jpg`;
}

export const CHINESE_ZODIAC_ART_CARDS = Object.freeze(CHINESE_ZODIAC_ART_CARD_ANIMALS.map((animal) => chineseZodiacArtCard(animal.slug)));

/**
 * An animal card's words: the guide's kicker, "Year of the Dragon" on two
 * lines (the page's headline) and the guide's line about the animal.
 * @param {string} slug
 * @returns {{ kicker: string, title: string[], line: string, alt: string }}
 */
export function chineseZodiacArtCardCopy(slug) {
  const animal = chineseAnimal(slug);
  return Object.freeze({
    kicker: CHINESE_ZODIAC_ART_CARD_KICKER,
    title: Object.freeze(['Year of', `the ${animal.name}`]),
    line: animal.line,
    alt: `Year of the ${animal.name}, an animal year guide: ${animal.line[0].toLowerCase()}${animal.line.slice(1, -1)}. Beside it, the guide’s painting of the ${animal.name.toLowerCase()}.`,
  });
}

/** JPEG quality for each family: the pairs and cusp birthdays are many cards over the same paintings. */
export const ART_PAGE_CARD_QUALITY = Object.freeze({ page: 86, pair: 80, birthday: 84, chineseZodiac: 86 });

/**
 * Every English art card under the English ceiling: the homepage, the signs in
 * zodiac order, each sign's horoscopes, the chart twins card, the thesis card,
 * then the single page cards (2026-11-27). The pair, cusp birthday and
 * Chinese zodiac cards are counted in folders of their own.
 */
export const ART_CARDS = Object.freeze([
  HOME_ART_CARD,
  ...OG_SIGNS.map((sign) => signArtCard(sign.slug)),
  ...OG_SIGNS.flatMap((sign) => HOROSCOPE_OG_SURFACES.map((surface) => horoscopeArtCard(sign.slug, surface.key))),
  CHART_TWINS_ART_CARD,
  THESIS_ART_CARD,
  ...ART_PAGE_CARDS,
]);
