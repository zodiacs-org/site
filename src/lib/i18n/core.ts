export const LOCALES = ['en', 'es', 'pt', 'fr', 'it', 'ru', 'ar', 'zh-hans', 'zh-hant'] as const;
export type Locale = typeof LOCALES[number];

/** Locales with complete production routes and catalogs. */
export const RELEASED_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const;
export type ReleasedLocale = typeof RELEASED_LOCALES[number];

/** Locales whose complete UI catalog can render in a gated preview. */
export const CATALOG_LOCALES = ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const;
export type CatalogLocale = typeof CATALOG_LOCALES[number];

/**
 * Locales released for one section only (the Chinese zodiac guide). They have
 * no complete UI catalog: shared chrome reads a chrome-only catalog that
 * fails the build on any key it does not carry, and every other route keeps
 * its English page.
 */
export const SECTION_LOCALES = ['zh-hans', 'zh-hant'] as const;
export type SectionLocale = typeof SECTION_LOCALES[number];

/** Locales that can render a page with the shared navigation and footer. */
export type PageLocale = CatalogLocale | SectionLocale;

export const DEFAULT_LOCALE: ReleasedLocale = 'en';

export type TextDirection = 'ltr' | 'rtl';

export interface LocaleMeta {
  /** URL segment, including its leading slash. Empty for the default locale. */
  pathPrefix: string;
  /** Value rendered on the document's `lang` attribute. */
  htmlLang: string;
  /** Browser text direction when a route for the locale is released. */
  dir: TextDirection;
  /** Value rendered on alternate links and sitemap entries. */
  hreflang: string;
  /** Locale passed to the browser's Intl formatters. */
  intlLocale: string;
  /** Open Graph's underscore-form locale identifier. */
  ogLocale: string;
  /** Self-name used by language selectors. */
  languageName: string;
}

/**
 * Metadata describes every known locale. Route availability is deliberately
 * separate: adding a locale here must never publish a URL or selector entry.
 */
export const LOCALE_META = {
  en: { pathPrefix: '', htmlLang: 'en', dir: 'ltr', hreflang: 'en', intlLocale: 'en-US', ogLocale: 'en_US', languageName: 'English' },
  es: { pathPrefix: '/es', htmlLang: 'es', dir: 'ltr', hreflang: 'es', intlLocale: 'es-419', ogLocale: 'es_LA', languageName: 'Español' },
  pt: { pathPrefix: '/pt', htmlLang: 'pt-BR', dir: 'ltr', hreflang: 'pt-BR', intlLocale: 'pt-BR', ogLocale: 'pt_BR', languageName: 'Português (Brasil)' },
  fr: { pathPrefix: '/fr', htmlLang: 'fr', dir: 'ltr', hreflang: 'fr', intlLocale: 'fr-FR', ogLocale: 'fr_FR', languageName: 'Français' },
  it: { pathPrefix: '/it', htmlLang: 'it', dir: 'ltr', hreflang: 'it', intlLocale: 'it-IT', ogLocale: 'it_IT', languageName: 'Italiano' },
  ru: { pathPrefix: '/ru', htmlLang: 'ru', dir: 'ltr', hreflang: 'ru', intlLocale: 'ru-RU', ogLocale: 'ru_RU', languageName: 'Русский' },
  ar: { pathPrefix: '/ar', htmlLang: 'ar', dir: 'rtl', hreflang: 'ar', intlLocale: 'ar-u-ca-gregory-nu-latn', ogLocale: 'ar_AR', languageName: 'العربية' },
  'zh-hans': { pathPrefix: '/zh-hans', htmlLang: 'zh-Hans', dir: 'ltr', hreflang: 'zh-Hans', intlLocale: 'zh-Hans', ogLocale: 'zh_CN', languageName: '简体中文' },
  'zh-hant': { pathPrefix: '/zh-hant', htmlLang: 'zh-Hant', dir: 'ltr', hreflang: 'zh-Hant', intlLocale: 'zh-Hant', ogLocale: 'zh_TW', languageName: '繁體中文' },
} as const satisfies Record<Locale, LocaleMeta>;

export function isLocale(locale: string): locale is Locale {
  return (LOCALES as readonly string[]).includes(locale);
}

export function isReleasedLocale(locale: string): locale is ReleasedLocale {
  return (RELEASED_LOCALES as readonly string[]).includes(locale);
}

export function isCatalogLocale(locale: string): locale is CatalogLocale {
  return (CATALOG_LOCALES as readonly string[]).includes(locale);
}

export function isSectionLocale(locale: string): locale is SectionLocale {
  return (SECTION_LOCALES as readonly string[]).includes(locale);
}

export function isPageLocale(locale: string): locale is PageLocale {
  return isCatalogLocale(locale) || isSectionLocale(locale);
}

/** Parse every declared locale, including staged locales with no routes yet. */
export function normalizeKnownLocale(locale: string | undefined | null): Locale {
  const value = locale?.trim().toLowerCase();
  if (!value) return DEFAULT_LOCALE;
  return LOCALES.find((candidate) => value === candidate || value.startsWith(`${candidate}-`))
    ?? DEFAULT_LOCALE;
}

/** Resolve a locale for code that renders today's complete catalogs/routes. */
export function normalizeReleasedLocale(locale: string | undefined | null): ReleasedLocale {
  const normalized = normalizeKnownLocale(locale);
  return isReleasedLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

/** Resolve a complete catalog for staged preview rendering without publishing it. */
export function normalizeCatalogLocale(locale: string | undefined | null): CatalogLocale {
  const normalized = normalizeKnownLocale(locale);
  return isCatalogLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

/** Resolve the locale a page renders in, including the section-only locales. */
export function normalizePageLocale(locale: string | undefined | null): PageLocale {
  const normalized = normalizeKnownLocale(locale);
  return isPageLocale(normalized) ? normalized : DEFAULT_LOCALE;
}

/** Existing rendering API remains release-gated; staged locales fail closed. */
export const normalizeLocale = normalizeReleasedLocale;

export function requireReleasedLocale(locale: Locale): ReleasedLocale {
  if (!isReleasedLocale(locale)) {
    throw new Error(`Locale ${locale} has no released production catalog`);
  }
  return locale;
}

/** Resolve only complete catalogs; this does not publish or index a locale. */
export function requireCatalogLocale(locale: Locale): CatalogLocale {
  if (!isCatalogLocale(locale)) {
    throw new Error(`Locale ${locale} has no complete production catalog`);
  }
  return locale;
}

export function localeHtmlLang(locale: Locale): string {
  return LOCALE_META[locale].htmlLang;
}
