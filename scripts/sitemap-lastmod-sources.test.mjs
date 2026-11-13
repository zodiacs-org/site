/*
 * A sitemap date says when a page's content last changed, never when the site
 * was built (Linear ZOD-221). The modules that compute the sitemaps' dates
 * read no clock, so a rebuild cannot move a date. Pages that change with each
 * daily edition take the edition's date from src/data/daily.json or the
 * horoscope program, which are data, not the clock; check-dist holds those
 * pages to the list in scripts/indexing-consistency.mjs (isDailyLastmodPath).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const DATE_SOURCES = [
  'src/pages/sitemap.xml.ts',
  'src/pages/sitemap-index.xml.ts',
  ...readdirSync(new URL('src/pages/sitemaps/', root)).map((name) => `src/pages/sitemaps/${name}`),
  'src/lib/seo-lastmod.ts',
  'src/world-times/updated.ts',
  'src/lib/horoscope-template-revision.mjs',
];

// new Date() or Date() with no argument, Date.now(), and performance.timeOrigin read the clock.
const CLOCK_READS = /\bnew\s+Date\s*\(\s*\)|(?<![.\w])Date\s*\(\s*\)|\bDate\.now\s*\(|\bperformance\.timeOrigin\b/u;

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

describe('sitemap dates', () => {
  it.each(DATE_SOURCES)('%s reads no clock', (path) => {
    const lines = code(read(path)).split('\n');
    const reads = lines.flatMap((line, index) => (CLOCK_READS.test(line) ? [`${index + 1}: ${line.trim()}`] : []));
    expect(reads).toEqual([]);
  });

  it('catches the ways a module could read the clock', () => {
    for (const line of ['const d = new Date();', 'lastmod: Date.now()', 'String(Date())', 'new Date ( )']) {
      expect(CLOCK_READS.test(line), line).toBe(true);
    }
    for (const line of ['new Date(value)', 'new Date(`${day}T00:00:00.000Z`)', 'parseDate(x)', 'updatedDate()']) {
      expect(CLOCK_READS.test(line), line).toBe(false);
    }
  });

  it('robots.txt sends crawlers to the sitemap index alone', () => {
    const sitemaps = read('public/robots.txt').split('\n').filter((line) => /^sitemap\s*:/iu.test(line));
    expect(sitemaps).toEqual(['Sitemap: https://zodiacs.org/sitemap-index.xml']);
  });
});
