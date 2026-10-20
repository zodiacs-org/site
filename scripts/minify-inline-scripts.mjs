#!/usr/bin/env node
/**
 * Minifies the whitespace of the inline scripts in the pages Astro renders,
 * after the critical styles are inlined (postbuild).
 *
 * Astro ships `is:inline` scripts as they are written, comments and
 * indentation included. On the daily horoscope page they came to 2.3 KB of
 * its 43 KB compressed HTML, which sat about a hundred bytes under the size
 * at which Lighthouse's simulated phone needs another round trip for the
 * document (LCP 2.48 s against the 2.5 s gate), so a longer daily reading
 * could tip it over. esbuild reprints each script with its whitespace and
 * comments removed and nothing else: no renaming and no syntax rewrites, so
 * the code that runs is the code that was written.
 *
 * Only plain and module scripts are touched; JSON, structured data, import
 * maps and every other typed block keep their bytes. Pages copied from
 * public/ (the wing's hand-authored and generated HTML) keep theirs too.
 * The CSP admits inline scripts with 'unsafe-inline', not by hash, so a
 * reprinted script needs no new hash.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { htmlFiles } from './inline-critical-styles.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gu;

/** The script's type, as the browser reads it ('' for none). @param {string} attributes */
function scriptType(attributes) {
  const match = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(attributes);
  return (match ? (match[1] ?? match[2] ?? match[3] ?? '') : '').trim().toLowerCase();
}

/** Plain JavaScript and modules only. @param {string} type */
function isJavaScript(type) {
  return type === '' || type === 'module' || type === 'text/javascript' || type === 'application/javascript';
}

/**
 * One script's code with its whitespace and comments removed.
 * @param {string} code
 * @param {{ module: boolean }} options
 */
export function minifyScriptWhitespace(code, { module }) {
  const result = transformSync(code, {
    loader: 'js',
    minifyWhitespace: true,
    legalComments: 'none',
    charset: 'utf8',
    ...(module ? { format: 'esm' } : {}),
  });
  return result.code.replace(/;?\n$/u, '');
}

/**
 * The page with each inline script's whitespace minified.
 * @param {string} html
 * @returns {{ html: string, scripts: number, saved: number, skipped: string[] }}
 */
export function minifyInlineScripts(html) {
  let scripts = 0;
  let saved = 0;
  const skipped = [];
  const out = html.replace(SCRIPT, (whole, attributes = '', code) => {
    if (!code.trim() || !isJavaScript(scriptType(attributes))) return whole;
    let minified;
    try {
      minified = minifyScriptWhitespace(code, { module: scriptType(attributes) === 'module' });
    } catch (error) {
      skipped.push(String(error?.message ?? error).split('\n')[0]);
      return whole;
    }
    if (minified.length >= code.length) return whole;
    scripts += 1;
    saved += code.length - minified.length;
    return `<script${attributes}>${minified}</script>`;
  });
  return { html: out, scripts, saved, skipped };
}

async function main() {
  const distRoot = resolve(repo, 'dist');
  const publicRoot = resolve(repo, 'public');
  const pages = (await htmlFiles(distRoot)).filter((path) => !existsSync(resolve(publicRoot, relative(distRoot, path))));
  let scripts = 0;
  let saved = 0;
  let changed = 0;
  const skipped = [];
  for (const path of pages) {
    const before = await readFile(path, 'utf8');
    const result = minifyInlineScripts(before);
    for (const reason of result.skipped) skipped.push(`${relative(distRoot, path).split(sep).join('/')}: ${reason}`);
    if (result.html === before) continue;
    await writeFile(path, result.html);
    changed += 1;
    scripts += result.scripts;
    saved += result.saved;
  }
  if (skipped.length > 0) {
    console.error(`minify-inline-scripts: could not read ${skipped.length} script(s), left as written:\n  ${skipped.slice(0, 10).join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`minify-inline-scripts: ${scripts} inline scripts across ${changed} of ${pages.length} pages, ${(saved / 1024).toFixed(1)} KB of whitespace and comments removed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
