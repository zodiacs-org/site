/**
 * Structured-data rules scripts/validate-schema.mjs applies to every indexable
 * page of the built site, kept pure so scripts/structured-data-checks.test.mjs
 * can hold each one to the defect it catches. Each function returns error
 * strings without the page label; the caller prefixes it.
 */

/** The locales that publish a daily horoscope of their own (LocalizedHoroscope.astro). */
export const DAILY_HOROSCOPE_LOCALES = Object.freeze(['es', 'pt']);
/** English horoscope surfaces that carry a dated Article. */
const ENGLISH_HOROSCOPE_SURFACES = ['tomorrow', 'weekly', 'monthly', 'love', 'career', '2027'];

/** Node types that must state their language on a page that is not in English. */
export const LANGUAGE_TAGGED_TYPES = Object.freeze(['Article', 'FAQPage', 'WebApplication']);

const hasType = (node, type) => (Array.isArray(node?.['@type']) ? node['@type'].includes(type) : node?.['@type'] === type);

/**
 * Whether a path is a sign's horoscope page that must carry one dated Article:
 * every English surface, and the daily page of each locale that publishes one.
 * @param {string} pathname
 * @param {readonly string[]} signs
 */
export function isHoroscopeContentPath(pathname, signs) {
  const sign = signs.join('|');
  return new RegExp(`^/horoscopes/(?:${sign})(?:/(?:${ENGLISH_HOROSCOPE_SURFACES.join('|')}))?/$`).test(pathname)
    || new RegExp(`^/(?:${DAILY_HOROSCOPE_LOCALES.join('|')})/horoscopes/(?:${sign})/$`).test(pathname);
}

/**
 * The locale prefix of a horoscope hub ('' for English), or null for any other path.
 * @param {string} pathname
 * @returns {string | null}
 */
export function horoscopeHubPrefix(pathname) {
  if (pathname === '/horoscopes/') return '';
  const match = pathname.match(/^\/([a-z]{2})\/horoscopes\/$/);
  return match && DAILY_HOROSCOPE_LOCALES.includes(match[1]) ? `/${match[1]}` : null;
}

/**
 * Every breadcrumb item must name a page's own canonical URL, which on this
 * site always ends in a slash: a slashless locale root (https://zodiacs.org/ru)
 * is a 308 redirect, not a page.
 * @param {unknown[]} items
 */
export function breadcrumbSlashErrors(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    const target = item?.item ?? item?.url;
    if (typeof target !== 'string') return [];
    try {
      return new URL(target).pathname.endsWith('/')
        ? []
        : [`breadcrumb ${index + 1} item must end in a slash (${target} redirects)`];
    } catch {
      return [];
    }
  });
}

/**
 * Event nodes need a name, a start date and a location (Google lists location
 * as required for an Event), and their @id must be a fragment of this page:
 * another page's URL is that page's WebPage, and one IRI must not name both.
 * @param {Record<string, unknown>[]} nodes
 * @param {string} canonicalUrl
 */
export function eventErrors(nodes, canonicalUrl) {
  return nodes.filter((node) => hasType(node, 'Event')).flatMap((event) => {
    const id = typeof event['@id'] === 'string' ? event['@id'] : '';
    const name = `Event ${id || JSON.stringify(event.name ?? '')}`;
    const errors = [];
    if (typeof event.name !== 'string' || !event.name.trim()) errors.push(`${name} is missing name`);
    if (typeof event.startDate !== 'string' || !Number.isFinite(Date.parse(event.startDate))) {
      errors.push(`${name} has an invalid startDate`);
    }
    if (
      event.endDate !== undefined
      && (typeof event.endDate !== 'string' || !Number.isFinite(Date.parse(event.endDate)))
    ) {
      errors.push(`${name} has an invalid endDate`);
    }
    const location = event.location;
    const locationNamed = hasType(location, 'Place')
      ? Boolean((typeof location.name === 'string' && location.name.trim()) || location.address)
      : hasType(location, 'VirtualLocation') && typeof location.url === 'string';
    if (!locationNamed) errors.push(`${name} needs a location (a named Place or a VirtualLocation)`);
    if (id && !(id.startsWith(`${canonicalUrl}#`) && id.length > canonicalUrl.length + 1)) {
      errors.push(`${name} @id must be a fragment of ${canonicalUrl}, not another page's URL`);
    }
    return errors;
  });
}

/**
 * Every node that states a language must agree with <html lang>, and on a page
 * that is not in English the Article, FAQPage and WebApplication nodes must
 * state it (English is the default a reader assumes).
 * @param {Record<string, unknown>[]} nodes
 * @param {string | undefined} htmlLang
 */
export function languageErrors(nodes, htmlLang) {
  if (!htmlLang) return ['page has no <html lang>'];
  return nodes.flatMap((node) => {
    const type = Array.isArray(node?.['@type']) ? node['@type'].join('/') : String(node?.['@type']);
    const value = node?.inLanguage;
    if (value === undefined) {
      return htmlLang !== 'en' && LANGUAGE_TAGGED_TYPES.some((wanted) => hasType(node, wanted))
        ? [`${type} is missing inLanguage "${htmlLang}"`]
        : [];
    }
    const values = Array.isArray(value) ? value : [value];
    return values.includes(htmlLang) ? [] : [`${type} inLanguage ${JSON.stringify(value)} does not include <html lang> "${htmlLang}"`];
  });
}

/**
 * The value of a page's <html lang>.
 * @param {string} html
 */
export function htmlLangOf(html) {
  return html.match(/<html\b[^>]*\blang=(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find((value) => value !== undefined);
}

/**
 * The content of a page's og:type meta tag.
 * @param {string} html
 */
export function ogTypeOf(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const get = (key) => tag.match(new RegExp(`\\b${key}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((value) => value !== undefined);
    if (get('property') === 'og:type') return get('content');
  }
  return undefined;
}
