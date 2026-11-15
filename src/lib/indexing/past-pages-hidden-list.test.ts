import { describe, expect, it } from 'vitest';
import { eventsCatalog } from '../events/catalog';
import { pageEvent } from '../events/page-event';
import { eventsPublication } from '../events/site-publication';
import { readFileSync } from 'node:fs';
import { PAST_PAGES_HIDDEN, isPastPageHidden } from './past-pages-hidden-list';
import { pastPageDate, pastPagesHidden, pastPagesHiddenFailures } from './past-pages-hidden.mjs';
import daily from '../../data/daily.json';

const catalog = eventsCatalog();
const published = new Set(eventsPublication.pages.map((page) => page.path));
const FAMILY_ROUTES = /^\/(?:full-moon|new-moon|eclipses|events)\//u;

describe('past pages hidden from search (ZOD-221, decision J)', () => {
  it('reads the date in a moon, eclipse or event page address, and nothing else', () => {
    expect(pastPageDate('/full-moon/2026-01-03/')).toBe('2026-01-03');
    expect(pastPageDate('/new-moon/2026-01-18/')).toBe('2026-01-18');
    expect(pastPageDate('/eclipses/2026-02-17/')).toBe('2026-02-17');
    expect(pastPageDate('/events/saturn-enters-aries-2026-02-14/')).toBe('2026-02-14');
    for (const path of [
      '/', '/events/', '/full-moon/', '/full-moon/2026-01-03', 'full-moon/2026-01-03/', '/full-moon/2026-13-03/',
      '/full-moon/2026-02-30/', '/full-moon-calendar/2026/', '/mercury-retrograde/2026-06-29/', '/events/preview/sample/',
      '/es/full-moon/2026-01-03/', '/full-moon/2026-01-03/extra/', 'https://zodiacs.org/full-moon/2026-01-03/',
    ]) expect(pastPageDate(path), path).toBeUndefined();
  });

  it('reads a date from every published moon, eclipse and event page', () => {
    const pages = eventsPublication.pages.filter((page) => FAMILY_ROUTES.test(page.path));
    expect(pages.length).toBeGreaterThan(150);
    for (const page of pages) expect(pastPageDate(page.path), page.path).toBe(page.anchor.slice(0, 10));
  });

  it('accepts only published pages whose date is past', () => {
    const check = (paths: unknown) => pastPagesHiddenFailures(paths, { today: '2026-11-14', publishedPaths: published });
    expect(check([])).toEqual([]);
    expect(check(['/full-moon/2026-01-03/', '/events/saturn-enters-aries-2026-02-14/'])).toEqual([]);
    expect(check(['/full-moon/2026-11-24/'])).toEqual([
      'past-pages-hidden: /full-moon/2026-11-24/ is not past on 2026-11-14; only past pages may be hidden',
    ]);
    expect(check(['/full-moon/2026-01-04/'])).toEqual(['past-pages-hidden: /full-moon/2026-01-04/ is not a published page']);
    expect(check(['/birth-chart/'])).toEqual(['past-pages-hidden: /birth-chart/ is not a moon, eclipse or event page address']);
    expect(check(['/full-moon/2026-01-03/', '/full-moon/2026-01-03/'])).toEqual([
      'past-pages-hidden: /full-moon/2026-01-03/ is listed twice',
    ]);
    expect(check({ paths: [] })).toEqual(['past-pages-hidden: "paths" must be a list']);
    expect(pastPagesHiddenFailures([], { today: undefined, publishedPaths: published })).toHaveLength(1);
  });

  it('the committed list is valid on the daily edition’s date', () => {
    expect(pastPagesHiddenFailures([...PAST_PAGES_HIDDEN], { today: daily.date, publishedPaths: published })).toEqual([]);
  });

  it('a listed page renders noindex and keeps its reading; every other page is untouched', () => {
    const hide = pastPagesHidden(['/full-moon/2026-01-03/']);
    const listed = catalog.pages.find((event) => event.facts.path === '/full-moon/2026-01-03/')!;
    const other = catalog.pages.find((event) => event.facts.path === '/new-moon/2026-01-18/')!;
    expect(listed.indexEligible).toBe(true);
    const page = pageEvent(listed, hide);
    expect(page.indexEligible).toBe(false);
    expect(page.interpretation).toBe(listed.interpretation);
    expect(page.facts).toBe(listed.facts);
    expect(pageEvent(other, hide)).toBe(other);
    // A page that was never eligible does not become so.
    const withheld = { ...other, indexEligible: false };
    expect(pageEvent(withheld, pastPagesHidden([])).indexEligible).toBe(false);
  });

  it('the sitemap and the four routes read the list', () => {
    // The built sitemaps, the pages' robots tags and the search index are held to the list by check-dist.
    const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    expect(read('pages/sitemap.xml.ts')).toContain('.filter((url) => !isHiddenChildPage(url.loc) && !isPastPageHidden(url.loc));');
    for (const route of ['full-moon/[date].astro', 'new-moon/[date].astro', 'eclipses/[date].astro', 'events/[slug].astro']) {
      expect(read(`pages/${route}`), route).toContain('props: { event: pageEvent(event) },');
    }
    for (const path of PAST_PAGES_HIDDEN) expect(isPastPageHidden(path), path).toBe(true);
    expect(isPastPageHidden('/full-moon/2026-11-24/')).toBe(false);
  });

  it('while the list is empty, nothing changes', () => {
    if (PAST_PAGES_HIDDEN.length > 0) return;
    for (const event of catalog.pages) expect(pageEvent(event).indexEligible, event.facts.id).toBe(event.indexEligible);
  });
});
