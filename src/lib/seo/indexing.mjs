/**
 * The one indexing rule the sitemap, the page head and the built-output
 * checks share, so the sitemap can never list a page whose head says
 * noindex.
 *
 * Plain ESM on purpose: SEO.astro and sitemap.xml.ts import it, and so do
 * the static wing generators and scripts/check-dist.mjs, which run under
 * plain node.
 *
 * Two lists, deliberately separate:
 *   - NOINDEX_RULES: template detail pages that carry
 *     `noindex, follow` in every locale. Section hubs (/compatibility/,
 *     /learn/, /registry/, /developers/, …) are not matched.
 *   - SITEMAP_PATHS: the only URLs the sitemap lists, in sitemap order
 *     (birth chart pages first). A page outside both lists stays indexable
 *     and is found through links.
 */

const SITE_ORIGIN = 'https://zodiacs.org';

/** Every locale prefix a route can carry, released or not. */
const LOCALE = String.raw`(?:/(?:es|pt|fr|it|ru|ar))?`;
const SIGN = '(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)';

const rule = (label, source) => ({ label, pattern: new RegExp(`^${LOCALE}${source}`, 'u') });

export const NOINDEX_RULES = Object.freeze([
  rule('birthday pages', String.raw`/birthday/[^/]+/`),
  rule('compatibility pair pages', String.raw`/compatibility/[a-z]+-[a-z]+/$`),
  rule('Learn pages', String.raw`/learn/[^/]+/`),
  rule('Terminal pages', String.raw`/terminal/[^/]+/`),
  rule('People pages', String.raw`/people/[^/]+/`),
  rule('Registry pages', String.raw`/registry/[^/]+/`),
  rule('chart of the day editions', String.raw`/chart-of-the-day/[^/]+/`),
  rule('horoscope period pages', String.raw`/horoscopes/${SIGN}/[^/]+/`),
  rule('new moon pages', String.raw`/new-moon/[^/]+/`),
  rule('full moon pages', String.raw`/full-moon/[^/]+/`),
  rule('eclipse pages', String.raw`/eclipses/[^/]+/`),
  rule('event pages', String.raw`/events/[^/]+/`),
  rule('rising sign profiles', String.raw`/rising-sign/[^/]+/`),
  rule('developer subpages', String.raw`/developers/[^/]+/`),
]);

/** Site-relative path of a URL or path, without query or fragment. */
function pathOf(pathOrUrl) {
  const value = String(pathOrUrl);
  const path = value.startsWith(SITE_ORIGIN) ? value.slice(SITE_ORIGIN.length) || '/' : value;
  return path.split(/[?#]/u, 1)[0];
}

/** The NOINDEX_RULES entry a path falls under, or null. */
export function noindexRuleFor(pathOrUrl) {
  const path = pathOf(pathOrUrl);
  return NOINDEX_RULES.find(({ pattern }) => pattern.test(path)) ?? null;
}

/**
 * Set on a robots meta tag whose noindex comes only from NOINDEX_RULES. The
 * site's own search still lists such a page; a page noindexed for its own
 * reasons carries no marker and stays out of search too.
 */
export const NOINDEX_RULE_ATTRIBUTE = 'data-noindex-rule';

/** Robots meta markup for a static page under a rule. */
export function ruleRobotsMeta(rule) {
  return `<meta name="robots" ${NOINDEX_RULE_ATTRIBUTE}="${rule.label}" content="noindex,follow" />`;
}

/** False when the page must carry `noindex, follow` and stay out of the sitemap. */
export function isIndexable(pathOrUrl) {
  return noindexRuleFor(pathOrUrl) === null;
}

const SIGN_SLUGS = [
  'aquarius', 'aries', 'cancer', 'capricorn', 'gemini', 'leo',
  'libra', 'pisces', 'sagittarius', 'scorpio', 'taurus', 'virgo',
];
const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
const ALL = ['', '/es', '/pt', '/fr', '/it', '/ru'];
const ROMANCE = ['/es', '/pt', '/fr', '/it'];
const NON_EN = ['/es', '/pt', '/fr', '/it', '/ru'];
const across = (prefixes, path) => prefixes.map((prefix) => `${prefix}${path}`);

/**
 * The sitemap, in order. A route is listed only for the locales where it is
 * published: there is no Russian sign guide in the index (the twelve RU
 * guides are noindex until rewritten, Packet F) and no translated
 * numerology, void-of-course, developer or daily page beyond these.
 */
export const SITEMAP_PATHS = Object.freeze([
  ...across(ALL, '/birth-chart/'),
  '/',
  ...across(ALL, '/sky-calendar/'),
  ...across(ALL, '/big-three/'),
  ...across(ALL, '/chart-twins/'),
  '/compatibility/',
  '/moon-sign/',
  '/rising-sign/',
  '/moon-phase/',
  '/saturn-return/',
  '/numerology/',
  '/void-of-course-moon/',
  ...LIFE_PATH_NUMBERS.map((number) => `/numerology/life-path/${number}/`),
  '/mercury-retrograde/',
  '/transits/',
  '/full-moon-calendar/',
  '/today/',
  '/baby-zodiac/',
  '/developers/',
  '/methodology/',
  '/about/',
  '/privacy/',
  '/es/privacy/',
  '/horoscopes/',
  '/es/today/',
  '/es/horoscopes/',
  '/pt/today/',
  '/pt/horoscopes/',
  ...SIGN_SLUGS.map((sign) => `/${sign}/`),
  ...NON_EN.map((prefix) => `${prefix}/`),
  ...across(NON_EN, '/compatibility/'),
  ...across(NON_EN, '/moon-sign/'),
  ...across(NON_EN, '/rising-sign/'),
  ...across(NON_EN, '/moon-phase/'),
  ...across(NON_EN, '/saturn-return/'),
  ...across(ROMANCE, '/mercury-retrograde/'),
  ...across(NON_EN, '/transits/'),
  ...across(ROMANCE, '/full-moon-calendar/'),
  ...across(NON_EN, '/baby-zodiac/'),
  ...across(NON_EN, '/methodology/'),
  ...across(['/pt', '/fr', '/it', '/ru'], '/privacy/'),
  ...SIGN_SLUGS.flatMap((sign) => across(ROMANCE, `/${sign}/`)),
]);

/** A ceiling well above the list, so a regression that refills the sitemap fails loudly. */
export const SITEMAP_MAX_URLS = 400;
