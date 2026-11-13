/*
 * The Sun's sign entries, 2026 through 2040, for the season pages
 * (src/lib/seasons/windows.ts):
 *
 *   node scripts/build-sun-ingresses.mjs           →  src/data/sun-ingresses.json
 *   node scripts/build-sun-ingresses.mjs --check   (fails when the file is stale)
 *
 * Same calculation as build-ingresses.mjs, Sun only: the engine's ΔT
 * installed in astronomy-engine, the apparent geocentric ecliptic longitude
 * of date, a one-day scan from 2026-01-01 and 22 bisection steps (about
 * 0.02 s) at each sign boundary, so the years both files hold agree to the
 * millisecond. Only closed windows are written: the clamped first window and
 * the still-open last one are dropped. The scan runs to 2041-02-01, so the
 * table runs from the Sun's entry into Aquarius in January 2026 to its exit
 * from Capricorn in January 2041: every sign's season that begins in 2040
 * is complete.
 *
 * ingresses.json is left alone on purpose: it is bundled byte for byte into
 * the AI runtime and the published developer plugin. This file carries no
 * generation timestamp, so a rebuild is byte-identical and `--check` holds.
 */
import './lib/deltat-install.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MakeTime, GeoVector, RotateVector, Rotation_EQJ_ECT, Body } from 'astronomy-engine';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/data/sun-ingresses.json');
const check = process.argv.includes('--check');

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const DAY = 86400_000;
const FROM = Date.UTC(2026, 0, 1);
const TO = Date.UTC(2041, 1, 1);

const norm = (x) => ((x % 360) + 360) % 360;

function lonAt(date) {
  const t = MakeTime(date);
  const vec = GeoVector(Body.Sun, t, true);
  const ecl = RotateVector(Rotation_EQJ_ECT(t), vec);
  return norm((Math.atan2(ecl.y, ecl.x) * 180) / Math.PI);
}

const signIndexAt = (date) => Math.floor(lonAt(date) / 30);

/** Bisect the boundary where the sign index flips from `prev`. */
function refine(lo, hi, prev) {
  for (let i = 0; i < 22; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (signIndexAt(mid) !== prev) hi = mid; else lo = mid;
  }
  return hi;
}

const windows = [];
let prevIndex = signIndexAt(new Date(FROM));
let windowStart = null;
for (let t = FROM + DAY; t <= TO; t += DAY) {
  const date = new Date(t);
  const index = signIndexAt(date);
  if (index === prevIndex) continue;
  const boundary = refine(new Date(t - DAY), date, prevIndex);
  if (windowStart) {
    windows.push({ sign: SIGN_SLUGS[prevIndex], from: windowStart.toISOString(), to: boundary.toISOString() });
  }
  windowStart = boundary;
  prevIndex = index;
}

// Refuse to write a corrupt table.
const problems = [];
for (let i = 0; i < windows.length; i += 1) {
  const days = (Date.parse(windows[i].to) - Date.parse(windows[i].from)) / DAY;
  if (days < 29 || days > 32) problems.push(`${windows[i].sign} ${windows[i].from}: ${days.toFixed(2)} days`);
  if (i > 0) {
    if (windows[i].from !== windows[i - 1].to) problems.push(`gap between ${windows[i - 1].to} and ${windows[i].from}`);
    const expected = SIGN_SLUGS[(SIGN_SLUGS.indexOf(windows[i - 1].sign) + 1) % 12];
    if (windows[i].sign !== expected) problems.push(`${windows[i].from}: ${windows[i].sign} after ${windows[i - 1].sign}`);
  }
}
for (const sign of SIGN_SLUGS) {
  if (!windows.some((w) => w.sign === sign && w.from.startsWith('2040-'))) problems.push(`no ${sign} season starts in 2040`);
}
if (problems.length) {
  console.error(`build-sun-ingresses: validation failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const payload = {
  source: 'scripts/build-sun-ingresses.mjs',
  body: 'Sun',
  horizon: { from: new Date(FROM).toISOString().slice(0, 10), to: new Date(TO).toISOString().slice(0, 10) },
  windows,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;

if (check) {
  const committed = await readFile(out, 'utf8').catch(() => '');
  if (committed !== text) {
    console.error('build-sun-ingresses: src/data/sun-ingresses.json is stale; run node scripts/build-sun-ingresses.mjs');
    process.exit(1);
  }
  console.log(`build-sun-ingresses: ${windows.length} windows up to date`);
} else {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, text);
  console.log(`build-sun-ingresses: ${windows.length} windows → src/data/sun-ingresses.json`);
}
