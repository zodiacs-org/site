/**
 * Fetch the raw material behind the thesis season wheel: daily en.wikipedia
 * user pageviews for each of the twelve sign articles, separately, from
 * 1 Jan 2016 to the last complete day.
 *
 *   node scripts/fetch-thesis-seasons.mjs [--out <file>]
 *
 * Writes one JSON file: per sign, the request URL, the SHA-256 of the raw API
 * response body, and the daily view counts as a dense array starting at
 * `from`. This is a reviewed, manual refresh (the workspace that edits the
 * site cannot reach Wikimedia; the "Thesis season snapshot" workflow runs it
 * and uploads the file as an artifact). Nothing in a build calls it.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const title = (sign) => `${sign[0].toUpperCase()}${sign.slice(1)}_(astrology)`;

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const FROM = '20160101';
const end = new Date();
end.setUTCDate(end.getUTCDate() - 1);
const TO = end.toISOString().slice(0, 10).replaceAll('-', '');
const out = outAt >= 0 ? resolve(args[outAt + 1]) : resolve(root, `docs/thesis-evidence/wikimedia-per-sign-${TO}.json`);

const dayIndex = (d) => (Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)) - Date.UTC(2016, 0, 1)) / 86400000;

const signs = {};
for (const sign of SIGNS) {
  const enc = encodeURIComponent(title(sign)).replace(/\(/g, '%28').replace(/\)/g, '%29');
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${enc}/daily/${FROM}00/${TO}00`;
  let res = null;
  for (let attempt = 0; attempt < 5 && !res?.ok; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * attempt));
    res = await fetch(url, { headers: { 'User-Agent': 'zodiacs.org thesis season wheel (fetch-thesis-seasons.mjs; admin@zodiacs.org)' } });
  }
  if (!res?.ok) throw new Error(`pageviews fetch failed for ${sign}: ${res?.status}`);
  const body = await res.text();
  const items = JSON.parse(body).items;
  const views = new Array(dayIndex(TO) + 1).fill(null);
  for (const item of items) views[dayIndex(item.timestamp.slice(0, 8))] = item.views;
  signs[sign] = { article: title(sign), url, sha256: createHash('sha256').update(body).digest('hex'), days: items.length, views };
  console.log(`${sign}: ${items.length} days`);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({
  $comment: 'Raw daily en.wikipedia user pageviews for each sign article, one array per sign starting at `from` (null = no row returned). Fetched by scripts/fetch-thesis-seasons.mjs; reduced by scripts/build-thesis-seasons.mjs.',
  source: 'Wikimedia REST API, pageviews per-article, en.wikipedia, all-access, user agent type',
  fetchedAt: new Date().toISOString(),
  from: FROM,
  to: TO,
  signs,
}));
console.log(`wrote ${out}`);
