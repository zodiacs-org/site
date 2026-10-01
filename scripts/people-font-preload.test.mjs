import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monoPath = '/fonts/jetbrains-mono-latin-wght-normal.woff2';
async function astroPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? astroPages(path) : entry.name.endsWith('.astro') ? [path] : [];
  }))).flat();
}
function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}(?:=(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?(?=\\s|/?>)`, 'i'));
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : undefined;
}
function monoPreloads(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag)
    .filter((tag) => attribute(tag, 'rel') === 'preload' && attribute(tag, 'href') === monoPath);
}

describe('People profile mono font discovery', () => {
  it('source: keeps full mono preloading an explicit People profile and sign guide opt-in', async () => {
    const pages = await astroPages(resolve(root, 'src/pages'));
    const optedIn = (await Promise.all(pages.map(async (path) => (
      /\bpreloadMonoFont\b/.test(await readFile(path, 'utf8')) ? path : null
    )))).filter(Boolean);
    expect(optedIn).toEqual([
      resolve(root, 'src/pages/[sign]/index.astro'),
      resolve(root, 'src/pages/people/[slug].astro'),
    ]);
    const base = await readFile(resolve(root, 'src/layouts/Base.astro'), 'utf8');
    expect(base).toContain('preloadMonoFont?: boolean;');
    expect(base.match(new RegExp(monoPath.replaceAll('.', '\\.'), 'g'))).toHaveLength(1);
  });

  it.each(['ada-lovelace', 'marie-curie', 'serena-williams'])(
    'build: discovers exactly one anonymous mono font in the head for %s', async (slug) => {
      const html = await readFile(resolve(root, `dist/people/${slug}/index.html`), 'utf8');
      const [head] = html.split('</head>');
      const hints = monoPreloads(head);
      expect(hints).toHaveLength(1);
      expect(monoPreloads(html)).toHaveLength(1);
      expect(attribute(hints[0], 'as')).toBe('font');
      expect(attribute(hints[0], 'type')).toBe('font/woff2');
      expect(['', 'anonymous']).toContain(attribute(hints[0], 'crossorigin'));
      expect(attribute(hints[0], 'media')).toBeUndefined();
    },
  );

  it.each(['index.html', 'birth-chart/index.html', 'horoscopes/index.html', 'people/index.html', 'ru/index.html'])(
    'build: does not add a full mono preload to %s', async (path) => {
      expect(monoPreloads(await readFile(resolve(root, 'dist', path), 'utf8'))).toEqual([]);
    },
  );

  it('build: preserves the existing desktop-only mono preload on Today', async () => {
    const hints = monoPreloads(await readFile(resolve(root, 'dist/today/index.html'), 'utf8'));
    expect(hints).toHaveLength(1);
    expect(attribute(hints[0], 'media')).toBe('(min-width: 782px)');
    expect(['', 'anonymous']).toContain(attribute(hints[0], 'crossorigin'));
  });
});
