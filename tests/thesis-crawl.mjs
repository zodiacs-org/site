#!/usr/bin/env node
/**
 * Thesis crawl check: what a search engine receives for /thesis/ over plain
 * HTTP, with no browser and no script run.
 *
 *   BASE_URL=https://<host> node tests/thesis-crawl.mjs [--json <file>]
 *
 * BASE_URL defaults to http://127.0.0.1:4321 (astro preview of a local build).
 * VERCEL_BYPASS, when set, is sent as the x-vercel-protection-bypass header so
 * a protected preview deployment answers; its value is never printed.
 *
 * It asserts: /thesis reaches /thesis/ (permanent redirect or the same
 * document), HTTP 200, the canonical https://zodiacs.org/thesis/, no noindex in
 * meta or headers, at least 20,000 characters of article text in the raw HTML,
 * valid Article JSON-LD, share tags with a reachable image, robots.txt allowing
 * the page, /sitemaps/core.xml listing it once, and a link to it from the
 * homepage, while the birth chart calculator carries none.
 *
 * Exit code 0 when every check passes, 1 otherwise.
 */
import { writeFile } from 'node:fs/promises';
import {
  CORE_SITEMAP_PATH,
  MIN_ARTICLE_CHARACTERS,
  SITEMAP_INDEX_PATH,
  SITE_ORIGIN,
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
  thesisAnchors,
  thesisArticle,
  visibleText,
} from './thesis-crawl-lib.mjs';

const base = (process.env.BASE_URL || 'http://127.0.0.1:4321').replace(/\/+$/u, '');
const bypass = process.env.VERCEL_BYPASS || '';
const jsonIndex = process.argv.indexOf('--json');
const jsonPath = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : null;
const isProduction = new URL(base).origin === SITE_ORIGIN;

const requestHeaders = {
  'user-agent': 'zodiacs-thesis-crawl-check/1 (plain HTTP, no script)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** One GET, never following redirects, retried twice on a network error. */
async function get(path) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: requestHeaders,
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      });
      const body = Buffer.from(await response.arrayBuffer());
      return { path, status: response.status, headers: response.headers, body, text: () => body.toString('utf8') };
    } catch (error) {
      lastError = error;
      await delay(1_500 * (attempt + 1));
    }
  }
  throw new Error(`GET ${path}: ${lastError?.cause?.code ?? lastError?.message ?? lastError}`);
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
}
function note(text) {
  console.log(`NOTE  ${text}`);
}

/** A sitemap or share-image address on the production origin, fetched from the host under test. */
const pathOnBase = (url) => {
  const parsed = new URL(url, SITE_ORIGIN);
  return `${parsed.pathname}${parsed.search}`;
};

async function main() {
  console.log(`thesis crawl check against ${base}${bypass ? ' (protection bypass header sent)' : ''}`);

  // 1. The address people type, without the slash.
  const bare = await get(THESIS_PATH.replace(/\/$/u, ''));
  if (bare.status === 301 || bare.status === 308) {
    const target = new URL(bare.headers.get('location') ?? '', `${base}/`).pathname;
    check('/thesis redirects permanently to /thesis/', target === THESIS_PATH, `${bare.status} to ${target}`);
  } else {
    const sameDocument = bare.status === 200 && canonicalHrefs(bare.text()).join() === THESIS_CANONICAL;
    check('/thesis redirects permanently to /thesis/', sameDocument,
      sameDocument ? `${bare.status}, same document with the /thesis/ canonical (this host does not redirect)` : `status ${bare.status}`);
  }

  // 2. The page itself.
  const page = await get(THESIS_PATH);
  const html = page.text();
  check('/thesis/ answers 200 with HTML', page.status === 200 && /^text\/html\b/iu.test(page.headers.get('content-type') ?? ''),
    `${page.status} ${page.headers.get('content-type') ?? 'no content type'}, ${page.body.length} bytes`);

  const canonicals = canonicalHrefs(html);
  check('one canonical, and it is https://zodiacs.org/thesis/', canonicals.length === 1 && canonicals[0] === THESIS_CANONICAL,
    canonicals.join(', ') || 'none');

  const metaDirectives = robotsMetaDirectives(html);
  check('no noindex in meta', !blocksIndexing(metaDirectives), metaDirectives.join(', ') || 'no robots meta');

  // Vercel adds "X-Robots-Tag: noindex" to every preview deployment, which is
  // not the site's doing. It is accepted only away from production, and only
  // when the homepage carries the same header, so a rule aimed at the thesis
  // still fails here.
  const home = await get('/');
  const homeHtml = home.text();
  const robotsHeader = page.headers.get('x-robots-tag');
  const homeRobotsHeader = home.headers.get('x-robots-tag');
  const headerBlocks = blocksIndexing(robotsHeader);
  const previewWide = headerBlocks && !isProduction && robotsHeader === homeRobotsHeader;
  check('no noindex in headers', !headerBlocks || previewWide,
    !headerBlocks ? (robotsHeader ? `X-Robots-Tag: ${robotsHeader}` : 'no X-Robots-Tag')
      : previewWide ? `X-Robots-Tag: ${robotsHeader} on every page of this preview host, the homepage included; production must be checked on ${SITE_ORIGIN}`
        : `X-Robots-Tag: ${robotsHeader}`);

  if (previewWide) note(`the X-Robots-Tag check passed by the preview exemption: this run proves nothing about headers. Only a run on ${SITE_ORIGIN} does.`);

  const titles = headTitles(html);
  check('one document title', titles.length === 1 && titles[0].length > 0, titles.join(' | ') || 'none');

  // 3. The text, as raw HTML carries it.
  const article = articleHtml(html);
  const articleText = visibleText(article);
  const pageText = visibleText(html);
  check(`at least ${MIN_ARTICLE_CHARACTERS.toLocaleString('en-US')} characters of article text in raw HTML`,
    articleText.length >= MIN_ARTICLE_CHARACTERS,
    `${articleText.length.toLocaleString('en-US')} in <article id="essay">, ${pageText.length.toLocaleString('en-US')} on the whole page`);
  const h1 = visibleText(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/iu)?.[0] ?? '');
  const headline = thesisArticle(html)?.headline ?? '';
  check('the heading on the page carries the Article headline', headline !== '' && h1.toLowerCase().includes(headline.toLowerCase()),
    `h1 "${h1}", headline "${headline}"`);

  // 4. Structured data.
  const articleIssues = articleProblems(html);
  check('valid Article JSON-LD for this page', articleIssues.length === 0, articleIssues.join('; ') || (() => {
    const node = thesisArticle(html);
    return `headline "${node.headline}", dateModified ${node.dateModified ?? 'none'}, datePublished ${node.datePublished ?? 'none'}`;
  })());
  const breadcrumbIssues = breadcrumbProblems(html);
  check('breadcrumb ends on this page', breadcrumbIssues.length === 0, breadcrumbIssues.join('; '));

  // 5. Share tags.
  const ogImage = metaContent(html, 'og:image');
  const shareIssues = [
    metaContent(html, 'og:url') === THESIS_CANONICAL ? null : `og:url is ${metaContent(html, 'og:url')}`,
    metaContent(html, 'og:type') === 'article' ? null : `og:type is ${metaContent(html, 'og:type')}`,
    metaContent(html, 'og:title') ? null : 'og:title is missing',
    metaContent(html, 'og:description') ? null : 'og:description is missing',
    metaContent(html, 'description') ? null : 'meta description is missing',
    metaContent(html, 'twitter:card') === 'summary_large_image' ? null : `twitter:card is ${metaContent(html, 'twitter:card')}`,
    ogImage && ogImage.startsWith(`${SITE_ORIGIN}/`) ? null : `og:image is ${ogImage}`,
    metaContent(html, 'twitter:image') === ogImage ? null : 'twitter:image differs from og:image',
  ].filter(Boolean);
  check('Open Graph and Twitter tags name this page', shareIssues.length === 0, shareIssues.join('; '));
  if (ogImage) {
    const image = await get(pathOnBase(ogImage));
    check('share image is reachable', image.status === 200 && /^image\//iu.test(image.headers.get('content-type') ?? ''),
      `${pathOnBase(ogImage)} ${image.status} ${image.headers.get('content-type') ?? ''}, ${image.body.length} bytes`);
  } else {
    check('share image is reachable', false, 'no og:image');
  }

  // 6. robots.txt and the sitemap.
  const robots = await get('/robots.txt');
  const robotsText = robots.text();
  const blocked = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'AnyOtherCrawler']
    .filter((agent) => !robotsAllows(robotsText, agent, THESIS_PATH));
  check('robots.txt allows /thesis/', robots.status === 200 && blocked.length === 0,
    robots.status === 200 ? (blocked.length ? `blocked for ${blocked.join(', ')}` : 'allowed for Googlebot, Bingbot, OAI-SearchBot and unnamed crawlers') : `status ${robots.status}`);
  const declared = robotsSitemaps(robotsText);
  check('robots.txt names the sitemap index', declared.includes(`${SITE_ORIGIN}${SITEMAP_INDEX_PATH}`), declared.join(', ') || 'no Sitemap line');

  const index = await get(SITEMAP_INDEX_PATH);
  const indexed = sitemapEntries(index.text(), `${SITE_ORIGIN}${CORE_SITEMAP_PATH}`);
  check('the sitemap index lists /sitemaps/core.xml', index.status === 200 && indexed.length === 1,
    index.status === 200 ? `${indexed.length} entry, lastmod ${indexed[0]?.lastmod ?? 'none'}` : `status ${index.status}`);

  const core = await get(CORE_SITEMAP_PATH);
  const listed = sitemapEntries(core.text(), THESIS_CANONICAL);
  const today = new Date().toISOString().slice(0, 10);
  const modified = thesisArticle(html)?.dateModified ?? null;
  const lastmod = listed[0]?.lastmod ?? null;
  // The comparison is by calendar day, so a dateModified with a time still compares.
  const lastmodHonest = /^\d{4}-\d{2}-\d{2}/u.test(lastmod ?? '')
    && lastmod.slice(0, 10) <= today
    && (!modified || lastmod.slice(0, 10) >= modified.slice(0, 10));
  check('/sitemaps/core.xml lists https://zodiacs.org/thesis/ once', core.status === 200 && listed.length === 1,
    core.status === 200 ? `${listed.length} entry` : `status ${core.status}`);
  check('its lastmod is a real date, not after today and not before the page\'s dateModified', listed.length === 1 && lastmodHonest,
    `lastmod ${lastmod ?? 'none'}, dateModified ${modified ?? 'none'}, today ${today} (UTC)`);

  // 7. A door from the consumer side, and none on a calculator.
  const homeLinks = thesisAnchors(homeHtml);
  const footerLinks = thesisAnchors(siteFooterHtml(homeHtml));
  check('the homepage links to /thesis/ in raw HTML', home.status === 200 && homeLinks.length > 0,
    `${homeLinks.length} link(s), ${footerLinks.length} of them in the footer`);

  for (const [name, path] of [['the birth chart calculator', '/birth-chart/'], ['the compatibility calculator', '/compatibility/'], ['the Spanish birth chart calculator', '/es/birth-chart/']]) {
    const calculator = await get(path);
    const calculatorLinks = thesisAnchors(calculator.text());
    check(`${name} carries no thesis link`, calculator.status === 200 && calculatorLinks.length === 0,
      calculator.status === 200 ? `${calculatorLinks.length} link(s)` : `status ${calculator.status}`);
  }

  if (!isProduction) note(`this host is not ${SITE_ORIGIN}: whether Google has indexed the page is answered only by Search Console.`);
}

let crashed = null;
try {
  await main();
} catch (error) {
  crashed = error instanceof Error ? error.message : String(error);
  check('the check ran to the end', false, crashed);
}

const passed = results.filter((result) => result.ok).length;
const failed = results.length - passed;
console.log(`\nthesis crawl: ${passed} passed, ${failed} failed, ${results.length} checks`);
if (jsonPath) {
  await writeFile(jsonPath, `${JSON.stringify({ base, checkedAt: new Date().toISOString(), passed, failed, results }, null, 2)}\n`);
}
process.exit(failed === 0 ? 0 : 1);
