/**
 * The sitemap must cover BOTH wings — Astro routes and the legacy pages
 * served verbatim from public/ — which is why this is a custom endpoint
 * rather than @astrojs/sitemap (which only sees Astro routes and would
 * move the sitemap URL robots.txt points at).
 */
import { HOROSCOPE_TEMPLATE_LASTMOD, laterDate } from '../lib/horoscope-template-revision.mjs';
import type { APIRoute } from 'astro';
import { LIFE_PATH_NUMBERS, LIFE_PATH_PAGES } from '../data/numerology-pages';
import { getCollection } from 'astro:content';
import { LEGACY_URLS } from '../lib/legacy/urls';
import { DEFAULT_LOCALE, LOCALE_META, alternatePathEntries, alternatePaths } from '../lib/i18n';
import { CHINESE_ZODIAC_PATHS } from '../lib/programmatic-paths';
import { registryAuraSitemapEntry } from '../lib/registry-aura-entry.mjs';
import { currentHoroscopeMonth, utcMonth } from '../lib/horoscope-month.mjs';
import { INDEXABLE_PEOPLE, PEOPLE_DIRECTORY_INDEXABLE, peopleForBirthday } from '../lib/people';
import {
  BIRTHDAY_CUSP_OG_MODIFIED_AT,
  BIRTHDAY_FAMOUS_LINE_MODIFIED_AT,
  PEOPLE_TEMPLATE_MODIFIED_AT,
  lastmodDate,
  latestModifiedAt,
  terminalResearchLastmod,
} from '../lib/seo-lastmod';
import { dailyEditions } from '../lib/return-visits/chart-of-day';
import { SIGNS } from '../lib/signs';
import birthdayFactsData from '../data/birthdays.json';
import daily from '../data/daily.json';
import developerGuides from '../data/developer-guides.json';
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
const YEARLY_HOROSCOPE_LASTMOD = '2026-10-16';
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
// MCP adapter 0.1.0-rc.16.2 of 2026-10-05: its page gains the three tools
// that run the compute API's calculations, and the compute API's page now
// says which UTC offsets a date without a zone is read in. rc.16.3, the same
// day, changes only the version and download the MCP page names.
const MCP_COMPUTE_TOOLS_LASTMOD = '2026-10-05';
const MCP_COMPUTE_TOOLS_ROUTES = ['/developers/mcp/', '/developers/compute/'] as const;
// The sky-fact benchmark of 2026-10-05: its own page, and the developer hub's
// card for it.
const SKY_BENCHMARK_LASTMOD = '2026-10-05';
const SKY_BENCHMARK_ROUTES = ['/developers/', '/developers/sky-benchmark/'] as const;
// The elections endpoint of 2026-10-05: its section on the compute API's page,
// the endpoints the developer hub and support page list, and what the privacy
// page says the compute API calculates.
const ELECTIONS_LASTMOD = '2026-10-05';
const ELECTIONS_ROUTES = ['/developers/', '/developers/compute/', '/developers/support/', '/privacy/'] as const;
// Engine 1.0.0-rc.2 adoption of 2026-10-07, and MCP adapter 0.1.0-rc.18: the pages that name the
// engine's version, how to install it and whether npm carries it, and the adapter's version and download.
const ENGINE_RC2_LASTMOD = '2026-10-07';
const ENGINE_RC2_ROUTES = [
  '/developers/', '/developers/ai/', '/developers/compare/', '/developers/compute/', '/developers/conformance/',
  '/developers/engine/', '/developers/mcp/', '/developers/support/',
] as const;
// The privacy page of 2026-10-09: it names the host's 30-day request-log
// retention for the hosted MCP server.
const MCP_HOST_LOGS_LASTMOD = '2026-10-09';
const MCP_HOST_LOGS_ROUTES = ['/privacy/'] as const;
// The privacy page names the ?ref= on links from the Zodiacs app, and its 0.5.0 tools' wording.
const ASSISTANT_REF_LASTMOD = '2026-10-14';
const ASSISTANT_REF_ROUTES = ['/privacy/'] as const;
// Engine 1.0.0, published on npm, adopted 2026-10-11 with MCP adapter 0.1.0-rc.19 and developer plugin 0.3.7:
// the same pages, which name the engine's version, how to install it and that npm carries it.
const ENGINE_100_LASTMOD = '2026-10-11';
const ENGINE_100_ROUTES = ENGINE_RC2_ROUTES;
// The developer guides: their index and one page per guide in the shared catalogue, and the developer hub's
// link to them.
const DEVELOPER_GUIDES_LASTMOD = '2026-10-12';
// Local times read by @zodiacs/engine/geo across the site: the compute API page's account of it, and the
// MCP page's adapter, now 0.1.0-rc.24 with resolve_birth_time and search_places.
const ENGINE_GEO_LASTMOD = '2026-10-12';
const ENGINE_GEO_ROUTES = ['/developers/compute/', '/developers/mcp/'] as const;
// The aspect facts of #740 (merged 2026-10-13): the compare page's section linking the guides that compare the
// engine with other software.
const ASPECT_FACTS_LASTMOD = '2026-10-13';
const ASPECT_FACTS_ROUTES = ['/developers/compare/'] as const;
// The birth-time tools of #742 (merged 2026-10-14): the compute API page's atlasPlace rules and the MCP page's
// search_places and resolve_birth_time.
const BIRTH_TIME_TOOLS_LASTMOD = '2026-10-14';
const BIRTH_TIME_TOOLS_ROUTES = ['/developers/compute/', '/developers/mcp/'] as const;
// Pages that changed without a new date, as the Sitemap Dates check (F-97) found them on 2026-10-15 by building
// each day's merges: the developer hub names the MCP adapter, 0.1.0-rc.23 with #740 and 0.1.0-rc.24 with #742;
// the MCP guide gained the birth-time tools with #742; the guide index listed #735's seven guides; and
// #737's pt-BR first-day ordinal ("1º de maio") changed the dates these Portuguese pages print.
const ADAPTER_RC24_LASTMOD = '2026-10-14';
const ADAPTER_RC24_ROUTES = ['/developers/', '/developers/docs/astrology-mcp-server/'] as const;
const QUERY_GUIDES_INDEX_LASTMOD = '2026-10-13';
const QUERY_GUIDES_INDEX_ROUTES = ['/developers/docs/'] as const;
const PT_FIRST_DAY_LASTMOD = '2026-10-13';
const PT_FIRST_DAY_ROUTES = ['/pt/eclipses/', '/pt/full-moon-calendar/', '/pt/mercury-retrograde/', '/pt/retrogrades/'] as const;
// The October 16 design sweep: decorative labels above headlines removed or
// turned into back-links and datelines, tool discs added to the tools hubs, and
// em and en dashes in the copy rewritten as commas, periods and range words.
const DESIGN_SWEEP_LASTMOD = '2026-10-16';
const DESIGN_SWEEP_ROUTES = [
  '/',
  '/about/',
  '/almanac/',
  '/ask/',
  '/baby-zodiac/',
  '/big-three/',
  '/birth-chart/',
  '/birth-chart/someone-else/',
  '/birth-chart/three-dimensions/',
  '/birthday/',
  '/compatibility/',
  '/corrections/',
  '/developers/',
  '/developers/compare/',
  '/eclipses/',
  '/eclipses/2027/',
  '/es/',
  '/es/baby-zodiac/',
  '/es/birth-chart/',
  '/es/chart-of-the-day/',
  '/es/compatibility/',
  '/es/eclipses/',
  '/es/full-moon-calendar/',
  '/es/mercury-retrograde/',
  '/es/methodology/',
  '/es/profile/',
  '/es/retrogrades/',
  '/es/rising-sign/',
  '/es/sky-calendar/',
  '/es/tools/',
  '/es/transits/',
  '/events/',
  '/feeds/',
  '/fr/',
  '/fr/baby-zodiac/',
  '/fr/birth-chart/',
  '/fr/chart-of-the-day/',
  '/fr/compatibility/',
  '/fr/eclipses/',
  '/fr/full-moon-calendar/',
  '/fr/mercury-retrograde/',
  '/fr/methodology/',
  '/fr/profile/',
  '/fr/retrogrades/',
  '/fr/rising-sign/',
  '/fr/sky-calendar/',
  '/fr/tools/',
  '/fr/transits/',
  '/full-moon-calendar/',
  '/full-moon-calendar/2027/',
  '/it/',
  '/it/baby-zodiac/',
  '/it/birth-chart/',
  '/it/chart-of-the-day/',
  '/it/compatibility/',
  '/it/eclipses/',
  '/it/full-moon-calendar/',
  '/it/mercury-retrograde/',
  '/it/methodology/',
  '/it/profile/',
  '/it/retrogrades/',
  '/it/rising-sign/',
  '/it/sky-calendar/',
  '/it/tools/',
  '/it/transits/',
  '/learn/communication/',
  '/learn/glossary/',
  '/learn/how-to-read-a-birth-chart/',
  '/learn/zodiac-dates/',
  '/mercury-retrograde/',
  '/mercury-retrograde/2027/',
  '/methodology/',
  '/moon-phase/',
  '/moon-sign/',
  '/occasions/',
  '/occasions/baby-shower/',
  '/occasions/milestones/',
  '/privacy/',
  '/profile/',
  '/pt/',
  '/pt/baby-zodiac/',
  '/pt/birth-chart/',
  '/pt/chart-of-the-day/',
  '/pt/compatibility/',
  '/pt/eclipses/',
  '/pt/full-moon-calendar/',
  '/pt/mercury-retrograde/',
  '/pt/methodology/',
  '/pt/profile/',
  '/pt/retrogrades/',
  '/pt/rising-sign/',
  '/pt/sky-calendar/',
  '/pt/tools/',
  '/pt/transits/',
  '/retrogrades/',
  '/rising-sign/',
  '/ru/',
  '/ru/baby-zodiac/',
  '/ru/birth-chart/',
  '/ru/chart-of-the-day/',
  '/ru/compatibility/',
  '/ru/methodology/',
  '/ru/moon-phase/',
  '/ru/moon-sign/',
  '/ru/profile/',
  '/ru/rising-sign/',
  '/ru/saturn-return/',
  '/ru/sky-calendar/',
  '/ru/tools/',
  '/ru/transits/',
  '/saturn-return/',
  '/sky-calendar/',
  '/solar-return/',
  '/tools/',
  '/transits/',
  '/void-of-course-moon/',
  '/widgets/',
  '/fr/aquarius/',
  '/fr/aries/',
  '/fr/cancer/',
  '/fr/capricorn/',
  '/fr/gemini/',
  '/fr/leo/',
  '/fr/libra/',
  '/fr/pisces/',
  '/fr/sagittarius/',
  '/fr/scorpio/',
  '/fr/taurus/',
  '/fr/virgo/',
  '/it/aquarius/',
  '/it/aries/',
  '/it/cancer/',
  '/it/capricorn/',
  '/it/gemini/',
  '/it/leo/',
  '/it/libra/',
  '/it/pisces/',
  '/it/sagittarius/',
  '/it/scorpio/',
  '/it/taurus/',
  '/it/virgo/',
  '/pt/aquarius/',
  '/pt/aries/',
  '/pt/cancer/',
  '/pt/capricorn/',
  '/pt/gemini/',
  '/pt/leo/',
  '/pt/libra/',
  '/pt/pisces/',
  '/pt/sagittarius/',
  '/pt/scorpio/',
  '/pt/taurus/',
  '/pt/virgo/',
] as const;
// The compute API playground (P3.8): the page, and the developer index and compute API page that link to it.
const PLAYGROUND_LASTMOD = '2026-10-16';
const PLAYGROUND_ROUTES = ['/developers/playground/', '/developers/', '/developers/compute/'] as const;
// The design sweep's change to /developers/ (the dash in its sky embed's title)
// arrives after the playground dated that page 2026-10-16, so it takes the next day.
const DESIGN_SWEEP_DEVELOPERS_LASTMOD = '2026-10-17';
// The top-ten redesign reaches the translated homes, birth chart and rising
// sign pages (their Today and horoscope pages date with the edition).
const TOP10_LOCALES_LASTMOD = '2026-10-17';
const TOP10_LOCALES_ROUTES = ['es', 'pt', 'fr', 'it', 'ru']
  .flatMap((locale) => ['/', '/birth-chart/', '/rising-sign/'].map((path) => `/${locale}${path}`));
// The profile redesign reaches /profile/ and its five translations.
const PROFILE_REDESIGN_LASTMOD = '2026-10-18';
const PROFILE_REDESIGN_ROUTES = ['', '/es', '/pt', '/fr', '/it', '/ru'].map((locale) => `${locale}/profile/`);
// The conventions registry (R44): its page, and the developer index and conformance page that link to it.
const CONVENTIONS_LASTMOD = '2026-10-18';
const CONVENTIONS_ROUTES = ['/developers/conventions/', '/developers/', '/developers/conformance/'] as const;
const DEVELOPER_GUIDES_ROUTES = [
  '/developers/docs/',
  ...developerGuides.map((guide) => `/developers/docs/${guide.slug}/`),
];

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
  ['/developers/', '2026-10-01'] as const,
  ['/developers/ai/', '2026-10-01'] as const,
  ['/developers/support/', '2026-09-20'] as const,
  ['/developers/engine/', '2026-09-20'] as const,
  ['/developers/examples/', '2026-09-17'] as const,
  ['/developers/compare/', '2026-09-18'] as const,
  ['/developers/mcp/', '2026-09-18'] as const,
  ['/developers/conformance/', '2026-09-28'] as const,
  ['/lunar-return/', '2026-09-06'] as const,
  // The occasion cards, first published 2026-10-11.
  ['/occasions/', '2026-10-17'] as const,
  ['/occasions/milestones/', '2026-10-11'] as const,
  ['/occasions/baby-shower/', '2026-10-11'] as const,
  ['/tools/', '2026-09-06'] as const,
  // Astrofolio on the Fomo app: the consumer landing page for the twelve.
  ['/fomo/', '2026-09-01'] as const,
  // Phase 4 re-exposes the already-reviewed Big Three share card from the
  // birth-chart result sheet.
  ['/birth-chart/', '2026-07-24'],
  ['/privacy/', '2026-10-01'],
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
  ...dailyEditions.flatMap((edition) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => [`${locale === 'en' ? '' : '/' + locale}/chart-of-the-day/${edition.day}/`, edition.ownerApproval.approvedAt.slice(0, 10)] as const)),
  ...(dailyEditions.length ? ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => [`${locale === 'en' ? '' : '/' + locale}/chart-of-the-day/`, dailyEditions.map((edition) => edition.ownerApproval.approvedAt.slice(0, 10)).sort().at(-1)!] as const) : []),
  ...['/sky-calendar/', '/astrologer-kit/', '/your-sky-wrapped/'].flatMap((path) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => [`${locale === 'en' ? '' : '/' + locale}${path}`, '2026-10-04'] as const)),
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
  ...MCP_COMPUTE_TOOLS_ROUTES.map((loc) => [loc, MCP_COMPUTE_TOOLS_LASTMOD] as const),
  ...SKY_BENCHMARK_ROUTES.map((loc) => [loc, SKY_BENCHMARK_LASTMOD] as const),
  ...ELECTIONS_ROUTES.map((loc) => [loc, ELECTIONS_LASTMOD] as const),
  ...ENGINE_RC2_ROUTES.map((loc) => [loc, ENGINE_RC2_LASTMOD] as const),
  ...MCP_HOST_LOGS_ROUTES.map((loc) => [loc, MCP_HOST_LOGS_LASTMOD] as const),
  ...ASSISTANT_REF_ROUTES.map((loc) => [loc, ASSISTANT_REF_LASTMOD] as const),
  ...ENGINE_100_ROUTES.map((loc) => [loc, ENGINE_100_LASTMOD] as const),
  ['/developers/', DEVELOPER_GUIDES_LASTMOD] as const,
  ...ENGINE_GEO_ROUTES.map((loc) => [loc, ENGINE_GEO_LASTMOD] as const),
  ...ASPECT_FACTS_ROUTES.map((loc) => [loc, ASPECT_FACTS_LASTMOD] as const),
  ...BIRTH_TIME_TOOLS_ROUTES.map((loc) => [loc, BIRTH_TIME_TOOLS_LASTMOD] as const),
  ...ADAPTER_RC24_ROUTES.map((loc) => [loc, ADAPTER_RC24_LASTMOD] as const),
  ...QUERY_GUIDES_INDEX_ROUTES.map((loc) => [loc, QUERY_GUIDES_INDEX_LASTMOD] as const),
  ...PT_FIRST_DAY_ROUTES.map((loc) => [loc, PT_FIRST_DAY_LASTMOD] as const),
  ...DESIGN_SWEEP_ROUTES.map((loc) => [loc, DESIGN_SWEEP_LASTMOD] as const),
  ...PLAYGROUND_ROUTES.map((loc) => [loc, PLAYGROUND_LASTMOD] as const),
  ['/developers/', DESIGN_SWEEP_DEVELOPERS_LASTMOD] as const,
  ...TOP10_LOCALES_ROUTES.map((loc) => [loc, TOP10_LOCALES_LASTMOD] as const),
  ...PROFILE_REDESIGN_ROUTES.map((loc) => [loc, PROFILE_REDESIGN_LASTMOD] as const),
  ...CONVENTIONS_ROUTES.map((loc) => [loc, CONVENTIONS_LASTMOD] as const),
  // Guide's provider and retention disclosures changed on these public pages.
  ...[
    '/about/', '/ask/', '/methodology/', '/privacy/',
    '/es/methodology/', '/es/privacy/', '/fr/methodology/', '/fr/privacy/',
    '/it/methodology/', '/it/privacy/', '/pt/methodology/', '/pt/privacy/',
    '/ru/methodology/', '/ru/privacy/',
  ].map((loc) => [loc, '2026-10-20'] as const),
  // Contextual discovery links added to the tools directory.
  ['/tools/', '2026-10-21'] as const,
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
    ...dailyEditions.flatMap((edition) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => ({ loc: `${locale === 'en' ? '' : '/' + locale}/chart-of-the-day/${edition.day}/`, priority: 0.6 }))),
    ...(dailyEditions.length ? ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => ({ loc: `${locale === 'en' ? '' : '/' + locale}/chart-of-the-day/`, priority: 0.7 })) : []),
    ...['/sky-calendar/', '/astrologer-kit/', '/your-sky-wrapped/'].flatMap((path) => ['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => ({ loc: `${locale === 'en' ? '' : '/' + locale}${path}`, priority: 0.8 }))),
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
    { loc: '/occasions/', priority: 0.7 },
    { loc: '/occasions/milestones/', priority: 0.6 },
    { loc: '/occasions/baby-shower/', priority: 0.6 },
    { loc: '/widgets/', priority: 0.6 },
    { loc: '/developers/', priority: 0.6 },
    { loc: '/developers/support/', priority: 0.6 },
    { loc: '/developers/engine/', priority: 0.6 },
    { loc: '/developers/examples/', priority: 0.6 },
    { loc: '/developers/compare/', priority: 0.6 },
    { loc: '/developers/mcp/', priority: 0.6 },
    { loc: '/developers/ai/', priority: 0.6 },
    { loc: '/developers/conformance/', priority: 0.6 },
    { loc: '/developers/conventions/', priority: 0.6 },
    { loc: '/developers/compute/', priority: 0.6 },
    { loc: '/developers/playground/', priority: 0.6 },
    { loc: '/developers/sky-benchmark/', priority: 0.6 },
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
    ...DEVELOPER_GUIDES_ROUTES.map((loc) => ({ loc, priority: 0.6, lastmod: EVERGREEN_LASTMOD.get(loc) ?? DEVELOPER_GUIDES_LASTMOD })),
    ...(registryAuraEntry ? [registryAuraEntry] : []),
    ...(gamesEnabled ? [
      { loc: '/race/', priority: 0.8, lastmod: DESIGN_SWEEP_LASTMOD },
      { loc: '/games/history/', priority: 0.6, lastmod: DESIGN_SWEEP_LASTMOD },
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
        { loc: `${root}weekly/`, priority: 0.74, lastmod: laterDate(signProgram.readings.weekly.period.from, HOROSCOPE_TEMPLATE_LASTMOD) },
        { loc: `${root}monthly/`, priority: 0.72, lastmod: laterDate(monthlyLastmod, HOROSCOPE_TEMPLATE_LASTMOD) },
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
        ...(peopleForBirthday(`/birthday/${b.id}/`).length > 0 ? [BIRTHDAY_FAMOUS_LINE_MODIFIED_AT] : []),
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
