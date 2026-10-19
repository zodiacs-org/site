import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
        inlineCount: 3, deferredCount: 1, externalCount: 1, loaderCount: 1,
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
      `<template data-zdx-deferred-style><style data-zdx-deferred-faces>${faces.italic}${faces.mono}</style></template>`
      + `<noscript><style>${faces.italic}${faces.mono}</style></noscript>`,
    );
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
