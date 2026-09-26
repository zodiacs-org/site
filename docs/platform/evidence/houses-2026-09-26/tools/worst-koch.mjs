// Feed Swiss's own RAMC and obliquity at the worst Koch case to the engine's
// Koch function, and report how far the cusps then are from Swiss's. Keeps the
// case and the two differences only.
import { readFileSync } from 'node:fs';
import { computeAngles, kochCusps } from '@zodiacs/engine/internal/math';

const worst = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const input = { gastHours: worst.swissRamc / 15, latitude: worst.latitude, longitude: 0, obliquity: worst.swissTrueObliquity };
const cusps = kochCusps(input, computeAngles(input));
const gap = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180) * 3600;
process.stdout.write(`${JSON.stringify({
  utc: worst.utc,
  latitude: worst.latitude,
  longitude: worst.longitude,
  endToEndArcsec: worst.endToEndArcsec,
  givenSwissInputsArcsec: Math.max(...cusps.map((cusp, index) => gap(cusp, worst.swissCusps[index])))
}, null, 1)}\n`);
