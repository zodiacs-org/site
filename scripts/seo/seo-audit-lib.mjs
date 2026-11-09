// Pure checks for the technical SEO audit (scripts/seo/seo-audit.mjs), kept
// separate so each rule has a unit test. Every function takes parsed page
// facts and returns a list of problem strings; an empty list is a pass.

export const SITE = 'https://zodiacs.org';
export const LOCALE_PREFIXES = ['es', 'pt', 'fr', 'it', 'ru', 'ar', 'zh-hans', 'zh-hant'];
const HTML_LANG = { en: 'en', es: 'es', pt: 'pt-BR', fr: 'fr', it: 'it', ru: 'ru', ar: 'ar', 'zh-hans': 'zh-Hans', 'zh-hant': 'zh-Hant' };

/** The locale a path belongs to by its prefix. */
export function localeOfPath(path) {
  const first = path.split('/')[1] ?? '';
  return LOCALE_PREFIXES.includes(first) ? first : 'en';
}

export function stripLocalePath(path) {
  const locale = localeOfPath(path);
  return locale === 'en' ? path : path.slice(locale.length + 1) || '/';
}

const attr = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))?.slice(2, 4).find((value) => value !== undefined);

/** Head facts of one built page. */
export function parsePage(html) {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
  const metaRobots = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).find((tag) => attr(tag, 'name')?.toLowerCase() === 'robots');
  const canonical = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((tag) => attr(tag, 'rel')?.toLowerCase() === 'canonical');
  const alternates = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
    .filter((tag) => attr(tag, 'rel')?.toLowerCase() === 'alternate' && attr(tag, 'hreflang'))
    .map((tag) => ({ hreflang: attr(tag, 'hreflang'), href: attr(tag, 'href') }));
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try {
      const value = JSON.parse(m[1]);
      const graph = Array.isArray(value) ? value : value['@graph'] ?? [value];
      return graph;
    } catch {
      return [{ '@type': '__invalid__' }];
    }
  });
  const htmlLang = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1];
  const anchors = [...html.matchAll(/<a\s([^>]*)>/gi)].map((m) => ({ href: attr(m[1], 'href'), hreflang: attr(m[1], 'hreflang') }));
  return {
    noindex: /noindex/i.test(attr(metaRobots ?? '', 'content') ?? ''),
    canonical: canonical ? attr(canonical, 'href') : undefined,
    alternates,
    jsonLd,
    htmlLang,
    anchors,
  };
}

/** Indexable pages are self-canonical, absolute, without query or fragment, with a trailing slash. */
export function canonicalProblems(path, page) {
  if (page.noindex) return [];
  const problems = [];
  if (!page.canonical) return ['no canonical'];
  if (!page.canonical.startsWith(`${SITE}/`)) problems.push(`canonical is not absolute on ${SITE}: ${page.canonical}`);
  if (/[?#]/.test(page.canonical)) problems.push(`canonical carries a query or fragment: ${page.canonical}`);
  if (page.canonical !== `${SITE}${path}`) problems.push(`canonical ${page.canonical} is not the page itself`);
  if (!path.endsWith('/')) problems.push('path has no trailing slash');
  return problems;
}

/** html lang matches the path's locale. */
export function langProblems(path, page) {
  if (page.noindex) return [];
  const expected = HTML_LANG[localeOfPath(path)];
  return page.htmlLang === expected ? [] : [`html lang is ${page.htmlLang ?? 'missing'}; expected ${expected}`];
}

/**
 * Hreflang: none on noindex pages; otherwise, when present, the set includes
 * the page itself and x-default equal to the English alternate.
 */
export function hreflangProblems(path, page) {
  if (page.noindex) return page.alternates.length ? ['noindex page declares hreflang alternates'] : [];
  if (!page.alternates.length) return [];
  const problems = [];
  const self = page.alternates.find((entry) => entry.href === `${SITE}${path}`);
  if (!self) problems.push('alternates do not include the page itself');
  const english = page.alternates.find((entry) => entry.hreflang === 'en');
  const xDefault = page.alternates.find((entry) => entry.hreflang === 'x-default');
  if (!xDefault) problems.push('no x-default alternate');
  else if (!english || xDefault.href !== english.href) problems.push('x-default does not point at the English page');
  const seen = new Set();
  for (const entry of page.alternates) {
    if (seen.has(entry.hreflang)) problems.push(`duplicate hreflang ${entry.hreflang}`);
    seen.add(entry.hreflang);
    if (!entry.href?.startsWith(`${SITE}/`)) problems.push(`alternate ${entry.hreflang} is not absolute`);
  }
  return problems;
}

/** Each alternate lists this page back with the same set (reciprocity). */
export function reciprocityProblems(path, page, pageAt) {
  if (page.noindex || !page.alternates.length) return [];
  const problems = [];
  const mine = JSON.stringify(page.alternates.map((entry) => `${entry.hreflang} ${entry.href}`).sort());
  for (const entry of page.alternates) {
    if (entry.hreflang === 'x-default') continue;
    const target = entry.href.slice(SITE.length);
    const other = pageAt(target);
    if (!other) { problems.push(`alternate ${entry.hreflang} ${target} is not built`); continue; }
    if (other.noindex) { problems.push(`alternate ${entry.hreflang} ${target} is noindex`); continue; }
    const theirs = JSON.stringify(other.alternates.map((alt) => `${alt.hreflang} ${alt.href}`).sort());
    if (theirs !== mine) problems.push(`alternate ${entry.hreflang} ${target} lists a different set`);
  }
  return problems;
}

const SIGNS = 'aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces';

/** Required structured data per page type, by the English canonical path. */
export const STRUCTURED_DATA_MATRIX = [
  { type: 'horoscope', test: new RegExp(`^/horoscopes/(?:${SIGNS})/(?:[a-z0-9]+/)?$`), required: ['Article', 'BreadcrumbList'] },
  { type: 'compatibility pair', test: new RegExp(`^/compatibility/(?:${SIGNS})-(?:${SIGNS})/$`), required: ['Article', 'BreadcrumbList', 'FAQPage'] },
  { type: 'full or new Moon', test: /^\/(?:full-moon|new-moon)\/\d{4}-\d{2}-\d{2}\/$/, required: ['Article', 'BreadcrumbList'] },
  { type: 'calculator', test: /^\/(?:birth-chart|big-three|moon-sign|rising-sign)\/$/, required: ['WebApplication'] },
  { type: 'sign guide', test: new RegExp(`^/(?:${SIGNS})/$`), required: ['BreadcrumbList'] },
  { type: 'rising profile', test: new RegExp(`^/rising-sign/(?:${SIGNS})/$`), required: ['Article', 'BreadcrumbList', 'FAQPage'] },
  { type: 'zodiac dates', test: /^\/learn\/zodiac-dates\/$/, required: ['Article', 'BreadcrumbList'] },
];

const typesOf = (node) => [node?.['@type']].flat().filter(Boolean);
const LANG_BASE = (value) => String(value ?? '').toLowerCase().split('-')[0];

/**
 * The page type's required nodes are present and valid JSON, and every
 * Article or WebApplication node says the page's language and URL.
 */
export function structuredDataProblems(path, page) {
  if (page.noindex) return [];
  const rule = STRUCTURED_DATA_MATRIX.find((entry) => entry.test.test(stripLocalePath(path)));
  const problems = [];
  if (page.jsonLd.some((node) => typesOf(node).includes('__invalid__'))) problems.push('invalid JSON-LD');
  if (!rule) return problems;
  const present = new Set(page.jsonLd.flatMap(typesOf));
  for (const type of rule.required) if (!present.has(type)) problems.push(`${rule.type} page has no ${type}`);
  const pageLang = LANG_BASE(HTML_LANG[localeOfPath(path)]);
  for (const node of page.jsonLd.filter((candidate) => typesOf(candidate).some((type) => type === 'Article' || type === 'WebApplication'))) {
    if (node.inLanguage !== undefined && LANG_BASE(node.inLanguage) !== pageLang) {
      problems.push(`${typesOf(node)[0]} inLanguage ${node.inLanguage} on a ${pageLang} page`);
    }
    if (node.url !== undefined && node.url !== `${SITE}${path}`) problems.push(`${typesOf(node)[0]} url ${node.url} is not the page`);
  }
  return problems;
}

/**
 * Locale-aware links: a localized page links to the English path only when
 * the same page in its own language is not an indexable page.
 */
export function localeLinkProblems(path, page, isIndexableAt) {
  const locale = localeOfPath(path);
  if (locale === 'en' || page.noindex) return [];
  const problems = [];
  for (const { href, hreflang } of page.anchors) {
    // A link that declares hreflang is a deliberate link to another language (the switcher, an English-only cue).
    if (hreflang) continue;
    if (!href || !href.startsWith('/') || href.startsWith('//')) continue;
    const target = href.split(/[?#]/, 1)[0];
    if (!target.endsWith('/') || localeOfPath(target) !== 'en') continue;
    const twin = `/${locale}${target}`;
    if (isIndexableAt(twin)) problems.push(`links ${target} while ${twin} exists`);
  }
  return [...new Set(problems)];
}

/** Every location in a locale's section sitemap belongs to that locale. */
export function localeSitemapProblems(locale, locations) {
  return locations
    .filter((loc) => localeOfPath(new URL(loc).pathname) !== locale)
    .map((loc) => `${locale} sitemap lists ${loc}`);
}
