import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defaultEphemeris, ENGINE_VERSION } from '@zodiacs/engine';
import { computeBodies, longitudeSpeed } from '@zodiacs/engine/internal';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { timeBasis } from '@zodiacs/engine/time';
import { MEASURE } from '../../swiss-benchmark/tools/corpus.mjs';

const DAY_MS = 86_400_000;
const VENDOR = new URL('../../../../../vendor/zodiacs-engine-2.1.0.tgz', import.meta.url);
assert.equal(defaultEphemeris().name, 'de440');

function row(ms) {
  const date = new Date(ms);
  const { ut1Days, ttDays } = timeBasis(ms, 'utc');
  const bodies = Object.fromEntries(computeBodies(date).map(({ body, lon, lat }) => [body, [lon, lat]]));
  return { utc: date.toISOString(), ut1Days, ttDays, bodies };
}

const dense = [];
for (let ms = Date.UTC(1800, 0, 1, 12); ms < Date.UTC(2200, 0, 1); ms += 10 * DAY_MS) {
  dense.push(row(ms));
}
const clock = [];
for (let ms = Date.UTC(2100, 0, 1); ms < Date.UTC(2200, 0, 1); ms += DAY_MS) {
  const { ttDays, deltaT } = timeBasis(ms, 'utc');
  const speed = Math.abs(longitudeSpeed('Moon', new Date(ms))) / 24;
  clock.push({ ttDays, deltaT: deltaT.seconds, sigma: deltaT.sigma, moonArcsecPerSecond: speed });
}

process.stdout.write(JSON.stringify({
  engine: ENGINE_VERSION,
  ephemeris: defaultEphemeris().name,
  archiveSha256: createHash('sha256').update(readFileSync(VENDOR)).digest('hex'),
  deltaTTableDigest: deltaTAt(0).tableDigest,
  stratified: MEASURE.map(({ id, stratum, utc }) => ({ id, stratum, ...row(Date.parse(utc)) })),
  dense,
  clock,
}) + '\n');
