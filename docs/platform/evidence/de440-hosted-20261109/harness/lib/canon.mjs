/**
 * Rule (iii): the four canon events of canon-events.json, found on the hosted
 * path. For each, /positions is sampled (the Sun with the Moon, or with
 * Venus) on a 60 s grid over +-3 h about the canon instant, then by golden
 * section to 1 ms, for the TT at which the apparent geocentric separation of
 * the two centres is least. Canon TT: the eclipses' TD; the transits' UT plus
 * the TT - UT the file records.
 */
import { bodyOf } from './api.mjs';
import { DAY_MS, J2000_MS, ttDaysOf, utcForTt, isoOf } from './clock.mjs';
import { separation } from './stats.mjs';

const ttMsOf = (iso) => Date.parse(`${iso}Z`);

/** The canon TT of an event, in milliseconds of TT counted like UTC milliseconds (J2000 TT at J2000_MS). */
export function canonTt(event) {
  if (event.canon.TD) return { ttMs: ttMsOf(event.canon.TD), from: 'TD' };
  const offset = event.ttMinusUt ?? event.canon.ttMinusUtSeconds;
  if (!Number.isFinite(offset)) throw new Error(`${event.id}: no TT - UT recorded`);
  return { ttMs: ttMsOf(event.canon.UT) + offset * 1000, from: `UT + ${offset} s` };
}

export async function findMinimum(api, event, other) {
  const { ttMs: canonMs } = canonTt(event);
  const ttDays = (ms) => (ms - J2000_MS) / DAY_MS;
  // One UTC millisecond for a TT millisecond: TT - UTC is constant over hours away from a leap second.
  const anchor = utcForTt(ttDays(canonMs));
  const offset = canonMs - anchor.ms; // TT - UTC in ms at the anchor, to within the residual
  const sep = new Map();
  async function at(utcList) {
    const missing = utcList.filter((ms) => !sep.has(ms));
    if (missing.length) {
      const rows = await api.positions(missing.map(isoOf), ['Sun', other]);
      rows.forEach((row, index) => {
        const sun = bodyOf(row, 'Sun');
        const body = bodyOf(row, other);
        sep.set(missing[index], sun.fail || body.fail ? NaN : separation(sun.lon, sun.lat, body.lon, body.lat));
      });
    }
    return utcList.map((ms) => sep.get(ms));
  }
  const grid = [];
  for (let k = -180; k <= 180; k += 1) grid.push(anchor.ms + k * 60_000);
  const values = await at(grid);
  if (values.some((value) => !Number.isFinite(value))) return { fail: 'a grid sample was refused or non-finite' };
  let i = values.indexOf(Math.min(...values));
  if (i === 0 || i === grid.length - 1) return { fail: 'the least separation is at the end of the grid' };
  // Golden section over whole UTC milliseconds between the grid neighbours.
  let lo = grid[i - 1];
  let hi = grid[i + 1];
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = Math.round(hi - g * (hi - lo));
  let x2 = Math.round(lo + g * (hi - lo));
  let [f1, f2] = await at([x1, x2]);
  while (hi - lo > 3) {
    if (f1 <= f2) { hi = x2; x2 = x1; f2 = f1; x1 = Math.round(hi - g * (hi - lo)); [f1] = await at([x1]); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = Math.round(lo + g * (hi - lo)); [f2] = await at([x2]); }
  }
  const candidates = [];
  for (let ms = lo; ms <= hi; ms += 1) candidates.push(ms);
  const last = await at(candidates);
  const best = candidates[last.indexOf(Math.min(...last))];
  const ttDaysBest = ttDaysOf(best);
  const foundTtMs = J2000_MS + ttDaysBest * DAY_MS;
  return {
    utc: isoOf(best),
    foundTt: new Date(Math.round(foundTtMs)).toISOString(),
    canonTt: new Date(canonMs).toISOString(),
    dtSeconds: (foundTtMs - canonMs) / 1000,
    leastSeparationArcsec: Math.min(...last) * 3600,
    evaluations: sep.size,
    ttMinusUtcMsAtAnchor: offset,
  };
}
