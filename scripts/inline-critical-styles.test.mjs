import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import {
  expectedStylesheetShape,
  htmlFiles,
  inlineCriticalStyles,
} from './inline-critical-styles.mjs';

const temporaryRoots = [];

async function fixture(styles = {}) {
  const root = await mkdtemp(join(tmpdir(), 'zdx-inline-css-'));
  temporaryRoots.push(root);
  await mkdir(join(root, '_astro'));
  for (const [name, css] of Object.entries(styles)) {
    await writeFile(join(root, '_astro', name), css);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('inlineCriticalStyles', () => {
  it('pins the idempotent built-output shape for each entry-page strategy', () => {
    expect(expectedStylesheetShape('index.html', true)).toEqual({
      inlineCount: 1, deferredCount: 1, externalCount: 2, loaderCount: 1,
    });
    expect(expectedStylesheetShape('birth-chart/index.html', true)).toEqual({
      inlineCount: 2, deferredCount: 2, externalCount: 4, loaderCount: 1,
    });
    expect(expectedStylesheetShape('ru/birth-chart/index.html', true)).toEqual({
      inlineCount: 1, deferredCount: 3, externalCount: 6, loaderCount: 1,
    });    for (const pair of ['compatibility/aries-cancer/index.html', 'pt/compatibility/pisces-pisces/index.html']) {
      expect(expectedStylesheetShape(pair, false)).toEqual({
        inlineCount: 3, deferredCount: 1, externalCount: 1, loaderCount: 1, inlineIsMinimum: true,
      });
    }
  });

  it('ignores transient build directories and tolerates a vanished directory', async () => {
    const root = await fixture();
    await mkdir(join(root, '.prerender'));
    await writeFile(join(root, '.prerender', 'staging.html'), 'transient');
    await writeFile(join(root, 'visible.html'), 'deployable');

    expect(await htmlFiles(root)).toEqual([join(root, 'visible.html')]);
    expect(await htmlFiles(join(root, 'already-removed'))).toEqual([]);
  });

  it('preserves cascade order and leaves an unmarked page byte-identical', async () => {
    const root = await fixture({
      'base.css': ':root{--ink:#fff}',
      'route.css': '.hero{color:var(--ink)}',
    });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/base.css">'
      + '<link rel="stylesheet" href="/_astro/route.css">'
      + '</head><body></body></html>';
    const result = await inlineCriticalStyles(marked, root);

    expect(result.stylesheets).toBe(2);
    expect(result.html).not.toContain('data-inline-critical-css');
    expect(result.html.indexOf('--ink:#fff')).toBeLessThan(result.html.indexOf('.hero{'));

    const unmarked = '<html><head></head><body>untouched</body></html>';
    expect((await inlineCriticalStyles(unmarked, root)).html).toBe(unmarked);
  });

  it('stabilizes exactly the canonical shared chrome faces on an opted-in page', async () => {
    const root = await fixture({
      'Base.hash.css': [
        '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2);font-weight:400 700;font-style:normal;font-display:swap}',
        '@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-400-normal.woff2);font-weight:400;font-style:normal;font-display:swap}',
        '@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-500-normal.woff2);font-weight:500;font-style:normal;font-display:swap}',
        '@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2);font-weight:300 600;font-style:normal;font-display:swap}',
        '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-italic.woff2);font-weight:400 700;font-style:italic;font-display:swap}',
      ].join(''),
    });
    const marked = '<html data-inline-critical-css data-stable-chrome-typography><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head><body></body></html>';
    const result = await inlineCriticalStyles(marked, root);

    expect(result.html.match(/font-display:optional/g)).toHaveLength(4);
    expect(result.html.match(/font-display:swap/g)).toHaveLength(1);
    expect(result.html).toContain('instrument-sans-latin-wght-italic.woff2');
    expect(result.html).not.toContain('data-stable-chrome-typography');
  });

  it('replaces the homepage canonical faces in place with optional route subsets', async () => {
    const root = await fixture({
      'Base.hash.css': [
        '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2);font-weight:400 700;font-style:normal;font-display:swap}',
        '@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-400-normal.woff2);font-weight:400;font-style:normal;font-display:swap}',
        '@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-500-normal.woff2);font-weight:500;font-style:normal;font-display:swap}',
        '@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2);font-weight:300 600;font-style:normal;font-display:swap}',
        '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-italic.woff2);font-weight:400 700;font-style:italic;font-display:swap}',
      ].join(''),
    });
    const marked = '<html data-inline-critical-css data-local-chrome-typography><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head><body></body></html>';
    const result = await inlineCriticalStyles(marked, root, { subsetHomepageFonts: true });

    expect(result.html.match(/font-display:optional/g)).toHaveLength(4);
    expect(result.html.match(/font-display:swap/g)).toHaveLength(1);
    expect(result.html).toContain('/assets/home/instrument-sans-home-nav-core.woff2');
    expect(result.html).toContain('/assets/home/eb-garamond-home-400-core.woff2');
    expect(result.html).toContain('/assets/home/eb-garamond-home-500-nav-core.woff2');
    expect(result.html).toContain('/assets/home/jetbrains-mono-home-nav-core.woff2');
    expect(result.html).toContain('instrument-sans-latin-wght-italic.woff2');
  });

  it('fails closed when a homepage subset build omits a canonical face', async () => {
    const root = await fixture({
      'Base.hash.css': '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2);font-weight:400 700;font-style:normal;font-display:swap}',
    });
    const marked = '<html data-inline-critical-css data-local-chrome-typography><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(marked, root, { subsetHomepageFonts: true })).rejects.toThrow(
      'expected 4 homepage subset faces, found 1',
    );
  });

  it('does not treat a content literal as a stable-chrome document marker', async () => {
    const root = await fixture({
      'route.css': '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2);font-weight:400 700;font-style:normal;font-display:swap}',
    });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/route.css">'
      + '</head><body><code>data-stable-chrome-typography</code></body></html>';
    const result = await inlineCriticalStyles(marked, root);

    expect(result.html).toContain('font-display:swap');
    expect(result.html).toContain('<code>data-stable-chrome-typography</code>');
  });

  it('fails closed when an opted-in build omits a required chrome face', async () => {
    const root = await fixture({
      'Base.hash.css': '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2);font-weight:400 700;font-style:normal;font-display:swap}',
    });
    const marked = '<html data-inline-critical-css data-stable-chrome-typography><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(marked, root)).rejects.toThrow(
      'expected 4 stable chrome faces, found 1',
    );
  });

  it('defers noncritical tool styles without inline handlers or a no-JS gap', async () => {
    const root = await fixture({
      'Base.hash.css': ':root{--ink:#fff}',
      'calculator.hash.css': '.calc{color:var(--ink)}',
      'explorer.hash.css': '.explorer{display:grid}',
      'ChartCalculator.hash.css': '.reading{display:block}',
    });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '<link rel="stylesheet" href="/_astro/calculator.hash.css">'
      + '<link rel="stylesheet" href="/_astro/explorer.hash.css">'
      + '<link rel="stylesheet" href="/_astro/ChartCalculator.hash.css">'
      + '</head><body></body></html>';
    const result = await inlineCriticalStyles(marked, root, { deferNonBase: true });

    expect(result.stylesheets).toBe(1);
    expect(result.html).toContain('<style data-zdx-critical="Base.hash.css">');
    expect(result.html.match(/<template data-zdx-deferred-style>/g)).toHaveLength(3);
    expect(result.html.match(/<noscript><link rel="stylesheet"/g)).toHaveLength(3);
    expect(result.html).toContain('data-zdx-deferred-style-loader');
    expect(result.html).toContain("window.addEventListener('load', schedule");
    expect(result.html).not.toMatch(/\bonload=/i);
    expect(result.html).not.toContain('data-inline-critical-css');
  });

  it('moves only the below-fold faces of a pair page behind the loader', async () => {
    const faces = {
      sans: "@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-normal.woff2) format('woff2-variations');font-weight:400 700;font-style:normal;font-display:swap}",
      italic: "@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-italic.woff2) format('woff2-variations');font-weight:400 700;font-style:italic;font-display:swap}",
      phase1Italic: "@font-face{font-family:Instrument Sans Phase1;src:url(/fonts/instrument-sans-latin-wght-italic.woff2) format('woff2-variations');font-weight:400 700;font-style:italic;font-display:optional}",
      mono: "@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2) format('woff2-variations');font-weight:300 600;font-style:normal;font-display:swap}",
      serifItalic: "@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-400-italic.woff2) format('woff2');font-weight:400;font-style:italic;font-display:swap}",
    };
    const root = await fixture({
      'Base.hash.css': `${faces.sans}${faces.italic}${faces.phase1Italic}${faces.mono}${faces.serifItalic}:root{--ink:#fff}`,
      'calculator.hash.css': '.calc{color:var(--ink)}',
      'pair-page.hash.css': '.ph-hero{height:840px}',
    });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '<link rel="stylesheet" href="/_astro/calculator.hash.css">'
      + '<link rel="stylesheet" href="/_astro/pair-page.hash.css">'
      + '</head><body></body></html>';
    const result = await inlineCriticalStyles(marked, root, { deferFaces: true, keepLinked: /^calculator\./ });

    expect(result.stylesheets).toBe(2);
    expect(result.html).toContain('<link rel="stylesheet" href="/_astro/calculator.hash.css">');
    expect(result.html.indexOf('data-zdx-critical="Base.hash.css"')).toBeLessThan(result.html.indexOf('calculator.hash.css'));
    expect(result.html.indexOf('calculator.hash.css')).toBeLessThan(result.html.indexOf('data-zdx-critical="pair-page.hash.css"'));
    const base = result.html.match(/<style data-zdx-critical="Base\.hash\.css">([^<]*)<\/style>/)[1];
    expect(base).toBe(`${faces.sans}${faces.phase1Italic}${faces.serifItalic}:root{--ink:#fff}`);
    expect(result.html).toContain(
      `<template data-zdx-deferred-style><style data-zdx-deferred-faces>${faces.italic}${faces.mono}</style>`,
    );
    expect(result.html).toContain(`<noscript><style>${faces.italic}${faces.mono}</style></noscript>`);
    const definitions = JSON.parse(result.html.match(/<script type="application\/json" data-zdx-font-faces>(.*?)<\/script>/)[1]);
    expect(definitions).toEqual([
      { family: 'Instrument Sans', source: "url(/fonts/instrument-sans-latin-wght-italic.woff2) format('woff2-variations')", descriptors: { weight: '400 700', style: 'italic', display: 'swap' } },
      { family: 'JetBrains Mono', source: "url(/fonts/jetbrains-mono-latin-wght-normal.woff2) format('woff2-variations')", descriptors: { weight: '300 600', style: 'normal', display: 'swap' } },
    ]);
    expect(result.html.indexOf('data-zdx-deferred-faces')).toBeLessThan(result.html.indexOf('data-zdx-deferred-style-loader'));
    expect(result.html.match(/<link\b[^>]*rel="stylesheet"/g)).toHaveLength(1);
    expect(result.html).not.toContain('data-inline-critical-css');
  });

  it('fails closed when the stylesheet to keep linked is missing', async () => {
    const root = await fixture({ 'Base.hash.css': ':root{--ink:#fff}' });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(marked, root, { keepLinked: /^calculator\./ })).rejects.toThrow(
      'expected one stylesheet to keep linked, found 0',
    );
  });

  it('fails closed when a pair page build loses a below-fold face', async () => {
    const root = await fixture({
      'Base.hash.css': "@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2) format('woff2-variations');font-style:normal}",
    });
    const marked = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/Base.hash.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(marked, root, { deferFaces: true })).rejects.toThrow(
      'expected 2 below-fold faces, found 1',
    );
  });

  it.each(['unicode-range:U+0000-00FF', 'font-stretch:condensed', 'font-feature-settings:"liga"', 'size-adjust:105%'])('rejects unsupported deferred descriptor %s', async (descriptor) => {
    const root = await fixture({
      'Base.hash.css': [
        `@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-italic.woff2);font-style:italic;${descriptor}}`,
        '@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2);font-style:normal}',
      ].join(''),
    });
    const marked = '<html data-inline-critical-css><head><link rel="stylesheet" href="/_astro/Base.hash.css"></head></html>';

    await expect(inlineCriticalStyles(marked, root, { deferFaces: true })).rejects.toThrow(
      `unsupported deferred font descriptor ${descriptor.split(':')[0]}`,
    );
  });

  it.each([
    ['relative URL', '.x{background:url(../image.png)}', 'relative CSS URL'],
    ['CSS import', '@import "/other.css";', '@import is not safe'],
    ['style terminator', '.x{} </style><script>', 'unsafe style terminator'],
  ])('rejects %s before relocating CSS', async (_label, css, message) => {
    const root = await fixture({ 'unsafe.css': css });
    const html = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/_astro/unsafe.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(html, root)).rejects.toThrow(message);
  });

  it('rejects stylesheet paths outside the build asset directory', async () => {
    const root = await fixture();
    const html = '<html data-inline-critical-css><head>'
      + '<link rel="stylesheet" href="/../escape.css">'
      + '</head></html>';

    await expect(inlineCriticalStyles(html, root)).rejects.toThrow(
      'refusing non-build stylesheet',
    );
  });
});

describe('deferred font loader', () => {
  async function harness({ supported = true, hash = '', fontTemplate = true, constructorThrowsAt = -1 } = {}) {
    const root = await fixture({
      'Base.hash.css': [
        '@font-face{font-family:Instrument Sans;src:url(/fonts/instrument-sans-latin-wght-italic.woff2);font-weight:400 700;font-style:italic;font-display:swap}',
        '@font-face{font-family:JetBrains Mono;src:url(/fonts/jetbrains-mono-latin-wght-normal.woff2);font-weight:300 600;font-style:normal;font-display:swap}',
      ].join(''),
    });
    const { html } = await inlineCriticalStyles('<html data-inline-critical-css><head><link rel="stylesheet" href="/_astro/Base.hash.css"></head></html>', root, { deferFaces: true });
    const definitions = html.match(/<script type="application\/json" data-zdx-font-faces>(.*?)<\/script>/)[1];
    const code = html.match(/<script data-zdx-deferred-style-loader>(.*?)<\/script>/s)[1];
    const events = new Map();
    const timers = [];
    const loads = [];
    const added = [];
    const changes = [];
    const template = {
      content: {
        querySelector: () => fontTemplate ? { textContent: definitions } : null,
        cloneNode: () => 'CSS fallback',
      },
      replaceWith: (node) => changes.push(node),
      remove: () => changes.push('removed'),
    };
    class TestFontFace {
      constructor(family, source, descriptors) {
        if (loads.length === constructorThrowsAt) throw new SyntaxError('invalid font');
        Object.assign(this, { family, source, descriptors });
      }
      load() {
        return new Promise((resolve, reject) => loads.push({ face: this, resolve: () => resolve(this), reject }));
      }
    }
    runInNewContext(code, {
      FontFace: TestFontFace,
      window: {
        FontFace: supported ? TestFontFace : undefined,
        location: { hash },
        addEventListener: (type, fn) => events.set(type, fn),
      },
      document: {
        readyState: 'loading',
        fonts: { add: (face) => added.push(face) },
        addEventListener: (type, fn) => events.set(type, fn),
        removeEventListener: (type) => events.delete(type),
        querySelectorAll: () => [template],
      },
      setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
      clearTimeout: () => {},
    });
    return { events, timers, loads, added, changes };
  }

  // Flush both the load rejection handler and the batch-registration promise.
  const flush = () => new Promise((done) => setImmediate(done));

  it('loads off-document, then registers both faces without inserting a stylesheet', async () => {
    const h = await harness();
    expect(h.loads).toHaveLength(0);
    h.events.get('load')();
    expect(h.timers[0].delay).toBe(200);
    h.timers[0].fn();
    expect(h.loads.map(({ face }) => face.family)).toEqual(['Instrument Sans', 'JetBrains Mono']);
    expect(h.added).toHaveLength(0);
    h.loads[1].resolve();
    await flush();
    expect(h.added).toHaveLength(0);
    h.loads[0].resolve();
    await flush();
    expect(h.added).toEqual(h.loads.map(({ face }) => face));
    expect(h.changes).toEqual(['removed']);
    expect(h.events.has('pointerdown')).toBe(false);
  });

  it('keeps a successful face when the other download fails', async () => {
    const h = await harness({ hash: '#p=shared-chart' });
    expect(h.loads).toHaveLength(2);
    h.loads[0].reject(new Error('network failure'));
    h.loads[1].resolve();
    await flush();
    expect(h.added).toEqual([h.loads[1].face]);
    expect(h.changes).toEqual(['removed']);
  });

  it('honors early island intent once, before the load fallback fires', async () => {
    const h = await harness();
    const intent = h.events.get('pointerdown');
    intent({ target: { closest: () => null } });
    expect(h.loads).toHaveLength(0);
    intent({ target: { closest: () => ({}) } });
    expect(h.loads).toHaveLength(2);
    h.events.get('load')();
    h.timers[0].fn();
    expect(h.loads).toHaveLength(2);
    for (const load of h.loads) load.resolve();
    await flush();
    expect(h.added).toHaveLength(2);
    expect(h.changes).toEqual(['removed']);
  });

  it('retains the CSS fallback when the FontFace API is unavailable', async () => {
    const h = await harness({ supported: false, hash: '#c=shared-compare' });
    expect(h.loads).toHaveLength(0);
    expect(h.changes).toEqual(['CSS fallback']);
  });

  it.each([0, 1])('inserts CSS when FontFace constructor %i throws', async (constructorThrowsAt) => {
    const h = await harness({ constructorThrowsAt, hash: '#c=shared-compare' });
    expect(h.loads).toHaveLength(constructorThrowsAt);
    expect(h.changes).toEqual(['CSS fallback']);
    for (const load of h.loads) load.resolve();
    await flush();
    expect(h.added).toHaveLength(0);
  });

  it('adds nothing and removes the template when both downloads fail', async () => {
    const h = await harness({ hash: '#p=shared-chart' });
    expect(h.loads).toHaveLength(2);
    for (const load of h.loads) load.reject(new Error('network failure'));
    await flush();
    expect(h.added).toHaveLength(0);
    expect(h.changes).toEqual(['removed']);
  });

  it('still inserts ordinary deferred stylesheets on entry pages', async () => {
    const h = await harness({ fontTemplate: false, hash: '#p=shared-chart' });
    expect(h.loads).toHaveLength(0);
    expect(h.changes).toEqual(['CSS fallback']);
  });
});
