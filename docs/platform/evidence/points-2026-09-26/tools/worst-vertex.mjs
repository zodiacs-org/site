/*
 * Feed Swiss's own sidereal time, obliquity and latitude at the worst
 * end-to-end Vertex case to the engine's vertexOf, and report the difference
 * that is left. Writes the case and the two differences, not Swiss's Vertex.
 *
 *   node tools/worst-vertex.mjs "$WORK/worst-vertex-inputs.json" > results/worst-vertex.json
 */
import { readFileSync } from 'node:fs';
import { computeAngles, vertexOf } from '@zodiacs/engine/internal/math';

const worst = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const input = { gastHours: worst.swiss.armc / 15, latitude: worst.latitude, longitude: 0, obliquity: worst.swiss.obliquity };
const vertex = vertexOf(input, computeAngles(input));
const gap = Math.abs(((vertex - worst.swiss.vertex + 540) % 360) - 180) * 3600;
const f = (worst.latitude * Math.PI) / 180;
const e = (worst.swiss.obliquity * Math.PI) / 180;
const zenith = Math.asin(Math.sin(f) * Math.cos(e) - Math.cos(f) * Math.sin(e) * Math.sin((worst.swiss.armc * Math.PI) / 180));
process.stdout.write(`${JSON.stringify({
  utc: worst.utc,
  latitude: worst.latitude,
  longitude: worst.longitude,
  zenithEclipticLatitudeDegrees: Number(((zenith * 180) / Math.PI).toFixed(4)),
  endToEndArcsec: worst.endToEndArcsec,
  givenSwissInputsArcsec: gap,
}, null, 1)}\n`);
