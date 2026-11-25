/**
 * Text extraction for the Markdown twins' parity checks: what a reader of the
 * page source or of the built HTML sees, as one whitespace-collapsed string,
 * so a twin's sentence can be looked up in it verbatim.
 */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  mdash: '\u2014', ndash: '\u2013', hellip: '…', middot: '·', times: '×', deg: '°', le: '≤', ge: '≥', rarr: '→', larr: '←',
  uarr: '↑', darr: '↓', prime: '′', Prime: '″',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name] ?? match;
  });
}

export const collapse = (text: string) => text.replace(/[\s ]+/gu, ' ').trim();

const INLINE_TAGS = 'a|abbr|b|bdi|cite|code|data|del|dfn|em|i|ins|kbd|mark|q|s|small|span|strong|sub|sup|time|u|var|astro-term-help|button';

/** Inline tags vanish (a link inside a word stays one word); every other tag is a space. */
function stripTags(html: string): string {
  return html
    .replace(new RegExp(`</?(?:${INLINE_TAGS})(?:\\s[^>]*)?>`, 'giu'), '')
    .replace(/<[^>]+>/gu, ' ');
}

/**
 * The visible text of a built page: the body without scripts, styles, the
 * glossary pop-up panels (hidden until a term is tapped) and SVG drawings.
 */
export function visibleHtmlText(html: string): string {
  const body = html.slice(Math.max(0, html.indexOf('<body')));
  return collapse(decodeEntities(stripTags(body
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/giu, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<span class="astro-term__panel"[\s\S]*?<\/astro-term-help>/gu, '')
    .replace(/<template\b[\s\S]*?<\/template>/giu, ' '))));
}

/** The head's description, title and canonical address. */
export function headOf(html: string) {
  const attr = (pattern: RegExp) => decodeEntities(html.match(pattern)?.[1] ?? '');
  return {
    title: attr(/<title>([^<]*)<\/title>/u),
    description: attr(/<meta name="description" content="([^"]*)"/u),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/u),
    markdownAlternate: attr(/<link rel="alternate" type="text\/markdown" href="([^"]*)"/u),
  };
}

/** Every question and answer the page's FAQPage structured data states. */
export function faqOf(html: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gu)) {
    const data = JSON.parse(json);
    const nodes: unknown[] = data['@graph'] ?? (Array.isArray(data) ? data : [data]);
    for (const node of nodes as Array<Record<string, unknown>>) {
      if (node['@type'] !== 'FAQPage') continue;
      for (const item of node.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>) {
        out.push({ q: collapse(item.name), a: collapse(item.acceptedAnswer.text) });
      }
    }
  }
  return out;
}

/** Every cell of the page's dated tables (the sky calendar pages' rows). */
export function tableCellsOf(html: string): string[] {
  return tableRowsOf(html).flat();
}

/** Dated table body rows, in page order, without the "now" and "ahead" markers. */
export function tableRowsOf(html: string): string[][] {
  const rows: string[][] = [];
  for (const [, table] of html.matchAll(/<table class="rx-table"[\s\S]*?<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gu)) {
    for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gu)) {
      const cells: string[] = [];
      for (const [, attrs, cell] of row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gu)) {
        if (attrs.includes('rx-table__state')) continue;
        const text = collapse(decodeEntities(stripTags(cell)));
        if (text && text !== '\u2014') cells.push(text);
      }
      if (cells.length) rows.push(cells);
    }
  }
  return rows;
}

/** Body rows of Markdown tables, in file order, skipping the header row of each table. */
export function markdownTableRows(markdown: string): string[][] {
  const rows: string[][] = [];
  let pending: string[][] = [];
  const flush = () => {
    if (pending.length > 1) rows.push(...pending.slice(1));
    pending = [];
  };
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      flush();
      continue;
    }
    if (/^\|?\s*-{3,}/u.test(line)) continue;
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((cell) => collapse(cell)).filter(Boolean);
    if (cells.length) pending.push(cells);
  }
  flush();
  return rows;
}

/**
 * What a reader sees, near enough, from an Astro page's source: the template
 * with styles, scripts and comments removed, glossary terms read as their
 * label, `{' '}` as a space and tags dropped; then the frontmatter, where the
 * questions and answers live as plain strings; then the raw template, for
 * text held in attributes.
 */
export function visibleSourceText(source: string): string {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? '';
  const template = source.slice(frontmatter ? frontmatter.length + 8 : 0)
    .replace(/<style\b[\s\S]*?<\/style>/gu, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gu, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, ' ')
    // Text shown only when a launch flag is on: twins state the default page, with every flag off.
    .replace(/\{launchFlagOn\(['"][A-Z0-9_]+['"]\)\s*&&\s*\([\s\S]*?\)\}/gu, '')
    .replace(/<AstroTerm\b[^>]*\blabel="([^"]*)"[^>]*\/>/gu, '$1')
    .replace(/\{\s*(['"])\s\1\s*\}/gu, ' ');
  // The raw template last, for text held in attributes: a description, a heading or a label prop.
  return `${collapse(decodeEntities(stripTags(template)))}\n${collapse(frontmatter)}\n${collapse(decodeEntities(template))}`;
}

/** Markdown back to the plain sentences it states, one per line, without its syntax. */
export function markdownStatements(markdown: string): string[] {
  const out: string[] = [];
  for (const raw of markdown.split('\n')) {
    let line = raw.trim();
    if (!line || /^\|?\s*-{3,}/u.test(line)) continue;
    if (line.startsWith('|')) {
      for (const cell of line.slice(1, -1).split('|')) if (cell.trim()) out.push(collapse(cell));
      continue;
    }
    line = line.replace(/^#{1,6}\s+/u, '').replace(/^>\s?/u, '').replace(/^[-*]\s+/u, '')
      .replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1');
    out.push(collapse(line));
  }
  return out;
}
