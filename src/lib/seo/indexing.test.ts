import { describe, expect, it } from 'vitest';
import {
  NOINDEX_RULES,
  SITEMAP_MAX_URLS,
  SITEMAP_PATHS,
  isIndexable,
  noindexRuleFor,
} from './indexing.mjs';

const LOCALES = ['', '/es', '/pt', '/fr', '/it', '/ru'];

describe('sitemap keep list', () => {
  it('stays under the ceiling, with unique site-relative paths', () => {
    expect(SITEMAP_PATHS.length).toBeLessThanOrEqual(SITEMAP_MAX_URLS);
    expect(SITEMAP_PATHS).toHaveLength(176);
    expect(new Set(SITEMAP_PATHS).size).toBe(SITEMAP_PATHS.length);
    for (const path of SITEMAP_PATHS) expect(path).toMatch(/^\/(?:[a-z0-9-]+\/)*$/);
  });

  it('lists nothing the noindex rule marks noindex', () => {
    expect(SITEMAP_PATHS.filter((path) => !isIndexable(path))).toEqual([]);
  });

  it('opens with the birth chart pages, English and Spanish first', () => {
    expect(SITEMAP_PATHS.slice(0, 6)).toEqual(LOCALES.map((prefix) => `${prefix}/birth-chart/`));
  });
});

describe('noindex rule', () => {
  const noindexed = [
    '/birthday/march-3/',
    '/compatibility/aries-leo/',
    '/learn/houses/',
    '/learn/aspects/trine/',
    '/terminal/research/',
    '/people/ada-lovelace/',
    '/registry/aries/',
    '/registry/technical/',
    '/chart-of-the-day/2026-10-01/',
    '/horoscopes/aries/weekly/',
    '/horoscopes/pisces/2027/',
    '/new-moon/2026-10-21/',
    '/full-moon/2026-10-07/',
    '/eclipses/2027/',
    '/eclipses/2026-08-12/',
    '/events/mercury-retrograde-2026/',
    '/rising-sign/aries/',
    '/developers/mcp/',
    '/developers/docs/getting-started/',
  ];
  const indexable = [
    '/',
    '/birthday/',
    '/compatibility/',
    '/compatibility/invite/',
    '/learn/',
    '/terminal/',
    '/people/',
    '/registry/',
    '/chart-of-the-day/',
    '/horoscopes/',
    '/horoscopes/aries/',
    '/eclipses/',
    '/events/',
    '/rising-sign/',
    '/developers/',
    '/aries/',
  ];

  it('marks template detail pages noindex in every locale', () => {
    for (const path of noindexed) {
      for (const prefix of LOCALES) {
        expect(noindexRuleFor(`${prefix}${path}`), `${prefix}${path}`).not.toBeNull();
      }
    }
  });

  it('leaves section hubs indexable', () => {
    for (const path of indexable) {
      for (const prefix of LOCALES) expect(isIndexable(`${prefix}${path}`), `${prefix}${path}`).toBe(true);
    }
  });

  it('reads absolute URLs, queries and fragments the same as paths', () => {
    expect(isIndexable('https://zodiacs.org/compatibility/aries-leo/?ref=x#top')).toBe(false);
    expect(isIndexable('https://zodiacs.org/compatibility/?ref=x')).toBe(true);
  });

  it('labels every rule', () => {
    for (const rule of NOINDEX_RULES) expect(rule.label).toMatch(/\S/);
  });
});
