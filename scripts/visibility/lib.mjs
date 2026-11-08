// Shared helpers for the exact-phrase visibility program (docs/visibility/).
// Pure functions only, so scripts/visibility/lib.test.mjs can cover them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const VIS_DIR = path.join(ROOT, 'docs/visibility');
export const SITE = 'https://zodiacs.org';

export function loadQuestions(file = path.join(VIS_DIR, 'questions.json')) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return data.questions;
}

// Hostname without www, lowercase. Returns '' for anything that is not a URL.
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isZodiacsUrl(url) {
  const h = hostOf(url);
  return h === 'zodiacs.org' || h.endsWith('.zodiacs.org');
}

// Gemini returns grounding links as vertexaisearch redirect URLs whose title is
// the source domain. Prefer the title when it looks like a hostname.
export function citationHost(c) {
  const h = hostOf(c.url);
  if (h && !h.endsWith('vertexaisearch.cloud.google.com')) return h;
  const t = String(c.title || '').toLowerCase().trim().replace(/^www\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t) ? t : h;
}

// Does an answer mention the brand, and does it cite a zodiacs.org page?
export function scoreAnswer(text, citations = []) {
  const mentioned = /\bzodiacs\.org\b|\bzodiacs org\b/i.test(text || '');
  const hosts = citations.map(citationHost).filter(Boolean);
  const citedUrls = citations.filter((c) => citationHost(c) === 'zodiacs.org' || isZodiacsUrl(c.url)).map((c) => c.url);
  return {
    mentioned,
    cited: citedUrls.length > 0,
    citedUrls,
    citedHosts: [...new Set(hosts)],
  };
}

// Search Console phrase matching: exact (after normalising case, spacing and
// punctuation) or close (every phrase word present, any order).
export function normaliseQuery(q) {
  return String(q).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function matchPhrase(query, phrase) {
  const q = normaliseQuery(query);
  const p = normaliseQuery(phrase);
  if (q === p) return 'exact';
  const words = new Set(q.split(' '));
  return p.split(' ').every((w) => words.has(w)) ? 'close' : null;
}

// Minimal RFC 4180 CSV parser (Search Console exports quote fields with commas).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Aggregate Search Console rows ({query, page, clicks, impressions, position})
// per phrase. Position is impression-weighted, as Search Console reports it.
export function summarisePhrase(rows, phrase, { closeMatches = true } = {}) {
  let clicks = 0, impressions = 0, weighted = 0;
  const pages = new Map();
  const queries = new Set();
  for (const r of rows) {
    const m = matchPhrase(r.query, phrase);
    if (!m || (m === 'close' && !closeMatches)) continue;
    queries.add(r.query);
    clicks += r.clicks;
    impressions += r.impressions;
    weighted += r.position * r.impressions;
    if (r.page) pages.set(r.page, (pages.get(r.page) || 0) + r.impressions);
  }
  return {
    phrase,
    clicks,
    impressions,
    position: impressions ? +(weighted / impressions).toFixed(1) : null,
    queries: [...queries].slice(0, 20),
    topPages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([page]) => page),
  };
}

// Opportunity score used to rank candidate phrases once data exists.
// demand: monthly impressions (Search Console) or a prior when there is none.
// position: current average position, null when the site has no impressions.
// aiCiteRate: share of assistant answers (0..1) that cite zodiacs.org.
// fit: 1 for a working tool page, 0.8 for an article, 0.6 for a page to build.
export function opportunityScore({ demand, position, aiCiteRate = 0, fit = 1 }) {
  // Pages sitting on page one bottom or page two move most for the least work.
  let gap;
  if (position == null) gap = 0.5;
  else if (position <= 3) gap = 0.3;
  else if (position <= 20) gap = 1;
  else if (position <= 50) gap = 0.7;
  else gap = 0.4;
  return +(Math.log10(1 + Math.max(0, demand)) * gap * fit * (1 - 0.5 * aiCiteRate)).toFixed(3);
}

// Consumer copy rules this program must keep: no em or en dashes, and no
// token, market or crypto words.
const DASHES = /[\u2013\u2014]/;
const MARKET = /\b(crypto|token|tokens|nft|coin|blockchain|wallet|market|trade|trading|invest|buy now)\b/i;
export function copyProblems(text) {
  const out = [];
  if (DASHES.test(text)) out.push('em or en dash');
  const m = text.match(MARKET);
  if (m) out.push(`market word "${m[0]}"`);
  return out;
}
