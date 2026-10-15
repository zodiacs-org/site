/*
 * A page whose rendered content changes needs a new sitemap date (F-97).
 *
 *   node scripts/sitemap-rendered-changes.mjs fingerprint <dist> <out.json>
 *   node scripts/sitemap-rendered-changes.mjs compare <base.json> <head.json>
 *     [--today YYYY-MM-DD] [--explain <base dist> <head dist>] [--summary <file>]
 *
 * IndexNow Changes (.github/workflows/indexnow-changes.yml) submits a page as
 * changed only when its <lastmod> in the live sitemap changes, and
 * src/pages/sitemap.xml.ts keeps many of those dates by hand. #740 and #742
 * changed three developer pages without re-dating them, so IndexNow was never
 * told. .github/workflows/sitemap-dates.yml builds a pull request's base and
 * head under one pinned clock (scripts/frozen-clock.mjs), fingerprints every
 * page of each build's sitemap and compares them: a page whose content
 * changed while its <lastmod> did not fails the check.
 *
 * A page's content here is what a reader or a search engine gets from it: its
 * <title>, its meta description, and the text, link targets and image
 * descriptions of its <main> (of <body> when it has no <main>), with scripts,
 * styles and comments left out, the copy its attributes carry, the files its
 * media show and the words its stylesheets add there (pageContent). Navigation,
 * the footer and the head's other tags are left out, so a site-wide header
 * change re-dates nothing. Any other file the sitemap lists counts by its bytes.
 *
 * This file imports nothing from the repository: the workflow runs one copy of
 * it on both builds, the base's included.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA = 'zodiacs.sitemap-rendered.v2';
const ORIGIN = 'https://zodiacs.org';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the character references this site's HTML and XML use. */
export function decodeEntities(text) {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (whole, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** Maps each sitemap <loc>'s path to its <lastmod> (null when it has none). */
export function sitemapDates(xml) {
  if (!/<urlset\b/u.test(xml)) throw new Error('The sitemap has no <urlset>.');
  const dates = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/gu)) {
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/u)?.[1];
    if (!loc) throw new Error('A sitemap entry has no <loc>.');
    const url = new URL(decodeEntities(loc));
    if (url.origin !== ORIGIN) throw new Error(`A sitemap <loc> is not on ${ORIGIN}: ${loc}`);
    if (dates.has(url.pathname)) throw new Error(`The sitemap lists ${url.pathname} twice.`);
    dates.set(url.pathname, block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/u)?.[1] ?? null);
  }
  return dates;
}

function attributes(tag) {
  const found = {};
  for (const [, name, , doubleQuoted, singleQuoted, bare] of tag.matchAll(/([a-z][a-z0-9:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/giu)) {
    found[name.toLowerCase()] = decodeEntities(doubleQuoted ?? singleQuoted ?? bare);
  }
  return found;
}

const squeeze = (text) => text.replace(/\s+/gu, ' ').trim();

// Copy a reader sees or hears that lives in an attribute: a field's placeholder, an icon button's accessible name, a
// tooltip, a button input's label, a text field's value, and a responsive table's data-label, which the site's
// stylesheets show with `content: attr(data-label)` (a test holds every attribute they show to this list).
export const LABEL_ATTRIBUTES = ['placeholder', 'aria-label', 'aria-description', 'title', 'label', 'data-label'];
const SHOWN_INPUT_VALUES = /^(?:|text|search|email|url|tel|number|submit|button|reset)$/iu;
// Where a media element names the file it shows; the site lazy-loads with data-src (a test holds the site to this list).
export const MEDIA_ATTRIBUTES = ['src', 'srcset', 'poster', 'data', 'data-src', 'data-srcset', 'data-poster'];

/** Where the quoted string starting at `start` ends (its closing quote), backslash escapes read as one. */
function stringEnd(text, start) {
  let end = start + 1;
  while (end < text.length && text[end] !== text[start]) end += text[end] === '\\' ? 2 : 1;
  return Math.min(end, text.length - 1);
}

/** Calls `visit(character, index, depth)` for each character of CSS outside strings and escapes; depth counts brackets. */
function scanCss(text, visit) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '"' || character === "'") i = stringEnd(text, i);
    else if (character === '\\') i += 1;
    else {
      if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
      visit(character, i, depth);
      if (character === '(' || character === '[') depth += 1;
    }
  }
}

/** A selector list's selectors: split at its own commas, not those inside parentheses, brackets or strings. */
function selectorList(selector) {
  const cuts = [];
  scanCss(selector, (character, index, depth) => { if (character === ',' && depth === 0) cuts.push(index); });
  return [-1, ...cuts].map((cut, at) => squeeze(selector.slice(cut + 1, cuts[at] ?? selector.length))).filter(Boolean);
}

// A class selector's name: an identifier, whose characters may be escaped (`.sm\:wide`, `.\31 0`).
const ESCAPE = String.raw`\\(?:[0-9a-f]{1,6}[ \t\n]?|[\s\S])`;
const CLASS_NAME = new RegExp(String.raw`\.((?:--|-?(?:[_a-z]|[^\x00-\x7f]|${ESCAPE}))(?:[\w-]|[^\x00-\x7f]|${ESCAPE})*)`, 'giu');
const unescapeCss = (name) => name.replace(/\\([0-9a-f]{1,6})[ \t\n]?|\\([\s\S])/giu, (whole, hex, character) => {
  if (character !== undefined) return character;
  const code = Number.parseInt(hex, 16);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\uFFFD';
});

/**
 * The classes a selector requires, unescaped: those outside strings, attribute selectors and the arguments of
 * functional pseudo-classes (:not(), :is(), :where(), :has() and the like, which a page may meet without them).
 */
function requiredClasses(selector) {
  let plain = selector.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/gu, ' ').replace(/\[[^\]]*\]/gu, ' ');
  for (let previous = ''; previous !== plain;) {
    previous = plain;
    plain = plain.replace(/::?[a-z-]+\([^()]*\)/giu, ' ');
  }
  return [...plain.matchAll(CLASS_NAME)].map(([, found]) => unescapeCss(found));
}

/**
 * A stylesheet's rules, each with its selector (or at-rule prelude), its own declarations and the rules around it:
 * at-rules such as `@media (max-width: 640px)`, and the rule a nested rule sits in. Comments are dropped and quoted
 * strings are read whole, so a brace inside either does not count; a statement before a rule, such as `@import …;`
 * or a declaration of the rule it is nested in, is not part of its selector.
 */
function cssRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, ' ');
  const rules = [];
  const open = [];
  let start = 0;
  const statementsEnd = (chunk) => {
    let end = -1;
    scanCss(chunk, (character, index, depth) => { if (character === ';' && depth === 0) end = index; });
    return end;
  };
  scanCss(text, (character, index) => {
    if (character === '{') {
      const chunk = text.slice(start, index);
      const end = statementsEnd(chunk);
      if (open.length) open[open.length - 1].block += chunk.slice(0, end + 1);
      open.push({ prelude: squeeze(chunk.slice(end + 1)), block: '' });
      start = index + 1;
    } else if (character === '}') {
      const rule = open.pop();
      if (rule) {
        rule.block += text.slice(start, index);
        if (rule.block.trim()) rules.push({ context: open.map(({ prelude }) => prelude), selector: rule.prelude, block: rule.block });
      }
      start = index + 1;
    }
  });
  return rules;
}

/**
 * The words a stylesheet adds with `content`: each content declaration holding a quoted string with a letter, kept
 * whole (so the order of its parts counts), with its rule's selector and the rules around it (so a word moved between
 * two states, into another media query or under another parent rule is a change), and, for each way the selectors of
 * its rule and of the style rules around it can match, the classes that requires.
 */
export function stylesheetCopy(css) {
  const copy = [];
  for (const { context, selector, block } of cssRules(css)) {
    let selectors = [[]];
    for (const prelude of [...context, selector]) {
      const own = prelude.startsWith('@') ? [] : selectorList(prelude).map(requiredClasses);
      if (own.length) selectors = selectors.flatMap((outer) => own.map((inner) => [...outer, ...inner]));
    }
    for (const [, value] of block.matchAll(/(?<![-\w])content\s*:\s*([^;]+)/giu)) {
      const strings = [...value.matchAll(/(["'])((?:\\.|(?!\1)[^\\])*)\1/gu)].map(([, , text]) => text);
      if (!strings.some((text) => /\p{L}/u.test(text))) continue;
      copy.push({ text: squeeze(value), selector: [...context, selector].join(' '), selectors });
    }
  }
  return copy;
}

/** A page's stylesheets: the href of each <link rel="stylesheet">, and the text of each <style> block. */
export function pageStylesheets(html) {
  const hrefs = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/giu)) {
    const found = attributes(tag);
    if (found.href && (found.rel ?? '').toLowerCase().split(/\s+/u).includes('stylesheet')) hrefs.push(found.href);
  }
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)].map(([, css]) => css);
  return { hrefs, inline };
}

const IMPORT = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)|"([^"]*)"|'([^']*)')([^;{}]*)(?:;|$)/giu;
const IMPORT_DEPTH = 8;

/**
 * A stylesheet with the stylesheets it imports (`@import`) read in, each inside the conditions it is imported under,
 * so their words count as the importing sheet's do. `url` is the sheet's own address, which its imports are relative
 * to; a sheet is read once along each chain of imports.
 */
async function withImports(css, url, readStylesheet, seen = new Set([url])) {
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, ' ');
  if (seen.size > IMPORT_DEPTH) return text;
  const imported = await Promise.all([...text.matchAll(IMPORT)].map(async ([, ...groups]) => {
    const target = new URL(groups.slice(0, 5).find((href) => href !== undefined), url).href;
    if (seen.has(target)) return '';
    const sheet = await withImports(await readStylesheet(target), target, readStylesheet, new Set([...seen, target]));
    const conditions = squeeze(groups[5]);
    return conditions ? `@import ${conditions} {${sheet}}` : sheet;
  }));
  return [...imported, text].join('\n');
}

/** The region a page's content is read from: its <main>, or its <body> without one. */
function contentRegion(html) {
  return html.match(/<main\b[\s\S]*?<\/main>/iu)?.[0]
    ?? html.match(/<body\b[\s\S]*?<\/body>/iu)?.[0]
    ?? html;
}

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** The classes of the elements open at `at` in a page, such as the <body> and wrappers its content region sits in. */
function enclosingClasses(html, at) {
  const open = [];
  const before = html.slice(0, at)
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<(script|style|template|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ');
  for (const [tag, closing, name] of before.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/giu)) {
    const element = name.toLowerCase();
    if (closing) {
      const index = open.findLastIndex((entry) => entry.element === element);
      if (index >= 0) open.length = index;
    } else if (!VOID_ELEMENTS.has(element) && !tag.endsWith('/>')) {
      open.push({ element, classes: attributes(tag).class ?? '' });
    }
  }
  return open.flatMap(({ classes }) => classes.split(/\s+/u)).filter(Boolean);
}

/**
 * The words a page's stylesheets add to its content (stylesheetCopy over its linked and inline stylesheets and those
 * they import), each with its rule's selector, sorted and distinct: a word counts when one way its rule can match
 * requires only classes the content's markup, or an element it sits in, carries.
 * `readStylesheet(url)` returns a stylesheet's text by its absolute address: from the build, or for IndexNow Changes
 * from the live site. `page` is the page's own address, which its stylesheets' hrefs are relative to.
 */
export async function generatedCopy(html, readStylesheet, { page = `${ORIGIN}/` } = {}) {
  const { hrefs, inline } = pageStylesheets(html);
  const sheets = await Promise.all([
    ...inline.map((css) => withImports(css, page, readStylesheet, new Set())),
    ...hrefs.map(async (href) => {
      const url = new URL(href, page).href;
      return withImports(await readStylesheet(url), url, readStylesheet);
    }),
  ]);
  const region = contentRegion(html);
  const classes = new Set(enclosingClasses(html, html.indexOf(region)));
  for (const [tag] of region.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/giu)) {
    for (const name of (attributes(tag).class ?? '').split(/\s+/u)) if (name) classes.add(name);
  }
  const shown = sheets.flatMap(stylesheetCopy)
    .filter(({ selectors }) => selectors.some((required) => required.every((name) => classes.has(name))));
  return [...new Set(shown.map(({ selector, text }) => `${selector} → ${text}`))].sort();
}

/**
 * What a page says: title, description, and its main content's text, link targets, image descriptions, the files its
 * media show, and the copy its attributes carry (LABEL_ATTRIBUTES, and the value of an input that shows it); with
 * `generated`, the words its stylesheets add (generatedCopy).
 */
export function pageContent(html, { generated = [] } = {}) {
  const title = squeeze(decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? ''));
  let description = '';
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/giu)) {
    const meta = attributes(tag);
    if (meta.name?.toLowerCase() === 'description') description = squeeze(meta.content ?? '');
  }
  const cleaned = contentRegion(html)
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ');
  const links = [...cleaned.matchAll(/<a\b[^>]*>/giu)].map(([tag]) => attributes(tag).href).filter(Boolean);
  const images = [...cleaned.matchAll(/<img\b[^>]*>/giu)].map(([tag]) => attributes(tag).alt).filter(Boolean).map(squeeze);
  // The files its images, video, audio and frames show, lazy-loaded ones included: a picture swapped under the same
  // description is a change.
  const media = [];
  for (const [tag] of cleaned.matchAll(/<(?:img|source|video|audio|iframe|embed|object)\b[^>]*>/giu)) {
    const found = attributes(tag);
    for (const name of MEDIA_ATTRIBUTES) if (found[name]) media.push(`${name}: ${squeeze(found[name])}`);
  }
  const labels = [];
  for (const [tag, element] of cleaned.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/giu)) {
    const found = attributes(tag);
    for (const name of LABEL_ATTRIBUTES) if (found[name]) labels.push(`${name}: ${squeeze(found[name])}`);
    if (element.toLowerCase() === 'input' && found.value && SHOWN_INPUT_VALUES.test(found.type ?? '')) {
      labels.push(`value: ${squeeze(found.value)}`);
    }
  }
  const text = squeeze(decodeEntities(cleaned.replace(/<[^>]+>/gu, ' ')));
  return { title, description, text, links, images, media, labels, generated };
}

/** The file a sitemap path is served from, as scripts/check-dist.mjs resolves it. */
export function distFile(dist, path) {
  const file = resolve(dist, path.replace(/^\//u, ''));
  return path.endsWith('/') ? join(file, 'index.html') : file;
}

const isHtmlPath = (path) => path.endsWith('/') || path.endsWith('.html');

/** A page's digest: of its pageContent, with the words its stylesheets add, for HTML; of its bytes otherwise. */
export function contentDigest(bytes, path, { generated = [] } = {}) {
  const material = isHtmlPath(path) ? JSON.stringify(pageContent(bytes.toString('utf8'), { generated })) : bytes;
  return createHash('sha256').update(material).digest('hex');
}

/** Reads a build's stylesheets by href, each once; an href outside the build reads as empty. */
export function buildStylesheets(dist) {
  const cache = new Map();
  return (pagePath) => (href) => {
    const url = new URL(href, `${ORIGIN}${pagePath}`);
    if (url.origin !== ORIGIN) return Promise.resolve('');
    if (!cache.has(url.pathname)) cache.set(url.pathname, readFile(join(dist, url.pathname)).then((bytes) => bytes.toString('utf8')));
    return cache.get(url.pathname);
  };
}

/** Every sitemap page of a build: its date and its content's digest. */
export async function fingerprint(dist) {
  const dates = sitemapDates(await readFile(join(dist, 'sitemap.xml'), 'utf8'));
  const stylesheets = buildStylesheets(dist);
  const urls = {};
  for (const path of [...dates.keys()].sort()) {
    const bytes = await readFile(distFile(dist, path));
    const generated = isHtmlPath(path) ? await generatedCopy(bytes.toString('utf8'), stylesheets(path), { page: `${ORIGIN}${path}` }) : [];
    urls[path] = { lastmod: dates.get(path), sha256: contentDigest(bytes, path, { generated }) };
  }
  return { schema: SCHEMA, urls };
}

/**
 * Pages the head changed: those re-dated, and those changed without a new date
 * (the failures). With `today`, the day both builds were made for, a page
 * already dated that day passes: a sitemap date says only the day of the last
 * change, so a second change that day needs no new one. A page the head dates
 * after that day fails too, changed or not (`future`): no page can have
 * changed later than the day it is built for.
 */
export function compare(base, head, { today } = {}) {
  for (const side of [base, head]) {
    if (side?.schema !== SCHEMA) throw new Error(`Not a ${SCHEMA} fingerprint.`);
  }
  if (today !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(today)) throw new Error(`Not a date: ${today}`);
  const result = {
    compared: 0, unchanged: 0, changedAndRedated: [], changedOnItsDate: [], redatedOnly: [], added: [], removed: [], undated: [],
    future: [],
  };
  for (const [path, now] of Object.entries(head.urls)) {
    if (today && now.lastmod && now.lastmod.slice(0, 10) > today) result.future.push({ path, lastmod: now.lastmod });
    const before = base.urls[path];
    if (!before) {
      result.added.push(path);
      continue;
    }
    result.compared += 1;
    const redated = now.lastmod !== before.lastmod;
    if (now.sha256 === before.sha256) {
      if (redated) result.redatedOnly.push(path);
      else result.unchanged += 1;
    } else if (redated) {
      result.changedAndRedated.push(path);
    } else if (today && now.lastmod && now.lastmod.slice(0, 10) === today) {
      result.changedOnItsDate.push(path);
    } else {
      result.undated.push({ path, lastmod: now.lastmod });
    }
  }
  result.removed = Object.keys(base.urls).filter((path) => !(path in head.urls));
  return result;
}

/** The first lines of text that differ between two builds of a page, to show what changed. */
export function textDifference(beforeHtml, afterHtml, limit = 3, { beforeGenerated = [], afterGenerated = [] } = {}) {
  const lines = (html, generated) => {
    const { title, description, text, links, images, media, labels } = pageContent(html, { generated });
    return [`title: ${title}`, `description: ${description}`, ...text.split(/(?<=[.!?:])\s+/u), ...links.map((href) => `link: ${href}`), ...images.map((alt) => `image: ${alt}`), ...media, ...labels, ...generated.map((copy) => `stylesheet: ${copy}`)];
  };
  const before = lines(beforeHtml, beforeGenerated);
  const after = lines(afterHtml, afterGenerated);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    removed: before.filter((line) => !afterSet.has(line)).slice(0, limit),
    added: after.filter((line) => !beforeSet.has(line)).slice(0, limit),
  };
}

function report(result) {
  const lines = [
    `Pages in both builds: ${result.compared}; unchanged: ${result.unchanged}; changed and re-dated: ${result.changedAndRedated.length}; changed and already dated that day: ${result.changedOnItsDate.length}; re-dated with no change in content: ${result.redatedOnly.length}; new: ${result.added.length}; removed: ${result.removed.length}.`,
  ];
  if (result.undated.length === 0) {
    lines.push('Every page whose content changed has a new sitemap date.');
  } else {
    lines.push(`${result.undated.length} page(s) changed without a new sitemap date. Give each a new date in src/pages/sitemap.xml.ts (or the data it is dated from), so IndexNow Changes submits it:`);
    for (const { path, lastmod } of result.undated) lines.push(`- ${path} (still ${lastmod ?? 'undated'})`);
  }
  if (result.future.length > 0) {
    lines.push(`${result.future.length} page(s) dated after the day the builds were made for. A sitemap date says when a page last changed, so date each no later than that day:`);
    for (const { path, lastmod } of result.future) lines.push(`- ${path} (dated ${lastmod})`);
  }
  return lines.join('\n');
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'fingerprint' && rest.length === 2) {
    const [dist, out] = rest;
    const prints = await fingerprint(dist);
    await writeFile(out, `${JSON.stringify(prints, null, 1)}\n`);
    console.log(`sitemap-rendered-changes: ${Object.keys(prints.urls).length} pages of ${dist} fingerprinted.`);
    return 0;
  }
  if (command === 'compare' && rest.length >= 2) {
    const [baseFile, headFile, ...options] = rest;
    const read = async (file) => JSON.parse(await readFile(file, 'utf8'));
    const todayAt = options.indexOf('--today');
    const result = compare(await read(baseFile), await read(headFile), todayAt >= 0 ? { today: options[todayAt + 1] } : {});
    let text = report(result);
    const explain = options.indexOf('--explain');
    if (explain >= 0 && result.undated.length > 0) {
      const [baseDist, headDist] = options.slice(explain + 1, explain + 3);
      const [baseSheets, headSheets] = [buildStylesheets(baseDist), buildStylesheets(headDist)];
      for (const { path } of result.undated.slice(0, 20)) {
        const [beforeHtml, afterHtml] = [await readFile(distFile(baseDist, path), 'utf8'), await readFile(distFile(headDist, path), 'utf8')];
        const difference = textDifference(beforeHtml, afterHtml, 3, {
          beforeGenerated: isHtmlPath(path) ? await generatedCopy(beforeHtml, baseSheets(path), { page: `${ORIGIN}${path}` }) : [],
          afterGenerated: isHtmlPath(path) ? await generatedCopy(afterHtml, headSheets(path), { page: `${ORIGIN}${path}` }) : [],
        });
        text += `\n\n${path}\n${difference.removed.map((line) => `  - ${line}`).join('\n')}\n${difference.added.map((line) => `  + ${line}`).join('\n')}`;
      }
    }
    console.log(text);
    const summary = options.indexOf('--summary');
    if (summary >= 0) await writeFile(options[summary + 1], `## Sitemap dates\n\n${text}\n`, { flag: 'a' });
    return result.undated.length === 0 && result.future.length === 0 ? 0 : 1;
  }
  console.error('usage: sitemap-rendered-changes.mjs fingerprint <dist> <out.json> | compare <base.json> <head.json> [--today YYYY-MM-DD] [--explain <base dist> <head dist>] [--summary <file>]');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
