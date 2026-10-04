/*
 * The engine's four co-ascendant points from a UTC instant and a place, with
 * its own sidereal time and true obliquity: calc's houses() gives the RAMC, the
 * obliquity and the instant's UT1 Julian day, and coAscendants() the points.
 * 3,000 draws within 66° of the equator, then the 55°–66.6° ladder every 0.2°
 * at six instants, north then south. Instants run from 1800 to 2199. Writes
 * engine values only (../PREREGISTRATION.md).
 *
 *   node tools/dump-end-to-end.mjs > "$WORK/end-to-end.jsonl"
 */
import { houses } from '@zodiacs/engine/calc';
import { coAscendants } from '@zodiacs/engine/houses';

let seed = 20261004;
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
  const line = { set: c.set, utc: c.utc.toISOString(), lat: c.lat, lon: c.lon };
  const result = houses({ time: line.utc, place: { latitude: c.lat, longitude: c.lon }, system: 'equal' });
  if (result.status !== 'ok') {
    process.stdout.write(`${JSON.stringify({ ...line, refused: result.reason })}\n`);
    continue;
  }
  const points = coAscendants({ gastHours: result.armc / 15, longitude: 0, latitude: c.lat, obliquity: result.obliquity });
  process.stdout.write(`${JSON.stringify({
    ...line,
    jdUt1: result.receipt.instants[0].jdUt1,
    armc: result.armc,
    obliquity: result.obliquity,
    points: [points.equatorialAscendant, points.kochCoAscendant, points.munkaseyCoAscendant, points.polarAscendant],
  })}\n`);
}
