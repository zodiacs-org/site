/**
 * How far rc.15's clock is from rc.14's, from 1972-01-01 to 2027-10-02, where
 * rc.15 reads an instant as UTC and rc.14 read it as UT1 with the ΔT model.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/clock-difference.mjs > clock-difference.json
 *
 * At every hour of the span and the millisecond before it (both sides of every
 * leap second), with rc.15's time basis as the package computes it
 * (src/lib/engine/time-basis.mjs) and rc.14's as the ΔT model of the same
 * package: TT and UT1 on rc.15 minus rc.14, in seconds, and rc.15's ΔT
 * (TT − UT1) minus the model's. An event found at a fixed TT moves by minus
 * the TT difference. Outside the span both read the instant as UT1 with the
 * model.
 */
import { deltaT } from '@zodiacs/engine/deltat';
import { timeBasis } from '../../../../../src/lib/engine/time-basis.mjs';

const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
const HOUR = 3_600_000;
const from = Date.UTC(1972, 0, 1);
const to = Date.UTC(2027, 9, 2);
const largest = () => ({ seconds: 0, at: null });
const stats = { tt: largest(), ut1: largest(), deltaT: largest() };
const ranges = { tt: {}, ut1: {} };
let samples = 0;
const keep = (row, value, at) => {
  if (Math.abs(value) > Math.abs(row.seconds)) Object.assign(row, { seconds: Number(value.toFixed(6)), at });
};
const range = (store, year, value) => {
  const key = year < 2026 ? `${Math.floor(year / 10) * 10}s` : String(year);
  const row = (store[key] ??= { min: Infinity, max: -Infinity });
  row.min = Math.min(row.min, value);
  row.max = Math.max(row.max, value);
};
for (let hour = from; hour <= to; hour += HOUR) {
  for (const t of hour === from ? [hour] : [hour - 1, hour]) {
    const basis = timeBasis(t, 'utc');
    if (basis.timeScale.basis !== 'iers') continue;
    samples += 1;
    const days = (t - J2000) / DAY;
    const at = new Date(t).toISOString();
    const tt = (basis.ttDays - days) * 86400 - deltaT(days);
    const ut1 = (basis.ut1Days - days) * 86400;
    keep(stats.tt, tt, at);
    keep(stats.ut1, ut1, at);
    keep(stats.deltaT, basis.deltaT.seconds - deltaT(days), at);
    const year = new Date(t).getUTCFullYear();
    range(ranges.tt, year, tt);
    range(ranges.ut1, year, ut1);
  }
}
const round = (store) => Object.fromEntries(Object.entries(store).map(([key, { min, max }]) => [key, { min: Number(min.toFixed(3)), max: Number(max.toFixed(3)) }]));
process.stdout.write(`${JSON.stringify({
  schema: 'zodiacs-site-clock-difference/v1',
  generatedAt: new Date().toISOString(),
  node: process.version,
  span: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), samples, cadence: 'every hour and the millisecond before it' },
  units: 'seconds, rc.15 minus rc.14 at the same instant',
  largest: stats,
  byDecadeAndYear: { tt: round(ranges.tt), ut1: round(ranges.ut1) },
}, null, 1)}\n`);
