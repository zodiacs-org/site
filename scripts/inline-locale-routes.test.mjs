import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inlineCriticalStyles } from './inline-critical-styles.mjs';
import { inlineLocaleRoute, inlineLocaleRoutes, LOCALE_ROUTE_PLANS } from './lib/inline-locale-routes.mjs';

const roots = [];
const monoSource = '/fonts/jetbrains-mono-latin-wght-normal.woff2';
const mono400 = '/assets/locale/jetbrains-mono-latin-400-normal.woff2';
const mono = `@font-face{font-family:JetBrains Mono;src:url(${monoSource}) format('woff2-variations');font-weight:300 600;font-style:normal;font-display:swap}`;
const alias = `@font-face{font-family:JetBrains Mono Phase1;src:url(${monoSource});font-weight:300 600;font-display:optional}`;
const serifItalic = '@font-face{font-family:EB Garamond;src:url(/fonts/eb-garamond-latin-400-italic.woff2);font-weight:400;font-style:italic;font-display:swap}';
const css = {
  Base: mono + alias + serifItalic + ':root{--ink:#fff}',
  LocalizedHomeHead: '.hero{color:var(--ink)}',
  calculator: '.calc{display:grid}',
  explorer: '.explorer{display:block}',
  ChartActionDock: '.actions{position:sticky}',
  LocalizedToday: '.today{padding:1rem}',
  'profile-page': '.profile{display:grid}',
  LivingChartTimeline: '.timeline{display:block}',
};
const manifest = '<link rel="manifest" href="/site.webmanifest">';
function page(names) {
  return '<!doctype html><html lang="es"><head>' + manifest + names.map((name) => (
    `<link rel="stylesheet" href="/_astro/${name}.hash.css">`
  )).join('<style>.route{color:white}</style>') + '</head><body>Unchanged copy</body></html>';
}
async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'zdx-locale-css-'));
  roots.push(root);
  await mkdir(join(root, '_astro'));
  for (const [name, text] of Object.entries({ ...css, ...overrides })) await writeFile(join(root, '_astro', `${name}.hash.css`), text);
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('translated entry stylesheet delivery', () => {
  it('selects the finite measured scope without taking ownership of English or existing Russian entry strategies', () => {
    const paths = LOCALE_ROUTE_PLANS.map(({ path }) => path);
    expect(paths).toHaveLength(10);
    expect(new Set(paths).size).toBe(10);
    expect(LOCALE_ROUTE_PLANS.reduce((sum, { stylesheets, keepLinked }) => sum + stylesheets.length - keepLinked.length, 0)).toBe(20);
    expect(LOCALE_ROUTE_PLANS.reduce((sum, { keepLinked }) => sum + keepLinked.length, 0)).toBe(8);
    expect(LOCALE_ROUTE_PLANS.filter(({ subsetMono }) => subsetMono).map(({ path }) => path))
      .toEqual(['es/index.html', 'pt/index.html', 'fr/index.html', 'it/index.html']);
    expect(LOCALE_ROUTE_PLANS.filter(({ deferManifest }) => deferManifest)).toHaveLength(10);
    for (const excluded of ['ru/index.html', 'ru/birth-chart/index.html', 'es/aries/index.html',
      'es/learn/index.html', 'es/tools/index.html', 'es/profile/index.html', 'ru/profile/index.html',
      'es/compatibility/aries-cancer/index.html', 'index.html']) expect(paths).not.toContain(excluded);
  });

  it('preserves CSS bytes, font-display, cascade order and content outside the home mono replacement', async () => {
    const root = await fixture();
    const plan = LOCALE_ROUTE_PLANS.find(({ path }) => path === 'es/birth-chart/index.html');
    const source = page(plan.stylesheets);
    let expected = source;
    for (const name of plan.stylesheets.filter((name) => !plan.keepLinked.includes(name))) expected = expected.replace(`<link rel="stylesheet" href="/_astro/${name}.hash.css">`, `<style data-zdx-locale-critical="${name}.hash.css">${css[name]}</style>`);
    const result = await inlineLocaleRoute(source, { relativePath: plan.path, root, inlineStyles: inlineCriticalStyles });
    expect(result.html.replace(/<script data-zdx-locale-manifest-loader>[\s\S]*?<\/script>/u, '')
      .replace(`<template data-zdx-locale-manifest>${manifest}</template><noscript>${manifest}</noscript>`, manifest)).toBe(expected);
    expect(result.html.indexOf('Base.hash.css')).toBeLessThan(result.html.indexOf('calculator.hash.css'));
    expect(result.html.indexOf('calculator.hash.css')).toBeLessThan(result.html.indexOf('explorer.hash.css'));
    expect(result.html).not.toContain('<!--zdx-locale-kept-');
    expect(result.html).not.toContain('data-inline-critical-css');
    expect(result.html).not.toContain('data-zdx-critical=');
    const again = await inlineLocaleRoute(result.html, { relativePath: plan.path, root, inlineStyles: vi.fn() });
    expect(again.html).toBe(result.html);
    expect(again.changed).toBe(false);
  });

  it('keeps the full variable mono face and adds only a static 400 face last', async () => {
    const root = await fixture();
    const result = await inlineLocaleRoute(page(['Base', 'LocalizedHomeHead']), { relativePath: 'es/index.html', root, inlineStyles: inlineCriticalStyles });
    const faces = mono + mono.replace('300 600', '400').replace(monoSource, mono400).replace('woff2-variations', 'woff2');
    expect(result.html).toContain(`<style data-zdx-locale-critical="Base.hash.css">${css.Base.replace(mono, faces)}</style>`);
    expect(result.html).toContain(alias);
    expect(result.html).toContain(serifItalic);
    expect(result.html).not.toContain('data-zdx-locale-home-font');
    const again = await inlineLocaleRoute(result.html, { relativePath: 'es/index.html', root, inlineStyles: vi.fn() });
    expect(again.html).toBe(result.html);
    expect(again.changed).toBe(false);
    await expect(inlineLocaleRoute(result.html.replace('font-weight:400;', 'font-weight:401;'), {
      relativePath: 'es/index.html', root, inlineStyles: vi.fn(),
    })).rejects.toThrow('unexpected home mono subset shape');
  });

  it('keeps every birth-chart font initially available and preserves the original manifest in no-JS fallback', async () => {
    const root = await fixture();
    const plan = LOCALE_ROUTE_PLANS.find(({ path }) => path === 'es/birth-chart/index.html');
    const result = await inlineLocaleRoute(page(plan.stylesheets), { relativePath: plan.path, root, inlineStyles: inlineCriticalStyles });
    expect(result.stylesheets).toBe(3);
    expect(result.html).toContain('<link rel="stylesheet" href="/_astro/calculator.hash.css">');
    expect(result.html).toContain(`<style data-zdx-locale-critical="Base.hash.css">${css.Base}</style>`);
    expect(result.html).toContain(`<template data-zdx-locale-manifest>${manifest}</template><noscript>${manifest}</noscript>`);
    expect(result.html).not.toContain(mono400);
    const again = await inlineLocaleRoute(result.html, { relativePath: plan.path, root, inlineStyles: vi.fn() });
    expect(again.html).toBe(result.html);
    await expect(inlineLocaleRoute(result.html.replace(`<noscript>${manifest}</noscript>`, ''), {
      relativePath: plan.path, root, inlineStyles: vi.fn(),
    })).rejects.toThrow('unexpected deferred manifest shape');
  });

  it('retains an optional account stylesheet at its original production cascade position', async () => {
    const root = await fixture();
    const plan = LOCALE_ROUTE_PLANS.find(({ path }) => path === 'es/birth-chart/index.html');
    // account.css is intentionally absent from the fixture: a kept stylesheet
    // must not be read, rewritten, or passed to the inline callback.
    for (const position of [0, 2, 4]) {
      const names = [...plan.stylesheets];
      names.splice(position, 0, 'account');
      const source = page(names);
      const result = await inlineLocaleRoute(source, { relativePath: plan.path, root, inlineStyles: inlineCriticalStyles });
      let expected = source;
      for (const name of plan.stylesheets.filter((name) => !plan.keepLinked.includes(name))) {
        expected = expected.replace(`<link rel="stylesheet" href="/_astro/${name}.hash.css">`, `<style data-zdx-locale-critical="${name}.hash.css">${css[name]}</style>`);
      }
      expect(result.html.replace(/<script data-zdx-locale-manifest-loader>[\s\S]*?<\/script>/u, '')
        .replace(`<template data-zdx-locale-manifest>${manifest}</template><noscript>${manifest}</noscript>`, manifest)).toBe(expected);
      expect(result).toMatchObject({ stylesheets: 3, keptStylesheets: 2 });
      const again = await inlineLocaleRoute(result.html, { relativePath: plan.path, root, inlineStyles: vi.fn() });
      expect(again.html).toBe(result.html);
      expect(again).toMatchObject({ changed: false, stylesheets: 3, keptStylesheets: 2 });
    }
  });

  it('rejects duplicate, unapproved, or out-of-scope optional stylesheets', async () => {
    const root = await fixture();
    const plan = LOCALE_ROUTE_PLANS.find(({ path }) => path === 'es/birth-chart/index.html');
    const options = { relativePath: plan.path, root, inlineStyles: inlineCriticalStyles };
    await expect(inlineLocaleRoute(page([...plan.stylesheets, 'account', 'account']), options))
      .rejects.toThrow('duplicate optional account stylesheet');
    await expect(inlineLocaleRoute(page([...plan.stylesheets, 'unapproved']), options))
      .rejects.toThrow('expected Base, calculator, explorer, ChartActionDock');
    await expect(inlineLocaleRoute(page(['Base', 'LocalizedHomeHead', 'account']), { ...options, relativePath: 'es/index.html' }))
      .rejects.toThrow('expected Base, LocalizedHomeHead');
    const account = '<link rel="stylesheet" href="/_astro/account.hash.css">';
    await expect(inlineLocaleRoute(page(plan.stylesheets).replace('</head>', `<template>${account}</template></head>`), options))
      .rejects.toThrow('unexpected inert stylesheet');
  });

  it('activates the deferred manifest only 200 ms after load, including an already loaded document', async () => {
    const root = await fixture();
    const result = await inlineLocaleRoute(page(['Base', 'LocalizedToday']), { relativePath: 'es/today/index.html', root, inlineStyles: inlineCriticalStyles });
    const loader = result.html.match(/<script data-zdx-locale-manifest-loader>([\s\S]*?)<\/script>/u)[1];
    for (const readyState of ['loading', 'complete']) {
      let onLoad, delayed, replacements = 0;
      runInNewContext(loader, {
        document: { readyState, querySelector: () => ({ content: { cloneNode: () => 'manifest' }, replaceWith: () => { replacements += 1; } }) },
        window: { addEventListener: (name, handler) => { expect(name).toBe('load'); onLoad = handler; } },
        setTimeout: (handler, delay) => { expect(delay).toBe(200); delayed = handler; },
      });
      expect(replacements).toBe(0);
      if (readyState === 'loading') { expect(delayed).toBeUndefined(); onLoad(); }
      expect(replacements).toBe(0);
      delayed();
      expect(replacements).toBe(1);
    }
  });

  it('rejects partial output, unsupported stylesheet semantics and unsafe CSS through the shared callback', async () => {
    const root = await fixture({ Base: '@import "/other.css";' });
    const options = { relativePath: 'es/today/index.html', root, inlineStyles: inlineCriticalStyles };
    await expect(inlineLocaleRoute(page(['Base', 'LocalizedToday']), options)).rejects.toThrow('@import');
    await expect(inlineLocaleRoute(page(['Base']), options)).rejects.toThrow('expected Base, LocalizedToday');
    await expect(inlineLocaleRoute(page(['Base', 'LocalizedToday']), { ...options, relativePath: 'ru/index.html' })).rejects.toThrow('outside approved scope');
    const source = page(['Base', 'LocalizedToday']);
    await expect(inlineLocaleRoute(source.replace('<link rel="stylesheet"', '<link media="print" rel="stylesheet"'), options)).rejects.toThrow('unsupported stylesheet attributes');
    await expect(inlineLocaleRoute(source.replace('/_astro/Base.hash.css', '/_astro/../Base.hash.css'), options)).rejects.toThrow('expected Base, LocalizedToday');
    await expect(inlineLocaleRoute(source.replace('<link rel="stylesheet" href="/_astro/Base.hash.css">', '<style data-zdx-locale-critical="Base.hash.css">x</style>'), options)).rejects.toThrow('expected Base, LocalizedToday');
    const inert = `<template><link rel="stylesheet" href="/_astro/Base.hash.css"></template>`;
    await expect(inlineLocaleRoute(source.replace('</head>', `${inert}</head>`), options)).rejects.toThrow('unexpected inert stylesheet');
  });

  it('validates all selected output before writing and leaves excluded Russian pages unchanged', async () => {
    const root = await fixture();
    for (const plan of LOCALE_ROUTE_PLANS) {
      const path = join(root, plan.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, page(plan.stylesheets));
    }
    const first = join(root, LOCALE_ROUTE_PLANS[0].path);
    const original = await readFile(first, 'utf8');
    const last = join(root, LOCALE_ROUTE_PLANS.at(-1).path);
    await writeFile(last, page(['Base']));
    await expect(inlineLocaleRoutes(root, inlineCriticalStyles)).rejects.toThrow('expected Base, LocalizedToday');
    expect(await readFile(first, 'utf8')).toBe(original);
    await writeFile(last, page(LOCALE_ROUTE_PLANS.at(-1).stylesheets));
    const excluded = join(root, 'ru/index.html');
    await mkdir(dirname(excluded), { recursive: true });
    await writeFile(excluded, '<html>untouched</html>');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const flagged = LOCALE_ROUTE_PLANS.find(({ path }) => path === 'es/birth-chart/index.html');
    await writeFile(join(root, flagged.path), page([...flagged.stylesheets, 'account']));
    expect(await inlineLocaleRoutes(root, inlineCriticalStyles)).toMatchObject({ pages: 10, changedPages: 10, stylesheets: 20, keptStylesheets: 9 });
    expect(await readFile(excluded, 'utf8')).toBe('<html>untouched</html>');
    expect(await inlineLocaleRoutes(root, inlineCriticalStyles)).toMatchObject({ pages: 10, changedPages: 0, stylesheets: 20, keptStylesheets: 9 });
  });
});
