#!/usr/bin/env node
/**
 * Localized pages must never link into English content silently.
 *
 * The RU release set the policy (SiteFooter.astro carries the shared copy in
 * src/lib/i18n/english-only.ts): an anchor on a localized page whose
 * destination is an English-only route carries hreflang="en", alongside a
 * visible or assistive "in English for now" cue. The footer stayed compliant
 * because it was reviewed; the nav and page-level links drifted because
 * nothing checked them. This walks the built dist/ so every surface — nav,
 * footer, guides, tools, bands — is held to the same bar.
 *
 * Rule: in dist/{locale}/**.html, an <a> whose href is an internal route
 * outside every locale prefix (i.e. English-canonical) must carry
 * hreflang="en". Links to the page's own locale tree, to another locale's
 * tree (the language switcher carries that locale's hreflang), to anchors,
 * to files with extensions (feeds, licenses, downloads), and to external
 * URLs are out of scope.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const DIST = join(process.cwd(), 'dist');
const LOCALE_PREFIXES = ['es', 'pt', 'fr', 'it', 'ru', 'ar', 'zh-hans', 'zh-hant'];

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) yield* htmlFiles(path);
    else if (entry.endsWith('.html')) yield path;
  }
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[2] ?? match[3]) : undefined;
}

function isViolation(pageLocale, attrs) {
  const href = attrValue(attrs, 'href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/, 1)[0];
  if (/\.[a-z0-9]+$/i.test(path)) return false; // feeds, licenses, downloads
  const segment = path.split('/')[1] ?? '';
  if (segment === pageLocale) return false; // own locale tree
  if (LOCALE_PREFIXES.includes(segment)) return false; // switcher: carries that locale's hreflang
  return attrValue(attrs, 'hreflang') !== 'en';
}

const violations = new Map(); // `${locale} ${href}` -> { count, example }
let pages = 0;

for (const locale of LOCALE_PREFIXES) {
  let localeDir;
  try {
    localeDir = statSync(join(DIST, locale)).isDirectory() ? join(DIST, locale) : undefined;
  } catch {
    continue;
  }
  if (!localeDir) continue;
  for (const file of htmlFiles(localeDir)) {
    pages += 1;
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\s([^>]*)>/gi)) {
      const attrs = match[1];
      if (!isViolation(locale, attrs)) continue;
      const href = attrValue(attrs, 'href');
      const key = `/${locale}/ → ${href}`;
      const entry = violations.get(key) ?? { count: 0, example: relative(DIST, file) };
      entry.count += 1;
      violations.set(key, entry);
    }
  }
}

if (violations.size) {
  console.error(`check-i18n-english-links: ${violations.size} silent English link target(s) across ${pages} localized pages:`);
  for (const [key, { count, example }] of [...violations].sort()) {
    console.error(`  ${key}  (${count}×, e.g. ${example})`);
  }
  console.error('Each anchor needs hreflang="en" plus the locale\'s cue from src/lib/i18n/english-only.ts.');
  process.exit(1);
}

console.log(`check-i18n-english-links: OK — ${pages} localized pages, no silent English links.`);
