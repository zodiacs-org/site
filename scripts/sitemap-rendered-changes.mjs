/*
 * A page whose rendered content changes needs a new sitemap date (F-97).
 *
 *   node scripts/sitemap-rendered-changes.mjs fingerprint <dist> <out.json>
 *   node scripts/sitemap-rendered-changes.mjs compare <base.json> <head.json>
 *     [--explain <base dist> <head dist>] [--summary <file>]
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
 * styles and comments left out. Navigation, the footer and the head's other
 * tags are left out, so a site-wide header change re-dates nothing. Any other
 * file the sitemap lists counts by its bytes.
 *
 * This file imports nothing from the repository: the workflow runs one copy of
 * it on both builds, the base's included.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA = 'zodiacs.sitemap-rendered.v1';
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

/** What a page says: title, description, and its main content's text, link targets and image descriptions. */
export function pageContent(html) {
  const title = squeeze(decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? ''));
  let description = '';
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/giu)) {
    const meta = attributes(tag);
    if (meta.name?.toLowerCase() === 'description') description = squeeze(meta.content ?? '');
  }
  const region = html.match(/<main\b[\s\S]*?<\/main>/iu)?.[0]
    ?? html.match(/<body\b[\s\S]*?<\/body>/iu)?.[0]
    ?? html;
  const cleaned = region
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ');
  const links = [...cleaned.matchAll(/<a\b[^>]*>/giu)].map(([tag]) => attributes(tag).href).filter(Boolean);
  const images = [...cleaned.matchAll(/<img\b[^>]*>/giu)].map(([tag]) => attributes(tag).alt).filter(Boolean).map(squeeze);
  const text = squeeze(decodeEntities(cleaned.replace(/<[^>]+>/gu, ' ')));
  return { title, description, text, links, images };
}

/** The file a sitemap path is served from, as scripts/check-dist.mjs resolves it. */
export function distFile(dist, path) {
  const file = resolve(dist, path.replace(/^\//u, ''));
  return path.endsWith('/') ? join(file, 'index.html') : file;
}

export function contentDigest(bytes, path) {
  const isHtml = path.endsWith('/') || path.endsWith('.html');
  const material = isHtml ? JSON.stringify(pageContent(bytes.toString('utf8'))) : bytes;
  return createHash('sha256').update(material).digest('hex');
}

/** Every sitemap page of a build: its date and its content's digest. */
export async function fingerprint(dist) {
  const dates = sitemapDates(await readFile(join(dist, 'sitemap.xml'), 'utf8'));
  const urls = {};
  for (const path of [...dates.keys()].sort()) {
    const bytes = await readFile(distFile(dist, path));
    urls[path] = { lastmod: dates.get(path), sha256: contentDigest(bytes, path) };
  }
  return { schema: SCHEMA, urls };
}

/** Pages the head changed: those re-dated, and those changed without a new date (the failures). */
export function compare(base, head) {
  for (const side of [base, head]) {
    if (side?.schema !== SCHEMA) throw new Error(`Not a ${SCHEMA} fingerprint.`);
  }
  const result = { compared: 0, unchanged: 0, changedAndRedated: [], redatedOnly: [], added: [], removed: [], undated: [] };
  for (const [path, now] of Object.entries(head.urls)) {
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
    } else {
      result.undated.push({ path, lastmod: now.lastmod });
    }
  }
  result.removed = Object.keys(base.urls).filter((path) => !(path in head.urls));
  return result;
}

/** The first lines of text that differ between two builds of a page, to show what changed. */
export function textDifference(beforeHtml, afterHtml, limit = 3) {
  const lines = (html) => {
    const { title, description, text, links, images } = pageContent(html);
    return [`title: ${title}`, `description: ${description}`, ...text.split(/(?<=[.!?:])\s+/u), ...links.map((href) => `link: ${href}`), ...images.map((alt) => `image: ${alt}`)];
  };
  const before = lines(beforeHtml);
  const after = lines(afterHtml);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    removed: before.filter((line) => !afterSet.has(line)).slice(0, limit),
    added: after.filter((line) => !beforeSet.has(line)).slice(0, limit),
  };
}

function report(result) {
  const lines = [
    `Pages in both builds: ${result.compared}; unchanged: ${result.unchanged}; changed and re-dated: ${result.changedAndRedated.length}; re-dated with no change in content: ${result.redatedOnly.length}; new: ${result.added.length}; removed: ${result.removed.length}.`,
  ];
  if (result.undated.length === 0) {
    lines.push('Every page whose content changed has a new sitemap date.');
  } else {
    lines.push(`${result.undated.length} page(s) changed without a new sitemap date. Give each a new date in src/pages/sitemap.xml.ts (or the data it is dated from), so IndexNow Changes submits it:`);
    for (const { path, lastmod } of result.undated) lines.push(`- ${path} (still ${lastmod ?? 'undated'})`);
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
    const result = compare(await read(baseFile), await read(headFile));
    let text = report(result);
    const explain = options.indexOf('--explain');
    if (explain >= 0 && result.undated.length > 0) {
      const [baseDist, headDist] = options.slice(explain + 1, explain + 3);
      for (const { path } of result.undated.slice(0, 20)) {
        const difference = textDifference(
          await readFile(distFile(baseDist, path), 'utf8'),
          await readFile(distFile(headDist, path), 'utf8'),
        );
        text += `\n\n${path}\n${difference.removed.map((line) => `  - ${line}`).join('\n')}\n${difference.added.map((line) => `  + ${line}`).join('\n')}`;
      }
    }
    console.log(text);
    const summary = options.indexOf('--summary');
    if (summary >= 0) await writeFile(options[summary + 1], `## Sitemap dates\n\n${text}\n`, { flag: 'a' });
    return result.undated.length === 0 ? 0 : 1;
  }
  console.error('usage: sitemap-rendered-changes.mjs fingerprint <dist> <out.json> | compare <base.json> <head.json> [--explain <base dist> <head dist>] [--summary <file>]');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
