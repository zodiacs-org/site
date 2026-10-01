/**
 * The privacy pages and llms-full.txt say that calendar addresses made before
 * feed ids keep working for 60 days and then stop. That is true only once
 * LEGACY_FEED_WINDOW_START is set: while it is null, such addresses are
 * served as before, with no end. The release commit sets it; until then the
 * second test here fails, so text that states the window cannot ship without
 * the code that runs it. Once it is set, every privacy page and
 * llms-full.txt must state the window.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGACY_FEED_WINDOW_DAYS, LEGACY_FEED_WINDOW_START } from './legacy-window';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Where the site's words come from: pages, components, islands, catalogs, content and the llms files. */
const SHIPPED_DIRECTORIES = [
  'src/pages',
  'src/components',
  'src/islands',
  'src/layouts',
  'src/strings',
  'src/lib/i18n',
  'src/content',
];
const SHIPPED_FILES = ['public/llms.txt', 'public/llms-full.txt'];
const TEXT_FILE = /\.(?:astro|tsx?|mjs|md|mdx|json|txt)$/u;

const WINDOW = new RegExp(
  `(?<![\\p{L}\\p{N}])${LEGACY_FEED_WINDOW_DAYS}[\\s\\u00a0]+(?:days?|días|jours|giorni|dias|дней|дня)(?!\\p{L})`,
  'giu',
);
const ADDRESS = /(?<!\p{L})(?:address(?:es)?|urls?|dirección|direcciones|adresses?|indirizz[oi]|endereços?|адрес\p{L}*)(?!\p{L})/iu;

/**
 * The sentences of a text that put the window's days on an address. Markup
 * wraps a sentence over several lines; in a plain text file (`lines`), each
 * line is its own paragraph.
 */
export function windowStatements(text: string, { lines = false } = {}): string[] {
  if (lines) return text.split('\n').flatMap((line) => windowStatements(line));
  const flat = text.replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ');
  const found: string[] = [];
  for (const match of flat.matchAll(WINDOW)) {
    const before = flat.slice(0, match.index);
    const start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 1;
    const end = flat.slice(match.index).search(/[.!?](?:\s|$)/u);
    const sentence = flat.slice(start, end < 0 ? flat.length : match.index + end + 1).trim();
    if (ADDRESS.test(sentence)) found.push(sentence);
  }
  return found;
}

function filesUnder(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return filesUnder(path);
    return entry.isFile() && TEXT_FILE.test(entry.name) && !/\.test\./u.test(entry.name) ? [path] : [];
  });
}

function shippedFiles(): string[] {
  return [...SHIPPED_DIRECTORIES.flatMap(filesUnder), ...SHIPPED_FILES];
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('the older calendar addresses\' 60-day window in the site\'s text', () => {
  it('recognizes the window in every language the site states it in, and nothing else', () => {
    for (const sentence of [
      'Those older addresses keep working for 60 days after the site started giving calendars random addresses.',
      'Esas direcciones antiguas siguen funcionando durante 60 días desde que el sitio empezó a dar a los calendarios direcciones aleatorias.',
      'Ces anciennes adresses continuent de fonctionner pendant 60 jours après que le site a commencé à donner des adresses aléatoires aux calendriers.',
      'Questi indirizzi più vecchi continuano a funzionare per 60 giorni da quando il sito ha iniziato a dare ai calendari indirizzi casuali.',
      'Esses endereços antigos continuam funcionando por 60 dias depois que o site passou a dar endereços aleatórios aos calendários.',
      'Такие старые адреса продолжают работать 60 дней с того дня, когда сайт стал давать календарям случайные адреса.',
      'Such addresses keep working for 60 days after the change and then answer 410 Gone.',
    ]) {
      expect(windowStatements(`Before. <p>${sentence}</p> After.`), sentence).toEqual([sentence]);
    }
    expect(windowStatements('Every lunation, ingress and station in the next 60 days, in order.')).toEqual([]);
    expect(windowStatements('Sky data: the next 60 days of lunations\nRegistry: paste-address verification', { lines: true }))
      .toEqual([]);
    expect(windowStatements('Those older addresses keep working for 600 days.')).toEqual([]);
  });

  it('states the window only once LEGACY_FEED_WINDOW_START is set', () => {
    const files = shippedFiles();
    const statements = files.flatMap((path) => windowStatements(read(path), { lines: /\.(?:txt|md)$/u.test(path) })
      .map((sentence) => `${path}: ${sentence}`));
    if (LEGACY_FEED_WINDOW_START === null) {
      expect(
        statements,
        'LEGACY_FEED_WINDOW_START in src/lib/calendar-feed/legacy-window.ts is null, so addresses made before '
          + 'feed ids never stop working, yet these texts say they do. Set it to the release day in the release '
          + 'commit (docs/OWNER-SETUP-RUNBOOK.md, section 8), or take the window out of these texts.',
      ).toEqual([]);
      return;
    }
    const pages = files.filter((path) => /(?:^|\/)privacy\/index\.astro$/u.test(path));
    expect(pages.length).toBeGreaterThanOrEqual(6);
    for (const path of [...pages, 'public/llms-full.txt']) {
      expect(statements.some((line) => line.startsWith(`${path}: `)), `${path} does not state the window`).toBe(true);
    }
  });

  it('dates every privacy page and its sitemap entry to the same release day', () => {
    expect(LEGACY_FEED_WINDOW_START).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    for (const locale of ['', 'es/', 'fr/', 'it/', 'pt/', 'ru/']) {
      expect(read(`src/pages/${locale}privacy/index.astro`))
        .toContain(`const modifiedAt = '${LEGACY_FEED_WINDOW_START}T00:00:00.000Z';`);
    }
    expect(read('src/pages/sitemap.xml.ts'))
      .toContain(`const CALENDAR_FEEDS_LASTMOD = '${LEGACY_FEED_WINDOW_START}';`);
    expect(read('src/pages/sitemap.xml.ts'))
      .toContain('...CALENDAR_FEEDS_ROUTES.map((loc) => [loc, CALENDAR_FEEDS_LASTMOD] as const)');
  });

  it('reads the files the site is built from', () => {
    const files = shippedFiles();
    expect(files).toContain('src/pages/privacy/index.astro');
    expect(files).toContain('src/pages/ru/privacy/index.astro');
    expect(files).toContain('src/islands/CalendarSubscribe.tsx');
    expect(files.every((path) => !path.includes(`${sep}node_modules${sep}`) && relative(ROOT, join(ROOT, path)) === path))
      .toBe(true);
  });
});
