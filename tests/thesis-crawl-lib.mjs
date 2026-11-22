/**
 * Pure readers behind the thesis crawl check (tests/thesis-crawl.mjs). They
 * take the bytes a crawler receives, with no browser and no script run, and
 * say what a search engine can read from them. tests/thesis-crawl.test.mjs
 * holds them to fixtures and to the committed sources.
 */

export const THESIS_PATH = '/thesis/';
export const SITE_ORIGIN = 'https://zodiacs.org';
export const THESIS_CANONICAL = `${SITE_ORIGIN}${THESIS_PATH}`;
/**
 * The essay with its evidence, as text. The committed page carried 30,024 on
 * 2026-11-20: 8,451 of essay and 21,572 in the closed evidence drawer. The
 * minimum is 90% of the whole, so a page that lost either part falls under it.
 */
export const MIN_ARTICLE_CHARACTERS = 27_000;
export const CORE_SITEMAP_PATH = '/sitemaps/core.xml';
export const SITEMAP_INDEX_PATH = '/sitemap-index.xml';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, body) => {
    const lower = body.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return Object.hasOwn(NAMED_ENTITIES, lower) ? NAMED_ENTITIES[lower] : whole;
  });
}

/** Text a reader sees with scripts off: no markup, styles, scripts, drawings or templates. */
export function visibleText(html) {
  const withoutHidden = String(html)
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<(script|style|svg|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ');
  return decodeEntities(withoutHidden).replace(/\s+/gu, ' ').trim();
}

/** Attributes of one opening tag, names in lower case. Handles quoted and bare values. */
export function tagAttributes(tag) {
  const attributes = {};
  // Only the closing bracket goes: a bare value such as href=/thesis/ keeps its
  // last slash, and a self-closing slash is no attribute name.
  const body = String(tag).replace(/^<\s*[a-z][a-z0-9:-]*/iu, '').replace(/>$/u, '');
  for (const match of body.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

export function findTags(html, name) {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, 'giu');
  return [...String(html).matchAll(pattern)].map((match) => ({
    index: match.index,
    tag: match[0],
    attributes: tagAttributes(match[0]),
  }));
}

/** The first element of this name that passes the test, with nested same-name elements kept whole. */
export function sliceElement(html, name, accepts = () => true) {
  const source = String(html);
  const start = findTags(source, name).find((candidate) => accepts(candidate.attributes));
  if (!start) return '';
  const boundary = new RegExp(`<(/?)${name}\\b[^>]*>`, 'giu');
  boundary.lastIndex = start.index;
  let depth = 0;
  for (let match = boundary.exec(source); match; match = boundary.exec(source)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return source.slice(start.index, match.index + match[0].length);
  }
  return '';
}

export function headOf(html) {
  return sliceElement(html, 'head');
}

/** The essay element: <article id="essay">. */
export function articleHtml(html) {
  return sliceElement(html, 'article', (attributes) => attributes.id === 'essay');
}

export function canonicalHrefs(html) {
  return findTags(headOf(html) || html, 'link')
    .filter(({ attributes }) => (attributes.rel ?? '').toLowerCase().split(/\s+/u).includes('canonical'))
    .map(({ attributes }) => attributes.href ?? '');
}

const ROBOTS_META_NAMES = /^(?:robots|googlebot|googlebot-news|bingbot|slurp|duckduckbot)$/iu;

/** Every robots directive the document states in meta tags, in lower case. */
export function robotsMetaDirectives(html) {
  return findTags(html, 'meta')
    .filter(({ attributes }) => ROBOTS_META_NAMES.test(attributes.name ?? ''))
    .flatMap(({ attributes }) => (attributes.content ?? '').toLowerCase().split(',').map((part) => part.trim()))
    .filter(Boolean);
}

/** True when a directive list (meta content or an X-Robots-Tag value) keeps a page out of the index. */
export function blocksIndexing(directives) {
  const list = Array.isArray(directives) ? directives : String(directives ?? '').split(',');
  return list.some((directive) => /(?:^|[\s:])(?:noindex|none)\s*$/iu.test(String(directive).trim()));
}

export function metaContent(html, key) {
  const wanted = key.toLowerCase();
  const found = findTags(headOf(html) || html, 'meta').find(({ attributes }) => (
    (attributes.property ?? attributes.name ?? '').toLowerCase() === wanted
  ));
  return found?.attributes.content ?? null;
}

/** Parsed JSON-LD blocks; a block that does not parse is reported, never skipped. */
export function jsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
  for (const match of String(html).matchAll(pattern)) {
    const type = tagAttributes(`<script ${match[1]}>`).type ?? '';
    if (type.toLowerCase() !== 'application/ld+json') continue;
    try {
      blocks.push({ data: JSON.parse(match[2]), error: null });
    } catch (error) {
      blocks.push({ data: null, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return blocks;
}

export function jsonLdNodes(blocks) {
  const nodes = [];
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      nodes.push(value);
      if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit);
    }
  };
  for (const block of blocks) if (block.data) visit(block.data);
  return nodes;
}

const hasType = (node, type) => [node?.['@type']].flat().includes(type);
const isIsoDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u.test(value)
  && Number.isFinite(Date.parse(value));
const isHttpsUrl = (value) => typeof value === 'string' && /^https:\/\/[^\s/]+\//u.test(value);

/**
 * What is wrong with the page's Article markup, as sentences. Empty means the
 * markup parses, names this page, and carries the fields Google reads for an
 * article: headline, image, a date, author and publisher. datePublished is
 * optional (the thesis states none, owner 2026-11-13); when present it must
 * not follow dateModified.
 */
export function articleProblems(html, { canonical = THESIS_CANONICAL, now = new Date() } = {}) {
  const problems = [];
  const blocks = jsonLdBlocks(html);
  if (blocks.length === 0) return ['no JSON-LD block'];
  for (const block of blocks) if (block.error) problems.push(`JSON-LD does not parse: ${block.error}`);
  const contexts = blocks.filter((block) => block.data).map((block) => block.data['@context']);
  if (contexts.some((context) => !/^https?:\/\/schema\.org\/?$/u.test(String(context)))) {
    problems.push('JSON-LD @context is not schema.org');
  }
  const articles = jsonLdNodes(blocks).filter((node) => hasType(node, 'Article'));
  if (articles.length !== 1) return [...problems, `expected one Article, found ${articles.length}`];
  const [article] = articles;

  if (typeof article.headline !== 'string' || article.headline.trim() === '') problems.push('Article.headline is missing');
  else if (article.headline.length > 110) problems.push('Article.headline is longer than 110 characters');

  const mainEntity = typeof article.mainEntityOfPage === 'object' ? article.mainEntityOfPage?.['@id'] : article.mainEntityOfPage;
  if (article.url !== canonical && mainEntity !== canonical) problems.push(`Article names ${article.url ?? mainEntity ?? 'no page'}, not ${canonical}`);

  const images = [article.image].flat().map((image) => (typeof image === 'object' ? image?.url : image));
  if (images.length === 0 || images.some((image) => !isHttpsUrl(image))) problems.push('Article.image is not an absolute https URL');

  const tomorrow = now.getTime() + 24 * 60 * 60 * 1000;
  for (const field of ['datePublished', 'dateModified']) {
    if (!Object.hasOwn(article, field)) continue;
    if (!isIsoDate(article[field])) problems.push(`Article.${field} is not an ISO 8601 date`);
    else if (Date.parse(article[field]) > tomorrow) problems.push(`Article.${field} is in the future`);
  }
  if (!Object.hasOwn(article, 'dateModified') && !Object.hasOwn(article, 'datePublished')) problems.push('Article carries no date');
  if (isIsoDate(article.datePublished) && isIsoDate(article.dateModified)
      && Date.parse(article.datePublished) > Date.parse(article.dateModified)) {
    problems.push('Article.dateModified predates datePublished');
  }
  for (const field of ['author', 'publisher']) {
    const parties = [article[field]].flat().filter(Boolean);
    if (parties.length === 0 || parties.some((party) => typeof party?.name !== 'string' || party.name.trim() === '')) {
      problems.push(`Article.${field} has no name`);
    }
  }
  return problems;
}

export function thesisArticle(html) {
  return jsonLdNodes(jsonLdBlocks(html)).find((node) => hasType(node, 'Article')) ?? null;
}

/** The last breadcrumb item must be this page. */
export function breadcrumbProblems(html, { canonical = THESIS_CANONICAL } = {}) {
  const lists = jsonLdNodes(jsonLdBlocks(html)).filter((node) => hasType(node, 'BreadcrumbList'));
  if (lists.length === 0) return [];
  const problems = [];
  for (const list of lists) {
    const items = Array.isArray(list.itemListElement) ? list.itemListElement : [];
    if (items.length === 0) problems.push('BreadcrumbList is empty');
    else if (items.some((item, index) => item.position !== index + 1)) problems.push('BreadcrumbList positions are not 1 to n');
    else if (items.at(-1).item !== canonical) problems.push(`BreadcrumbList ends at ${items.at(-1).item}, not ${canonical}`);
  }
  return problems;
}

function robotsPatternLength(pattern) {
  return pattern.length;
}

function robotsPatternMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&')).join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`, 'u').test(path);
}

/**
 * Whether robots.txt lets this crawler fetch the path, by the published rules:
 * the group naming the crawler wins over `*`, the longest matching rule wins,
 * and Allow wins a tie.
 */
export function robotsAllows(robotsTxt, userAgent, path) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(robotsTxt).split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      if (value !== '') current.rules.push({ allow: field === 'allow', pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const agent = userAgent.toLowerCase();
  const named = groups.filter((group) => group.agents.some((name) => name !== '*' && agent.includes(name)));
  const chosen = named.length ? named : groups.filter((group) => group.agents.includes('*'));
  let best = null;
  for (const rule of chosen.flatMap((group) => group.rules)) {
    if (!robotsPatternMatches(rule.pattern, path)) continue;
    const length = robotsPatternLength(rule.pattern);
    if (!best || length > best.length || (length === best.length && rule.allow)) best = { ...rule, length };
  }
  return best ? best.allow : true;
}

export function robotsSitemaps(robotsTxt) {
  return [...String(robotsTxt).matchAll(/^\s*sitemap\s*:\s*(\S+)\s*$/gimu)].map((match) => match[1]);
}

/** Every <url> (or <sitemap>) entry whose <loc> is exactly this address. */
export function sitemapEntries(xml, loc) {
  return [...String(xml).matchAll(/<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/giu)]
    .map((match) => ({
      loc: decodeEntities(match[2].match(/<loc>\s*([^<]*?)\s*<\/loc>/iu)?.[1] ?? ''),
      lastmod: match[2].match(/<lastmod>\s*([^<]*?)\s*<\/lastmod>/iu)?.[1] ?? null,
    }))
    .filter((entry) => entry.loc === loc);
}

/** Anchors in this HTML that lead to the thesis, by relative or absolute address. */
export function thesisAnchors(html) {
  return findTags(html, 'a').filter(({ attributes }) => {
    const href = (attributes.href ?? '').trim();
    const path = href.replace(/^https?:\/\/(?:www\.)?zodiacs\.org/iu, '').replace(/[?#].*$/u, '');
    return path === THESIS_PATH || path === THESIS_PATH.replace(/\/$/u, '');
  });
}

/** The page's site footer (the Celestial Colophon), or an empty string. */
export function siteFooterHtml(html) {
  return sliceElement(html, 'footer', (attributes) => /(?:^|\s)zfooter(?:\s|$)/u.test(attributes.class ?? ''));
}

export function headTitles(html) {
  return [...(headOf(html) || '').matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/giu)].map((match) => decodeEntities(match[1]).trim());
}
