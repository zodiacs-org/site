#!/usr/bin/env node
// Snapshot what each target page in docs/visibility/questions.json says today:
// title, description, H1, opening paragraph, JSON-LD types, canonical, robots,
// how many site pages link to it, and whether each target phrase appears in
// the title, H1 and opening paragraph.
//
//   node scripts/visibility/page-baseline.mjs --dist dist --label 2026-11-08
//   node scripts/visibility/page-baseline.mjs --base https://zodiacs.org --label 2026-12-20
//
// --dist reads a local build (and counts internal links across every page);
// --base reads the live site (no internal link count).
// Output: docs/visibility/baseline/<label>/pages.json
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadQuestions, normaliseQuery, VIS_DIR, ROOT } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const dist = opt('dist') ? path.resolve(ROOT, opt('dist')) : null;
const base = opt('base');
const label = opt('label') || new Date().toISOString().slice(0, 10);
if (!dist && !base) throw new Error('Pass --dist <dir> or --base <url>');

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const strip = (s) => decode(s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')); return m ? decode(m[1]) : null; };

export function extract(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = (n) => { const t = metaTags.find((m) => attr(m, 'name') === n || attr(m, 'property') === n); return t ? attr(t, 'content') : null; };
  const canonTag = (html.match(/<link\b[^>]*rel="canonical"[^>]*>/i) || [])[0];
  const h1m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  let opening = null;
  if (h1m) {
    const after = html.slice(h1m.index + h1m[0].length);
    const p = after.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (p) opening = strip(p[1]).slice(0, 400);
  }
  const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const types = new Set();
  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          if (n['@type']) [].concat(n['@type']).forEach((t) => types.add(t));
          Object.values(n).forEach(walk);
        }
      };
      walk(JSON.parse(m[1]));
    } catch { types.add('INVALID_JSON_LD'); }
  }
  return {
    title: title ? strip(title[1]) : null,
    description: meta('description'),
    canonical: canonTag ? attr(canonTag, 'href') : null,
    robots: meta('robots'),
    h1: h1m ? strip(h1m[1]) : null,
    opening,
    h2,
    jsonLdTypes: [...types].sort(),
  };
}

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

const has = (hay, phrase) => !!hay && normaliseQuery(hay).includes(normaliseQuery(phrase));

const questions = loadQuestions();
const targets = [...new Set(questions.map((q) => q.target).filter(Boolean))];

let inbound = null;
if (dist) {
  inbound = new Map(targets.map((t) => [t, 0]));
  for (const file of htmlFiles(dist)) {
    const html = readFileSync(file, 'utf8');
    const own = '/' + path.relative(dist, path.dirname(file)).split(path.sep).join('/') + '/';
    for (const t of targets) {
      if (own === t || own === '//' && t === '/') continue;
      const re = new RegExp(`href="(?:https://zodiacs\\.org)?${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#][^"]*)?"`);
      if (re.test(html)) inbound.set(t, inbound.get(t) + 1);
    }
  }
}

const pages = [];
for (const t of targets) {
  let html = null, status = null;
  if (dist) {
    const f = path.join(dist, t, 'index.html');
    if (existsSync(f)) { html = readFileSync(f, 'utf8'); status = 'built'; } else status = 'missing';
  } else {
    const res = await fetch(new URL(t, base), { redirect: 'manual' });
    status = res.status;
    if (res.ok) html = await res.text();
  }
  const page = { path: t, status, ...(html ? extract(html) : {}), inboundPages: inbound ? inbound.get(t) : null };
  page.phrases = questions.filter((q) => q.target === t).map((q) => ({
    id: q.id,
    phrase: q.phrase,
    inTitle: has(page.title, q.phrase),
    inH1: has(page.h1, q.phrase),
    inOpening: has(page.opening, q.phrase),
    inH2: (page.h2 || []).some((h) => has(h, q.phrase)),
    placement: q.placement || null,
  }));
  pages.push(page);
}
const unanswered = questions.filter((q) => !q.target).map((q) => ({ id: q.id, phrase: q.phrase }));

const out = path.join(VIS_DIR, 'baseline', label);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'pages.json'), JSON.stringify({ label, source: dist ? `local build (${path.relative(ROOT, dist)})` : base, generated: new Date().toISOString(), pages, unanswered }, null, 2) + '\n');
console.log(`${pages.length} pages recorded, ${unanswered.length} questions with no page, into ${path.relative(ROOT, out)}/pages.json`);
