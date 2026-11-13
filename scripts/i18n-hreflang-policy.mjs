import { readFileSync } from 'node:fs';
import { EVENT_PUBLICATION_FILES, mergeEventPublications } from '../src/lib/events/merge-publications.mjs';
import { EXPANSION_FAMILY_IDS, HOROSCOPE_PERIODS, familyForPath, publishedLocalesForPath } from '../src/lib/locale-expansion/policy.mjs';
const approvedDailyDays = JSON.parse(readFileSync(new URL('../src/data/chart-of-the-day.json', import.meta.url), 'utf8')).editions.filter((edition) => edition.ownerApproval?.approved === true).map((edition) => edition.day);
// Each approved edition, plus the chart-of-the-day index once any edition exists, in six languages.
const dailyBlocks = (approvedDailyDays.length + (approvedDailyDays.length ? 1 : 0)) * 6;
/**
 * Hreflang activation is explicit and per locale. Declaring metadata in the
 * TypeScript locale union never changes this release policy.
 */
const HREFLANG_OF = { en: 'en', es: 'es', pt: 'pt-BR', fr: 'fr', it: 'it', ru: 'ru' };
const SIGNS_FOR_EXPANSION = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
// Both event receipts, joined as the site reads them (src/lib/events/site-publication.ts).
const publishedEventPaths = mergeEventPublications(EVENT_PUBLICATION_FILES
  .map((file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))))
  .pages.map((page) => page.path);
/** Base locales of a family before the expansion: the daily editions already publish es and pt. */
const LIVE_FIVE = ['en', 'es', 'pt', 'fr', 'it'];
const EXPANSION_BASE = {
  'horoscope-daily': ['en', 'es', 'pt'],
  today: ['en', 'es', 'pt'],
  'sign-guide': LIVE_FIVE,
  'rising-profile': LIVE_FIVE,
  'compatibility-pair': LIVE_FIVE,
};
/** English paths per expansion family (src/lib/locale-expansion/policy.mjs). */
export function expansionFamilyPaths(family) {
  if (family === 'horoscope-daily') return ['/horoscopes/', ...SIGNS_FOR_EXPANSION.map((slug) => `/horoscopes/${slug}/`)];
  if (family === 'today') return ['/today/'];
  if (family === 'zodiac-dates') return ['/learn/zodiac-dates/'];
  if (family === 'sign-guide') return SIGNS_FOR_EXPANSION.map((slug) => `/${slug}/`);
  if (family === 'rising-profile') return SIGNS_FOR_EXPANSION.map((slug) => `/rising-sign/${slug}/`);
  if (family === 'compatibility-pair') {
    return SIGNS_FOR_EXPANSION.flatMap((a, index) => SIGNS_FOR_EXPANSION.slice(index).map((b) => `/compatibility/${a}-${b}/`));
  }
  if (family === 'full-moon' || family === 'new-moon') return publishedEventPaths.filter((path) => path.startsWith(`/${family}/`));
  const period = HOROSCOPE_PERIODS.find((candidate) => family === `horoscope-${candidate}`);
  return period ? SIGNS_FOR_EXPANSION.map((slug) => `/horoscopes/${slug}/${period}/`) : [];
}
/**
 * Extra sitemap blocks per hreflang from released expansion pages. A path
 * whose set grows from b to n locales gives each listed locale n blocks
 * (none while n is 1); the difference from the base is added here. Counted
 * per path, since a family may be released in batches.
 */
export function expansionBlockDeltas(published = publishedLocalesForPath) {
  const delta = {};
  for (const family of EXPANSION_FAMILY_IDS) {
    const base = EXPANSION_BASE[family] ?? ['en'];
    const before = base.length > 1 ? base.length : 0;
    for (const path of expansionFamilyPaths(family)) {
      const added = published(path);
      if (!added.length) continue;
      const all = [...new Set([...base, ...added])];
      for (const locale of all) {
        const hreflang = HREFLANG_OF[locale];
        delta[hreflang] = (delta[hreflang] ?? 0) + all.length - (base.includes(locale) ? before : 0);
      }
      delta['x-default'] = (delta['x-default'] ?? 0) + all.length - before;
    }
  }
  return delta;
}
const EXPANSION_DELTA = expansionBlockDeltas();
const withExpansion = (entry) => ({ ...entry, expectedBlocks: entry.expectedBlocks + (EXPANSION_DELTA[entry.hreflang] ?? 0) });

export const HREFLANG_LOCALE_POLICY = Object.freeze([
  { locale: 'en', hreflang: 'en', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'birthday', 'daily-reading', 'rising-profile', 'sky-calendar', 'compatibility-pair', 'new-pages'], expectedBlocks: 1224 + dailyBlocks },
  { locale: 'es', hreflang: 'es', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'daily-reading', 'rising-profile', 'sky-calendar', 'compatibility-pair', 'new-pages'], expectedBlocks: 858 + dailyBlocks },
  { locale: 'pt', hreflang: 'pt-BR', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'daily-reading', 'rising-profile', 'sky-calendar', 'compatibility-pair', 'new-pages'], expectedBlocks: 858 + dailyBlocks },
  { locale: 'fr', hreflang: 'fr', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'rising-profile', 'sky-calendar', 'compatibility-pair', 'new-pages'], expectedBlocks: 816 + dailyBlocks },
  { locale: 'it', hreflang: 'it', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'rising-profile', 'sky-calendar', 'compatibility-pair', 'new-pages'], expectedBlocks: 816 + dailyBlocks },
  { locale: 'ru', hreflang: 'ru', indexEligible: true, routeFamilies: ['core'], expectedBlocks: 120 + dailyBlocks },
  { locale: 'ar', hreflang: 'ar', indexEligible: false, routeFamilies: [], expectedBlocks: 0 },
  // The Chinese zodiac guide alone: its 13 pages in each of the seven locales that publish it.
  { locale: 'zh-hans', hreflang: 'zh-Hans', indexEligible: true, routeFamilies: ['chinese-zodiac'], expectedBlocks: 91 },
  { locale: 'zh-hant', hreflang: 'zh-Hant', indexEligible: true, routeFamilies: ['chinese-zodiac'], expectedBlocks: 91 },
].map(withExpansion));

export const X_DEFAULT_HREFLANG = Object.freeze({
  hreflang: 'x-default',
  locale: 'en',
  expectedBlocks: 1224 + dailyBlocks + (EXPANSION_DELTA['x-default'] ?? 0),
});

export const ACTIVE_HREFLANGS = Object.freeze(
  HREFLANG_LOCALE_POLICY.filter((entry) => entry.indexEligible).map((entry) => entry.hreflang),
);

export const INACTIVE_HREFLANGS = Object.freeze(
  HREFLANG_LOCALE_POLICY.filter((entry) => !entry.indexEligible).map((entry) => entry.hreflang),
);

/** Complete locale trees still held in private QA. */
export const STAGED_NOINDEX_LOCALES = Object.freeze([]);

/** Declared metadata only: no generated route tree is permitted yet. */
export const ABSENT_LOCALES = Object.freeze(
  INACTIVE_HREFLANGS.filter((locale) => !STAGED_NOINDEX_LOCALES.includes(locale)),
);

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const CORE_PATHS = new Set([
  '/', '/tools/', '/birth-chart/', '/compatibility/', '/moon-sign/',
  '/rising-sign/', '/moon-phase/', '/saturn-return/', '/transits/',
  '/profile/', '/methodology/', '/privacy/', '/disclosure/',
  '/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/',
  '/sky-calendar/', '/astrologer-kit/', '/your-sky-wrapped/', '/chart-of-the-day/',
  ...approvedDailyDays.map((day) => `/chart-of-the-day/${day}/`),
]);
const SIGN_GUIDE_PATHS = new Set(SIGN_SLUGS.map((slug) => `/${slug}/`));
// Translated in src/content/learn-i18n for es, pt, fr and it; Russian links to the English profiles.
// The four calendar hubs; their year and event pages stay English-only.
const SKY_CALENDAR_PATHS = new Set(['/full-moon-calendar/', '/eclipses/', '/mercury-retrograde/', '/retrogrades/']);
const RISING_PROFILE_PATHS = new Set(SIGN_SLUGS.map((slug) => `/rising-sign/${slug}/`));
// The 78 pairs in zodiac order, translated in src/content/pairs-i18n for es, pt, fr and it.
const COMPATIBILITY_PAIR_PATHS = new Set(SIGN_SLUGS.flatMap((a, i) => SIGN_SLUGS.slice(i).map((b) => `/compatibility/${a}-${b}/`)));
// Your 2027 sky, the Moon journal and the sign-season hub with its twelve season pages, translated in their
// own copy modules (src/lib/year-sky, src/lib/moon-journal, src/lib/seasons) for es, pt, fr and it: 15 pages,
// each listed in five languages, so 75 more blocks for each of the five and for x-default.
const NEW_PAGE_PATHS = new Set(['/your-2027-sky/', '/moon-journal/', '/seasons/', ...SIGN_SLUGS.map((slug) => `/seasons/${slug}/`)]);
const DAILY_READING_PATHS = new Set([
  '/today/', '/horoscopes/', ...SIGN_SLUGS.map((slug) => `/horoscopes/${slug}/`),
]);
const MONTH_LENGTHS = {
  january: 31, february: 29, march: 31, april: 30, may: 31, june: 30,
  july: 31, august: 31, september: 30, october: 31, november: 30, december: 31,
};
const ANIMALS = new Set([
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig',
]);

function canonicalPath(path) {
  let clean = path;
  for (const prefix of ['/es', '/pt', '/fr', '/it', '/ru', '/ar', '/zh-hans', '/zh-hant']) {
    if (clean === prefix) return '/';
    if (clean.startsWith(`${prefix}/`)) {
      clean = clean.slice(prefix.length) || '/';
      break;
    }
  }
  return clean;
}

export function hreflangRouteFamily(path) {
  const clean = canonicalPath(path);
  if (CORE_PATHS.has(clean)) return 'core';
  if (SIGN_GUIDE_PATHS.has(clean)) return 'sign-guide';
  if (RISING_PROFILE_PATHS.has(clean)) return 'rising-profile';
  if (SKY_CALENDAR_PATHS.has(clean)) return 'sky-calendar';
  if (COMPATIBILITY_PAIR_PATHS.has(clean)) return 'compatibility-pair';
  if (DAILY_READING_PATHS.has(clean)) return 'daily-reading';
  if (NEW_PAGE_PATHS.has(clean)) return 'new-pages';
  if (clean === '/learn/chinese-zodiac/') return 'chinese-zodiac';
  const animal = clean.match(/^\/learn\/chinese-zodiac\/([a-z]+)\/$/)?.[1];
  if (animal && ANIMALS.has(animal)) return 'chinese-zodiac';
  const birthday = clean.match(/^\/birthday\/([a-z]+)-(\d{1,2})\/$/);
  if (!birthday) return null;
  const day = Number(birthday[2]);
  return MONTH_LENGTHS[birthday[1]] >= day && birthday[2] === String(day) && day >= 1
    ? 'birthday'
    : null;
}

/** Exact expected set for this route family; no global all-locale assumption. */
export function expectedHreflangsForPath(path) {
  const family = hreflangRouteFamily(path);
  const added = familyForPath(canonicalPath(path)) ? publishedLocalesForPath(canonicalPath(path)) : [];
  if (added.length) {
    const base = family ? [...expectedHreflangsForPath.base(path)] : ['en'];
    const set = new Set([...base, ...added.map((locale) => HREFLANG_OF[locale])]);
    set.add(X_DEFAULT_HREFLANG.hreflang);
    return set;
  }
  if (!family) return new Set();
  const expected = new Set(HREFLANG_LOCALE_POLICY
    .filter((entry) => entry.routeFamilies.includes(family))
    .map((entry) => entry.hreflang));
  if (expected.size) expected.add(X_DEFAULT_HREFLANG.hreflang);
  return expected;
}

/** The policy's own set for a path, before any expansion family is added. */
expectedHreflangsForPath.base = (path) => {
  const family = hreflangRouteFamily(path);
  return new Set(HREFLANG_LOCALE_POLICY.filter((entry) => entry.routeFamilies.includes(family)).map((entry) => entry.hreflang));
};
