/* Postbuild delivery changes for the measured translated entry templates. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const latinLocales = ['es', 'pt', 'fr', 'it'];
const marker = 'data-zdx-locale-critical';
const monoSource = '/fonts/jetbrains-mono-latin-wght-normal.woff2';
const mono400 = '/assets/locale/jetbrains-mono-latin-400-normal.woff2';
const manifestMarker = 'data-zdx-locale-manifest';
const manifestLoader = `<script data-zdx-locale-manifest-loader>
(function () {
  var activate = function () {
    var template = document.querySelector('template[${manifestMarker}]');
    if (template) template.replaceWith(template.content.cloneNode(true));
  };
  var schedule = function () { setTimeout(activate, 200); };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
</script>`;
const families = {
  home: { stylesheets: ['Base', 'LocalizedHomeHead'], keepLinked: ['LocalizedHomeHead'], subsetMono: true, deferManifest: true },
  // Account saving is a production-only dependency of the shared calculator.
  // Astro can emit its stylesheet even when the localized result hides that
  // control. Keep that optional link unchanged, wherever Astro placed it.
  'birth-chart': { stylesheets: ['Base', 'calculator', 'explorer', 'ChartActionDock'], keepLinked: ['calculator'], optionalLinked: ['account'], deferManifest: true },
  today: { stylesheets: ['Base', 'LocalizedToday'], deferManifest: true },
};

export const LOCALE_ROUTE_PLANS = Object.freeze([
  ...latinLocales.map((locale) => [`${locale}/index.html`, 'home']),
  ...latinLocales.map((locale) => [`${locale}/birth-chart/index.html`, 'birth-chart']),
  ...['es', 'pt'].map((locale) => [`${locale}/today/index.html`, 'today']),
].map(([path, family]) => Object.freeze({
  path,
  stylesheets: Object.freeze([...families[family].stylesheets]),
  keepLinked: Object.freeze([...(families[family].keepLinked ?? [])]),
  optionalLinked: Object.freeze([...(families[family].optionalLinked ?? [])]),
  subsetMono: families[family].subsetMono === true,
  deferManifest: families[family].deferManifest === true,
})));

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

function declaration(face, property) {
  const match = face.match(new RegExp(`${property}\\s*:\\s*(?:"([^"]+)"|'([^']+)'|([^;}]+))`, 'i'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function normalMonoFaces(css) {
  return [...css.matchAll(/@font-face\s*\{[^{}]*\}/gi)].map(([face]) => face).filter((face) => (
    declaration(face, 'font-family') === 'JetBrains Mono'
    && (declaration(face, 'font-style') || 'normal') === 'normal'
    && (face.includes(monoSource) || face.includes(mono400))
  ));
}

function useHomeMono400(html) {
  const blocks = [...html.matchAll(/(<style\b[^>]*\bdata-zdx-locale-critical=["']Base\.[A-Za-z0-9_-]+\.css["'][^>]*>)([\s\S]*?)(<\/style>)/gi)];
  if (blocks.length !== 1) throw new Error('inline-locale-routes: expected one home Base style');
  const block = blocks[0];
  const faces = normalMonoFaces(block[2]);
  if (faces.some((face) => face.includes(mono400))) {
    const weights = faces.map((face) => declaration(face, 'font-weight').replace(/\s+/gu, ' '));
    const sourceFormat = faces[0].match(/format\(\s*(['"]?)woff2-variations\1\s*\)/i)?.[0];
    const normalized = faces.map((face) => face.replace(mono400, monoSource)
      .replace(/format\(\s*(['"]?)woff2\1\s*\)/i, sourceFormat ?? '')
      .replace(/(font-weight\s*:\s*)[^;}]+/i, (_, prefix) => `${prefix}300 600`));
    if (faces.length !== 2 || weights.join(',') !== '300 600,400' || !sourceFormat
      || !faces[0].includes(monoSource) || !faces[1].includes(mono400)
      || !/format\(\s*(['"]?)woff2\1\s*\)/i.test(faces[1])
      || normalized.some((face) => face !== normalized[0])) {
      throw new Error('inline-locale-routes: unexpected home mono subset shape');
    }
    return html;
  }
  if (faces.length !== 1 || declaration(faces[0], 'font-weight').replace(/\s+/gu, ' ') !== '300 600') {
    throw new Error('inline-locale-routes: expected one unaliased normal mono face at weight 300 600');
  }
  const face = faces[0];
  if (!/format\(\s*(['"]?)woff2-variations\1\s*\)/i.test(face)) throw new Error('inline-locale-routes: normal mono face lost its variable format');
  const replacement = face + face.replace(/(font-weight\s*:\s*)[^;}]+/i, (_, prefix) => `${prefix}400`)
    .replace(monoSource, mono400).replace(/woff2-variations/gi, 'woff2');
  return html.replace(block[0], `${block[1]}${block[2].replace(face, replacement)}${block[3]}`);
}

function manifestLinks(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag)
    .filter((tag) => attribute(tag, 'rel')?.toLowerCase() === 'manifest');
}

function deferManifest(html) {
  const links = manifestLinks(html);
  if (html.includes(manifestMarker)) {
    if (links.length !== 2 || links[0] !== links[1]
      || attribute(links[0], 'href') !== '/site.webmanifest'
      || !html.includes(`<template ${manifestMarker}>${links[0]}</template><noscript>${links[0]}</noscript>`)
      || (html.match(/<script\b[^>]*\bdata-zdx-locale-manifest-loader\b/gi)?.length ?? 0) !== 1
      || html.split(manifestLoader).length !== 2) {
      throw new Error('inline-locale-routes: unexpected deferred manifest shape');
    }
    return html;
  }
  if (links.length !== 1 || attribute(links[0], 'href') !== '/site.webmanifest' || !html.includes('</head>')) {
    throw new Error('inline-locale-routes: expected one site manifest and a closing head');
  }
  return html.replace(links[0], `<template ${manifestMarker}>${links[0]}</template><noscript>${links[0]}</noscript>`)
    .replace('</head>', `${manifestLoader}</head>`);
}

function stylesheetIdentity(name) {
  return name.match(/^([A-Za-z][A-Za-z0-9_-]*)\.[A-Za-z0-9_-]+\.css$/u)?.[1] ?? null;
}

function deliveryShape(html) {
  const shape = { links: [], styles: [], inertLinks: [], order: [] };
  const inert = [];
  const tokens = /<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?(?:template|noscript)\b[^>]*>|<link\b[^>]*>/gi;
  for (const [token] of html.matchAll(tokens)) {
    const tag = token.match(/^<[^>]+>/u)?.[0] ?? '';
    const container = tag.match(/^<(\/)?(template|noscript)\b/i);
    if (container) {
      if (container[1]) inert.pop();
      else inert.push(container[2].toLowerCase());
    } else if (/^<style\b/i.test(tag) && attribute(tag, marker)) {
      shape.styles.push(tag);
      shape.order.push(stylesheetIdentity(attribute(tag, marker)));
    } else if (/^<link\b/i.test(tag) && attribute(tag, 'rel')?.toLowerCase() === 'stylesheet') {
      shape[inert.length ? 'inertLinks' : 'links'].push(tag);
      if (!inert.length) shape.order.push(linkIdentity(tag));
    }
  }
  return shape;
}

function requireIdentities(actual, expected, path) {
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error(`inline-locale-routes: ${path} expected ${expected.join(', ')}, found ${actual.join(', ')}`);
  }
}

function validateStylesheetOrder(order, plan) {
  requireIdentities(order.filter((name) => !plan.optionalLinked.includes(name)), plan.stylesheets, plan.path);
  for (const optional of plan.optionalLinked) {
    if (order.filter((name) => name === optional).length > 1) {
      throw new Error(`inline-locale-routes: duplicate optional ${optional} stylesheet at ${plan.path}`);
    }
  }
}

function validateOutput(shape, plan, originalOrder) {
  validateStylesheetOrder(shape.order, plan);
  if (originalOrder) requireIdentities(shape.order, originalOrder, plan.path);
  requireIdentities(shape.styles.map((tag) => stylesheetIdentity(attribute(tag, marker))), plan.stylesheets.filter((name) => !plan.keepLinked.includes(name)), plan.path);
  const linked = shape.order.filter((name) => plan.keepLinked.includes(name) || plan.optionalLinked.includes(name));
  requireIdentities(shape.links.map(linkIdentity), linked, plan.path);
  if (shape.inertLinks.length > 0) {
    throw new Error(`inline-locale-routes: unexpected transformed output at ${plan.path}`);
  }
}

function linkIdentity(tag) {
  const href = attribute(tag, 'href');
  return href?.startsWith('/_astro/') ? stylesheetIdentity(href.slice('/_astro/'.length)) : null;
}

function finishRoute(html, plan) {
  let output = plan.subsetMono ? useHomeMono400(html) : html;
  if (plan.deferManifest) output = deferManifest(output);
  return output;
}

/** Reuse the existing CSS safety checks through an injected callback. */
export async function inlineLocaleRoute(html, { relativePath, root, inlineStyles }) {
  const plan = LOCALE_ROUTE_PLANS.find(({ path }) => path === relativePath);
  if (!plan) throw new Error(`inline-locale-routes: route outside approved scope: ${relativePath}`);
  if (/<html\b[^>]*\bdata-inline-critical-css\b/i.test(html)
    || /<style\b[^>]*\bdata-zdx-critical=/i.test(html)) {
    throw new Error(`inline-locale-routes: existing inliner owns ${relativePath}`);
  }
  const shape = deliveryShape(html);
  const { links, styles } = shape;
  // The callback cannot preserve media, disabled, or alternate link semantics.
  for (const tag of links) {
    const rest = tag.replace(/^<link\b/i, '').replace(/\/?\s*>$/u, '')
      .replace(/\s+(?:rel|href)=["'][^"']*["']/gi, '').trim();
    if (rest) throw new Error(`inline-locale-routes: unsupported stylesheet attributes at ${relativePath}`);
  }
  if (styles.length > 0) {
    validateOutput(shape, plan);
    const output = finishRoute(html, plan);
    return { html: output, changed: output !== html, stylesheets: styles.length, keptStylesheets: links.length, bytes: 0 };
  }
  const allLinks = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(([tag]) => attribute(tag, 'rel')?.toLowerCase() === 'stylesheet');
  if (allLinks.length !== links.length) throw new Error(`inline-locale-routes: unexpected inert stylesheet at ${relativePath}`);
  const originalOrder = links.map(linkIdentity);
  validateStylesheetOrder(originalOrder, plan);
  if (!/<html\b[^>]*>/i.test(html)) throw new Error(`inline-locale-routes: missing html element at ${relativePath}`);
  if (html.includes('<!--zdx-locale-kept-')) throw new Error('inline-locale-routes: stale kept stylesheet placeholder');
  const kept = links.filter((tag) => plan.keepLinked.includes(linkIdentity(tag)) || plan.optionalLinked.includes(linkIdentity(tag)));
  let stashed = html;
  for (const [index, tag] of kept.entries()) stashed = stashed.replace(tag, `<!--zdx-locale-kept-${index}-->`);
  const result = await inlineStyles(stashed.replace(/<html\b/i, '<html data-inline-critical-css'), root);
  let inlined = result.html.replace(/(<style\b[^>]*\s)data-zdx-critical=/gi, `$1${marker}=`);
  for (const [index, tag] of kept.entries()) inlined = inlined.replace(`<!--zdx-locale-kept-${index}-->`, tag);
  const output = finishRoute(inlined, plan);
  if (result.stylesheets !== plan.stylesheets.length - plan.keepLinked.length || /<html\b[^>]*\bdata-inline-critical-css\b/i.test(output)) {
    throw new Error(`inline-locale-routes: unexpected transformed output at ${relativePath}`);
  }
  validateOutput(deliveryShape(output), plan, originalOrder);
  return { html: output, changed: true, stylesheets: result.stylesheets, keptStylesheets: kept.length, bytes: result.bytes };
}

/** Validate all routes before writing any HTML. */
export async function inlineLocaleRoutes(root, inlineStyles) {
  const outputs = [];
  for (const { path } of LOCALE_ROUTE_PLANS) {
    const file = resolve(root, path);
    const result = await inlineLocaleRoute(await readFile(file, 'utf8'), { relativePath: path, root, inlineStyles });
    outputs.push({ file, ...result });
  }
  for (const result of outputs) if (result.changed) await writeFile(result.file, result.html);
  const summary = {
    pages: outputs.length,
    changedPages: outputs.filter(({ changed }) => changed).length,
    stylesheets: outputs.reduce((sum, result) => sum + result.stylesheets, 0),
    keptStylesheets: outputs.reduce((sum, result) => sum + result.keptStylesheets, 0),
    bytes: outputs.reduce((sum, result) => sum + result.bytes, 0),
  };
  console.log(`inline-locale-routes: ${summary.stylesheets} stylesheets ${summary.changedPages ? 'inlined' : 'already inlined'} across ${summary.pages} locale pages`);
  return summary;
}
