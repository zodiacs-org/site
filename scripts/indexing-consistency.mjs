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
