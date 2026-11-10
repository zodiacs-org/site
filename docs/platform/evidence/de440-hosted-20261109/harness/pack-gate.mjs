/**
 * The deploy's pack against the ERFA chain's oracles, through the vendored
 * engine's @zodiacs/engine/de440 (what the hosted backend runs): every place
 * within 0.002 arcsecond and the true node within 0.1 arcsecond at the 200
 * instants. A regression gate for the pack the build makes, from the engine's
 * measured 0.00094" and 0.066" (its docs/evidence/de440-20261110/
 * pack-accuracy.json); not one of the preregistered rules.
 *
 *   node pack-gate.mjs <sealed pack>
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { openDe440Pack } from '@zodiacs/engine/de440';

const PACK_SHA256 = '51428874d9a47213abc0ff42cbcec65f338624eaa2d8831f0e6ddc3654bf1fa7';
const ORACLES = new URL('../oracles/', import.meta.url);
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;
const PLACE_GATE = 0.002;
const NODE_GATE = 0.1;
const bytes = new Uint8Array(readFileSync(process.argv[2]));
const source = await openDe440Pack(bytes, { expectDigest: PACK_SHA256 });
const places = JSON.parse(readFileSync(new URL('erfa-places.json', ORACLES), 'utf8'));
const nodes = JSON.parse(readFileSync(new URL('erfa-nodes.json', ORACLES), 'utf8'));
const unit = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const angle = (a, b) => {
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return (Math.atan2(Math.hypot(...c), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD) * 3600;
};
let placeMax = 0;
for (const row of places.rows) {
  const p = source.place(row.body, (row.ttMs - J2000_MS) / 86_400_000);
  placeMax = Math.max(placeMax, angle(unit(p.lon, p.lat), unit(Number(row.lon), Number(row.lat))));
}
let nodeMax = 0;
for (const row of nodes.rows) {
  let d = (source.trueNode((row.ttMs - J2000_MS) / 86_400_000) - Number(row.northNodeLon)) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  nodeMax = Math.max(nodeMax, Math.abs(d) * 3600);
}
const pass = placeMax <= PLACE_GATE && nodeMax <= NODE_GATE;
console.log(`pack ${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}: places within ${placeMax.toExponential(3)}" (gate ${PLACE_GATE}"), true node within ${nodeMax.toExponential(3)}" (gate ${NODE_GATE}"): ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
