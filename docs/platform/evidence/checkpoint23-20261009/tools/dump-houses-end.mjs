// rc.2 adapter: only request key system -> houseSystem; original seeds/cases unchanged.
/*
 * End to end: every house system from a UTC instant, on the engine's own
 * sidereal time and obliquity, for comparison with swe_houses_ex at the same
 * UT1. The rc.9 record's cases and seed (../../houses-2026-09-26/tools/
 * dump-end-to-end.mjs): a ladder of 55°–66.6° every 0.2° (six instants each,
 * both hemispheres), then 3,000 draws within 66° of the equator, 1800–2199.
 * calc's houses() computes the cusps as natalChart() does and gives the
 * instant's UT1 Julian day, which compare-end-to-end.py passes to Swiss
 * (../PREREGISTRATION.md). Writes engine values only.
 *
 *   node tools/dump-end-to-end.mjs > "$WORK/end-to-end.jsonl"
 */
import { houses } from '@zodiacs/engine/calc';
import { HOUSE_SYSTEMS } from '@zodiacs/engine/internal/math';

let seed = 1234567;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const start = Date.UTC(1800, 0, 1);
const end = Date.UTC(2199, 11, 31);
const instant = () => new Date(start + random() * (end - start)).toISOString();
const cases = [];
for (let tenth = 550; tenth <= 666; tenth += 2)
  for (const sign of [1, -1])
    for (let k = 0; k < 6; k += 1) cases.push({ set: 'ladder', utc: instant(), lat: (sign * tenth) / 10, lon: -180 + random() * 360 });
for (let i = 0; i < 3000; i += 1) cases.push({ set: 'broad', utc: instant(), lat: -66 + random() * 132, lon: -180 + random() * 360 });
for (const c of cases) {
  const systems = {};
  const refused = {};
  let jdUt1;
  for (const system of HOUSE_SYSTEMS) {
    const result = houses({ time: c.utc, place: { latitude: c.lat, longitude: c.lon }, houseSystem: system });
    if (result.status !== 'ok') {
      refused[system] = result.reason;
      systems[system] = null;
      continue;
    }
    jdUt1 = result.receipt.instants[0].jdUt1;
    systems[system] = result.system === system ? result.cusps : null;
  }
  process.stdout.write(`${JSON.stringify({ ...c, jdUt1, systems, ...(Object.keys(refused).length ? { refused } : {}) })}\n`);
}
