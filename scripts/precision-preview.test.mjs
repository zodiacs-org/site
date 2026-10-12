/**
 * The developer preview route, checked at the source and at the built
 * bundles. Scoped: it says nothing about any other page.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const page = readFileSync('src/pages/developers/precision-preview/index.astro', 'utf8');
const app = readFileSync('public/precision-preview/app.mjs', 'utf8');
const worker = readFileSync('public/precision-preview/worker.mjs', 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the precision preview is isolated', () => {
  it('is noindex and a private surface, so it inherits no analytics', () => {
    expect(page).toMatch(/noindex=\{true\}/);
    expect(page).toMatch(/privateSurface=\{true\}/);
  });

  it('is excluded from the offline worker, not merely stopped from registering one', () => {
    // A page that says it stores nothing cannot be cached by the site's
    // worker. `noServiceWorker` only stops registration FROM this page;
    // a worker already active at scope / controls it anyway.
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toMatch(/function neverCached\(url\)/);
    expect(sw).toContain("url.pathname.startsWith('/developers/precision-preview/')");
    expect(sw).toContain("url.pathname.startsWith('/precision-preview/')");
    expect(sw).toMatch(/registryVolatileSurface\(url\) \|\| neverCached\(url\)/);
  });

  it('inherits neither the service worker nor the assistant', () => {
    // Both are same-origin, so "no off-origin traffic" says nothing about
    // them. The worker precaches into Cache Storage, which is storage; the
    // assistant mounts a widget that can send typed text to the server.
    expect(page).toMatch(/noServiceWorker=\{true\}/);
    expect(page).toMatch(/noAssistant=\{true\}/);
    const footer = readFileSync('src/components/SiteFooter.astro', 'utf8');
    // Both the loader and the Guide button: without the loader the button
    // is a control that does nothing, which is worse than the fetch it
    // saves.
    expect(footer.match(/!Astro\.props\.noAssistant/g)).toHaveLength(2);
  });

  it('is not in the sitemap', () => {
    const sitemap = readFileSync('src/pages/sitemap.xml.ts', 'utf8');
    expect(sitemap).not.toContain('precision-preview');
  });

  it('says plainly that it is not the production engine', () => {
    expect(page).toMatch(/not what(?:\{' '\})?\s*\n?\s*<a href="\/birth-chart\/">/);
    expect(page).toMatch(/does not load on any\s*\n?\s*other page/);
  });

  it('loads exactly one module, a static file outside the Astro graph', () => {
    const scripts = [...page.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(scripts).toEqual(['/precision-preview/app.mjs']);
  });
});

describe('the built bundles', () => {
  it('exist and are browser-clean', () => {
    for (const [name, code] of [['app', app], ['worker', worker]]) {
      const c = strip(code);
      expect(c, `${name}: node: import`).not.toMatch(/from\s*["']node:/);
      expect(c, `${name}: require`).not.toMatch(/\brequire\s*\(/);
      expect(c, `${name}: Buffer`).not.toMatch(/\bBuffer\b/);
      expect(c, `${name}: process.`).not.toMatch(/\bprocess\s*\./);
    }
  });

  it('gives NEITHER bundle a way to reach the network or persist anything', () => {
    // Scanned raw. The comment strip this used to run first deletes from
    // any literal `/*` to the next `*/`, including inside a string, and
    // any line starting with `//` -- which a bundled
    // "//host/path" string is. And only the worker was scanned; the app
    // is the half with DOM access.
    for (const [name, code] of [['app', app], ['worker', worker]]) {
      for (const re of [
        /\bfetch\s*\(/, /https?:\/\//, /["'`]\/\/[a-z0-9.-]+\//i, /XMLHttpRequest/,
        /importScripts/, /sendBeacon/, /\bWebSocket\b/, /\bEventSource\b/, /new\s+Request\b/,
      ]) expect(code, `${name}: ${re}`).not.toMatch(re);
    }
  });

  it('persists nothing', () => {
    for (const code of [app, worker]) {
      for (const re of [/localStorage/, /sessionStorage/, /indexedDB/i, /\bcaches\b/, /document\s*\.\s*cookie/]) {
        expect(code).not.toMatch(re);
      }
    }
  });

  it('carries the v2 result contract, not the withdrawn v1 flags', () => {
    expect(worker).toContain('zodiacs-precision-search/2');
    expect(strip(app)).not.toMatch(/\.isolation\b/);
    expect(strip(app)).toMatch(/completeness\.established/);
  });

  it('labels synthetic output as synthetic wherever it is shown', () => {
    expect(app).toMatch(/not planetary positions|invented, not a planet/);
    expect(worker).toMatch(/NOT a planetary ephemeris/);
  });

  it('is generated from the committed sources, and the generator says so', () => {
    // This used to be called "without drift" and did not check drift: its
    // four assertions were two files existing and two banners on line 1,
    // so a hand-edited worker with a fetch() in it would have passed.
    // Real drift coverage is `--check`, below.
    expect(existsSync('src/precision-preview/app.src.mjs')).toBe(true);
    expect(existsSync('src/precision-preview/worker.src.mjs')).toBe(true);
    expect(app.startsWith('// Built by scripts/build-precision-preview.mjs')).toBe(true);
    expect(worker.startsWith('// Built by scripts/build-precision-preview.mjs')).toBe(true);
  });

  it('has not drifted from its sources', () => {
    // The generator's own --check, run here rather than only in CI, so a
    // hand-edit to the built bundle fails at the same moment as a
    // hand-edit to anything else in this file's scope.
    const out = spawnSync(process.execPath, ['scripts/build-precision-preview.mjs', '--check'], { encoding: 'utf8' });
    expect(`${out.stdout}${out.stderr}`.trim()).not.toMatch(/drift/i);
    expect(out.status).toBe(0);
  });
});
