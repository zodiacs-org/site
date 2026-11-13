const ORIGIN = 'https://zodiacs.org';

export function attr(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined) ?? null;
}

/** Extract only rendered, followable anchors with exact built URL spelling. */
export function renderedLinks(path, html) {
  const links = new Set();
  html = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    if ((attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('nofollow')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const url = new URL(href.replaceAll('&amp;', '&'), ORIGIN + path);
      if (url.origin === ORIGIN && !url.search) links.add(url.pathname);
    } catch { /* Invalid links are checked by the forward resolver. */ }
  }
  return links;
}

/** Breadth-first traversal retains paths and adjacency sets, never full HTML. */
export function crawlDepths(graph) {
  const depths = new Map([['/', 0]]);
  const queue = ['/'];
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    for (const target of graph.get(path) ?? []) {
      if (!graph.has(target) || depths.has(target)) continue;
      depths.set(target, depths.get(path) + 1);
      queue.push(target);
    }
  }
  return depths;
}

export function canonicalHrefs(html) {
  html = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(([tag]) => (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'))
    .map(([tag]) => attr(tag, 'href'));
}

export function canonicalHref(html) {
  return canonicalHrefs(html)[0] ?? null;
}

/** Every sitemap entry must name exactly its own canonical, including URL spelling. */
export function sitemapCanonicalErrors(path, html, redirectSources = new Set()) {
  const errors = [];
  if (redirectSources.has(path)) errors.push(`${path}: sitemap URL is a configured redirect`);
  const canonicals = canonicalHrefs(html);
  if (canonicals.length !== 1 || canonicals[0] !== ORIGIN + path) {
    errors.push(`${path}: sitemap URL must have exactly one self-referencing canonical`);
  }
  return errors;
}

/**
 * The rules robots.txt gives every crawler (the `User-agent: *` group), and
 * the sitemaps it names. Groups for named crawlers are left out: no sitemap
 * page may be blocked for crawlers in general.
 */
export function robotsRules(text) {
  const rules = { allow: [], disallow: [], sitemaps: [] };
  let agents = [];
  let inRules = false;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim();
    if (!line) continue;
    const [, field, value] = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/u) ?? [];
    if (!field) continue;
    const key = field.toLowerCase();
    if (key === 'sitemap') {
      rules.sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value);
      continue;
    }
    if (key !== 'allow' && key !== 'disallow') continue;
    inRules = true;
    if (!agents.includes('*') || !value) continue;
    rules[key].push(value);
  }
  return rules;
}

function robotsPatternMatches(pattern, path) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`, 'u').test(path);
}

/** Whether robots.txt blocks a path, as Google reads it: the longest matching rule wins, and Allow wins a tie. */
export function robotsBlocks(rules, path) {
  const longest = (patterns) => Math.max(-1, ...patterns.filter((pattern) => robotsPatternMatches(pattern, path)).map((pattern) => pattern.length));
  const disallow = longest(rules.disallow);
  return disallow >= 0 && disallow > longest(rules.allow);
}

