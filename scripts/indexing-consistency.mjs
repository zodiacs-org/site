const ORIGIN = 'https://zodiacs.org';

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined);
}

/** Crawl only rendered anchors. Hreflang and sitemap entries are not click paths. */
export function crawlDepths(pages) {
  const depths = new Map([['/', 0]]);
  const queue = ['/'];
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const html = (pages.get(path) ?? '').replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
      if (/\bnofollow\b/i.test(attribute(tag, 'rel') ?? '')) continue;
      const href = attribute(tag, 'href');
      if (!href) continue;
      let url;
      try { url = new URL(href.replaceAll('&amp;', '&'), ORIGIN + path); } catch { continue; }
      if (url.origin !== ORIGIN || url.search || !pages.has(url.pathname) || depths.has(url.pathname)) continue;
      depths.set(url.pathname, depths.get(path) + 1);
      queue.push(url.pathname);
    }
  }
  return depths;
}

/** Every sitemap entry must name exactly its own canonical, including URL spelling. */
export function sitemapCanonicalErrors(path, html, redirectSources = new Set()) {
  const errors = [];
  if (redirectSources.has(path)) errors.push(`${path}: sitemap URL is a configured redirect`);
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(([tag]) => (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'))
    .map(([tag]) => attribute(tag, 'href'));
  if (canonicals.length !== 1 || canonicals[0] !== ORIGIN + path) {
    errors.push(`${path}: sitemap URL must have exactly one self-referencing canonical`);
  }
  return errors;
}
