/**
 * Markdown twins of twelve English consumer pages, for assistants and other
 * programs that read text rather than HTML. A twin states only what its page
 * already states (the parity test in markdown-twins.test.ts holds it to the
 * page source and to the built HTML), plus its canonical address and the sky
 * calendar links. Every reader gets the same file; nothing is served by user
 * agent. Each page links its twin with <link rel="alternate"
 * type="text/markdown"> from SEO.astro, and each twin names its page as
 * canonical in a Link header (here, and in vercel.json for the static file).
 */

export const SITE = 'https://zodiacs.org';

export const TWIN_SLUGS = [
  'birth-chart',
  'compatibility',
  'moon-sign',
  'rising-sign',
  'saturn-return',
  'mercury-retrograde',
  'full-moon-calendar',
  'eclipses',
  'horoscopes',
  'methodology',
  'privacy',
  'about',
] as const;

export type TwinSlug = (typeof TWIN_SLUGS)[number];

export const pagePathOf = (slug: TwinSlug) => `/${slug}/`;
export const twinPathOf = (slug: TwinSlug) => `/${slug}.md`;
export const canonicalLinkHeader = (slug: TwinSlug) => `<${SITE}${pagePathOf(slug)}>; rel="canonical"`;

/** The twin of an English page's canonical path, or null when it has none. */
export function markdownTwinHref(canonicalPath: string, locale = 'en'): string | null {
  if (locale !== 'en') return null;
  const slug = TWIN_SLUGS.find((candidate) => pagePathOf(candidate) === canonicalPath);
  return slug ? `${SITE}${twinPathOf(slug)}` : null;
}

/**
 * One block of a twin. `computed` marks text built from data or from another
 * module at build time, which the page source does not hold literally; the
 * parity test checks it against the built HTML instead.
 */
export type Block =
  | { h: 2 | 3; text: string; computed?: boolean }
  | { p: string; computed?: boolean }
  | { list: string[]; computed?: boolean }
  | { table: { head: string[]; rows: string[][] } };

export interface Twin {
  slug: TwinSlug;
  /** The page's h1. */
  title: string;
  /** The page's meta description, when it suits a consumer twin. */
  description?: string;
  blocks: Block[];
}

/** The links every twin ends with, in the words llms.txt and the site navigation already use. */
export const SKY_CALENDAR_BLOCKS: Block[] = [
  { h: 2, text: 'Sky calendar' },
  { list: [
    'Sky calendar (.ics): https://zodiacs.org/sky-calendar.ics',
    'How to add it to Google or Apple Calendar: https://zodiacs.org/sky-calendar/',
  ] },
];

const cell = (text: string) => text.replaceAll('|', '\\|');

export function renderTwin(twin: Twin): string {
  const lines = [`# ${twin.title}`, '', ...(twin.description ? [`> ${twin.description}`, ''] : []), `Canonical page: ${SITE}${pagePathOf(twin.slug)}`, ''];
  for (const block of [...twin.blocks, ...SKY_CALENDAR_BLOCKS]) {
    if ('h' in block) lines.push(`${'#'.repeat(block.h)} ${block.text}`, '');
    else if ('p' in block) lines.push(block.p, '');
    else if ('list' in block) lines.push(...block.list.map((item) => `- ${item}`), '');
    else {
      const { head, rows } = block.table;
      lines.push(`| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`);
      for (const row of rows) lines.push(`| ${row.map(cell).join(' | ')} |`);
      lines.push('');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export const markdownHeaders = (slug: TwinSlug) => ({
  'Content-Type': 'text/markdown; charset=utf-8',
  Link: canonicalLinkHeader(slug),
});
