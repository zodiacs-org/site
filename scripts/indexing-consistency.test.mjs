import { describe, expect, it } from 'vitest';
import { crawlDepths, sitemapCanonicalErrors } from './indexing-consistency.mjs';

describe('rendered discovery graph', () => {
  it('finds shortest click paths through relative, absolute and fragment links', () => {
    const pages = new Map([
      ['/', '<a href="/learn/">Learn</a><a href="https://zodiacs.org/tools/#all">Tools</a>'],
      ['/learn/', '<a href="chinese-zodiac/">Chinese zodiac</a>'],
      ['/tools/', '<a href="../learn/chinese-zodiac/">Chinese zodiac</a>'],
      ['/learn/chinese-zodiac/', '<a href="dragon/">Dragon</a>'],
      ['/learn/chinese-zodiac/dragon/', '<a href="../">Back</a>'],
    ]);
    expect(crawlDepths(pages).get('/learn/chinese-zodiac/dragon/')).toBe(3);
  });
  it('does not mistake sitemap, hreflang, script, external or nofollow references for discovery', () => {
    const pages = new Map([
      ['/', '<link rel="alternate" href="/isolated/"/><script>const template = `<a href="/script/">Hidden</a>`;</script><!-- <a href="/isolated/">Hidden</a> --><a href="https://example.com/external/">External</a><a href="/filtered/?x=1">Filtered</a><a rel="nofollow" href="/private/">Private</a>'],
      ...['isolated', 'script', 'external', 'filtered', 'private'].map((name) => [`/${name}/`, '']),
    ]);
    expect([...crawlDepths(pages)]).toEqual([['/', 0]]);
  });
});

describe('sitemap canonical contract', () => {
  const canonical = '<link href="https://zodiacs.org/aries/" rel="canonical">';
  it('accepts one exact self canonical', () => expect(sitemapCanonicalErrors('/aries/', canonical)).toEqual([]));
  it.each(['', canonical + canonical, canonical.replace('/aries/', '/'), canonical.replace('/aries/', '/aries'), canonical.replace('https:', 'http:')])('rejects missing, duplicate or conflicting canonicals', (html) => {
    expect(sitemapCanonicalErrors('/aries/', html)).not.toEqual([]);
  });
  it('rejects a sitemap URL intercepted by a configured redirect', () => {
    expect(sitemapCanonicalErrors('/aries/', canonical, new Set(['/aries/']))).toEqual(['/aries/: sitemap URL is a configured redirect']);
  });
});
