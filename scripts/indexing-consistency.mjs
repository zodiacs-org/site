const ORIGIN = 'https://zodiacs.org';

export function attr(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((value) => value !== undefined) ?? null;
}

/** Extract rendered anchors with exact built URL spelling. */
export function renderedLinks(path, html, { discoveryOnly = true } = {}) {
  const links = new Set();
  html = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    if (discoveryOnly && (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('nofollow')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const url = new URL(href.replaceAll('&amp;', '&'), ORIGIN + path);
      if (url.origin === ORIGIN && (!discoveryOnly || !url.search)) links.add(url.pathname);
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
 * Keep each crawler group for group-specific checks. The top-level rules
 * combine the wildcard groups for sitemap checks against general crawlers.
 */
export function robotsRules(text) {
  const groups = [];
  const sitemaps = [];
  let group;
  let inRules = false;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim();
    if (!line) continue;
    const [, field, value] = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/u) ?? [];
    if (!field) continue;
    const key = field.toLowerCase();
    if (key === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!value) continue;
      if (!group || inRules) {
        group = { agents: [], allow: [], disallow: [] };
        groups.push(group);
      }
      inRules = false;
      group.agents.push(value);
      continue;
    }
    if (key !== 'allow' && key !== 'disallow') continue;
    inRules = true;
    if (group && value) group[key].push(value);
  }
  const general = groups.filter(({ agents }) => agents.includes('*'));
  return {
    groups,
    sitemaps,
    allow: general.flatMap(({ allow }) => allow),
    disallow: general.flatMap(({ disallow }) => disallow),
  };
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

export function robotsGroupBlockFailures({ groups }, paths) {
  const failures = [];
  for (const group of groups) {
    for (const path of paths) {
      if (!robotsBlocks(group, path)) failures.push({ agents: group.agents, path });
    }
  }
  return failures;
}

/**
 * Pages whose content changes with every daily edition, so their sitemap date
 * is the edition's date: Today, the horoscope hubs and each sign's daily,
 * tomorrow, love and career readings (English, Spanish and Portuguese), and
 * the chart of the day. Every other page is dated from its content (a
 * constant or a source date in src/pages/sitemap.xml.ts), never the build.
 */
const SIGN = '(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)';
const DAILY_LASTMOD_PATTERNS = [
  /^\/(?:(?:es|pt)\/)?today\/$/u,
  /^\/(?:(?:es|pt)\/)?horoscopes\/$/u,
  new RegExp(`^/(?:es|pt)/horoscopes/${SIGN}/$`, 'u'),
  new RegExp(`^/horoscopes/${SIGN}/(?:tomorrow/|love/|career/)?$`, 'u'),
  /^\/(?:(?:es|pt|fr|it|ru)\/)?chart-of-the-day\/(?:\d{4}-\d{2}-\d{2}\/)?$/u,
];

export function isDailyLastmodPath(path) {
  return DAILY_LASTMOD_PATTERNS.some((pattern) => pattern.test(path));
}
