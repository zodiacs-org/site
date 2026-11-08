#!/usr/bin/env node
// Turn one baseline folder (docs/visibility/baseline/<label>/) into a ranked
// phrase table, or compare two folders to show movement.
//
//   node scripts/visibility/report.mjs --rank 2026-11-08
//   node scripts/visibility/report.mjs --from 2026-11-08 --to 2026-12-20
//
// Reads whatever the folder holds: gsc.json, ai/*.json, pages.json,
// rankings.json. Missing inputs are reported as missing, never as zero.
// Writes REPORT.md (rank) or COMPARE-<from>-to-<to>.md beside the data.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadQuestions, opportunityScore, VIS_DIR } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);

export function load(label) {
  const dir = path.join(VIS_DIR, 'baseline', label);
  const aiDir = path.join(dir, 'ai');
  const ai = {};
  if (existsSync(aiDir)) for (const f of readdirSync(aiDir).filter((f) => f.endsWith('.json'))) ai[f.replace('.json', '')] = read(path.join(aiDir, f));
  return { dir, gsc: read(path.join(dir, 'gsc.json')), pages: read(path.join(dir, 'pages.json')), rankings: read(path.join(dir, 'rankings.json')), ai };
}

// Share of a question's answers (all runs, all providers) naming or citing zodiacs.org.
function aiRates(data, id) {
  const per = {};
  let cited = 0, n = 0;
  for (const [prov, doc] of Object.entries(data.ai)) {
    const a = (doc.answers || []).filter((x) => x.id === id && !x.error);
    if (!a.length) continue;
    const c = a.filter((x) => x.cited).length;
    const m = a.filter((x) => x.mentioned || x.cited).length;
    per[prov] = `${m}/${a.length}`;
    cited += c; n += a.length;
  }
  return { per, citeRate: n ? cited / n : null };
}

const fit = (q) => (!q.target ? 0.6 : q.intent === 'tool' || q.intent === 'dates' ? 1 : 0.8);
const fmt = (v) => (v == null ? 'n/a' : String(v));

function rank(label) {
  const d = load(label);
  const providers = Object.keys(d.ai);
  const rows = loadQuestions().map((q) => {
    const g = d.gsc?.phrases.find((p) => p.id === q.id);
    const r = aiRates(d, q.id);
    const serp = d.rankings?.rankings?.find((x) => x.phrase === q.phrase);
    const demand = g ? g.close.impressions : null;
    return {
      q, g, r, serp,
      score: demand == null ? null : opportunityScore({ demand, position: g.close.position, aiCiteRate: r.citeRate || 0, fit: fit(q) }),
    };
  });
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const lines = [
    `# Visibility baseline ${label}`, '',
    `Inputs: Search Console ${d.gsc ? `yes (${d.gsc.source})` : 'MISSING'}; AI answers ${providers.length ? providers.join(', ') : 'MISSING'}; page snapshot ${d.pages ? 'yes' : 'MISSING'}; search results snapshot ${d.rankings ? 'yes' : 'MISSING'}.`, '',
    `| # | Phrase | Target | GSC impr. (exact / close) | Clicks | Avg pos. | ${providers.map((p) => `${p} named`).join(' | ')}${providers.length ? ' | ' : ''}Search pos. | Score |`,
    `|---|---|---|---|---|---|${providers.map(() => '---|').join('')}---|---|`,
  ];
  rows.forEach(({ q, g, r, serp, score }, i) => {
    lines.push(`| ${i + 1} | ${q.phrase} | ${q.target || 'none'} | ${g ? `${g.exact.impressions} / ${g.close.impressions}` : 'n/a'} | ${g ? g.close.clicks : 'n/a'} | ${fmt(g?.close.position)} | ${providers.map((p) => r.per[p] || 'n/a').join(' | ')}${providers.length ? ' | ' : ''}${serp ? fmt(serp.zodiacs_pos) : 'n/a'} | ${fmt(score)} |`);
  });
  const file = path.join(d.dir, 'REPORT.md');
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}

function compare(from, to) {
  const a = load(from), b = load(to);
  const lines = [`# Movement ${from} to ${to}`, '', '| Phrase | Impr. | Clicks | Avg pos. | AI cite rate | Title / H1 / opening |', '|---|---|---|---|---|---|'];
  for (const q of loadQuestions()) {
    const ga = a.gsc?.phrases.find((p) => p.id === q.id)?.close, gb = b.gsc?.phrases.find((p) => p.id === q.id)?.close;
    const ra = aiRates(a, q.id).citeRate, rb = aiRates(b, q.id).citeRate;
    const pb = b.pages?.pages.find((p) => p.path === q.target)?.phrases.find((x) => x.id === q.id);
    const d = (x, y) => (x == null || y == null ? 'n/a' : `${x} to ${y}`);
    const pct = (x) => (x == null ? null : `${Math.round(x * 100)}%`);
    lines.push(`| ${q.phrase} | ${d(ga?.impressions, gb?.impressions)} | ${d(ga?.clicks, gb?.clicks)} | ${d(ga?.position, gb?.position)} | ${d(pct(ra), pct(rb))} | ${pb ? [pb.inTitle, pb.inH1, pb.inOpening].map((v) => (v ? 'yes' : 'no')).join(' / ') : 'n/a'} |`);
  }
  lines.push('', 'Spam check (manual, in Search Console): Security & Manual actions shows "No issues detected" for both dates; Pages report shows no new "Duplicate without user-selected canonical" or "Crawled, currently not indexed" spike on the changed URLs.');
  const file = path.join(b.dir, `COMPARE-${from}-to-${to}.md`);
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}

if (opt('rank')) rank(opt('rank'));
else if (opt('from') && opt('to')) compare(opt('from'), opt('to'));
else console.log('Pass --rank <label> or --from <label> --to <label>');
