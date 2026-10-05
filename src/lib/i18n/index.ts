import { SIGN_SLUGS } from '../signs';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from './core';
import { clientUiMessage } from './ui/client';
import { serverUiMessage } from './ui/server';
import type { UiKey } from './ui/schema';

export {
  DEFAULT_LOCALE,
  CATALOG_LOCALES,
  LOCALES,
  LOCALE_META,
  RELEASED_LOCALES,
  isLocale,
  isCatalogLocale,
  isReleasedLocale,
  localeHtmlLang,
  normalizeKnownLocale,
  normalizeCatalogLocale,
  normalizeLocale,
  normalizeReleasedLocale,
  requireReleasedLocale,
  requireCatalogLocale,
  type CatalogLocale,
  type Locale,
  type LocaleMeta,
  type ReleasedLocale,
  type TextDirection,
} from './core';
export { UI } from './ui/server';
export { ENGLISH_ONLY_COPY, englishOnlyCue, type EnglishOnlyCue } from './english-only';
export { pluralCategory, pluralText, tp } from './plural';
export type { PluralCatalog, PluralCategory, PluralForms } from './plural';
export type { UiKey } from './ui/schema';

/** Kept separate so client-side path helpers do not carry head-only metadata. */
export const LOCALE_PATH_PREFIX = {
  en: '',
  es: '/es',
  pt: '/pt',
  fr: '/fr',
  it: '/it',
  ru: '/ru',
  ar: '/ar',
} as const satisfies Record<Locale, string>;

/** D9 policy: authored interpretation corpora remain English-only. */
export function showsEnglishOnlyInterpretation(locale: Locale): boolean {
  return locale === 'en';
}

const CORE_LOCALIZED_PATHS = [
  '/',
  '/tools/',
  '/big-three/',
  '/compatibility/invite/',
  '/group-charts/',
  '/chart-twins/',
  '/sky-calendar/',
  '/astrologer-kit/',
  '/your-sky-wrapped/',
  '/chart-of-the-day/',
  '/birth-chart/',
  '/compatibility/',
  '/moon-sign/',
  '/rising-sign/',
  '/moon-phase/',
  '/saturn-return/',
  '/transits/',
  '/baby-zodiac/',
  '/profile/',
  '/methodology/',
  '/privacy/',
  '/disclosure/',
  '/404.html',
  ...SIGN_SLUGS.map((slug) => `/${slug}/`),
];

/**
 * Route publication is independent from catalog readiness. Future RU/AR
 * catalogs cannot publish a URL until that locale is added to a route policy.
 */
export const CORE_ROUTE_LOCALES = ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const satisfies readonly Locale[];

/** Published daily editions; longer-range forecasts remain English-only. */
export const DAILY_READING_ROUTE_LOCALES = ['en', 'es', 'pt'] as const satisfies readonly Locale[];
const DAILY_READING_PATHS = [
  '/today/',
  '/horoscopes/',
  ...SIGN_SLUGS.map((slug) => `/horoscopes/${slug}/`),
];

/** RU sign-guide shells stay renderable but are withheld from discovery. */
export const INDEXABLE_SIGN_GUIDE_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const satisfies readonly Locale[];

/** Complete private-preview trees awaiting a later indexability release. */
export const STAGED_CORE_ROUTE_LOCALES = [] as const satisfies readonly Locale[];

/** Birthday and Chinese-zodiac families remain outside R1/R2/A1/A2. */
export const PROGRAMMATIC_ROUTE_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const satisfies readonly Locale[];

/** Byte-compatible locale-home fallback; future locales never join it. */
export const LEGACY_HOME_SELECTOR_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const satisfies readonly Locale[];

/** Discovery metadata has no side effects; client navigation can omit this map. */
export const LOCALIZED_PATHS: ReadonlyMap<string, readonly Locale[]> = /*#__PURE__*/ (() => new Map<string, readonly Locale[]>([
  ...CORE_LOCALIZED_PATHS.map((path) => [
    path,
    SIGN_SLUGS.some((slug) => path === `/${slug}/`)
      ? INDEXABLE_SIGN_GUIDE_LOCALES
      : CORE_ROUTE_LOCALES,
  ] as const),
  ...DAILY_READING_PATHS.map((path) => [path, DAILY_READING_ROUTE_LOCALES] as const),
]))();

const BIRTHDAY_MONTH_LENGTHS: Readonly<Record<string, number>> = Object.freeze({
  january: 31,
  february: 29,
  march: 31,
  april: 30,
  may: 31,
  june: 30,
  july: 31,
  august: 31,
  september: 30,
  october: 31,
  november: 30,
  december: 31,
});
const CHINESE_ZODIAC_SLUGS = new Set([
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig',
]);

function isLocalizedChineseZodiacPath(path: string): boolean {
  if (path === '/learn/chinese-zodiac/') return true;
  const animal = path.match(/^\/learn\/chinese-zodiac\/([a-z]+)\/$/)?.[1];
  if (animal) return CHINESE_ZODIAC_SLUGS.has(animal);

  return false;
}

function isLocalizedBirthdayPath(path: string): boolean {
  const birthday = path.match(/^\/birthday\/([a-z]+)-(\d{1,2})\/$/);
  if (!birthday) return false;
  const maxDay = BIRTHDAY_MONTH_LENGTHS[birthday[1]];
  const day = Number(birthday[2]);
  return Boolean(maxDay && birthday[2] === String(day) && day >= 1 && day <= maxDay);
}

/** Families translated for es, pt, fr and it only (rising-sign profiles, sky calendars); Russian links to English. */
export const RISING_PROFILE_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const satisfies readonly Locale[];

/** The four sky-calendar hubs are translated for es, pt, fr and it; their year and event pages stay English. */
const SKY_CALENDAR_PATHS: readonly string[] = ['/full-moon-calendar/', '/eclipses/', '/mercury-retrograde/', '/retrogrades/'];

function isRisingProfilePath(path: string): boolean {
  const sign = path.match(/^\/rising-sign\/([a-z]+)\/$/)?.[1];
  return Boolean(sign && SIGN_SLUGS.includes(sign));
}

export function availableLocalesForPath(path: string): readonly Locale[] | undefined {
  const canonical = stripLocale(path);
  if (/^\/chart-of-the-day\/\d{4}-\d{2}-\d{2}\/$/.test(canonical)) return CORE_ROUTE_LOCALES;
  return LOCALIZED_PATHS.get(canonical)
    ?? (isLocalizedChineseZodiacPath(canonical) ? PROGRAMMATIC_ROUTE_LOCALES : undefined)
    ?? (isRisingProfilePath(canonical) ? RISING_PROFILE_LOCALES : undefined)
    ?? (SKY_CALENDAR_PATHS.includes(canonical) ? RISING_PROFILE_LOCALES : undefined)
    ?? (isLocalizedBirthdayPath(canonical) ? [DEFAULT_LOCALE] : undefined);
}

/** Internal rendering availability; never use this for discovery metadata. */
export function renderableLocalesForPath(path: string): readonly Locale[] | undefined {
  const canonical = stripLocale(path);
  if (CORE_LOCALIZED_PATHS.includes(canonical) || /^\/chart-of-the-day\/\d{4}-\d{2}-\d{2}\/$/.test(canonical)) {
    return [...CORE_ROUTE_LOCALES, ...STAGED_CORE_ROUTE_LOCALES];
  }
  if (DAILY_READING_PATHS.includes(canonical)) return DAILY_READING_ROUTE_LOCALES;
  if (isRisingProfilePath(canonical)) return RISING_PROFILE_LOCALES;
  if (SKY_CALENDAR_PATHS.includes(canonical)) return RISING_PROFILE_LOCALES;
  return isLocalizedChineseZodiacPath(canonical) || isLocalizedBirthdayPath(canonical)
    ? PROGRAMMATIC_ROUTE_LOCALES
    : undefined;
}

export function stripLocale(path: string): string {
  for (const locale of LOCALES) {
    const prefix = LOCALE_PATH_PREFIX[locale];
    if (!prefix) continue;
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || '/';
  }
  return path;
}

export function localizePath(locale: Locale, path: string): string {
  if (path.startsWith('http') || path.startsWith('#')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const canonical = stripLocale(clean);
  if (locale === DEFAULT_LOCALE) return canonical;
  if (!renderableLocalesForPath(canonical)?.includes(locale)) return canonical;
  return `${LOCALE_PATH_PREFIX[locale]}${canonical}`;
}

export type AlternatePaths = Partial<Record<Locale, string>>;
export interface AlternatePathEntry { locale: Locale; href: string }

export function alternatePaths(path: string): AlternatePaths | null {
  // Astro emits nested locale 404s at /{locale}/404/, while English remains
  // /404.html. Normalize only this server-rendered alternate-link family so
  // the client path helper stays byte-identical.
  const clean = path.endsWith('/404/') ? '/404.html' : stripLocale(path);
  const locales = availableLocalesForPath(clean);
  if (!locales) return null;
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      clean === '/404.html' && locale !== DEFAULT_LOCALE
        ? `${LOCALE_PATH_PREFIX[locale]}/404/`
        : localizePath(locale, clean),
    ]),
  ) as AlternatePaths;
}

/** Ordered route-derived entries for selectors, head metadata, and sitemaps. */
export function alternatePathEntries(path: string): AlternatePathEntry[] {
  const alternates = alternatePaths(path);
  if (!alternates) return [];
  return Object.entries(alternates).map(([locale, href]) => ({
    locale: locale as Locale,
    href,
  }));
}

/** Visible navigation only; unlike discovery metadata, includes noindex previews. */
export function renderableAlternatePathEntries(path: string): AlternatePathEntry[] {
  const clean = path.endsWith('/404/') ? '/404.html' : stripLocale(path);
  const locales = renderableLocalesForPath(clean);
  if (!locales) return [];
  return locales.map((locale) => ({
    locale,
    href: clean === '/404.html' && locale !== DEFAULT_LOCALE
      ? `${LOCALE_PATH_PREFIX[locale]}/404/`
      : localizePath(locale, clean),
  }));
}

export function t(locale: Locale, key: UiKey): string {
  return import.meta.env.SSR ? serverUiMessage(locale, key) : clientUiMessage(locale, key);
}

export function tf(
  locale: Locale,
  key: UiKey,
  values: Record<string, string | number>,
): string {
  return t(locale, key).replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, name: string) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
  ));
}
