#!/usr/bin/env node
// Record Search Console performance for every phrase in docs/visibility/questions.json.
//
// Two ways in, both read-only:
//
// 1. CSV (no credentials in this repo or session). In Search Console:
//    Performance > Search results > Date: last 28 days > Export > Download CSV.
//    Unzip it and point the script at the folder, which holds Queries.csv
//    (and Pages.csv). Query-only exports have no page column, so a second
//    export filtered by page is optional.
//      node scripts/visibility/gsc.mjs --csv ~/Downloads/zodiacs.org-Performance --label 2026-11-08
//
// 2. API. Export a short-lived OAuth token with the webmasters.readonly scope
//    in the shell as GSC_ACCESS_TOKEN (for example from
//    `gcloud auth application-default print-access-token` after logging in
//    with that scope). Rows come back per query and page.
//      node scripts/visibility/gsc.mjs --api --site sc-domain:zodiacs.org \
//        --start 2026-10-11 --end 2026-11-07 --label 2026-11-08
//
// Output: docs/visibility/baseline/<label>/gsc.json, aggregate counts only
// (Search Console holds no personal data; anonymised queries are not returned).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadQuestions, parseCsv, summarisePhrase, VIS_DIR } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
const label = opt('label') || new Date().toISOString().slice(0, 10);

const num = (s) => Number(String(s).replace(/[%,]/g, '')) || 0;

function fromCsv(dir) {
  const file = ['Queries.csv', 'queries.csv'].map((f) => path.join(dir, f)).find(existsSync);
  if (!file) throw new Error(`No Queries.csv in ${dir}`);
  const [head, ...rows] = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const col = (re) => head.findIndex((h) => re.test(h));
  const q = col(/quer/i), c = col(/click/i), im = col(/impression/i), pos = col(/position/i);
  return rows.map((r) => ({ query: r[q], page: null, clicks: num(r[c]), impressions: num(r[im]), position: num(r[pos]) }));
}

async function fromApi(site, start, end) {
  const token = process.env.GSC_ACCESS_TOKEN;
  if (!token) throw new Error('Set GSC_ACCESS_TOKEN in the shell (webmasters.readonly scope).');
  const out = [];
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['query', 'page'], rowLimit: 25000, startRow, dataState: 'final' }),
    });
    if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    for (const r of json.rows || []) out.push({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position });
    if (!json.rows || json.rows.length < 25000) break;
  }
  return out;
}

let rows, source;
if (opt('csv')) { rows = fromCsv(path.resolve(opt('csv'))); source = 'Search Console CSV export (query level)'; }
else if (opt('api')) {
  const site = opt('site') || 'sc-domain:zodiacs.org';
  const end = opt('end'); const start = opt('start');
  if (!start || !end) throw new Error('Pass --start and --end (YYYY-MM-DD), 28 days ending 2 to 3 days ago.');
  rows = await fromApi(site, start, end); source = `Search Console API ${site} ${start}..${end} (query x page)`;
} else throw new Error('Pass --csv <folder> or --api');

const questions = loadQuestions();
const phrases = questions.map((q) => ({ id: q.id, target: q.target, exact: summarisePhrase(rows, q.phrase, { closeMatches: false }), close: summarisePhrase(rows, q.phrase) }));
// Family x locale totals: Search Console queries matched (accents and case
// folded) against the keyword tables in docs/visibility/keywords/.
const fold = (q) => String(q).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const kwDir = path.join(VIS_DIR, 'keywords');
const kwIndex = new Map();
if (existsSync(path.join(kwDir, 'all-locales.csv'))) {
  for (const r of parseCsv(readFileSync(path.join(kwDir, 'all-locales.csv'), 'utf8')).slice(1)) kwIndex.set(fold(r[5]), `${r[3]}:${r[0]}`);
}
const families = {};
for (const r of rows) {
  const key = kwIndex.get(fold(r.query));
  if (!key) continue;
  const f = (families[key] ??= { clicks: 0, impressions: 0, weighted: 0, queries: 0 });
  f.clicks += r.clicks; f.impressions += r.impressions; f.weighted += r.position * r.impressions; f.queries++;
}
for (const f of Object.values(families)) { f.position = f.impressions ? +(f.weighted / f.impressions).toFixed(1) : null; delete f.weighted; }

const totals = rows.reduce((t, r) => ({ clicks: t.clicks + r.clicks, impressions: t.impressions + r.impressions }), { clicks: 0, impressions: 0 });
const out = path.join(VIS_DIR, 'baseline', label);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'gsc.json'), JSON.stringify({ label, source, rows: rows.length, totals, families, phrases }, null, 2) + '\n');
console.log(`${rows.length} rows, ${totals.impressions} impressions, ${totals.clicks} clicks; ${phrases.filter((p) => p.close.impressions).length} of ${phrases.length} phrases have impressions`);
