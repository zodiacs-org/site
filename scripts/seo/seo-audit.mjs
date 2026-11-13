#!/usr/bin/env node
// Technical SEO audit over a built site (postbuild):
//   canonicals, html lang, hreflang (with x-default and reciprocity),
//   structured data per page type, locale-aware internal links and the
//   per-locale sitemaps. Rules live in ./seo-audit-lib.mjs.
//
//   node scripts/seo/seo-audit.mjs [--dist dist]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  LOCALE_PREFIXES,
  canonicalProblems,
  hreflangProblems,
  langProblems,
  localeLinkProblems,
  localeSitemapProblems,
  parsePage,
  reciprocityProblems,
  structuredDataProblems,
} from './seo-audit-lib.mjs';

const args = process.argv.slice(2);
const dist = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : 'dist';

// Pages outside the audit: the legacy wing served verbatim from public/
// styles itself and is checked by its own gates; embeds and share receivers
// are noindex by design.
const SKIP = /^\/(?:registry|thesis|archive|sdk|terminal|developers\/engine\/reference|embed|widgets|precision-preview|share)\//;

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (entry === 'index.html') yield path;
  }
}

const pages = new Map();
for (const file of htmlFiles(dist)) {
  const path = `/${relative(dist, file).split(sep).slice(0, -1).join('/')}${relative(dist, file).includes(sep) ? '/' : ''}`;
  if (SKIP.test(path) || path === '/404/' || /\/404\/$/.test(path)) continue;
  pages.set(path, parsePage(readFileSync(file, 'utf8')));
}
const pageAt = (path) => pages.get(path);
const isIndexableAt = (path) => Boolean(pages.get(path) && !pages.get(path).noindex);

const failures = new Map();
const add = (rule, path, problems) => {
  for (const problem of problems) {
    const list = failures.get(rule) ?? [];
    list.push(`${path}: ${problem}`);
    failures.set(rule, list);
  }
};
for (const [path, page] of pages) {
  add('canonical', path, canonicalProblems(path, page));
  add('html lang', path, langProblems(path, page));
  add('hreflang', path, hreflangProblems(path, page));
  add('reciprocity', path, reciprocityProblems(path, page, pageAt));
  add('structured data', path, structuredDataProblems(path, page));
  add('locale links', path, localeLinkProblems(path, page, isIndexableAt));
}

const index = existsSync(join(dist, 'sitemap-index.xml')) ? readFileSync(join(dist, 'sitemap-index.xml'), 'utf8') : '';
for (const locale of LOCALE_PREFIXES) {
  const file = join(dist, 'sitemaps', `${locale}.xml`);
  if (!existsSync(file)) continue;
  const locations = [...readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  add('locale sitemaps', `/sitemaps/${locale}.xml`, localeSitemapProblems(locale, locations));
  if (!index.includes(`/sitemaps/${locale}.xml</loc>`)) add('locale sitemaps', '/sitemap-index.xml', [`does not list ${locale}.xml`]);
  for (const loc of locations) {
    if (!isIndexableAt(new URL(loc).pathname)) add('locale sitemaps', `/sitemaps/${locale}.xml`, [`${loc} is not an indexable built page`]);
  }
}

const total = [...failures.values()].reduce((sum, list) => sum + list.length, 0);
if (total) {
  console.error(`seo-audit: ${total} problem(s) across ${pages.size} pages`);
  for (const [rule, list] of failures) {
    console.error(`  ${rule}: ${list.length}`);
    for (const line of list.slice(0, 8)) console.error(`    ${line}`);
    if (list.length > 8) console.error(`    ... ${list.length - 8} more`);
  }
  process.exit(1);
}
console.log(`seo-audit: OK, ${pages.size} pages (canonical, lang, hreflang and reciprocity, structured data, locale links, locale sitemaps)`);
