/*
 * End to end: every house system from a UTC instant, on the engine's own
 * sidereal time and obliquity, for comparison with swe_houses_ex from the same
 * instant. A ladder of 55°–66.6° every 0.2° (six instants each, both
 * hemispheres) and 3,000 draws within 66° of the equator, 1800–2199.
 *
 *   node tools/dump-end-to-end.mjs > "$WORK/end-to-end.jsonl"
 */
import { natalChart } from '@zodiacs/engine';
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
  for (const houseSystem of HOUSE_SYSTEMS) {
    const chart = natalChart({ utc: c.utc, latitude: c.lat, longitude: c.lon, houseSystem });
    systems[houseSystem] = chart.houses.system === houseSystem ? chart.houses.cusps : null;
  }
  process.stdout.write(`${JSON.stringify({ ...c, systems })}\n`);
}
