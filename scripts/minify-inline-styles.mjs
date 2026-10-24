#!/usr/bin/env node
/**
 * Minifies the whitespace of the inline stylesheets in every built page,
 * after the critical styles are inlined and the inline scripts minified
 * (postbuild). minify-inline-scripts.mjs runs it as its second pass, so the
 * postbuild chain in package.json (a Phase 1 template-hash input whose change
 * needs re-driven acceptance captures) stays as it is; it also runs alone.
 *
 * Astro already minifies the styles it bundles, but `is:inline` style blocks
 * and the hand-authored wing pages copied from public/ ship as written,
 * comments and indentation included. Astrofolio carried 426 KB of such CSS
 * (507 KB of HTML) and Terminal about as much. esbuild reprints each block
 * with its whitespace and comments removed and nothing else: no rule merging,
 * no shorthand or colour rewrites, no dropped fallbacks, so the cascade the
 * browser applies is the one that was written.
 *
 * Only plain CSS blocks are touched (no type, or type="text/css"). A style
 * block inside a script, an HTML comment or an inline SVG keeps its bytes:
 * the first two are not stylesheets, and SVG style text is parsed as foreign
 * content with entity decoding. The CSP admits inline styles with
 * 'unsafe-inline', not by hash, so a reprinted block needs no new hash.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { htmlFiles } from './inline-critical-styles.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// One left-to-right scan: a style block is consumed whole (so SVG data URIs
// in its CSS do not end it early), and the regions whose text is not a page
// stylesheet (scripts, HTML comments, inline SVG) are kept byte for byte.
const TOKEN = /<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->|<svg\b[\s\S]*?<\/svg>|<style(\s[^>]*)?>([\s\S]*?)<\/style>/giu;

/** Plain CSS only. @param {string} attributes */
function isCss(attributes) {
  const match = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(attributes);
  const type = (match ? (match[1] ?? match[2] ?? match[3] ?? '') : '').trim().toLowerCase();
  return type === '' || type === 'text/css';
}

/** One stylesheet with its whitespace and comments removed. @param {string} css */
export function minifyStyleWhitespace(css) {
  const result = transformSync(css, {
    loader: 'css',
    minifyWhitespace: true,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
  });
  return result.code.replace(/\n$/u, '');
}

/**
 * The page with each inline stylesheet's whitespace minified.
 * @param {string} html
 * @returns {{ html: string, styles: number, saved: number, skipped: string[] }}
 */
export function minifyInlineStyles(html) {
  let styles = 0;
  let saved = 0;
  const skipped = [];
  const out = html.replace(TOKEN, (whole, attributes = '', css) => {
    if (css === undefined || !css.trim() || !isCss(attributes)) return whole;
    let minified;
    try {
      minified = minifyStyleWhitespace(css);
    } catch (error) {
      skipped.push(String(error?.message ?? error).split('\n')[0]);
      return whole;
    }
    if (minified.length >= css.length) return whole;
    styles += 1;
    saved += css.length - minified.length;
    return `<style${attributes}>${minified}</style>`;
  });
  return { html: out, styles, saved, skipped };
}

/**
 * Minifies every built page's inline stylesheets in place and logs the total.
 * Sets a failing exit code when a block cannot be read.
 * @param {string} distRoot
 */
export async function minifyDistInlineStyles(distRoot = resolve(repo, 'dist')) {
  const pages = await htmlFiles(distRoot);
  let styles = 0;
  let saved = 0;
  let changed = 0;
  const skipped = [];
  for (const path of pages) {
    const before = await readFile(path, 'utf8');
    const result = minifyInlineStyles(before);
    for (const reason of result.skipped) skipped.push(`${relative(distRoot, path).split(sep).join('/')}: ${reason}`);
    if (result.html === before) continue;
    await writeFile(path, result.html);
    changed += 1;
    styles += result.styles;
    saved += result.saved;
  }
  if (skipped.length > 0) {
    console.error(`minify-inline-styles: could not read ${skipped.length} style block(s), left as written:\n  ${skipped.slice(0, 10).join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`minify-inline-styles: ${styles} inline stylesheets across ${changed} of ${pages.length} pages, ${(saved / 1024).toFixed(1)} KB of whitespace and comments removed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await minifyDistInlineStyles();
}
