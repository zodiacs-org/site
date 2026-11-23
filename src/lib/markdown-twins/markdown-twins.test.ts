import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SITE,
  TWIN_SLUGS,
  buildTwin,
  canonicalLinkHeader,
  markdownTwinHref,
  renderTwin,
  type Block,
  type TwinSlug,
} from './index';
import { faqOf, headOf, markdownStatements, tableCellsOf, visibleHtmlText, visibleSourceText } from './parity';

const read = (path: string) => readFileSync(path, 'utf8');
/** Compared without whitespace: the built HTML drops the space where a line break meets a tag. */
const squash = (text: string) => text.replace(/[\s ]+/gu, '');
const pageSource = (slug: TwinSlug) => `src/pages/${slug}/index.astro`;
const DATED = new Set<TwinSlug>(['mercury-retrograde', 'full-moon-calendar', 'eclipses', 'horoscopes']);

/** The statements a twin makes about its page: everything but its canonical line and the closing sky calendar links. */
function pageStatements(markdown: string): string[] {
  const body = markdown.slice(0, markdown.indexOf('\n## Sky calendar\n'));
  return markdownStatements(body).filter((line) => !line.startsWith('Canonical page: '));
}

const blockTexts = (block: Block): string[] => {
  if ('h' in block) return [block.text];
  if ('p' in block) return [block.p];
  if ('list' in block) return block.list.flatMap((item) => markdownStatements(item));
  return [];
};

/** The questions and answers a page source holds as plain string literals in its frontmatter. */
function literalFaq(source: string): string[] {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? '';
  const block = frontmatter.match(/const faq = \[([\s\S]*?)\n\];/u)?.[1] ?? '';
  return [...block.matchAll(/\b[qa]:\s*'((?:[^'\\]|\\.)*)'\s*,/gu)].map(([, text]) => text.replace(/\\'/gu, "'"));
}

describe('Markdown twin routes', () => {
  it.each(TWIN_SLUGS)('/%s.md is prerendered Markdown naming its page as canonical', async (slug) => {
    const route = await import(`../../pages/${slug}.md.ts`);
    expect(route.prerender).toBe(true);
    const response: Response = await route.GET({} as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('link')).toBe(`<https://zodiacs.org/${slug}/>; rel="canonical"`);
    const body = await response.text();
    expect(body.startsWith(`# ${buildTwin(slug).title}\n`)).toBe(true);
    expect(body).toContain(`Canonical page: https://zodiacs.org/${slug}/`);
    expect(body).toContain('https://zodiacs.org/sky-calendar.ics');
  });

  it('serves the same headers from vercel.json, where the static file loses the route\'s', () => {
    const headers = JSON.parse(read('vercel.json')).headers as { source: string; headers: { key: string; value: string }[] }[];
    for (const slug of TWIN_SLUGS) {
      const rule = headers.find((entry) => entry.source === `/${slug}.md`);
      expect(rule, slug).toBeDefined();
      expect(rule!.headers).toEqual([
        { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        { key: 'Link', value: canonicalLinkHeader(slug) },
      ]);
    }
  });

  it('links each English page to its twin and no other page', () => {
    for (const slug of TWIN_SLUGS) expect(markdownTwinHref(`/${slug}/`)).toBe(`${SITE}/${slug}.md`);
    expect(markdownTwinHref('/birth-chart/', 'es')).toBeNull();
    expect(markdownTwinHref('/es/birth-chart/', 'es')).toBeNull();
    expect(markdownTwinHref('/today/')).toBeNull();
    expect(markdownTwinHref('/compatibility/aries-taurus/')).toBeNull();
    expect(read('src/components/SEO.astro')).toMatch(/markdownTwin && <link rel="alternate" type="text\/markdown" href=\{markdownTwin\} \/>/u);
  });
});

describe('Markdown twins say only what their pages say (page source)', () => {
  it.each(TWIN_SLUGS)('%s: every fixed sentence is on the page', (slug) => {
    const twin = buildTwin(slug);
    const source = squash(visibleSourceText(read(pageSource(slug))));
    // The dated pages' titles and descriptions carry the year span or the edition date; the built HTML checks them.
    const head = DATED.has(slug) ? [] : [twin.title, ...(twin.description ? [twin.description] : [])];
    const fixed = [...head, ...twin.blocks
      .filter((block) => !('table' in block) && !block.computed)
      .flatMap(blockTexts)];
    const missing = fixed.filter((text) => !source.includes(squash(text)));
    expect(missing).toEqual([]);
  });

  it.each(TWIN_SLUGS)('%s: every fixed question and answer on the page is in the twin', (slug) => {
    const twin = squash(renderTwin(buildTwin(slug)));
    const missing = literalFaq(read(pageSource(slug))).filter((text) => !twin.includes(squash(text)));
    expect(missing).toEqual([]);
  });

  it.each(TWIN_SLUGS)('%s: plain punctuation and no wing language', (slug) => {
    const markdown = renderTwin(buildTwin(slug));
    expect(markdown).not.toMatch(/[\u2013\u2014]/u);
    expect(markdown).not.toMatch(/\b(?:tokens?|crypto\w*|wallets?|blockchain|markets?|trading|invest\w*)\b/iu);
  });
});

describe.skipIf(!existsSync('dist/birth-chart.md'))('Markdown twins match the built pages', () => {
  it.each(TWIN_SLUGS)('%s: every statement, question, answer and dated row matches the HTML', (slug) => {
    const html = read(`dist/${slug}/index.html`);
    const markdown = read(`dist/${slug}.md`);
    const text = squash(visibleHtmlText(html));
    const statements = pageStatements(markdown);
    const head = headOf(html);

    expect(head.markdownAlternate).toBe(`${SITE}/${slug}.md`);
    expect(head.canonical).toBe(`${SITE}/${slug}/`);
    const twin = buildTwin(slug);
    if (twin.description) expect(twin.description).toBe(head.description);
    expect(html).toContain('href="/sky-calendar/"');

    // The twin invents nothing: each line, heading and table cell is on the page.
    const invented = statements.filter((line) => line !== twin.description && !text.includes(squash(line)));
    expect(invented).toEqual([]);

    // And drops nothing the page states as a fact: every question, answer and dated row is in the twin.
    const twinText = squash(statements.join(' '));
    const faq = faqOf(html);
    if (!['horoscopes', 'methodology', 'privacy', 'about'].includes(slug)) expect(faq.length).toBeGreaterThan(2);
    const droppedFaq = faq.flatMap(({ q, a }) => [q, a]).filter((part) => !twinText.includes(squash(part)));
    expect(droppedFaq).toEqual([]);
    const cells = new Set(statements);
    const rows = tableCellsOf(html);
    if (['mercury-retrograde', 'full-moon-calendar', 'eclipses'].includes(slug)) expect(rows.length).toBeGreaterThan(40);
    const droppedRows = rows.filter((cell) => !cells.has(cell));
    expect(droppedRows).toEqual([]);
  });

  it('leaves other pages and other languages without a twin link', () => {
    for (const path of ['dist/today/index.html', 'dist/es/birth-chart/index.html', 'dist/learn/index.html']) {
      if (existsSync(path)) expect(headOf(read(path)).markdownAlternate).toBe('');
    }
  });
});
