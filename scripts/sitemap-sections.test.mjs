import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import eventsPublication from '../src/data/events-publication.json';
import { BIRTHDAY_PATHS, CHINESE_ZODIAC_PATHS } from '../src/lib/programmatic-paths';
import {
  SITEMAP_SECTIONS,
  SITEMAP_URL_LIMIT,
  partitionSitemap,
  sitemapSection,
  sitemapSectionPath,
} from '../src/pages/sitemaps/_sections';

const LOCALES = ['', '/es', '/pt', '/fr', '/it', '/ru'];
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// The shapes sitemap.xml lists: hubs and tools, the generated families from
// the same data the endpoint reads, the wing, and their locale copies. The
// Terminal Research notes are noindex, so the terminal section holds the archive alone.
const FIXTURE = [...new Set([
  ...LOCALES.flatMap((locale) => [
    '/', '/birth-chart/', '/birth-chart/someone-else/', '/compatibility/', '/compatibility/invite/', '/moon-sign/',
    '/rising-sign/', '/tools/', '/privacy/', '/terms/', '/methodology/', '/sky-calendar/', '/chart-of-the-day/',
    '/chart-of-the-day/2026-10-26/', '/horoscopes/', '/learn/', '/birthday/', '/numerology/', '/developers/',
    '/people/', '/events/', '/eclipses/', '/eclipses/2027/', '/full-moon-calendar/2027/', '/mercury-retrograde/2027/',
    '/void-of-course-moon/', '/learn/houses/', '/learn/aspects/sun-moon/', '/compatibility/aries-leo/',
    '/numerology/life-path/7/', '/developers/docs/', '/developers/compute/', '/people/ada-lovelace/',
    ...SIGNS.flatMap((sign) => [`/${sign}/`, `/rising-sign/${sign}/`, `/horoscopes/${sign}/`, `/horoscopes/${sign}/weekly/`, `/horoscopes/${sign}/2027/`]),
    ...BIRTHDAY_PATHS,
    ...CHINESE_ZODIAC_PATHS,
    ...eventsPublication.pages.map((page) => page.path),
  ].map((path) => `${locale}${path}`)),
  '/terminal/', '/terminal/research/', '/astrofolio/', '/registry/', '/registry/aries/', '/registry/technical/',
  '/thesis/', '/archive/', '/sdk/', '/fomo/', '/disclosure/', '/almanac/', '/almanac/2026-10/', '/404.html',
])].map((loc, index) => ({ loc, priority: index }));

function expectExactPartition(entries) {
  const sections = partitionSitemap(entries);
  const position = new Map(entries.map((entry, index) => [entry, index]));
  expect([...sections.keys()]).toEqual([...SITEMAP_SECTIONS]);
  const union = [...sections.values()].flat();
  expect(union).toHaveLength(entries.length);
  expect(new Set(union.map((entry) => entry.loc)).size).toBe(union.length);
  expect(new Set(union).size).toBe(entries.length);
  expect(union.every((entry) => position.has(entry))).toBe(true);
  for (const [section, list] of sections) {
    expect(list.length, section).toBeLessThan(SITEMAP_URL_LIMIT);
    // Within a section, entries keep sitemap.xml's order.
    const order = list.map((entry) => position.get(entry));
    expect(order, section).toEqual([...order].sort((a, b) => a - b));
  }
  return sections;
}

describe('section sitemaps', () => {
  it('partition the sitemap entries exactly: every location once, each section under the limit', () => {
    const sections = expectExactPartition(FIXTURE);
    for (const section of SITEMAP_SECTIONS) expect(sections.get(section).length, section).toBeGreaterThan(0);
  });

  it('places locations by locale first, then by section, with hubs in core', () => {
    expect(sitemapSection('/')).toBe('core');
    expect(sitemapSection('/tools/')).toBe('core');
    expect(sitemapSection('/birthday/')).toBe('core');
    expect(sitemapSection('/aries/')).toBe('core');
    expect(sitemapSection('/rising-sign/aries/')).toBe('core');
    expect(sitemapSection('/registry/aries/')).toBe('core');
    expect(sitemapSection('/birthday/october-26/')).toBe('birthdays');
    expect(sitemapSection('/compatibility/aries-leo/')).toBe('compatibility');
    expect(sitemapSection('/learn/houses/')).toBe('learn');
    expect(sitemapSection('/learn/chinese-zodiac/')).toBe('chinese-zodiac');
    expect(sitemapSection('/learn/chinese-zodiac/rat/')).toBe('chinese-zodiac');
    expect(sitemapSection('/horoscopes/aries/tomorrow/')).toBe('horoscopes');
    expect(sitemapSection('/new-moon/2026-11-09/')).toBe('sky-events');
    expect(sitemapSection('/full-moon/2026-11-24/')).toBe('sky-events');
    expect(sitemapSection('/eclipses/2027/')).toBe('sky-events');
    expect(sitemapSection('/events/saturn-sextile-uranus-2026-01-20/')).toBe('sky-events');
    expect(sitemapSection('/sky-calendar/2026-10-26/')).toBe('sky-events');
    expect(sitemapSection('/mercury-retrograde/2026-10-24/')).toBe('sky-events');
    expect(sitemapSection('/full-moon-calendar/2027/')).toBe('sky-events');
    expect(sitemapSection('/mercury-retrograde/')).toBe('core');
    expect(sitemapSection('/people/ada-lovelace/')).toBe('people');
    expect(sitemapSection('/terminal/research/')).toBe('terminal');
    expect(sitemapSection('/numerology/life-path/11/')).toBe('numerology');
    expect(sitemapSection('/developers/docs/')).toBe('developers');
    expect(sitemapSection('/es/')).toBe('es');
    expect(sitemapSection('/pt/horoscopes/aries/')).toBe('pt');
    expect(sitemapSection('/fr/birthday/october-26/')).toBe('fr');
    expect(sitemapSection('/it/learn/chinese-zodiac/')).toBe('it');
    expect(sitemapSection('/ru/privacy/')).toBe('ru');
    expect(sitemapSectionPath('sky-events')).toBe('/sitemaps/sky-events.xml');
  });

  // With a build present, hold the real output to the same rule.
  it.skipIf(!existsSync('dist/sitemap.xml') || !existsSync('dist/sitemap-index.xml'))('partition the built sitemap.xml exactly', () => {
    const locs = [...readFileSync('dist/sitemap.xml', 'utf8').matchAll(/<loc>https:\/\/zodiacs\.org([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locs).size).toBe(locs.length);
    const sections = expectExactPartition(locs.map((loc) => ({ loc })));
    const built = existsSync('dist/sitemaps') ? readdirSync('dist/sitemaps').sort() : [];
    expect(built).toEqual(SITEMAP_SECTIONS.filter((section) => sections.get(section).length > 0).map((section) => `${section}.xml`).sort());
    const index = readFileSync('dist/sitemap-index.xml', 'utf8');
    expect([...index.matchAll(/<loc>https:\/\/zodiacs\.org\/sitemaps\/([^<]+)<\/loc>/g)].map((m) => m[1]).sort()).toEqual(built);
    for (const name of built) {
      const childLocs = [...readFileSync(`dist/sitemaps/${name}`, 'utf8').matchAll(/<loc>https:\/\/zodiacs\.org([^<]+)<\/loc>/g)].map((m) => m[1]);
      expect(childLocs.length, name).toBeLessThan(SITEMAP_URL_LIMIT);
      expect(childLocs, name).toEqual(sections.get(name.replace(/\.xml$/u, '')).map((entry) => entry.loc));
    }
  });
});
