import publication from '../../data/locale-expansion-publication.json' with { type: 'json' };

// One rule for the Astro pages, the route integration, the sitemap and the
// postbuild checks, in the manner of scripts/natal-aspects-policy.mjs.
// Pages pass nothing (the module reads the shell environment once); plain
// Node callers may pass their own record and environment.
//
// A family is published in a locale only when its entry is released and
// names a reviewer and a review date. Held families are not built at all.
// PUBLIC_LOCALE_EXPANSION_PREVIEW=1, set in the shell (never a .env file),
// builds held families as noindex pages outside the sitemaps and hreflang,
// for review on a preview deploy. The flag cannot publish anything.

export const LOCALE_EXPANSION_PREVIEW_FLAG = 'PUBLIC_LOCALE_EXPANSION_PREVIEW';

const SIGNS = 'aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces';

export const HOROSCOPE_PERIODS = ['tomorrow', 'weekly', 'monthly', 'love', 'career', '2026', '2027'];

// The top-level values below are marked pure: nothing here runs for its side
// effects, so a browser bundle that never uses the policy drops the module.

/** English canonical path patterns, one per family. The first match wins. */
export const EXPANSION_FAMILIES = /* @__PURE__ */ buildFamilies();

function buildFamilies() {
  return [
  ['horoscope-daily', new RegExp(`^/horoscopes/(?:(?:${SIGNS})/)?$`)],
  ['today', /^\/today\/$/],
  ...HOROSCOPE_PERIODS.map((period) => [`horoscope-${period}`, new RegExp(`^/horoscopes/(?:${SIGNS})/${period}/$`)]),
  ['full-moon', /^\/full-moon\/\d{4}-\d{2}-\d{2}\/$/],
  ['new-moon', /^\/new-moon\/\d{4}-\d{2}-\d{2}\/$/],
  ['zodiac-dates', /^\/learn\/zodiac-dates\/$/],
  // Families the site already publishes in es, pt, fr and it; the record
  // holds the further locales (Russian) that join them.
  ['sign-guide', new RegExp(`^/(?:${SIGNS})/$`)],
  ['rising-profile', new RegExp(`^/rising-sign/(?:${SIGNS})/$`)],
  ['compatibility-pair', new RegExp(`^/compatibility/(?:${SIGNS})-(?:${SIGNS})/$`)],
  ];
}

export const EXPANSION_FAMILY_IDS = /* @__PURE__ */ EXPANSION_FAMILIES.map(([id]) => id);

export function familyForPath(canonicalPath) {
  return EXPANSION_FAMILIES.find(([, pattern]) => pattern.test(canonicalPath))?.[0];
}

function entryPublished(entry) {
  return Boolean(entry && entry.released === true && entry.reviewer && entry.reviewedAt);
}

function readEnv() {
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

/** Every (locale, family) the record names, with its state. */
export function expansionState(record = publication, env = readEnv()) {
  // "1" previews every held family; a comma list ("es,pt") previews those locales only.
  const flag = String(env?.[LOCALE_EXPANSION_PREVIEW_FLAG] ?? '').trim();
  const previewLocales = flag === '1' ? null : new Set(flag.split(',').map((value) => value.trim()).filter(Boolean));
  const preview = flag === '1' || Boolean(previewLocales?.size);
  const previews = (locale) => flag === '1' || Boolean(previewLocales?.has(locale));
  const rows = [];
  for (const [locale, families] of Object.entries(record.entries ?? {})) {
    for (const [family, entry] of Object.entries(families)) {
      if (!EXPANSION_FAMILY_IDS.includes(family)) {
        throw new Error(`locale-expansion: unknown family "${family}" for ${locale}`);
      }
      if (entry.released === true && !entryPublished(entry)) {
        throw new Error(`locale-expansion: ${locale}.${family} is released without a reviewer and review date`);
      }
      const published = entryPublished(entry);
      // An optional list of English paths releases part of a family, so a
      // 12-page family can go out in batches under the weekly cap.
      if (entry.paths !== undefined && (!Array.isArray(entry.paths) || entry.paths.some((path) => familyForPath(path) !== family))) {
        throw new Error(`locale-expansion: ${locale}.${family} lists paths outside its family`);
      }
      const paths = Array.isArray(entry.paths) ? new Set(entry.paths) : null;
      rows.push({ locale, family, published, paths, preview: previews(locale), enabled: published || previews(locale) });
    }
  }
  return { preview, rows };
}

// Computed on first use, not at import: the module then has no top-level side
// effect, so a browser bundle that imports src/lib/i18n never carries the
// record (the expansion hook there runs only on the server).
let STATE;
function currentState() {
  STATE ??= expansionState();
  return STATE;
}

/** Locales whose copy of this family is published (indexable, in sitemaps and hreflang). */
export function publishedExpansionLocales(family, state = currentState()) {
  return state.rows.filter((row) => row.family === family && row.published).map((row) => row.locale);
}

/** Locales whose copy of this family is built: published, or held under the preview flag. */
export function enabledExpansionLocales(family, state = currentState()) {
  return state.rows.filter((row) => row.family === family && row.enabled).map((row) => row.locale);
}

export function isExpansionPublished(locale, family, state = currentState()) {
  return state.rows.some((row) => row.locale === locale && row.family === family && row.published);
}

export function isExpansionEnabled(locale, family, state = currentState()) {
  return state.rows.some((row) => row.locale === locale && row.family === family && row.enabled);
}

const publishedFor = (row, path) => row.published && (!row.paths || row.paths.has(path));
const enabledFor = (row, path) => row.preview || publishedFor(row, path);

/** Extra discovery locales for an English canonical path, beyond the base route policy. */
export function publishedLocalesForPath(canonicalPath, state = currentState()) {
  const family = familyForPath(canonicalPath);
  if (!family) return [];
  return state.rows.filter((row) => row.family === family && publishedFor(row, canonicalPath)).map((row) => row.locale);
}

/** Extra renderable locales for an English canonical path (published or previewed). */
export function enabledLocalesForPath(canonicalPath, state = currentState()) {
  const family = familyForPath(canonicalPath);
  if (!family) return [];
  return state.rows.filter((row) => row.family === family && enabledFor(row, canonicalPath)).map((row) => row.locale);
}

/** Whether this locale's copy of an English path is built. */
export function isPathEnabled(locale, canonicalPath, state = currentState()) {
  return enabledLocalesForPath(canonicalPath, state).includes(locale);
}

/** True when this localized copy is built only for review: it must be noindex. */
export function isHeldPreview(locale, canonicalPath, state = currentState()) {
  return isPathEnabled(locale, canonicalPath, state) && !publishedLocalesForPath(canonicalPath, state).includes(locale);
}

export const LOCALE_EXPANSION_UPDATED = /* @__PURE__ */ readUpdated();

function readUpdated() {
  return publication.updated;
}

// ── Routes ──
// The pages live outside src/pages (the Phase 1 freeze covers the locale
// trees) and are injected only while at least one locale has the family
// built; each entrypoint's getStaticPaths lists exactly the enabled locales.
const ENTRY = './src/locale-pages';
export const EXPANSION_ROUTES = [
  { families: ['horoscope-daily'], pattern: '/horoscopes/', file: 'horoscope-hub' },
  { families: ['horoscope-daily'], pattern: '/horoscopes/[sign]/', file: 'horoscope-daily' },
  { families: /* @__PURE__ */ HOROSCOPE_PERIODS.map((period) => `horoscope-${period}`), pattern: '/horoscopes/[sign]/[period]/', file: 'horoscope-period' },
  { families: ['today'], pattern: '/today/', file: 'today' },
  { families: ['full-moon'], pattern: '/full-moon/[date]/', file: 'full-moon' },
  { families: ['new-moon'], pattern: '/new-moon/[date]/', file: 'new-moon' },
  { families: ['zodiac-dates'], pattern: '/learn/zodiac-dates/', file: 'zodiac-dates' },
  { families: ['rising-profile'], pattern: '/rising-sign/[sign]/', file: 'rising-profile' },
  { families: ['compatibility-pair'], pattern: '/compatibility/[pair]/', file: 'compatibility-pair' },
];

export function localeExpansionRoutes(state = currentState()) {
  return {
    name: 'locale-expansion-publication',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        // A static locale prefix per route, so it outranks /{locale}/[...slug].
        for (const route of EXPANSION_ROUTES) {
          const locales = [...new Set(route.families.flatMap((family) => enabledExpansionLocales(family, state)))]
            // A route with no parameters is one page: inject it only when that page itself is built.
            .filter((locale) => route.pattern.includes('[') || isPathEnabled(locale, route.pattern, state));
          for (const locale of locales) {
            injectRoute({ pattern: `/${locale}${route.pattern}`, entrypoint: `${ENTRY}/${locale}/${route.file}.astro` });
          }
        }
      },
    },
  };
}
