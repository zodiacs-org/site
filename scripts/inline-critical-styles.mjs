/*
 * Inline the emitted CSS only for entry pages whose mobile LCP is dominated by
 * stylesheet round trips. Astro still owns bundling and minification; this
 * postbuild pass changes delivery, not the stylesheet contents. Keeping the
 * opt-in marker on the page avoids duplicating CSS across the programmatic
 * catalogue and preserves shared-cache behavior everywhere else.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(repo, 'dist');
const marker = 'data-inline-critical-css';
const stableChromeMarker = 'data-stable-chrome-typography';
const localChromeMarker = 'data-local-chrome-typography';
const linkPattern = /<link\b[^>]*>/gi;
const criticalStylePattern = /<style\b[^>]*\bdata-zdx-critical=["'][^"']+["'][^>]*>/gi;
const deferredStylePattern = /<template\b[^>]*\bdata-zdx-deferred-style\b[^>]*>/gi;
const deferredStyleLoader = `<script data-zdx-deferred-style-loader>
    (function () {
      var active = false;
      var fallback;
      var events = ['pointerover', 'pointerdown', 'focusin', 'keydown'];
      var activate = function () {
        if (active) return;
        active = true;
        if (fallback) clearTimeout(fallback);
        for (var eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
          document.removeEventListener(events[eventIndex], onIntent, true);
        }
        var templates = document.querySelectorAll('template[data-zdx-deferred-style]');
        for (var index = 0; index < templates.length; index += 1) {
          templates[index].replaceWith(templates[index].content.cloneNode(true));
        }
      };
      var onIntent = function (event) {
        if (event.target && event.target.closest && event.target.closest('astro-island')) activate();
      };
      for (var index = 0; index < events.length; index += 1) {
        document.addEventListener(events[index], onIntent, true);
      }
      var schedule = function () { fallback = setTimeout(activate, 200); };
      if (document.readyState === 'complete') schedule();
      else window.addEventListener('load', schedule, { once: true });
      if (/(?:^|[&#])(?:p|c)=/.test(window.location.hash)) activate();
    })();
  </script>`;
const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const targetPaths = [
  // The EN homepage keeps only Base plus its route-owned first-paint geometry
  // on the render path. The complete route bundle still loads after first
  // paint (and remains present for no-JS readers), so below-fold styles cannot
  // delay the poster while the settled page keeps its reviewed appearance.
  'index.html',
  'birth-chart/index.html',
  // The lunar-return hero missed LCP with two blocking stylesheet requests.
  'lunar-return/index.html',
  // The numerology hero sat a few hundredths over the LCP budget in CI with
  // calculator.css on the render path and an eagerly hydrated island.
  'numerology/index.html',
  // Sign-guide icons need their existing geometry before the first paint;
  // the two stylesheet round trips put a cold mobile LCP over the budget.
  ...signs.map((sign) => `${sign}/index.html`),
  'today/index.html',
  ...signs.map((sign) => `horoscopes/${sign}/index.html`),
  // Compact love/career heroes make the sign icon their mobile LCP. Keep
  // their existing stylesheet contents on the same delivery path as Daily.
  ...signs.flatMap((sign) => ['love', 'career'].map((surface) => `horoscopes/${sign}/${surface}/index.html`)),
  'ru/index.html',
  'ru/birth-chart/index.html',
];

/**
 * Entry pages inline the styles required for above-fold geometry and defer
 * the rest. The homepage and RU calculator need Base only; the EN calculator
 * also keeps calculator.css on the render path. No-JS copies remain ordinary
 * stylesheets, so the settled page is unchanged.
 */
const deferNonBaseConfig = new Map([
  ['index.html', {
    select: /^Base\.[A-Za-z0-9_-]+\.css$/u,
    shape: { inline: 1, deferred: 1, external: 2 },
  }],
  ['birth-chart/index.html', {
    select: /^(?:Base|calculator)\.[A-Za-z0-9_-]+\.css$/u,
    shape: { inline: 2, deferred: 2, external: 4 },
  }],
  ['ru/birth-chart/index.html', {
    select: /^Base\.[A-Za-z0-9_-]+\.css$/u,
    shape: { inline: 1, deferred: 3, external: 6 },
  }],
]);

export async function htmlFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    // Astro may remove a transient prerender staging directory between the
    // parent readdir and the recursive walk. It is not part of the deployable
    // output, so a vanished directory is equivalent to an empty one.
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  }));
  return nested.flat();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
}

function htmlAttributePattern(name) {
  return new RegExp(
    `\\s${name}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=\\s|>)`,
    'i',
  );
}

function openingHtmlTag(html) {
  return html.match(/<html\b[^>]*>/i)?.[0] ?? '';
}

function hasHtmlAttribute(html, name) {
  return htmlAttributePattern(name).test(openingHtmlTag(html));
}

function removeHtmlAttribute(html, name) {
  const tag = openingHtmlTag(html);
  if (!tag) return html;
  return html.replace(tag, tag.replace(htmlAttributePattern(name), ''));
}

export function expectedStylesheetShape(relativePath, deferNonBase) {
  if (deferNonBase) {
    const shape = deferNonBaseConfig.get(relativePath)?.shape;
    const deferredCount = shape?.deferred ?? 3;
    return {
      inlineCount: shape?.inline ?? 1,
      deferredCount,
      externalCount: shape?.external ?? deferredCount * 2,
      loaderCount: 1,
    };
  }
  return {
    inlineCount: 2,
    deferredCount: 0,
    externalCount: 0,
    loaderCount: 0,
  };
}

function assertSafeCss(css, href) {
  if (/@import\b/i.test(css)) {
    throw new Error(`inline-critical-styles: @import is not safe to relocate from ${href}`);
  }
  if (/<\/style/i.test(css)) {
    throw new Error(`inline-critical-styles: unsafe style terminator in ${href}`);
  }
  for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi)) {
    const url = (match[2] ?? match[3] ?? '').trim();
    if (url && !url.startsWith('/') && !url.startsWith('#') && !url.startsWith('data:')) {
      throw new Error(`inline-critical-styles: relative CSS URL ${url} in ${href}`);
    }
  }
}

const stableChromeFaces = new Map([
  ['Instrument Sans', '/fonts/instrument-sans-latin-wght-normal.woff2'],
  ['EB Garamond:400', '/fonts/eb-garamond-latin-400-normal.woff2'],
  ['EB Garamond:500', '/fonts/eb-garamond-latin-500-normal.woff2'],
  ['JetBrains Mono', '/fonts/jetbrains-mono-latin-wght-normal.woff2'],
]);
const homepageSubsetFaces = new Map([
  ['Instrument Sans', {
    source: '/fonts/instrument-sans-latin-wght-normal.woff2',
    subset: '/assets/home/instrument-sans-home-nav-core.woff2',
  }],
  ['EB Garamond:400', {
    source: '/fonts/eb-garamond-latin-400-normal.woff2',
    subset: '/assets/home/eb-garamond-home-400-core.woff2',
  }],
  ['EB Garamond:500', {
    source: '/fonts/eb-garamond-latin-500-normal.woff2',
    subset: '/assets/home/eb-garamond-home-500-nav-core.woff2',
  }],
  ['JetBrains Mono', {
    source: '/fonts/jetbrains-mono-latin-wght-normal.woff2',
    subset: '/assets/home/jetbrains-mono-home-nav-core.woff2',
  }],
]);

function declarationValue(face, property) {
  const match = face.match(new RegExp(`${property}\\s*:\\s*(?:"([^"]+)"|'([^']+)'|([^;}]+))`, 'i'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function stabilizeChromeFontDisplay(css) {
  let changes = 0;
  const output = css.replace(/@font-face\s*\{[^{}]*\}/gi, (face) => {
    const family = declarationValue(face, 'font-family');
    const weight = declarationValue(face, 'font-weight');
    const key = family === 'EB Garamond' ? `${family}:${weight}` : family;
    const expectedSource = stableChromeFaces.get(key);
    if (!expectedSource || !face.includes(expectedSource)) return face;

    const transformed = face.replace(/(font-display\s*:\s*)swap\b/i, '$1optional');
    if (transformed !== face) changes += 1;
    return transformed;
  });
  return { css: output, changes };
}

function useHomepageFontSubsets(css) {
  let changes = 0;
  const output = css.replace(/@font-face\s*\{[^{}]*\}/gi, (face) => {
    const family = declarationValue(face, 'font-family');
    const weight = declarationValue(face, 'font-weight');
    const key = family === 'EB Garamond' ? `${family}:${weight}` : family;
    const replacement = homepageSubsetFaces.get(key);
    if (!replacement || !face.includes(replacement.source)) return face;
    if (!/font-display\s*:\s*swap\b/i.test(face)) {
      throw new Error(`inline-critical-styles: homepage face ${key} lost its swap source contract`);
    }

    changes += 1;
    return face
      .replace(replacement.source, replacement.subset)
      .replace(/(font-display\s*:\s*)swap\b/i, '$1optional');
  });
  return { css: output, changes };
}

export async function inlineCriticalStyles(
  html,
  root = distRoot,
  { deferNonBase = false, subsetHomepageFonts = false } = {},
) {
  if (!hasHtmlAttribute(html, marker)) return { html, stylesheets: 0, bytes: 0 };

  const stabilizeChrome = hasHtmlAttribute(html, stableChromeMarker);
  if (stabilizeChrome && subsetHomepageFonts) {
    throw new Error('inline-critical-styles: stable chrome and homepage subsets are mutually exclusive');
  }
  if (subsetHomepageFonts && !hasHtmlAttribute(html, localChromeMarker)) {
    throw new Error('inline-critical-styles: homepage subsets require the local-chrome delivery marker');
  }

  const stylesheetTags = [...html.matchAll(linkPattern)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, 'rel')?.toLowerCase() === 'stylesheet');
  if (stylesheetTags.length === 0) {
    throw new Error('inline-critical-styles: marked page has no stylesheet links');
  }
  for (const tag of stylesheetTags) {
    const href = attribute(tag, 'href');
    if (!href?.startsWith('/_astro/') || !href.endsWith('.css')) {
      throw new Error(`inline-critical-styles: refusing non-build stylesheet ${href ?? '(missing href)'}`);
    }
    const cssPath = resolve(root, `.${href}`);
    const astroRoot = resolve(root, '_astro') + sep;
    if (!cssPath.startsWith(astroRoot)) {
      throw new Error(`inline-critical-styles: stylesheet escaped build root: ${href}`);
    }
  }

  const selectPattern = deferNonBase instanceof RegExp
    ? deferNonBase
    : /^Base\.[A-Za-z0-9_-]+\.css$/u;
  const selectedTags = deferNonBase
    ? stylesheetTags.filter((tag) => {
      const href = attribute(tag, 'href');
      return href ? selectPattern.test(basename(href)) : false;
    })
    : stylesheetTags;
  const deferredTags = deferNonBase
    ? stylesheetTags.filter((tag) => !selectedTags.includes(tag))
    : [];
  if (deferNonBase && (selectedTags.length === 0 || deferredTags.length === 0)) {
    throw new Error(
      `inline-critical-styles: expected inlined entry styles plus deferred tool styles, found ${selectedTags.length} + ${deferredTags.length}`,
    );
  }

  let output = html;
  let bytes = 0;
  let stabilizedChromeFaces = 0;
  let subsetHomepageFaces = 0;
  for (const tag of selectedTags) {
    const href = attribute(tag, 'href');
    const cssPath = resolve(root, `.${href}`);
    const sourceCss = await readFile(cssPath, 'utf8');
    const stableResult = stabilizeChrome
      ? stabilizeChromeFontDisplay(sourceCss)
      : { css: sourceCss, changes: 0 };
    const subsetResult = subsetHomepageFonts
      ? useHomepageFontSubsets(stableResult.css)
      : { css: stableResult.css, changes: 0 };
    const css = subsetResult.css;
    stabilizedChromeFaces += stableResult.changes;
    subsetHomepageFaces += subsetResult.changes;
    assertSafeCss(css, href);
    bytes += Buffer.byteLength(css);
    output = output.replace(
      tag,
      `<style data-zdx-critical="${basename(href)}">${css}</style>`,
    );
  }

  if (stabilizeChrome && stabilizedChromeFaces !== stableChromeFaces.size) {
    throw new Error(
      `inline-critical-styles: expected ${stableChromeFaces.size} stable chrome faces, found ${stabilizedChromeFaces}`,
    );
  }
  if (subsetHomepageFonts && subsetHomepageFaces !== homepageSubsetFaces.size) {
    throw new Error(
      `inline-critical-styles: expected ${homepageSubsetFaces.size} homepage subset faces, found ${subsetHomepageFaces}`,
    );
  }

  for (const tag of deferredTags) {
    output = output.replace(
      tag,
      `<template data-zdx-deferred-style>${tag}</template><noscript>${tag}</noscript>`,
    );
  }
  if (deferredTags.length > 0) {
    if (!output.includes('</head>')) {
      throw new Error('inline-critical-styles: cannot install deferred-style loader without </head>');
    }
    output = output.replace('</head>', `${deferredStyleLoader}</head>`);
  }

  output = removeHtmlAttribute(output, marker);
  output = removeHtmlAttribute(output, stableChromeMarker);
  return { html: output, stylesheets: selectedTags.length, bytes };
}

async function main() {
  let pages = 0;
  let alreadyInlined = 0;
  let stylesheets = 0;
  let bytes = 0;
  const allPaths = await htmlFiles(distRoot);
  const markedOutsideScope = allPaths.filter((path) => {
    const relativePath = path.slice(distRoot.length + 1).split(sep).join('/');
    return !targetPaths.includes(relativePath);
  });
  for (const path of markedOutsideScope) {
    const source = await readFile(path, 'utf8');
    if (hasHtmlAttribute(source, marker)) {
      throw new Error(`inline-critical-styles: marker outside approved scope: ${path}`);
    }
  }

  for (const relativePath of targetPaths) {
    const path = resolve(distRoot, relativePath);
    const source = await readFile(path, 'utf8');
    const deferConfig = deferNonBaseConfig.get(relativePath);
    if (hasHtmlAttribute(source, stableChromeMarker) && relativePath !== 'today/index.html') {
      throw new Error(`inline-critical-styles: stable chrome marker outside Today: ${relativePath}`);
    }
    if (!hasHtmlAttribute(source, marker)) {
      const inlineCount = source.match(criticalStylePattern)?.length ?? 0;
      const externalCount = [...source.matchAll(linkPattern)]
        .map((match) => match[0])
        .filter((tag) => attribute(tag, 'rel')?.toLowerCase() === 'stylesheet')
        .length;
      const deferredCount = source.match(deferredStylePattern)?.length ?? 0;
      const loaderCount = source.match(/data-zdx-deferred-style-loader/g)?.length ?? 0;
      const {
        inlineCount: expectedInlineCount,
        deferredCount: expectedDeferredCount,
        externalCount: expectedExternalCount,
        loaderCount: expectedLoaderCount,
      } = expectedStylesheetShape(relativePath, Boolean(deferConfig));
      if (
        inlineCount !== expectedInlineCount
        || deferredCount !== expectedDeferredCount
        || externalCount !== expectedExternalCount
        || loaderCount !== expectedLoaderCount
      ) {
        throw new Error(
          `inline-critical-styles: ${relativePath} has an unexpected inline/external stylesheet shape`,
        );
      }
      alreadyInlined += 1;
      stylesheets += inlineCount;
      continue;
    }
    const result = await inlineCriticalStyles(source, distRoot, {
      deferNonBase: deferConfig?.select,
      subsetHomepageFonts: relativePath === 'index.html',
    });
    await writeFile(path, result.html);
    pages += 1;
    stylesheets += result.stylesheets;
    bytes += result.bytes;
  }
  if (pages + alreadyInlined !== 55 || stylesheets !== 108) {
    throw new Error(
      `inline-critical-styles: expected 55 pages / 108 inlined stylesheets, found ${pages + alreadyInlined} / ${stylesheets}`,
    );
  }
  const state = pages > 0
    ? `${stylesheets} stylesheets inlined across ${pages} entry pages · ${(bytes / 1024).toFixed(1)} KB`
    : `${stylesheets} stylesheets already inlined across ${alreadyInlined} entry pages`;
  console.log(`inline-critical-styles: ${state}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
