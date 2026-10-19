import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const distRoot = resolve(import.meta.dirname, '../dist');

// The built pair pages, in English and in translation: three of their four
// stylesheets inlined (the shared calculator sheet stays linked), the faces only text far down the page uses loaded after load, the
// hero's italic preloaded, and the paintings' AVIF copies offered at 1.5x.
describe.skipIf(!existsSync(distRoot))('built compatibility pair pages', () => {
  it.each([
    'compatibility/aries-cancer/index.html',
    'es/compatibility/aries-cancer/index.html',
    'pt/compatibility/pisces-pisces/index.html',
  ])('%s keeps the hero on a short first-paint path', (path) => {
    const html = readFileSync(join(distRoot, path), 'utf8');
    // Base, the pair styles and the wheel at least; production flags can add
    // more (account.css from the share control), and all of them are inlined.
    const inlined = [...html.matchAll(/<style data-zdx-critical="([^"]+)"/g)].map((match) => match[1]);
    expect(inlined.length).toBeGreaterThanOrEqual(3);
    for (const name of [/^Base\./u, /^pair-page\./u, /^RelationshipWheel\./u]) {
      expect(inlined.some((value) => name.test(value))).toBe(true);
    }
    expect(html.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)).toEqual([
      expect.stringMatching(/href="\/_astro\/calculator\.[A-Za-z0-9_-]+\.css"/),
    ]);
    expect(html.match(/<style data-zdx-deferred-faces>(.*?)<\/style>/)?.[1].match(/@font-face/g)).toHaveLength(2);
    expect(html).toContain('data-zdx-deferred-style-loader');
    expect(html).toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/eb-garamond-latin-400-italic\.woff2/i);
    expect(html.match(/<source type="image\/avif" media="\(min-resolution: 1\.5dppx\)"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/<img\b[^>]*fetchpriority="high"/g)).toHaveLength(1);
  });
});
