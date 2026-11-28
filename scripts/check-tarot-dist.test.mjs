import { describe, expect, it } from 'vitest';
import { TAROT_MARKERS, tarotDistProblems } from './check-tarot-dist.mjs';
import { TAROT_OFF_ENTRYPOINT, TAROT_PAGE_ENTRYPOINT, tarotEnabled, tarotRoute } from './tarot-route.mjs';
import { readFileSync } from 'node:fs';

const REDIRECT = '<meta http-equiv="refresh" content="0;url=/404.html">';
const PAGE = '<h1 class="display">Draw a tarot card.</h1>';
const island = { name: 'TarotDraw.KtatQXyb.js', text: `${TAROT_MARKERS.join(' ')} draw` };
const other = { name: 'Base.abc123.js', text: 'export {}' };

describe('the tarot route follows PUBLIC_TAROT_ENABLED', () => {
  const injected = (enabled) => {
    const routes = [];
    tarotRoute(enabled).hooks['astro:config:setup']({ injectRoute: (route) => routes.push(route) });
    return routes;
  };

  it('routes /tarot/ to the draw only when the flag is exactly 1, and to the bare redirect otherwise', () => {
    expect(injected(true)).toEqual([{ pattern: '/tarot/', entrypoint: TAROT_PAGE_ENTRYPOINT }]);
    expect(injected(false)).toEqual([{ pattern: '/tarot/', entrypoint: TAROT_OFF_ENTRYPOINT }]);
    for (const value of [undefined, '', '0', 'true', ' 1']) expect(tarotEnabled({ PUBLIC_TAROT_ENABLED: value }), String(value)).toBe(false);
    expect(tarotEnabled({ PUBLIC_TAROT_ENABLED: '1' })).toBe(true);
  });

  it('keeps the redirect page free of the draw: it imports nothing', () => {
    const off = readFileSync(new URL('../src/pages/tarot/_off.astro', import.meta.url), 'utf8');
    expect(off).not.toMatch(/import /u);
    expect(off).toContain("Astro.redirect('/404.html')");
    // The draw page is an underscore file, so Astro never routes it by itself.
    expect(TAROT_PAGE_ENTRYPOINT).toBe('./src/pages/tarot/_draw.astro');
    expect(readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8')).toMatch(/tarotRoute\(\)/u);
  });
});

describe('the built tarot assets', () => {
  it('pass a flag-off build with no island, no draw words and no precache entry', () => {
    expect(tarotDistProblems({ enabled: false, assets: [other], serviceWorker: "const PRECACHE_URLS = ['/_astro/Base.abc123.js'];", page: REDIRECT })).toEqual([]);
  });

  it('fail a flag-off build that ships the island, its words or a precache entry for it', () => {
    const problems = tarotDistProblems({ enabled: false, assets: [other, island], serviceWorker: "const PRECACHE_URLS = ['/_astro/TarotDraw.KtatQXyb.js'];", page: REDIRECT });
    expect(problems).toEqual([
      '/_astro/TarotDraw.KtatQXyb.js is the tarot island in a flag-off build',
      "/_astro/TarotDraw.KtatQXyb.js carries the tarot draw's words in a flag-off build",
      'the service worker lists a tarot asset in a flag-off build',
    ]);
    // Words inlined into another chunk are caught too.
    expect(tarotDistProblems({ enabled: false, assets: [{ name: 'shared.x.js', text: TAROT_MARKERS[1] }], serviceWorker: '', page: REDIRECT })).toHaveLength(1);
    expect(tarotDistProblems({ enabled: false, assets: [], serviceWorker: '', page: PAGE })).toHaveLength(1);
  });

  it('pass a flag-on build with the page and its island, and fail one without them', () => {
    expect(tarotDistProblems({ enabled: true, assets: [other, island], serviceWorker: '', page: PAGE })).toEqual([]);
    expect(tarotDistProblems({ enabled: true, assets: [other], serviceWorker: '', page: REDIRECT }).length).toBeGreaterThan(1);
  });

  it('reads its markers from the island and the meanings as they are', () => {
    expect(readFileSync(new URL('../src/islands/TarotDraw.tsx', import.meta.url), 'utf8')).toContain(TAROT_MARKERS[0]);
    expect(readFileSync(new URL('../src/lib/tarot/meanings.ts', import.meta.url), 'utf8')).toContain(TAROT_MARKERS[1]);
  });
});
