import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const distRoot = resolve(import.meta.dirname, '../dist');

// The built pair pages, in English and in translation: three of their four
// stylesheets inlined (the shared calculator sheet stays linked), the faces only text far down the page uses loaded after load, the
// hero's italic preloaded, the paintings' AVIF copies offered at 1.5x, and
// every hero image but the first painting at low priority.
describe.skipIf(!existsSync(distRoot))('built compatibility pair pages', () => {
  it.each(['aries-cancer', 'leo-scorpio', 'taurus-taurus'])('%s ships comparison symbols without platform font lookup', (pair) => {
    const html = readFileSync(join(distRoot, `compatibility/${pair}/index.html`), 'utf8');
    const badges = [...html.matchAll(/<span class="ph-adds__gl(?: ph-adds__gl--two)?" aria-hidden="true">([\s\S]*?)<\/span>/g)];
    expect(badges).toHaveLength(3);
    for (const [, content] of badges) {
      expect(content).toMatch(/<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"/);
      expect(content).not.toMatch(/[\u260c\u263d\u2640\u2642\ufe0e]/u);
    }
    expect(html).not.toContain('Pair Symbol Fallback');
  });

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
    const fonts = JSON.parse(html.match(/<script type="application\/json" data-zdx-font-faces>(.*?)<\/script>/)?.[1] ?? 'null');
    expect(fonts.map(({ family, source, descriptors }) => [family, source, descriptors.style, descriptors.weight, descriptors.display])).toEqual([
      ['Instrument Sans', expect.stringContaining('/fonts/instrument-sans-latin-wght-italic.woff2'), 'italic', '400 700', 'swap'],
      ['JetBrains Mono', expect.stringContaining('/fonts/jetbrains-mono-latin-wght-normal.woff2'), 'normal', '300 600', 'swap'],
    ]);
    expect(html).toContain('data-zdx-deferred-style-loader');
    expect(html).toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/eb-garamond-latin-400-italic\.woff2/i);
    expect(html.match(/<source type="image\/avif" media="\(min-resolution: 1\.5dppx\)"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/<img\b[^>]*fetchpriority="high"/g)).toHaveLength(1);
    // Everything else in the hero waits behind the first painting. On a slow
    // link Chrome raises any image on screen at the first layout to high
    // priority unless it asks for low, and Lighthouse then counts it in LCP.
    const hero = html.match(/<header class="ph-hero"[^>]*>[\s\S]*?<\/header>/)?.[0] ?? '';
    const heroImages = hero.match(/<img\b[^>]*>/g) ?? [];
    expect(heroImages.length).toBeGreaterThanOrEqual(4);
    expect(heroImages.filter((tag) => !/fetchpriority="(?:high|low)"/.test(tag))).toEqual([]);
  });
});
