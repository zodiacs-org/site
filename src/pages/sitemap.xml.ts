/**
 * The sitemap must cover BOTH wings — Astro routes and the legacy pages
 * served verbatim from public/ — which is why this is a custom endpoint
 * rather than @astrojs/sitemap (which only sees Astro routes and would
 * move the sitemap URL robots.txt points at).
 */
import type { APIRoute } from 'astro';
import { LIFE_PATH_NUMBERS, LIFE_PATH_PAGES } from '../data/numerology-pages';
import { getCollection } from 'astro:content';
import { LEGACY_URLS } from '../lib/legacy/urls';
import { DEFAULT_LOCALE, LOCALE_META, alternatePathEntries, alternatePaths } from '../lib/i18n';
import { CHINESE_ZODIAC_PATHS } from '../lib/programmatic-paths';
import { registryAuraSitemapEntry } from '../lib/registry-aura-entry.mjs';
import { currentHoroscopeMonth, utcMonth } from '../lib/horoscope-month.mjs';
import { INDEXABLE_PEOPLE, PEOPLE_DIRECTORY_INDEXABLE } from '../lib/people';
import {
  BIRTHDAY_CUSP_OG_MODIFIED_AT,
  PEOPLE_TEMPLATE_MODIFIED_AT,
  lastmodDate,
  latestModifiedAt,
  terminalResearchLastmod,
} from '../lib/seo-lastmod';
import { SIGNS } from '../lib/signs';
import birthdayFactsData from '../data/birthdays.json';
import daily from '../data/daily.json';
import horoscopeProgram from '../data/horoscope-program.json';
import eventsPublicationData from '../data/events-publication.json';
import registryResearchPublicationData from '../data/registry-research/publication.json';
import type { EventsPublication } from '../lib/events/publication';

import { EDITORIAL_METADATA } from '../lib/editorial-metadata.mjs';

const SITE = 'https://zodiacs.org';
const eventsPublication = eventsPublicationData as EventsPublication;
type RegistryResearchPublication = {
  generatedAt: string;
  items: Array<{ url: string; status: 'published' | 'scheduled'; visibleAt: string; publishedAt: string }>;
};
const registryResearchPublication = registryResearchPublicationData as unknown as RegistryResearchPublication;
const birthdayFacts = birthdayFactsData as unknown as { days: Record<string, { cusp?: unknown }> };
const researchLastmod = terminalResearchLastmod(registryResearchPublication);
const YEARLY_HOROSCOPE_LASTMOD = '2026-07-19';
const AUDIT_REMEDIATION_LASTMOD = '2026-08-23';
const THESIS_LASTMOD = '2026-09-05';
const LEGAL_IDENTITY_LASTMOD = '2026-08-29';
const YEAR_PAGES_LASTMOD = '2026-09-01';
// The numerology calculator; the tools hub and methodology page changed with
// it. Each Life Path page dates itself from its own `updated` field, the same
// date its Article markup carries.
const NUMEROLOGY_LASTMOD = '2026-09-07';
// The void-of-course Moon calendar shipped in the same review cycle.
const VOID_OF_COURSE_LASTMOD = '2026-09-07';
// Phase 1 of the engine brief and the claims ledger's corrections (step 1.14)
// changed the rendered copy of these routes: birthplace local mean time, the
// pinned zone history, event timing, and privacy wording held to the code.
// The events hub dates itself from its publication data and the rising-sign
// profiles from their Learn content, so neither is listed; the experimental
// preview under /developers/ is kept out of the sitemap altogether.
const ENGINE_PHASE1_LASTMOD = '2026-09-23';
const ENGINE_PHASE1_ROUTES = [
  '/', '/about/', '/ask/', '/birth-chart/', '/birth-chart/three-dimensions/', '/developers/',
  '/developers/compare/', '/developers/engine/', '/developers/examples/', '/developers/support/',
  '/full-moon-calendar/', '/mercury-retrograde/', '/methodology/', '/moon-sign/', '/privacy/', '/race/',
  '/retrogrades/', '/solar-return/', '/void-of-course-moon/', '/ru/birth-chart/', '/ru/methodology/',
  '/ru/moon-sign/', '/ru/privacy/',
] as const;
// The privacy audit of 2026-09-28 (findings F-17, F-18, F-19, F-27, F-40)
// changed what these routes say about shared chart codes, Guide's chart
// attachment, sign pictures and request logs.
const PRIVACY_AUDIT_LASTMOD = '2026-09-28';
const PRIVACY_AUDIT_ROUTES = [
  '/about/', '/ask/', '/birth-chart/someone-else/', '/methodology/', '/privacy/', '/tools/',
  '/es/methodology/', '/es/privacy/', '/pt/methodology/', '/pt/privacy/', '/fr/methodology/',
  '/fr/privacy/', '/it/methodology/', '/it/privacy/', '/ru/methodology/', '/ru/privacy/',
] as const;
// The share-image review of 2026-09-29 changed what the privacy pages say
// about images, downloaded calendar files and older links, and what the
// solar return page says about an unknown birth time.
const SHARE_IMAGE_REVIEW_LASTMOD = '2026-09-29';
const SHARE_IMAGE_REVIEW_ROUTES = [
  '/privacy/', '/es/privacy/', '/pt/privacy/', '/fr/privacy/', '/it/privacy/', '/ru/privacy/',
  '/solar-return/',
] as const;
// The ΔT attribution of 2026-09-29 (finding F-50) changed what the terms and
// methodology pages say about the ΔT values the chart code carries.
const DELTAT_ATTRIBUTION_LASTMOD = '2026-09-29';
const DELTAT_ATTRIBUTION_ROUTES = ['/methodology/', '/terms/'] as const;
// The compute API of 2026-09-29: its own page, the developer pages that
// called it planned, the birth chart FAQ that said no chart API exists, and
// the privacy page's section on it.
const COMPUTE_API_LASTMOD = '2026-09-29';
const COMPUTE_API_ROUTES = [
  '/developers/', '/developers/compute/', '/developers/support/', '/birth-chart/', '/ru/birth-chart/',
  '/privacy/',
] as const;
// Its review of 2026-09-30 changed what these say about availability, logs,
// memory and citations, and the four translated birth chart FAQs.
const COMPUTE_API_REVIEW_LASTMOD = '2026-09-30';
const COMPUTE_API_REVIEW_ROUTES = [
  '/developers/', '/developers/compute/', '/developers/support/', '/privacy/',
  '/es/birth-chart/', '/fr/birth-chart/', '/it/birth-chart/', '/pt/birth-chart/',
] as const;
// Keep these dates source-controlled: build environments may have shallow or
// absent Git history. When an evergreen page's rendered source changes, update
// its entry here in the same commit.
const OWNER_TRUST_LASTMOD = '2026-10-03';
const OWNER_TRUST_ROUTES = ['/', '/privacy/', '/terms/', '/methodology/', '/astrofolio/how-to-buy/'] as const;

const EVERGREEN_LASTMOD = new Map<string, string>([
  [eventsPublication.hub.path, eventsPublication.lastModified] as const,
  ...[
    '/', '/birth-chart/', '/compatibility/', '/moon-sign/', '/rising-sign/',
    '/moon-phase/', '/saturn-return/', '/solar-return/', '/mercury-retrograde/', '/transits/', '/ask/',
    '/eclipses/', '/full-moon-calendar/', '/retrogrades/', '/today/', '/learn/', '/tools/',
    '/profile/', '/learn/how-to-read-a-birth-chart/', '/learn/communication/', '/learn/zodiac-dates/', '/learn/glossary/', '/learn/planets/',
    '/learn/houses/', '/learn/aspects/', '/learn/placements/', '/birthday/',
    '/baby-zodiac/', '/widgets/', '/methodology/', '/about/', '/corrections/', '/privacy/',
    '/terms/', '/feeds/', '/almanac/',
    '/es/', '/es/birth-chart/', '/es/compatibility/', '/es/moon-sign/',
    '/es/rising-sign/', '/es/moon-phase/', '/es/saturn-return/', '/es/transits/',
    '/es/tools/', '/es/profile/', '/es/baby-zodiac/', '/es/methodology/', '/es/privacy/',
  ].map((loc) => [
    loc,
    [
      '/solar-return/', '/tools/', '/almanac/', '/learn/', '/learn/communication/',
      '/privacy/', '/es/privacy/',
    ].includes(loc)
      ? '2026-07-14'
      : ['/today/', '/about/', '/methodology/', '/corrections/'].includes(loc)
      ? '2026-07-19'
      : ['/', '/learn/zodiac-dates/', '/learn/glossary/'].includes(loc) ? '2026-07-11' : '2026-07-10',
  ] as const),
  // Developer pages date from the last commit that changed their content, not
  // from the review cycle that first shipped the section; these had drifted a
  // fortnight behind edits that were live.
  ['/developers/', '2026-09-28'] as const,
  ['/developers/support/', '2026-09-20'] as const,
  ['/developers/engine/', '2026-09-20'] as const,
  ['/developers/examples/', '2026-09-17'] as const,
  ['/developers/compare/', '2026-09-18'] as const,
  ['/developers/mcp/', '2026-09-18'] as const,
  ['/developers/conformance/', '2026-09-28'] as const,
  ['/lunar-return/', '2026-09-06'] as const,
  ['/tools/', '2026-09-06'] as const,
  // Astrofolio on the Fomo app: the consumer landing page for the twelve.
  ['/fomo/', '2026-09-01'] as const,
  // Phase 4 re-exposes the already-reviewed Big Three share card from the
  // birth-chart result sheet.
  ['/birth-chart/', '2026-07-24'],
  ['/privacy/', '2026-07-26'],
  ['/registry/technical/', '2026-08-02'],
  ['/terminal/research/', researchLastmod],
  ...LEGACY_URLS.map((url) => [url.path, '2026-07-10'] as const),
  ['/thesis/', THESIS_LASTMOD],
  // Astrofolio, the Terminal market desk, and the Registry's twelve plain-language token records.
  ['/astrofolio/', AUDIT_REMEDIATION_LASTMOD],
  ['/terminal/', AUDIT_REMEDIATION_LASTMOD],
  ['/registry/', AUDIT_REMEDIATION_LASTMOD],
  ...[
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ].map((sign) => [`/registry/${sign}/`, AUDIT_REMEDIATION_LASTMOD] as const),
  ...[
    '/disclosure/',
    ...CHINESE_ZODIAC_PATHS,
  ].map((loc) => [loc, '2026-07-15'] as const),
  ['/birth-chart/someone-else/', '2026-07-18'],
  ['/birth-chart/three-dimensions/', AUDIT_REMEDIATION_LASTMOD],
  ...[
    '/pt/', '/pt/birth-chart/', '/pt/compatibility/', '/pt/moon-sign/',
    '/pt/rising-sign/', '/pt/moon-phase/', '/pt/saturn-return/', '/pt/transits/',
    '/pt/tools/', '/pt/profile/', '/pt/baby-zodiac/', '/pt/methodology/', '/pt/privacy/',
    ...[
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].map((sign) => `/pt/${sign}/`),
  ].map((loc) => [loc, '2026-07-15'] as const),
  ...[
    '/fr/', '/fr/birth-chart/', '/fr/compatibility/', '/fr/moon-sign/',
    '/fr/rising-sign/', '/fr/moon-phase/', '/fr/saturn-return/', '/fr/transits/',
    '/fr/tools/', '/fr/profile/', '/fr/baby-zodiac/', '/fr/methodology/', '/fr/privacy/',
    ...[
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].map((sign) => `/fr/${sign}/`),
  ].map((loc) => [loc, '2026-07-15'] as const),
  ...[
    '/it/', '/it/birth-chart/', '/it/compatibility/', '/it/moon-sign/',
    '/it/rising-sign/', '/it/moon-phase/', '/it/saturn-return/', '/it/transits/',
    '/it/tools/', '/it/profile/', '/it/baby-zodiac/', '/it/methodology/', '/it/privacy/',
    ...[
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].map((sign) => `/it/${sign}/`),
  ].map((loc) => [loc, '2026-07-15'] as const),
  ...[
    '/ru/', '/ru/birth-chart/', '/ru/compatibility/', '/ru/moon-sign/',
    '/ru/rising-sign/', '/ru/moon-phase/', '/ru/saturn-return/', '/ru/transits/',
    '/ru/tools/', '/ru/profile/', '/ru/baby-zodiac/', '/ru/methodology/',
    '/ru/privacy/', '/ru/disclosure/',
    ...[
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ].map((sign) => `/ru/${sign}/`),
  ].map((loc) => [loc, '2026-07-22'] as const),
  // Full-audit remediation changed rendered copy, disclosures, navigation, or
  // source receipts on these evergreen routes. Keep this explicit so a build
  // does not manufacture freshness from its wall-clock time.
  ...[
    '/', '/learn/', '/learn/houses/', '/learn/zodiac-dates/', '/learn/glossary/',
    '/methodology/', '/about/', '/privacy/', '/terms/', '/es/', '/disclosure/',
    '/ru/disclosure/', '/registry/technical/', '/sdk/',
  ].map((loc) => [loc, AUDIT_REMEDIATION_LASTMOD] as const),
  ...['/', '/about/', '/privacy/', '/terms/'].map((loc) => [loc, LEGAL_IDENTITY_LASTMOD] as const),
  ...['/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/'].flatMap((path) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => [`${locale === 'en' ? '' : '/' + locale}${path}`, '2026-10-03'] as const)),
  ...['/full-moon-calendar/2027/', '/eclipses/2027/', '/mercury-retrograde/2027/']
    .map((loc) => [loc, YEAR_PAGES_LASTMOD] as const),
  ...['/numerology/', '/tools/', '/methodology/'].map((loc) => [loc, NUMEROLOGY_LASTMOD] as const),
  ...LIFE_PATH_PAGES.map((page) => [`/numerology/life-path/${page.number}/`, page.updated] as const),
  ['/void-of-course-moon/', VOID_OF_COURSE_LASTMOD] as const,
  // The ephemeris section now carries a measured comparison against Swiss
  // Ephemeris in place of the upstream library's own arcminute target. Last,
  // so it wins over the numerology cycle's date for the same page.
  ['/methodology/', '2026-09-20'] as const,
  // Last, so it wins over each route's earlier date.
  ...ENGINE_PHASE1_ROUTES.map((loc) => [loc, ENGINE_PHASE1_LASTMOD] as const),
  // After that, the privacy audit's fixes, which won over it for these.
  ...PRIVACY_AUDIT_ROUTES.map((loc) => [loc, PRIVACY_AUDIT_LASTMOD] as const),
  // Then the share-image review.
  ...SHARE_IMAGE_REVIEW_ROUTES.map((loc) => [loc, SHARE_IMAGE_REVIEW_LASTMOD] as const),
  // Then the ΔT attribution.
  ...DELTAT_ATTRIBUTION_ROUTES.map((loc) => [loc, DELTAT_ATTRIBUTION_LASTMOD] as const),
  // Then the compute API, and its review last of all.
  ...COMPUTE_API_ROUTES.map((loc) => [loc, COMPUTE_API_LASTMOD] as const),
  ...COMPUTE_API_REVIEW_ROUTES.map((loc) => [loc, COMPUTE_API_REVIEW_LASTMOD] as const),
  ...OWNER_TRUST_ROUTES.map((loc) => [loc, OWNER_TRUST_LASTMOD] as const),
]);

function getLastmod(loc: string): string {
  const date = EDITORIAL_METADATA[loc]?.modified ?? EVERGREEN_LASTMOD.get(loc);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Missing evergreen lastmod for ${loc}`);
  }
  return date;
}

function sitemapAlternates(loc: string) {
  return alternatePaths(loc);
}

export const GET: APIRoute = async () => {
  const guides = await getCollection('guides', ({ data }) => !data.draft);
  const pairs = await getCollection('pairs', ({ data }) => !data.draft);
  const learn = await getCollection('learn', ({ data }) => !data.draft);
  const horoscopes = await getCollection('horoscopes', ({ data }) => !data.draft);
  const birthdays = await getCollection('birthdays', ({ data }) => !data.draft);
  const almanac = await getCollection('almanac', ({ data }) => !data.draft);
  const latestMonth = currentHoroscopeMonth(horoscopes.map((h) => h.data.month), utcMonth(daily.date));
  const latestMonthlyBySign = new Map(
    horoscopes
      .filter((entry) => entry.data.month === latestMonth)
      .map((entry) => [entry.data.sign, entry] as const),
  );
  const registryAuraEntry = registryAuraSitemapEntry({
    PUBLIC_REGISTRY_COLLECTION_ENABLED:
      import.meta.env.PUBLIC_REGISTRY_COLLECTION_ENABLED ?? process.env.PUBLIC_REGISTRY_COLLECTION_ENABLED,
    PUBLIC_REGISTRY_AURA_ENABLED:
      import.meta.env.PUBLIC_REGISTRY_AURA_ENABLED ?? process.env.PUBLIC_REGISTRY_AURA_ENABLED,
  });
  // The Race exists only while the Games flag is on; its entry follows the
  // same build-time gate as the page itself (R2.1).
  const gamesEnabled = (import.meta.env.PUBLIC_ZODIAC_GAMES_ENABLED
    ?? process.env.PUBLIC_ZODIAC_GAMES_ENABLED) === '1';

  const evergreenUrls = [
    { loc: '/', priority: 1.0 },
    { loc: '/birth-chart/', priority: 0.95 },
    { loc: '/birth-chart/someone-else/', priority: 0.75 },
    { loc: '/birth-chart/three-dimensions/', priority: 0.7 },
    ...['/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/'].flatMap((path) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => ({ loc: `${locale === 'en' ? '' : '/' + locale}${path}`, priority: 0.8 }))),
    { loc: '/compatibility/', priority: 0.9 },
    { loc: '/moon-sign/', priority: 0.9 },
    { loc: '/rising-sign/', priority: 0.9 },
    { loc: '/moon-phase/', priority: 0.85 },
    { loc: '/saturn-return/', priority: 0.85 },
    { loc: '/solar-return/', priority: 0.85 },
    { loc: '/lunar-return/', priority: 0.85 },
    { loc: '/numerology/', priority: 0.85 },
    { loc: '/void-of-course-moon/', priority: 0.8 },
    ...LIFE_PATH_NUMBERS.map((number) => ({ loc: `/numerology/life-path/${number}/`, priority: 0.7 })),
    { loc: '/mercury-retrograde/', priority: 0.85 },
    { loc: '/transits/', priority: 0.85 },
    { loc: '/eclipses/', priority: 0.85 },
    { loc: '/full-moon-calendar/', priority: 0.85 },
    { loc: '/full-moon-calendar/2027/', priority: 0.7 },
    { loc: '/eclipses/2027/', priority: 0.7 },
    { loc: '/mercury-retrograde/2027/', priority: 0.7 },
    { loc: '/retrogrades/', priority: 0.8 },
    { loc: '/today/', priority: 0.8 },
    ...(eventsPublication.hub.indexEligible
      ? [{ loc: eventsPublication.hub.path, priority: 0.82 }]
      : []),
    { loc: '/learn/', priority: 0.85 },
    { loc: '/tools/', priority: 0.8 },
    { loc: '/ask/', priority: 0.8 },
    { loc: '/profile/', priority: 0.75 },
    { loc: '/registry/technical/', priority: 0.6 },
    { loc: '/terminal/research/', priority: 0.68 },
    { loc: '/learn/how-to-read-a-birth-chart/', priority: 0.8 },
    { loc: '/learn/communication/', priority: 0.8 },
    { loc: '/learn/zodiac-dates/', priority: 0.8 },
    { loc: '/learn/glossary/', priority: 0.8 },
    { loc: '/learn/planets/', priority: 0.7 },
    { loc: '/learn/houses/', priority: 0.7 },
    { loc: '/learn/aspects/', priority: 0.7 },
    { loc: '/learn/placements/', priority: 0.7 },
    { loc: '/birthday/', priority: 0.7 },
    { loc: '/baby-zodiac/', priority: 0.8 },
    { loc: '/widgets/', priority: 0.6 },
    { loc: '/developers/', priority: 0.6 },
    { loc: '/developers/support/', priority: 0.6 },
    { loc: '/developers/engine/', priority: 0.6 },
    { loc: '/developers/examples/', priority: 0.6 },
    { loc: '/developers/compare/', priority: 0.6 },
    { loc: '/developers/mcp/', priority: 0.6 },
    { loc: '/developers/conformance/', priority: 0.6 },
    { loc: '/developers/compute/', priority: 0.6 },
    { loc: '/fomo/', priority: 0.6 },
    { loc: '/disclosure/', priority: 0.5 },
    // Locale variants and hreflang blocks are added below through the same
    // alternatePaths policy used by birthday pages and the translated rails.
    ...CHINESE_ZODIAC_PATHS.map((loc, index) => ({
      loc,
      priority: index === 0 ? 0.7 : 0.6,
    })),
    { loc: '/methodology/', priority: 0.6 },
    { loc: '/about/', priority: 0.55 },
    { loc: '/corrections/', priority: 0.4 },
    { loc: '/privacy/', priority: 0.4 },
    { loc: '/es/privacy/', priority: 0.4 },
    { loc: '/terms/', priority: 0.4 },
    { loc: '/feeds/', priority: 0.55 },
    { loc: '/almanac/', priority: 0.75 },
  ].map((url) => ({
    ...url,
    lastmod: url.loc === '/today/' ? daily.date : getLastmod(url.loc),
  }));

  const urls: { loc: string; priority: number; lastmod?: string }[] = [
    ...evergreenUrls,
    ...(registryAuraEntry ? [registryAuraEntry] : []),
    ...(gamesEnabled ? [
      { loc: '/race/', priority: 0.8, lastmod: '2026-08-19' },
      { loc: '/games/history/', priority: 0.6, lastmod: '2026-08-19' },
    ] : []),
    { loc: '/horoscopes/', priority: 0.8, lastmod: horoscopeProgram.anchorDate },
    // Spanish and Portuguese daily surfaces render the same edition from the
    // same facts; they date with the edition like /today/ does.
    ...(['es', 'pt'] as const).flatMap((locale) => [
      { loc: `/${locale}/today/`, priority: 0.7, lastmod: daily.date },
      { loc: `/${locale}/horoscopes/`, priority: 0.7, lastmod: daily.date },
      ...SIGNS.map((sign) => ({ loc: `/${locale}/horoscopes/${sign.slug}/`, priority: 0.66, lastmod: daily.date })),
    ]),
    ...eventsPublication.pages.map((event) => ({
      loc: event.path,
      priority: 0.64,
      lastmod: event.lastModified,
    })),
    ...registryResearchPublication.items
      .filter((item) => item.status === 'published' && item.visibleAt <= registryResearchPublication.generatedAt)
      .map((item) => ({
        loc: item.url,
        priority: 0.56,
        lastmod: item.publishedAt.slice(0, 10),
      })),
    ...(PEOPLE_DIRECTORY_INDEXABLE ? [{
      loc: '/people/',
      priority: 0.7,
      lastmod: lastmodDate(latestModifiedAt(
        PEOPLE_TEMPLATE_MODIFIED_AT,
        ...INDEXABLE_PEOPLE.map((person) => person.reviewedAtUtc),
      )),
    }] : []),
    ...INDEXABLE_PEOPLE.map((person) => ({
      loc: `/people/${person.slug}/`,
      priority: 0.58,
      lastmod: lastmodDate(latestModifiedAt(
        PEOPLE_TEMPLATE_MODIFIED_AT,
        person.reviewedAtUtc,
      )),
    })),
    ...guides.map((g) => ({
      loc: `/${g.data.sign}/`,
      priority: 0.9,
      lastmod: g.data.updated.toISOString().slice(0, 10),
    })),
    ...SIGNS.flatMap((sign) => {
      const root = `/horoscopes/${sign.slug}/`;
      const monthly = latestMonthlyBySign.get(sign.slug);
      if (!monthly) throw new Error(`Missing latest monthly horoscope for ${sign.slug}`);
      const signProgram = horoscopeProgram.signs.find((entry) => entry.sign === sign.slug);
      if (!signProgram) throw new Error(`Missing horoscope program for ${sign.slug}`);
      const monthlyLastmod = monthly.data.updated.toISOString().slice(0, 10);
      return [
        { loc: root, priority: 0.8, lastmod: horoscopeProgram.anchorDate },
        { loc: `${root}tomorrow/`, priority: 0.72, lastmod: horoscopeProgram.anchorDate },
        { loc: `${root}weekly/`, priority: 0.74, lastmod: signProgram.readings.weekly.period.from },
        { loc: `${root}monthly/`, priority: 0.72, lastmod: monthlyLastmod },
        { loc: `${root}love/`, priority: 0.7, lastmod: horoscopeProgram.anchorDate },
        { loc: `${root}career/`, priority: 0.7, lastmod: horoscopeProgram.anchorDate },
        { loc: `${root}2027/`, priority: 0.68, lastmod: YEARLY_HOROSCOPE_LASTMOD },
      ];
    }),
    ...pairs.map((p) => ({
      loc: `/compatibility/${p.id}/`,
      priority: 0.75,
      lastmod: p.data.updated.toISOString().slice(0, 10),
    })),
    // Rising profiles live at /rising-sign/{sign}/, outside /learn/ —
    // an unfiltered loop here would emit URLs that have no files.
    ...learn.flatMap((l) =>
      l.data.kind === 'rising'
        ? [{
            loc: `/rising-sign/${l.data.sign}/`,
            priority: 0.8,
            lastmod: l.data.updated.toISOString().slice(0, 10),
          }]
        : [{
            loc: `/learn/${l.id}/`,
            priority: 0.65,
            lastmod: l.data.updated.toISOString().slice(0, 10),
          }]),
    ...birthdays.map((b) => ({
      loc: `/birthday/${b.id}/`,
      priority: 0.65,
      lastmod: lastmodDate(latestModifiedAt(
        b.data.updated,
        ...(birthdayFacts.days[b.id]?.cusp ? [BIRTHDAY_CUSP_OG_MODIFIED_AT] : []),
      )),
    })),
    ...almanac.map((entry) => ({
      loc: `/almanac/${entry.id}/`,
      priority: 0.65,
      lastmod: entry.data.updated.toISOString().slice(0, 10),
    })),
    ...LEGACY_URLS.map((u) => ({ loc: u.path, priority: u.priority, lastmod: getLastmod(u.path) })),
  ];

  const existingLocations = new Set(urls.map((url) => url.loc));
  const localizedUrls = urls.flatMap((url) => {
    if (url.loc === '/404.html') return [];
    const alternates = alternatePaths(url.loc);
    if (!alternates) return [];
    return alternatePathEntries(url.loc).flatMap(({ href: loc }) => {
      if (!loc || loc === url.loc || existingLocations.has(loc)) return [];
      existingLocations.add(loc);
      return [{
        ...url,
        loc,
        lastmod: EVERGREEN_LASTMOD.has(loc) ? getLastmod(loc) : url.lastmod,
      }];
    });
  });
  const allUrls = [
    ...urls,
    ...localizedUrls,
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls
  .map(
    (u) => {
      const alternates = sitemapAlternates(u.loc);
      const defaultAlternate = alternates?.[DEFAULT_LOCALE];
      const alternateLinks = alternates && defaultAlternate
        ? `${alternatePathEntries(u.loc).map(({ locale, href }) => (
            `    <xhtml:link rel="alternate" hreflang="${LOCALE_META[locale].hreflang}" href="${SITE}${href}" />`
          )).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${defaultAlternate}" />`
        : '';
      return `  <url>
    <loc>${SITE}${u.loc}</loc>${alternateLinks ? `\n${alternateLinks}` : ''}${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <priority>${u.priority.toFixed(2)}</priority>
  </url>`;
    }
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
