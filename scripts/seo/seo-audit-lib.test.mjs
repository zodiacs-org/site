import { describe, expect, it } from 'vitest';
import {
  canonicalProblems,
  hreflangProblems,
  langProblems,
  localeLinkProblems,
  localeOfPath,
  localeSitemapProblems,
  parsePage,
  reciprocityProblems,
  structuredDataProblems,
} from './seo-audit-lib.mjs';

const S = 'https://zodiacs.org';
const page = ({ path = '/es/aries/', lang = 'es', robots = '', canonical = `${S}${path}`, alternates = [], ld = [], body = '' } = {}) => parsePage(
  `<html lang="${lang}"><head>${robots ? `<meta name="robots" content="${robots}">` : ''}`
  + `<link rel="canonical" href="${canonical}">`
  + alternates.map(([hreflang, href]) => `<link rel="alternate" hreflang="${hreflang}" href="${S}${href}">`).join('')
  + ld.map((node) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [node] })}</script>`).join('')
  + `</head><body>${body}</body></html>`,
);
const set = [['en', '/aries/'], ['es', '/es/aries/'], ['x-default', '/aries/']];

describe('seo audit rules', () => {
  it('reads the locale of a path', () => {
    expect(localeOfPath('/')).toBe('en');
    expect(localeOfPath('/pt/horoscopes/')).toBe('pt');
    expect(localeOfPath('/zh-hant/learn/chinese-zodiac/')).toBe('zh-hant');
  });

  it('wants indexable pages self-canonical, absolute and clean', () => {
    expect(canonicalProblems('/es/aries/', page())).toEqual([]);
    expect(canonicalProblems('/es/aries/', page({ canonical: `${S}/aries/` }))).toHaveLength(1);
    expect(canonicalProblems('/es/aries/', page({ canonical: `${S}/es/aries/?x=1` })).length).toBeGreaterThan(0);
    expect(canonicalProblems('/es/aries/', page({ canonical: `${S}/aries/`, robots: 'noindex, follow' }))).toEqual([]);
  });

  it('checks html lang against the path', () => {
    expect(langProblems('/pt/aries/', page({ lang: 'pt-BR' }))).toEqual([]);
    expect(langProblems('/pt/aries/', page({ lang: 'en' }))).toHaveLength(1);
  });

  it('wants hreflang to include the page and an x-default equal to English, and none on noindex', () => {
    expect(hreflangProblems('/es/aries/', page({ alternates: set }))).toEqual([]);
    expect(hreflangProblems('/es/aries/', page({ alternates: set.slice(0, 2) }))).toContain('no x-default alternate');
    expect(hreflangProblems('/es/aries/', page({ alternates: [['en', '/aries/'], ['es', '/es/aries/'], ['x-default', '/es/aries/']] })))
      .toContain('x-default does not point at the English page');
    expect(hreflangProblems('/es/aries/', page({ alternates: set, robots: 'noindex' }))).toEqual(['noindex page declares hreflang alternates']);
  });

  it('wants every alternate to list the same set back', () => {
    const es = page({ alternates: set });
    const en = page({ path: '/aries/', lang: 'en', alternates: set });
    expect(reciprocityProblems('/es/aries/', es, (path) => (path === '/aries/' ? en : es))).toEqual([]);
    const lonely = page({ path: '/aries/', lang: 'en', alternates: [['en', '/aries/'], ['x-default', '/aries/']] });
    expect(reciprocityProblems('/es/aries/', es, (path) => (path === '/aries/' ? lonely : es))).toEqual(['alternate en /aries/ lists a different set']);
    expect(reciprocityProblems('/es/aries/', es, () => undefined)[0]).toMatch(/not built/);
  });

  it('wants each page type to carry its structured data in its own language', () => {
    const article = { '@type': 'Article', url: `${S}/es/horoscopes/leo/weekly/`, inLanguage: 'es' };
    const crumbs = { '@type': 'BreadcrumbList' };
    expect(structuredDataProblems('/es/horoscopes/leo/weekly/', page({ path: '/es/horoscopes/leo/weekly/', ld: [article, crumbs] }))).toEqual([]);
    expect(structuredDataProblems('/es/horoscopes/leo/weekly/', page({ path: '/es/horoscopes/leo/weekly/', ld: [crumbs] })))
      .toEqual(['horoscope page has no Article']);
    expect(structuredDataProblems('/es/horoscopes/leo/weekly/', page({ path: '/es/horoscopes/leo/weekly/', ld: [{ ...article, inLanguage: 'en' }, crumbs] })))
      .toEqual(['Article inLanguage en on a es page']);
    expect(structuredDataProblems('/pt/compatibility/aries-leo/', page({ path: '/pt/compatibility/aries-leo/', lang: 'pt-BR', ld: [{ '@type': 'Article', inLanguage: 'pt-BR' }, crumbs, { '@type': 'FAQPage' }] })))
      .toEqual([]);
  });

  it('flags a localized page linking English when its own twin is indexable, but not deliberate cross-language links', () => {
    const body = '<a href="/aries/">plain</a><a href="/eclipses/" hreflang="en">cued</a><a href="/es/moon-phase/">own</a>';
    const indexable = (path) => ['/es/aries/', '/es/eclipses/'].includes(path);
    expect(localeLinkProblems('/es/leo/', page({ path: '/es/leo/', body }), indexable)).toEqual(['links /aries/ while /es/aries/ exists']);
    expect(localeLinkProblems('/leo/', page({ path: '/leo/', lang: 'en', body }), indexable)).toEqual([]);
  });

  it('keeps each locale sitemap to its own locale', () => {
    expect(localeSitemapProblems('fr', [`${S}/fr/aries/`])).toEqual([]);
    expect(localeSitemapProblems('fr', [`${S}/aries/`, `${S}/it/aries/`])).toHaveLength(2);
  });
});
