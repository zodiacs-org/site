/*
 * The engine's Vertex, East Point and Equal-from-midheaven cusps from a UTC
 * instant and place, with its own sidereal time and obliquity: 3,000 draws
 * within 66° of the equator, and the 55°–66.6° ladder every 0.2° at six
 * instants, both hemispheres. Instants run from 1800 to 2199.
 *
 *   node tools/dump-end-to-end.mjs > "$WORK/end-to-end.jsonl"
 */
import { chartPoints, natalChart } from '@zodiacs/engine';

let seed = 20260928;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const start = Date.UTC(1800, 0, 1);
const span = Date.UTC(2200, 0, 1) - start;
const cases = [];
for (let i = 0; i < 3000; i += 1)
  cases.push({ set: 'broad', utc: new Date(start + random() * span), lat: -66 + random() * 132, lon: -180 + random() * 360 });
for (let fifth = 275; fifth <= 333; fifth += 1)
  for (const sign of [1, -1])
    for (let k = 0; k < 6; k += 1)
      cases.push({ set: 'ladder', utc: new Date(start + random() * span), lat: (sign * fifth) / 5, lon: -180 + random() * 360 });
for (const c of cases) {
  const birth = { utc: c.utc, latitude: c.lat, longitude: c.lon, houseSystem: 'equal-mc' };
  const chart = natalChart(birth);
  const byName = Object.fromEntries(chartPoints(chart).points.map((p) => [p.point, p.lon]));
  process.stdout.write(`${JSON.stringify({
    set: c.set, utc: c.utc.toISOString(), lat: c.lat, lon: c.lon,
    equalMc: chart.houses.cusps, vertex: byName.Vertex, eastPoint: byName['East Point'],
  })}\n`);
}
