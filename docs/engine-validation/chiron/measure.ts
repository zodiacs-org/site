/**
 * How far the Chiron table's interpolation is from NASA JPL Horizons on every day from 1800 to 2199.
 *
 *   python3 docs/engine-validation/chiron/fetch.py --dense /some/dir
 *   npx vite-node --script docs/engine-validation/chiron/measure.ts /some/dir
 *
 * It reads the daily Horizons responses that fetch.py --dense wrote (not kept: about 7 MB), evaluates
 * chironAtJdTT (src/ai-tools/features/chiron.ts, the code the tools run) at each day from 1800-01-01 to
 * 2199-12-31 TT that is not a table row, and writes statistics only to dense-check.json beside this file:
 * the longitude's difference from Horizons, and the daily motion's from Horizons' own motion, the central
 * difference of the days either side. It also finds every station and sign change in the daily values (where the
 * day-to-day change turns sign, and where the longitude passes a multiple of 30 degrees, between two days) and
 * pairs each with the one chironEvents finds from the table, two years at a time. The SHA-256 of each response is
 * recorded, so a later run can show it read the same values.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chironAtJdTT, chironEvents } from '../../../src/ai-tools/features/chiron';
import table from '../../../src/data/chiron.json';
import { timeBasis } from '@zodiacs/engine/time';

const SPAN = [2378496.5, 2524593.5];
const directory = process.argv[2];
if (!directory) throw new Error('Give the directory fetch.py --dense wrote.');

const responses: { file: string; bytes: number; sha256: string }[] = [];
const days = new Map<number, number>();
for (const file of readdirSync(directory).filter((name) => /^daily-\d+\.5\.txt$/u.test(name)).sort()) {
  const bytes = readFileSync(join(directory, file));
  responses.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  const text = bytes.toString('utf8');
  for (const line of text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE')).trim().split('\n')) {
    const [jd, lon] = line.trim().split(/\s+/u).map(Number);
    days.set(jd, lon);
  }
}
const wrap = (difference: number) => ((((difference + 180) % 360) + 360) % 360) - 180;
const arcsec = (degrees: number) => Math.abs(degrees) * 3600;
const longitude: { jd: number; error: number }[] = [];
const motion: { jd: number; error: number }[] = [];
for (const [jd, lon] of [...days].sort((a, b) => a[0] - b[0])) {
  if (jd < SPAN[0] || jd >= SPAN[1]) continue;
  if ((jd - table.firstJd) % table.stepDays === 0) continue;
  const found = chironAtJdTT(jd);
  longitude.push({ jd, error: arcsec(wrap(found.lon - lon)) });
  const [before, after] = [days.get(jd - 1), days.get(jd + 1)];
  if (before !== undefined && after !== undefined) motion.push({ jd, error: arcsec(found.speed - wrap(after - before) / 2) });
}
const stats = (rows: { jd: number; error: number }[]) => {
  const sorted = rows.map((row) => row.error).sort((a, b) => a - b);
  const worst = rows.reduce((a, b) => (b.error > a.error ? b : a));
  const at = (q: number) => Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(3));
  return { count: rows.length, median: at(0.5), p99: at(0.99), max: Number(worst.error.toFixed(3)), worstJdTT: worst.jd };
};

// Stations and sign changes in the daily values, on the engine's UTC (TT less its Delta T), against the table's.
const J2000 = 2451545;
const utcOf = (jdTT: number) => {
  let ms = (jdTT - 2440587.5) * 86_400_000;
  for (let round = 0; round < 4; round += 1) ms -= (J2000 + timeBasis(ms).ttDays - jdTT) * 86_400_000;
  return ms;
};
const series = [...days].sort((a, b) => a[0] - b[0]);
const unwrapped: number[] = [];
for (const [, lon] of series) unwrapped.push(unwrapped.length ? unwrapped.at(-1)! + wrap(lon - unwrapped.at(-1)!) : lon);
const daily: { kind: 'station' | 'ingress'; ms: number }[] = [];
for (let index = 1; index + 1 < series.length; index += 1) {
  const [before, here, after] = [unwrapped[index - 1], unwrapped[index], unwrapped[index + 1]];
  if (Math.sign(here - before) !== Math.sign(after - here)) daily.push({ kind: 'station', ms: utcOf(series[index][0]) });
  const [a, b] = [Math.floor(here / 30), Math.floor(after / 30)];
  if (a !== b) daily.push({ kind: 'ingress', ms: utcOf(series[index][0] + (Math.max(a, b) * 30 - here) / (after - here)) });
}
const [spanFrom, spanTo] = [Date.UTC(1800, 0, 1), Date.UTC(2200, 0, 1)];
const found: { kind: 'station' | 'ingress'; ms: number }[] = [];
for (let year = 1800; year < 2200; year += 2) {
  for (const event of chironEvents(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 2, 0, 1))).events) found.push({ kind: event.kind, ms: event.at.getTime() });
}
const paired = (kind: 'station' | 'ingress') => {
  const reference = daily.filter((event) => event.kind === kind && event.ms >= spanFrom && event.ms < spanTo);
  const ours = found.filter((event) => event.kind === kind);
  if (reference.length !== ours.length) throw new Error(`${kind}: ${reference.length} in the daily values, ${ours.length} from the table`);
  const hours = reference.map((event, index) => Math.abs(ours[index].ms - event.ms) / 3_600_000);
  const gaps = ours.slice(1).map((event, index) => (event.ms - ours[index].ms) / 86_400_000);
  return { daily: reference.length, table: ours.length, maxHoursApart: Number(Math.max(...hours).toFixed(2)), fewestDaysBetween: Number(Math.min(...gaps).toFixed(1)) };
};

const out = {
  what: 'The Chiron table (src/data/chiron.json), interpolated by src/ai-tools/features/chiron.ts, against every daily NASA JPL Horizons value from 1800-01-01 to 2199-12-31 TT that is not a table row: the longitude in arcseconds, and the daily motion in arcseconds a day against the central difference of the Horizons values a day either side. Statistics only; the responses are not kept.',
  query: 'fetch.py --dense: observer quantity 31, 2060;, 500@399, TT, airless, every day from 1799-06-01 to 2200-07-01 in 16,000-day requests',
  measured: new Date().toISOString().slice(0, 10),
  table: { sha256: table.source.sha256, stepDays: table.stepDays, points: table.points },
  responses,
  longitudeArcsec: stats(longitude),
  dailyMotionArcsecPerDay: stats(motion),
  // Read from daily values, a station's time is only good to about a day and a sign change's to a few minutes;
  // the hourly windows kept under horizons/ check both more finely (src/ai-tools/features/chiron.test.ts).
  stations: paired('station'),
  signChanges: paired('ingress'),
};
writeFileSync(new URL('./dense-check.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify({ longitude: out.longitudeArcsec, motion: out.dailyMotionArcsecPerDay, stations: out.stations, signChanges: out.signChanges }));
