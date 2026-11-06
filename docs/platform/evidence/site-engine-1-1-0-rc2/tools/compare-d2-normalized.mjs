/**
 * D2, after the fact: the ChartCalculator closure production serves against a local build's, with chunk
 * hashes and the two Supabase settings (project URL, publishable key) written out on both sides, so that
 * what remains is everything else. Counts and file names only: neither setting is printed or written.
 *
 *   node docs/platform/evidence/site-engine-1-1-0-rc2/tools/compare-d2-normalized.mjs <local _astro dir> [base URL]
 */
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const [localAstro, base = 'https://zodiacs.org'] = process.argv.slice(2);
const view = 'ChartCalculator';
const STATIC = /(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["'](\.\/[^"']+\.js)["']/gu;
const normalize = (text) => text
  .replace(/https?:\/\/(?:[a-z0-9]{20}\.supabase\.co|127\.0\.0\.1:54321|[a-z0-9-]+\.supabase\.co)/gu, '<SUPABASE_URL>')
  .replace(/sb_publishable_[A-Za-z0-9_-]+/gu, '<SUPABASE_KEY>')
  .replace(/([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{8}\.(js|css)/gu, '$1.<hash>.$2');
async function closure(start, read) {
  const files = new Map();
  const queue = [start];
  while (queue.length) {
    const name = queue.shift();
    if (files.has(name)) continue;
    const text = await read(name);
    files.set(name, text);
    if (text == null) continue;
    for (const match of text.matchAll(STATIC)) queue.push(match[1].slice(2));
  }
  return files;
}
const page = await (await fetch(`${base}/birth-chart/`)).text();
const html = page + (await (await fetch(`${base}/compatibility/`)).text());
const productionStart = [...new Set(html.match(new RegExp(`${view}\\.[A-Za-z0-9_-]{8}\\.js`, 'gu')) ?? [])];
const localStart = readdirSync(localAstro).filter((file) => new RegExp(`^${view}\\.[A-Za-z0-9_-]{8}\\.js$`, 'u').test(file));
if (productionStart.length !== 1 || localStart.length !== 1) throw new Error(`expected one ${view} chunk on each side: ${productionStart.length}, ${localStart.length}`);
const production = await closure(productionStart[0], async (name) => {
  const response = await fetch(`${base}/_astro/${name}`);
  return response.ok ? response.text() : null;
});
const local = await closure(localStart[0], async (name) => readFile(join(localAstro, name), 'utf8').catch(() => null));
const byNormalName = (files) => new Map([...files].map(([name, text]) => [normalize(name), text == null ? null : normalize(text)]));
const p = byNormalName(production);
const l = byNormalName(local);
const names = [...new Set([...p.keys(), ...l.keys()])].sort();
const rows = names.map((name) => ({ file: name, inProduction: p.has(name), inLocal: l.has(name), equalWhenNormalised: p.has(name) && l.has(name) && p.get(name) === l.get(name) }));
const rawEqual = [...production.keys()].filter((name) => local.has(name) && production.get(name) === local.get(name)).length;
console.log(JSON.stringify({
  view,
  files: { production: production.size, local: local.size },
  equalByteForByte: rawEqual,
  equalWhenNormalised: rows.filter((row) => row.equalWhenNormalised).length,
  onlyInProduction: rows.filter((row) => row.inProduction && !row.inLocal).map((row) => row.file),
  onlyInLocal: rows.filter((row) => !row.inProduction && row.inLocal).map((row) => row.file),
  differingWhenNormalised: rows.filter((row) => row.inProduction && row.inLocal && !row.equalWhenNormalised).map((row) => row.file),
}, null, 1));
