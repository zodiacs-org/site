#!/usr/bin/env node
// Coverage of the five high-volume astrology families in every locale the
// site publishes, read from a local build's sitemap and HTML.
//
//   node scripts/visibility/coverage.mjs --dist dist --label 2026-11-08
//
// Families: horoscope (per sign, by period), compatibility (sign pairs),
// birth chart (calculator and natal meanings), sky events (Moon phase,
// retrogrades, lunations, eclipses, seasons), signs (sign meanings and traits).
// Per locale and family: page count, sub-types, sitemap lastmod range, median
// words in <main>, noindex count, titles carrying an em or en dash, and
// whether page slugs are in the page's language.
// Output: docs/visibility/baseline/<label>/coverage.json and coverage.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, VIS_DIR } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const dist = path.resolve(ROOT, opt('dist') || 'dist');
const label = opt('label') || new Date().toISOString().slice(0, 10);

const LOCALES = ['en', 'es', 'pt', 'fr', 'it', 'ru', 'ar', 'zh-hans', 'zh-hant'];
const SIGNS = 'aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces';

// Order matters: the first match wins.
export const FAMILIES = [
  ['horoscope', /^\/horoscopes\//, (r) => {
    const m = r.match(new RegExp(`^/horoscopes/(?:${SIGNS})/([^/]+)/`));
    if (m) return /^\d{4}$/.test(m[1]) ? 'yearly' : m[1];
    return new RegExp(`^/horoscopes/(?:${SIGNS})/$`).test(r) ? 'daily' : 'hub';
  }],
  ['compatibility', /^\/compatibility\//, (r) => (/^\/compatibility\/$/.test(r) ? 'hub' : /^\/compatibility\/[a-z]+-[a-z]+\/$/.test(r) ? 'pair' : 'other')],
  ['birth-chart', /^\/(birth-chart|big-three|moon-sign|learn\/how-to-read-a-birth-chart|learn\/houses|learn\/placements|learn\/planets|learn\/aspects)\/|^\/rising-sign\/$/, (r) => r.split('/')[1] === 'learn' ? r.split('/')[2] : r.split('/')[1]],
  ['sky-events', /^\/(today|moon-phase|mercury-retrograde|venus-retrograde|mars-retrograde|retrogrades|full-moon|new-moon|full-moon-calendar|eclipses|void-of-course-moon|events|seasons|sky-calendar|almanac)\//, (r) => r.split('/')[1]],
  ['signs', new RegExp(`^/(${SIGNS})/$|^/rising-sign/(${SIGNS})/$|^/learn/zodiac-dates/$`), (r) => (r.startsWith('/rising-sign/') ? 'rising-sign' : r.startsWith('/learn/') ? 'zodiac-dates' : 'sign-guide')],
];

const sitemap = readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  path: new URL(m[1].match(/<loc>([^<]+)/)[1]).pathname,
  lastmod: (m[1].match(/<lastmod>([^<]+)/) || [])[1] || null,
}));

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
function measure(p) {
  const file = path.join(dist, p, 'index.html');
  if (!existsSync(file)) return { missing: true };
  const html = readFileSync(file, 'utf8');
  const main = (html.match(/<main\b[\s\S]*?<\/main>/i) || [html])[0];
  const text = strip(main);
  // CJK has no spaces between words; count characters / 2 as a rough word figure.
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  const words = text.split(' ').filter(Boolean).length + Math.round(cjk / 2);
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ['', ''])[1]);
  return {
    words,
    title,
    noindex: /<meta[^>]+name="robots"[^>]+noindex/i.test(html),
    dashTitle: /[–—]/.test(title),
    jsonLd: (html.match(/application\/ld\+json/g) || []).length,
  };
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = {};
for (const u of urls) {
  const m = u.path.match(/^\/(es|pt|fr|it|ru|ar|zh-hans|zh-hant)(\/.*)$/);
  const locale = m ? m[1] : 'en';
  const rest = m ? m[2] : u.path;
  const fam = FAMILIES.find(([, re]) => re.test(rest));
  if (!fam) continue;
  const [name, , sub] = fam;
  const bucket = ((out[locale] ??= {})[name] ??= { pages: 0, sub: {}, lastmod: [], words: [], noindex: 0, dashTitles: 0, jsonLdPages: 0, samples: [] });
  const meas = measure(u.path);
  bucket.pages++;
  const s = sub(rest);
  bucket.sub[s] = (bucket.sub[s] || 0) + 1;
  if (u.lastmod) bucket.lastmod.push(u.lastmod);
  if (!meas.missing) {
    bucket.words.push(meas.words);
    if (meas.noindex) bucket.noindex++;
    if (meas.dashTitle) bucket.dashTitles++;
    if (meas.jsonLd) bucket.jsonLdPages++;
    if (bucket.samples.length < 3) bucket.samples.push({ path: u.path, title: meas.title });
  }
}

const table = [];
for (const locale of LOCALES) {
  for (const [name] of FAMILIES) {
    const b = out[locale]?.[name];
    table.push(b ? {
      locale, family: name, pages: b.pages, sub: b.sub,
      lastmodOldest: b.lastmod.sort()[0] || null, lastmodNewest: b.lastmod.sort().at(-1) || null,
      medianWords: median(b.words), noindex: b.noindex, dashTitles: b.dashTitles, jsonLdPages: b.jsonLdPages, samples: b.samples,
    } : { locale, family: name, pages: 0 });
  }
}

const dir = path.join(VIS_DIR, 'baseline', label);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'coverage.json'), JSON.stringify({ label, source: `local build (${path.relative(ROOT, dist)}), default feature flags; sitemap entries only`, table }, null, 2) + '\n');
const md = ['| Locale | Family | Pages | Sub-types | Lastmod (oldest to newest) | Median words | JSON-LD pages | Dash titles |', '|---|---|---|---|---|---|---|---|'];
for (const r of table) md.push(`| ${r.locale} | ${r.family} | ${r.pages} | ${r.pages ? Object.entries(r.sub).map(([k, v]) => `${k} ${v}`).join(', ') : ''} | ${r.pages ? `${r.lastmodOldest} to ${r.lastmodNewest}` : ''} | ${r.medianWords ?? ''} | ${r.jsonLdPages ?? ''} | ${r.dashTitles ?? ''} |`);
writeFileSync(path.join(dir, 'coverage.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
