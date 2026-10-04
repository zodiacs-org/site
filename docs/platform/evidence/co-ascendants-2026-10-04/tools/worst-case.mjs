/*
 * The worst ladder case from 1850 to 2049: feeds Swiss's own RAMC and true
 * obliquity, from the scratch file compare-end-to-end.py writes, to the
 * engine's coAscendants, and prints the case's instant, place and differences
 * only, end to end and given Swiss's inputs (../PREREGISTRATION.md).
 *
 *   node tools/worst-case.mjs "$WORK/worst-case.json" > results/worst-case.json
 */
import { readFileSync } from 'node:fs';
import { coAscendants } from '@zodiacs/engine/houses';

const NAMES = ['equatorialAscendant', 'kochCoAscendant', 'munkaseyCoAscendant', 'polarAscendant'];
const worst = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const gap = (a, b) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180) * 3600;
const figure = (v) => Number(v.toPrecision(4));

const given = coAscendants({ gastHours: worst.swiss.armc / 15, longitude: 0, latitude: worst.lat, obliquity: worst.swiss.obliquity });
const record = {
  unit: 'arcseconds',
  utc: worst.utc,
  latitude: worst.lat,
  longitude: worst.lon,
  endToEnd: Object.fromEntries(NAMES.map((name, k) => [name, figure(worst.endToEnd[k])])),
  givenSwissInputs: Object.fromEntries(NAMES.map((name, k) => [name, figure(gap(given[name], worst.swiss.points[k]))])),
};
process.stdout.write(`${JSON.stringify(record, null, 1)}\n`);
