import { readFileSync } from 'node:fs';
const approvedDailyDays = JSON.parse(readFileSync(new URL('../src/data/chart-of-the-day.json', import.meta.url), 'utf8')).editions.filter((edition) => edition.ownerApproval?.approved === true).map((edition) => edition.day);
const dailyBlocks = approvedDailyDays.length * 6;
/**
 * Hreflang activation is explicit and per locale. Declaring metadata in the
 * TypeScript locale union never changes this release policy.
 */
export const HREFLANG_LOCALE_POLICY = Object.freeze([
  { locale: 'en', hreflang: 'en', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'birthday', 'daily-reading'], expectedBlocks: 659 + dailyBlocks },
  { locale: 'es', hreflang: 'es', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'daily-reading'], expectedBlocks: 293 + dailyBlocks },
  { locale: 'pt', hreflang: 'pt-BR', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac', 'daily-reading'], expectedBlocks: 293 + dailyBlocks },
  { locale: 'fr', hreflang: 'fr', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac'], expectedBlocks: 251 + dailyBlocks },
  { locale: 'it', hreflang: 'it', indexEligible: true, routeFamilies: ['core', 'sign-guide', 'chinese-zodiac'], expectedBlocks: 251 + dailyBlocks },
  { locale: 'ru', hreflang: 'ru', indexEligible: true, routeFamilies: ['core'], expectedBlocks: 126 + dailyBlocks },
  { locale: 'ar', hreflang: 'ar', indexEligible: false, routeFamilies: [], expectedBlocks: 0 },
]);

export const X_DEFAULT_HREFLANG = Object.freeze({
  hreflang: 'x-default',
  locale: 'en',
  expectedBlocks: 659 + dailyBlocks,
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
  '/baby-zodiac/', '/profile/', '/methodology/', '/privacy/', '/disclosure/',
  '/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/',
  '/sky-calendar/', '/astrologer-kit/', '/your-sky-wrapped/', '/chart-of-the-day/',
  ...approvedDailyDays.map((day) => `/chart-of-the-day/${day}/`),
]);
const SIGN_GUIDE_PATHS = new Set(SIGN_SLUGS.map((slug) => `/${slug}/`));
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
  for (const prefix of ['/es', '/pt', '/fr', '/it', '/ru', '/ar']) {
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
  if (DAILY_READING_PATHS.has(clean)) return 'daily-reading';
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
  if (!family) return new Set();
  const expected = new Set(HREFLANG_LOCALE_POLICY
    .filter((entry) => entry.routeFamilies.includes(family))
    .map((entry) => entry.hreflang));
  if (expected.size) expected.add(X_DEFAULT_HREFLANG.hreflang);
  return expected;
}
