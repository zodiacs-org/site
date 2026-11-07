/*
 * Precomputes the per-date facts behind the 366 /birthday/ pages.
 *
 *   npm run data:birthdays   →  src/data/birthdays.json
 *
 * For every calendar date: the sun sign (checked across 1940–2030 at that
 * date's noon UTC) and the sun's degree span across those years. Dates that
 * ever contain a sign ingress get a per-year cusp table instead of a flat
 * sign — for each year the day is
 * either wholly one sign or splits at the ingress minute, and the table
 * records which ("a", "b", or the "HH:MM" UTC ingress time that day).
 * Feb 29 is computed from leap years only. The template renders these
 * receipts; prose lives in src/content/birthdays/.
 *
 * It also writes src/data/birthdays-precise.json: the same three noon-UTC
 * longitudes (lonMin, lonMax, now.lon) to four decimals, which the website's
 * birthday pages print to the arcminute. birthdays.json keeps its 0.01°
 * values because the AI tools and the published developer plugin bundle it
 * byte for byte; the precise file is read by the site only. Neither file is
 * rewritten when only the date would change.
 */
import './lib/deltat-install.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  MakeTime, GeoVector, RotateVector, Rotation_EQJ_ECT, EclipticGeoMoon,
} from 'astronomy-engine';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/data/birthdays.json');
const outPrecise = resolve(root, 'src/data/birthdays-precise.json');
await mkdir(dirname(out), { recursive: true });

const YEAR_FROM = 1940;
const YEAR_TO = 2030;
const NOW_YEAR = 2026; // the "this year" receipt line; refresh yearly with sky.json

// Mirrors src/lib/signs.ts SIGN_SLUGS order (scripts can't import the TS
// module; keep in sync by hand).
const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function lonAt(body, date) {
  const t = MakeTime(date);
  if (body === 'Moon') {
    const lon = EclipticGeoMoon(t).lon;
    return ((lon % 360) + 360) % 360;
  }
  const vec = GeoVector(body, t, true);
  const ecl = RotateVector(Rotation_EQJ_ECT(t), vec);
  const lon = (Math.atan2(ecl.y, ecl.x) * 180) / Math.PI;
  return ((lon % 360) + 360) % 360;
}

const signAt = (date) => SIGN_SLUGS[Math.floor(lonAt('Sun', date) / 30) % 12];
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const utc = (y, m, d, hh = 0, mm = 0) => new Date(Date.UTC(y, m - 1, d, hh, mm));

function yearsFor(month, day) {
  const all = [];
  for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
    if (month === 2 && day === 29 && !isLeap(y)) continue;
    all.push(y);
  }
  return all;
}

// Bisect the ingress instant within one UTC day; returns "HH:MM".
function ingressTime(y, m, d) {
  let lo = utc(y, m, d).getTime();
  let hi = lo + 86400_000;
  const startSign = signAt(new Date(lo));
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (signAt(new Date(mid)) === startSign) lo = mid; else hi = mid;
  }
  const at = new Date(hi);
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---- pass 1: which calendar dates ever contain an ingress? -----------------
// The sun ingress near each boundary drifts across a ~3-day window over the
// leap cycle; sweep every date's day-start/day-end signs per year.
console.log('scanning boundary windows…');
const cuspDates = new Map(); // "m-d" -> { a, b, years: {} }
for (let m = 1; m <= 12; m++) {
  for (let d = 1; d <= DAYS_IN_MONTH[m - 1]; d++) {
    // Cheap prefilter: only dates within ±3 days of a multiple-of-30 sun
    // longitude (checked at noon in one year) can straddle an ingress.
    const probe = lonAt('Sun', utc(2000, m, d, 12));
    const distToBoundary = Math.min(probe % 30, 30 - (probe % 30));
    if (distToBoundary > 4) continue;

    const years = yearsFor(m, d);
    const table = {};
    let a = null;
    let b = null;
    let varies = false;
    for (const y of years) {
      const s0 = signAt(utc(y, m, d));
      const s1 = signAt(new Date(utc(y, m, d).getTime() + 86400_000 - 1000));
      if (s0 === s1) {
        table[y] = s0;
      } else {
        a = s0;
        b = s1;
        table[y] = ingressTime(y, m, d);
        varies = true;
      }
    }
    const flat = new Set(Object.values(table).filter((v) => !v.includes(':')));
    if (!varies && flat.size <= 1) continue; // one sign every year — not a cusp date
    // Fill a/b if the split rows never fired but years disagree wholesale.
    if (a === null) {
      const seen = [...flat];
      const ia = SIGN_SLUGS.indexOf(seen[0]);
      const ib = SIGN_SLUGS.indexOf(seen[1]);
      [a, b] = (ib === (ia + 1) % 12) ? [seen[0], seen[1]] : [seen[1], seen[0]];
    }
    const years2 = {};
    for (const [y, v] of Object.entries(table)) {
      years2[y] = v === a ? 'a' : v === b ? 'b' : v;
    }
    cuspDates.set(`${m}-${d}`, { a, b, years: years2 });
  }
}
console.log(`  ${cuspDates.size} cusp dates found`);

// ---- pass 2: per-date facts -------------------------------------------------
console.log('computing per-date facts…');
const days = {};
const precise = {};
const round4 = (v) => Math.round(v * 10_000) / 10_000;
for (let m = 1; m <= 12; m++) {
  for (let d = 1; d <= DAYS_IN_MONTH[m - 1]; d++) {
    const slug = `${MONTHS[m - 1]}-${d}`;
    const years = yearsFor(m, d);

    // Degree span across years at noon UTC, unwrapped around the first value
    // so the 0° Aries wrap can't produce a bogus [0, 360] span.
    const ref = lonAt('Sun', utc(years[0], m, d, 12));
    let lonMin = ref;
    let lonMax = ref;
    for (const y of years.slice(1)) {
      let lon = lonAt('Sun', utc(y, m, d, 12));
      while (lon - ref > 180) lon -= 360;
      while (ref - lon > 180) lon += 360;
      lonMin = Math.min(lonMin, lon);
      lonMax = Math.max(lonMax, lon);
    }

    const entry = {
      month: m,
      day: d,
      lonMin: Math.round(lonMin * 100) / 100,
      lonMax: Math.round(lonMax * 100) / 100,
      now: null,
    };

    // "This year" receipt (Feb 29 uses the nearest leap year).
    const nowYear = (m === 2 && d === 29 && !isLeap(NOW_YEAR))
      ? [...years].reverse().find((y) => y <= NOW_YEAR + 2)
      : NOW_YEAR;
    const nowNoon = utc(nowYear, m, d, 12);
    const nowLon = lonAt('Sun', nowNoon);
    precise[slug] = { lonMin: round4(lonMin), lonMax: round4(lonMax), nowLon: round4(nowLon) };
    entry.now = {
      year: nowYear,
      lon: Math.round(nowLon * 100) / 100,
      moonSign: SIGN_SLUGS[Math.floor(lonAt('Moon', nowNoon) / 30) % 12],
    };

    const cusp = cuspDates.get(`${m}-${d}`);
    if (cusp) {
      entry.cusp = cusp;
    } else {
      const sign = signAt(utc(2000, m, d, 12));
      // Safety: the flat sign must hold at both ends of the range.
      const early = signAt(utc(years[0], m, d, 12));
      const late = signAt(utc(years[years.length - 1], m, d, 12));
      if (early !== sign || late !== sign) {
        throw new Error(`${slug}: sign varies (${early}/${sign}/${late}) but not flagged as cusp`);
      }
      entry.sign = sign;
    }

    days[slug] = entry;
  }
}

// ---- self-validation --------------------------------------------------------
const problems = [];
const count = Object.keys(days).length;
if (count !== 366) problems.push(`expected 366 dates, got ${count}`);
if (days['july-7']?.sign !== 'cancer') problems.push('anchor: july-7 should be cancer');
if (days['february-29']?.sign !== 'pisces') problems.push('anchor: february-29 should be pisces');
if (!days['march-20']?.cusp && !days['march-21']?.cusp) problems.push('anchor: march 20/21 should carry a cusp table');
const cuspCount = Object.values(days).filter((e) => e.cusp).length;
if (cuspCount < 12 || cuspCount > 48) problems.push(`implausible cusp-date count ${cuspCount}`);
for (const [slug, e] of Object.entries(days)) {
  const span = e.lonMax - e.lonMin;
  if (span < 0 || span > 2.5) problems.push(`${slug}: degree span ${span.toFixed(2)} out of range`);
  if (e.cusp) {
    const ia = SIGN_SLUGS.indexOf(e.cusp.a);
    const ib = SIGN_SLUGS.indexOf(e.cusp.b);
    if (ib !== (ia + 1) % 12) problems.push(`${slug}: cusp pair ${e.cusp.a}/${e.cusp.b} not adjacent`);
    for (const v of Object.values(e.cusp.years)) {
      if (v !== 'a' && v !== 'b' && !/^\d{2}:\d{2}$/.test(v)) problems.push(`${slug}: bad cusp year value ${v}`);
    }
  } else if (!SIGN_SLUGS.includes(e.sign)) {
    problems.push(`${slug}: bad sign ${e.sign}`);
  }
  if (!SIGN_SLUGS.includes(e.now.moonSign)) problems.push(`${slug}: bad moon sign`);
}
if (problems.length) {
  console.error('✗ validation failed:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

for (const [slug, p] of Object.entries(precise)) {
  const e = days[slug];
  // The precise values must round to the published ones.
  for (const [a, b] of [[p.lonMin, e.lonMin], [p.lonMax, e.lonMax], [p.nowLon, e.now.lon]]) {
    if (Math.abs(a - b) > 0.0051) problems.push(`${slug}: precise ${a} does not round to ${b}`);
  }
}
if (problems.length) {
  console.error('✗ validation failed:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

// Keep the previous date when the facts are unchanged, so a rerun is a no-op.
let generated = new Date().toISOString().slice(0, 10);
try {
  const previous = JSON.parse(await readFile(out, 'utf8'));
  if (JSON.stringify(previous.days) === JSON.stringify(days)
    && previous.nowYear === NOW_YEAR
    && JSON.stringify(previous.yearRange) === JSON.stringify([YEAR_FROM, YEAR_TO])) {
    generated = previous.generated;
  }
} catch { /* first run */ }

const payload = {
  generated,
  yearRange: [YEAR_FROM, YEAR_TO],
  nowYear: NOW_YEAR,
  days,
};
await writeFile(out, `${JSON.stringify(payload, null, 1)}\n`);
await writeFile(outPrecise, `${JSON.stringify({
  note: 'Noon-UTC Sun longitudes to four decimals for the website birthday pages; birthdays.json holds the same values to 0.01 for the AI tools.',
  yearRange: [YEAR_FROM, YEAR_TO],
  nowYear: NOW_YEAR,
  days: precise,
}, null, 1)}\n`);
console.log(`✓ src/data/birthdays.json — ${count} dates, ${cuspCount} with per-year cusp tables`);
