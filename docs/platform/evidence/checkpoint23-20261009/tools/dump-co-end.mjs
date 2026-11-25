// rc.2 adapter: request key system -> houseSystem; 2.0+ adapter: keep ratified post-2027 UT1 clock so seeds/cases stay unchanged.
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
import { ramcOf } from '@zodiacs/engine/core';
import { tilt, timeBasis } from '@zodiacs/engine/time';

const J2000_JD = 2451545.0;
const gastHoursAt = (ut, tt) => {
  const t = tt / 36525;
  const eqeq = tilt(tt).ee;
  const thet1 = 0.779057273264 + 0.00273781191135448 * ut;
  const thet3 = ut % 1;
  let theta = 360 * ((thet1 + thet3) % 1);
  if (theta < 0) theta += 360;
  const st = eqeq + 0.014506 + ((((-368e-10 * t - 29956e-9) * t - 44e-8) * t + 1.3915817) * t + 4612.156534) * t;
  let gst = ((st / 3600 + theta) % 360) / 15;
  if (gst < 0) gst += 24;
  return gst;
};

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
  const ms = c.utc.getTime();
  let jdUt1;
  let armc;
  let obliquity;
  if (timeBasis(ms, 'utc').timeScale.basis === 'continuous-utc') {
    const basis = timeBasis(ms, 'ut1');
    jdUt1 = J2000_JD + basis.ut1Days;
    obliquity = tilt(basis.ttDays).tobl;
    armc = ramcOf({ gastHours: gastHoursAt(basis.ut1Days, basis.ttDays), longitude: c.lon });
  } else {
    const result = houses({ time: line.utc, place: { latitude: c.lat, longitude: c.lon }, houseSystem: 'equal' });
    if (result.status !== 'ok') {
      process.stdout.write(`${JSON.stringify({ ...line, refused: result.reason })}\n`);
      continue;
    }
    jdUt1 = result.receipt.instants[0].jdUt1;
    armc = result.armc;
    obliquity = result.obliquity;
  }
  const points = coAscendants({ gastHours: armc / 15, longitude: 0, latitude: c.lat, obliquity });
  process.stdout.write(`${JSON.stringify({
    ...line,
    jdUt1,
    armc,
    obliquity,
    points: [points.equatorialAscendant, points.kochCoAscendant, points.munkaseyCoAscendant, points.polarAscendant],
  })}\n`);
}
