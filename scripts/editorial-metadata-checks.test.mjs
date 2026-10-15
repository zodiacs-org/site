import { describe, expect, it } from 'vitest';
import { EDITORIAL_METADATA, editorialDates, editorialMetadata } from '../src/lib/editorial-metadata.mjs';
import { editorialGraphErrors, editorialSitemapErrors } from './editorial-metadata-checks.mjs';

describe('editorial metadata ownership', () => {
  it('bounds the repair to five English collections and 65 five-locale articles', () => {
    const entries = Object.entries(EDITORIAL_METADATA);
    expect(entries).toHaveLength(70);
    expect(entries.filter(([, x]) => x.type === 'CollectionPage').map(([path]) => path).sort()).toEqual([
      '/learn/', '/learn/aspects/', '/learn/houses/', '/learn/placements/', '/learn/planets/',
    ]);
    for (const locale of ['', '/es', '/pt', '/fr', '/it']) {
      const articles = entries.filter(([path, x]) => path.startsWith(`${locale}/learn/chinese-zodiac/`) && x.type === 'Article');
      expect(articles).toHaveLength(13);
      expect(new Set(articles.map(([, x]) => x.modified))).toEqual(new Set(['2026-07-15']));
    }
    expect(() => editorialMetadata('/ru/learn/chinese-zodiac/')).toThrow(/Missing/);
  });

  it('preserves old dates and advances only the documented Learn content revision', () => {
    expect(editorialMetadata('/learn/').modified).toBe('2026-09-05');
    expect(editorialMetadata('/learn/houses/').modified).toBe('2026-08-23');
    for (const slug of ['planets', 'aspects', 'placements']) {
      expect(editorialMetadata(`/learn/${slug}/`).modified).toBe('2026-07-10');
    }
    for (const [path, owner] of Object.entries(EDITORIAL_METADATA)) {
      expect(new Date(`${owner.modified}T00:00:00Z`).toISOString().slice(0, 10)).toBe(owner.modified);
      expect(editorialDates(path)).toEqual({ dateModified: `${owner.modified}T00:00:00.000Z` });
    }
  });

  it('rejects duplicate Article graphs on collection hubs and missing owners', () => {
    const collection = { '@type': 'CollectionPage', ...editorialDates('/learn/') };
    expect(editorialGraphErrors('/learn/', [collection])).toEqual([]);
    expect(editorialGraphErrors('/learn/', [collection, { '@type': 'Article' }])).toContain('collection hub must not also emit Article');
    expect(editorialGraphErrors('/learn/', [])).not.toEqual([]);
    expect(editorialGraphErrors('/learn/', [collection, collection])).not.toEqual([]);
  });

  it('rejects invented publication dates and build-time modification drift', () => {
    const path = '/fr/learn/chinese-zodiac/rat/';
    const article = { '@type': 'Article', ...editorialDates(path) };
    expect(editorialGraphErrors(path, [article])).toEqual([]);
    for (const datePublished of [null, '2026-07-15T00:00:00.000Z']) {
      expect(editorialGraphErrors(path, [{ ...article, datePublished }])).not.toEqual([]);
    }
    expect(editorialGraphErrors(path, [{ ...article, dateModified: '2026-09-06T00:00:00.000Z' }])).not.toEqual([]);
  });

  it('requires a listed owner\'s sitemap date and rejects missing, duplicate or stale entries', () => {
    const listed = new Set(Object.keys(EDITORIAL_METADATA));
    const xml = Object.entries(EDITORIAL_METADATA).map(([path, x]) => `<url><loc>https://zodiacs.org${path}</loc><lastmod>${x.modified}</lastmod></url>`).join('');
    expect(editorialSitemapErrors(xml, listed)).toEqual([]);
    expect(editorialSitemapErrors(xml.replace('<lastmod>2026-09-05</lastmod>', '<lastmod>2026-08-23</lastmod>'), listed)).not.toEqual([]);
    expect(editorialSitemapErrors(xml.replace(/<url>.*?<\/url>/u, ''), listed)).not.toEqual([]);
    expect(editorialSitemapErrors(xml + xml, listed)).toHaveLength(70);
  });

  it('keeps owners off the sitemap keep list out of the sitemap', () => {
    const xml = Object.entries(EDITORIAL_METADATA).map(([path, x]) => `<url><loc>https://zodiacs.org${path}</loc><lastmod>${x.modified}</lastmod></url>`).join('');
    expect(editorialSitemapErrors('<urlset></urlset>')).toEqual([]);
    expect(editorialSitemapErrors(xml)).toHaveLength(70);
  });
});
