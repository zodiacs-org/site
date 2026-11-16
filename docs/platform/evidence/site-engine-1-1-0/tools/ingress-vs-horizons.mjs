/**
 * ZOD-63: the engine's sign changes against NASA JPL Horizons.
 *
 * For every sign change in src/data/nasa-event-instants.json (solved on Horizons DE441 apparent
 * geocentric ecliptic longitude of date, QUANTITIES 31, Mars to Pluto as system barycentres, which is
 * also what the engine's DE440 pack computes), find the engine's crossing of the same boundary in the
 * same direction within two days and record the difference in seconds, and that difference as an angle
 * at the planet's speed then.
 *
 * Usage: node docs/platform/evidence/site-engine-1-1-0/tools/ingress-vs-horizons.mjs [engine module path]
 * With no path it imports the installed @zodiacs/engine. Writes JSON to stdout.
 *
 * A fresh Horizons query was not possible from the session that wrote this: its network policy refused
 * ssd.jpl.nasa.gov (proxy 403), so the reference is the committed table, whose provenance block names
 * each Horizons query URL with its retrieval time and the SHA-256 of the response.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const engine = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@zodiacs/engine');
const { searchLongitudeCrossings, positions, ENGINE_VERSION } = engine;
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const DAY = 86_400_000;
const table = JSON.parse(readFileSync(new URL('../../../../../src/data/nasa-event-instants.json', import.meta.url), 'utf8'));
const NAMED = [['Neptune', 'aries', '2026-01-26'], ['Saturn', 'aries', '2026-02-14'], ['Uranus', 'gemini', '2026-04-26'], ['Uranus', 'gemini', '2025-07-07'], ['Saturn', 'aries', '2025-05-25'], ['Pluto', 'aquarius', '2024-11-19'], ['Pluto', 'aquarius', '2024-01-21']];

const rows = [];
for (const row of table.ingresses) {
  const index = SIGNS.indexOf(row.sign);
  const boundary = ((row.retrograde ? index + 1 : index) % 12) * 30;
  const nasa = Date.parse(row.nasa);
  const result = searchLongitudeCrossings(row.body, boundary, new Date(nasa - 2 * DAY), new Date(nasa + 2 * DAY), { stepDays: 1 });
  const same = (result.crossings ?? []).filter((crossing) => crossing.retrograde === row.retrograde);
  if (!same.length) { rows.push({ ...row, engine: null }); continue; }
  const best = same.reduce((a, b) => (Math.abs(b.at - nasa) < Math.abs(a.at - nasa) ? b : a));
  const seconds = (best.at.getTime() - nasa) / 1000;
  const speed = positions(best.at).find((p) => p.body === row.body).speed; // degrees a day
  rows.push({ body: row.body, sign: row.sign, retrograde: row.retrograde, nasa: row.nasa, engine: best.at.toISOString(), seconds: Math.round(seconds * 10) / 10, arcseconds: Math.round(Math.abs(seconds / 86400 * speed * 3600) * 10000) / 10000 });
}

const summary = {};
for (const row of rows) {
  const era = row.nasa < '1962' ? 'before 1962 (UT1)' : '1962 to 2099 (UTC)';
  const key = `${row.body}, ${era}`;
  const s = (summary[key] ??= { count: 0, withinOneMinute: 0, largestSeconds: 0, largestArcseconds: 0, missing: 0 });
  s.count += 1;
  if (row.engine === null) { s.missing += 1; continue; }
  if (Math.abs(row.seconds) <= 60) s.withinOneMinute += 1;
  if (Math.abs(row.seconds) > Math.abs(s.largestSeconds)) s.largestSeconds = row.seconds;
  s.largestArcseconds = Math.max(s.largestArcseconds, row.arcseconds);
}
const named = NAMED.map(([body, sign, day]) => rows.find((row) => row.body === body && row.sign === sign && row.nasa.startsWith(day)));
console.log(JSON.stringify({ engine: ENGINE_VERSION, reference: 'src/data/nasa-event-instants.json (Horizons DE441, QUANTITIES 31)', named, summary, rows }, null, 1));
