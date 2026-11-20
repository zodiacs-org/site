import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  MIN_ARTICLE_CHARACTERS,
  THESIS_CANONICAL,
  THESIS_PATH,
  articleHtml,
  articleProblems,
  blocksIndexing,
  breadcrumbProblems,
  canonicalHrefs,
  headTitles,
  metaContent,
  robotsAllows,
  robotsMetaDirectives,
  robotsSitemaps,
  siteFooterHtml,
  sitemapEntries,
  sliceElement,
  tagAttributes,
  thesisAnchors,
  thesisArticle,
  visibleText,
} from './thesis-crawl-lib.mjs';

// The committed sources behind what tests/thesis-crawl.mjs fetches over HTTP.
// This file needs no server, so every pull request runs it; the HTTP check
// proves the same things on a build or a deployment.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const THESIS = await read('public/thesis/index.html');
// src/pages/robots.txt.ts serves these rules; it adds only the accuracy pages' own Disallow lines.
const ROBOTS = await read('src/robots.txt');
const VERCEL = JSON.parse(await read('vercel.json'));
const SITEMAP_SOURCE = await read('src/pages/sitemap.xml.ts');
const FOOTER_SOURCE = await read('src/components/SiteFooter.astro');
const NAV_SOURCE = await read('src/components/SiteNav.astro');
const HOME_SOURCE = await read('src/pages/index.astro');

/** A vercel.json `source` as a regular expression, enough for the rules this file holds. */
function sourcePattern(source) {
  const body = source
    .replace(/:[A-Za-z_]+\(([^)]*(?:\([^)]*\)[^)]*)*)\)/gu, '($1)')
    .replace(/:[A-Za-z_]+\*/gu, '.*')
    .replace(/:[A-Za-z_]+/gu, '[^/]+');
  return new RegExp(`^${body}$`, 'u');
}

/** False only for a rule held to another host (www, or a second domain) by a `has` condition. */
function appliesOnProductionHost(rule) {
  return (rule.has ?? []).every((condition) => (
    condition.type !== 'host' || new RegExp(condition.value, 'u').test('zodiacs.org')
  ));
}

describe('thesis crawl readers', () => {
  it('reads a robots directive wherever it is stated, and nothing else as one', () => {
    expect(blocksIndexing(['index', 'follow'])).toBe(false);
    expect(blocksIndexing(['max-image-preview:large'])).toBe(false);
    expect(blocksIndexing(null)).toBe(false);
    expect(blocksIndexing('noindex, nofollow, noarchive')).toBe(true);
    expect(blocksIndexing('googlebot: noindex')).toBe(true);
    expect(blocksIndexing('none')).toBe(true);
    expect(robotsMetaDirectives('<meta name=googlebot content="NoIndex, nofollow">')).toEqual(['noindex', 'nofollow']);
    expect(robotsMetaDirectives('<meta name="viewport" content="noindex">')).toEqual([]);
  });

  it('reads attributes in either quote style or none', () => {
    expect(tagAttributes('<link rel=canonical href=https://zodiacs.org/thesis/>')).toEqual({
      rel: 'canonical', href: 'https://zodiacs.org/thesis/',
    });
    expect(tagAttributes(`<a class='x y' href="/thesis/" data-on>`)).toEqual({ class: 'x y', href: '/thesis/', 'data-on': '' });
  });

  it('keeps nested elements whole and drops what a reader never sees', () => {
    const html = '<article id="other">no</article><article id="essay">One <article>two</article> three</article> four';
    expect(visibleText(articleHtml(html))).toBe('One two three');
    expect(sliceElement('<footer class="zfooter zfooter--static">a</footer>', 'footer')).toContain('a');
    expect(visibleText('<p>Seen &amp; read</p><script>var hidden</script><style>.x{}</style><svg><title>Aries</title></svg><!-- note -->'))
      .toBe('Seen & read');
  });

  it('follows the robots.txt rules: named group first, longest rule, Allow on a tie', () => {
    const robots = [
      'User-agent: *', 'Allow: /', 'Disallow: /terminal/research/', 'Allow: /terminal/research/$',
      '', 'User-agent: GPTBot', 'Disallow: /thesis/',
    ].join('\n');
    expect(robotsAllows(robots, 'Googlebot', '/thesis/')).toBe(true);
    expect(robotsAllows(robots, 'GPTBot', '/thesis/')).toBe(false);
    expect(robotsAllows(robots, 'Googlebot', '/terminal/research/note/')).toBe(false);
    expect(robotsAllows(robots, 'Googlebot', '/terminal/research/')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /', 'Googlebot', '/thesis/')).toBe(false);
    expect(robotsAllows('', 'Googlebot', '/thesis/')).toBe(true);
  });

  it('finds thesis links by relative or absolute address, and only those', () => {
    const html = '<a href="/thesis/">a</a><a href="https://zodiacs.org/thesis/#essay">b</a><a href="/thesis/x/">c</a><a href="/registry/">d</a>';
    expect(thesisAnchors(html)).toHaveLength(2);
  });

  it('reads sitemap entries by exact address', () => {
    const xml = '<urlset><url><loc>https://zodiacs.org/thesis/</loc><lastmod>2026-11-14</lastmod></url>'
      + '<url><loc>https://zodiacs.org/thesis/other/</loc></url></urlset>';
    expect(sitemapEntries(xml, THESIS_CANONICAL)).toEqual([{ loc: THESIS_CANONICAL, lastmod: '2026-11-14' }]);
  });

  it('fails a page that a crawler could not index or read as an article', () => {
    const noindexed = THESIS.replace('<link rel="canonical"', '<meta name="robots" content="noindex" /><link rel="canonical"');
    expect(blocksIndexing(robotsMetaDirectives(noindexed))).toBe(true);

    const elsewhere = THESIS.replace(`"url": "${THESIS_CANONICAL}"`, '"url": "https://zodiacs.org/"');
    expect(articleProblems(elsewhere).join(' ')).toContain('Article names https://zodiacs.org/');

    const undated = THESIS.replace(/"dateModified": "[^"]+",/u, '');
    expect(articleProblems(undated)).toContain('Article carries no date');

    const future = THESIS.replace(/"dateModified": "[^"]+"/u, '"dateModified": "2999-01-01"');
    expect(articleProblems(future)).toContain('Article.dateModified is in the future');

    const broken = THESIS.replace('"@context": "https://schema.org",', '"@context": "https://schema.org"');
    expect(articleProblems(broken).join(' ')).toContain('JSON-LD does not parse');

    const emptied = THESIS.replace(articleHtml(THESIS), '<article id="essay"></article>');
    expect(visibleText(articleHtml(emptied))).toBe('');

    // The essay gone and only the evidence drawer left, as when the essay is drawn by a script: under the minimum.
    const article = articleHtml(THESIS);
    // Each <details>, whole with whatever it nests; the largest is the evidence drawer.
    const drawers = (article.match(/<details\b/giu) ?? []).map((_tag, index) => {
      let seen = -1;
      return sliceElement(article, 'details', () => (seen += 1) === index);
    });
    const drawer = drawers.reduce((longest, candidate) => (candidate.length > longest.length ? candidate : longest), '');
    const drawerText = visibleText(drawer).length;
    const essayText = visibleText(article.replace(drawer, '')).length;
    expect(drawerText, 'the evidence drawer is the larger part').toBeGreaterThan(essayText);
    expect(essayText, 'the essay alone is a real part of the page').toBeGreaterThan(5_000);
    const drawerOnly = THESIS.replace(article, `<article id="essay">${drawer}</article>`);
    expect(visibleText(articleHtml(drawerOnly)).length).toBe(drawerText);
    expect(drawerText, 'the drawer alone is under the minimum').toBeLessThan(MIN_ARTICLE_CHARACTERS);
    // And the essay alone, with the drawer gone, is under it too.
    const essayOnly = THESIS.replace(article, article.replace(drawer, ''));
    expect(visibleText(articleHtml(essayOnly)).length).toBeLessThan(MIN_ARTICLE_CHARACTERS);
  });
});

describe('the thesis page as a crawler receives it (committed source)', () => {
  it('declares one canonical and no noindex', () => {
    expect(canonicalHrefs(THESIS)).toEqual([THESIS_CANONICAL]);
    expect(blocksIndexing(robotsMetaDirectives(THESIS))).toBe(false);
    expect(headTitles(THESIS)).toHaveLength(1);
    expect(THESIS).toMatch(/<html\b[^>]*\blang="en"/u);
  });

  it('carries the essay and its evidence as text in the HTML itself', () => {
    const text = visibleText(articleHtml(THESIS));
    expect(text.length).toBeGreaterThanOrEqual(MIN_ARTICLE_CHARACTERS);
    // The first words of the essay are in the markup, not written in by a script.
    expect(text).toContain('Why Zodiacs Matter');
  });

  it('publishes valid Article and breadcrumb markup for its own address', () => {
    expect(articleProblems(THESIS)).toEqual([]);
    expect(breadcrumbProblems(THESIS)).toEqual([]);
    const h1 = visibleText(THESIS.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/iu)?.[0] ?? '');
    expect(h1).toContain(thesisArticle(THESIS).headline);
  });

  it('names itself in its share tags, with an image the repository holds', async () => {
    expect(metaContent(THESIS, 'og:url')).toBe(THESIS_CANONICAL);
    expect(metaContent(THESIS, 'og:type')).toBe('article');
    expect(metaContent(THESIS, 'twitter:card')).toBe('summary_large_image');
    const image = metaContent(THESIS, 'og:image');
    expect(image).toMatch(/^https:\/\/zodiacs\.org\/assets\//u);
    expect(metaContent(THESIS, 'twitter:image')).toBe(image);
    expect(thesisArticle(THESIS).image).toBe(image);
    const bytes = await readFile(new URL(`../public${new URL(image).pathname}`, import.meta.url));
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});

describe('nothing in the repository keeps the thesis from being crawled', () => {
  it('robots.txt allows it for every crawler and names the sitemap index', () => {
    for (const agent of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'AnyOtherCrawler']) {
      expect(robotsAllows(ROBOTS, agent, THESIS_PATH), agent).toBe(true);
    }
    expect(robotsSitemaps(ROBOTS)).toEqual(['https://zodiacs.org/sitemap-index.xml']);
  });

  it('vercel.json sends no robots header for it and does not redirect it away', () => {
    const robotsRules = VERCEL.headers
      .filter((rule) => rule.headers.some((header) => header.key.toLowerCase() === 'x-robots-tag'))
      .filter(appliesOnProductionHost);
    expect(robotsRules.length).toBeGreaterThan(0);
    for (const rule of robotsRules) {
      expect(sourcePattern(rule.source).test('/thesis/'), rule.source).toBe(false);
      expect(sourcePattern(rule.source).test('/thesis'), rule.source).toBe(false);
    }
    // The reader of these rules must see the ones that do apply elsewhere.
    expect(robotsRules.some((rule) => sourcePattern(rule.source).test('/terminal/markets/x'))).toBe(true);
    const moves = [...VERCEL.redirects, ...VERCEL.rewrites];
    for (const rule of moves.filter(appliesOnProductionHost)) {
      expect(sourcePattern(rule.source).test('/thesis/'), rule.source).toBe(false);
    }
    // The rules set aside are the two host moves, and nothing else.
    expect(moves.filter((rule) => !appliesOnProductionHost(rule)).map((rule) => rule.has.find((condition) => condition.type === 'host').value)).toEqual([
      '^(?:www\\.)?astrofolio\\.xyz$',
      '^www\\.zodiacs\\.org$',
    ]);
  });

  it('the sitemap lists it, dated no earlier than the page says it changed', () => {
    expect(SITEMAP_SOURCE).toContain("['/thesis/', THESIS_LASTMOD]");
    const lastmod = SITEMAP_SOURCE.match(/const THESIS_LASTMOD = '(\d{4}-\d{2}-\d{2})';/u)?.[1];
    expect(lastmod).toBeDefined();
    expect(lastmod >= thesisArticle(THESIS).dateModified.slice(0, 10)).toBe(true);
  });
});

describe('the consumer door to the thesis', () => {
  const link = '<a href="/thesis/" hreflang={englishHreflang} title={englishOnlyAria}>{thesisLabel}{englishSuffix}</a>';
  const LABELS = { en: 'Thesis', es: 'Tesis', pt: 'Tese', fr: 'Thèse', it: 'Tesi', ru: 'Манифест' };

  it('is one plain link in the footer Registry column, which tool pages do not render', () => {
    expect(FOOTER_SOURCE.split('href="/thesis/"')).toHaveLength(2);
    const column = FOOTER_SOURCE.slice(
      FOOTER_SOURCE.indexOf('{showCollection && ('),
      FOOTER_SOURCE.indexOf('<nav class="zfooter__group zfooter__twelve"'),
    );
    expect(column).toContain(link);
    expect(FOOTER_SOURCE).toContain('const showCollection = showsCollectionNavigation(Astro.url.pathname);');
  });

  it('names the page in each language from the catalog, with no dash and none of the wing vocabulary', async () => {
    expect(FOOTER_SOURCE).toContain("const thesisLabel = sectionLocale ? 'Thesis' : t(locale, 'footerThesis');");
    for (const [locale, label] of Object.entries(LABELS)) {
      const catalog = await read(`src/lib/i18n/ui/${locale}.ts`);
      expect(catalog, locale).toMatch(new RegExp(`footerThesis: ["']${label}["'],`, 'u'));
      expect(label).not.toMatch(/[–—]/u);
      expect(label).not.toMatch(/coin|token|wallet|buy|trade|market|crypto|монет|токен|крипт/iu);
    }
  });

  it('is not repeated in the navigation or the homepage body', () => {
    expect(NAV_SOURCE).not.toContain('/thesis/');
    expect(HOME_SOURCE).not.toContain('/thesis/');
  });

  it('is found by the footer reader the HTTP check uses', () => {
    const rendered = '<main></main><footer class="zfooter"><a href="/thesis/">Thesis</a></footer>';
    expect(thesisAnchors(siteFooterHtml(rendered))).toHaveLength(1);
    expect(thesisAnchors(siteFooterHtml('<footer class="other"><a href="/thesis/">Thesis</a></footer>'))).toHaveLength(0);
  });
});
