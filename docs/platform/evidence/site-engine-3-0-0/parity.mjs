// Run from the site root: node docs/platform/evidence/site-engine-3-0-0/parity.mjs
// Prints the parity report for the Node that runs it, on DE440 as the site's server installs it.
import '../../../../src/lib/engine/server-de440.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION, natalChart, searchLongitudeCrossings } from '@zodiacs/engine';

const archive = readFileSync(`vendor/zodiacs-engine-${ENGINE_VERSION}.tgz`);
const { ephemeris } = natalChart({ utc: '2026-01-26T17:34:38Z' });
const crossing = searchLongitudeCrossings('Neptune', 0, new Date('2026-01-01T00:00:00Z'), new Date('2026-02-28T00:00:00Z'));
const at = (crossing.crossings ?? crossing)[0]?.at ?? (crossing.crossings ?? crossing)[0];
console.log(JSON.stringify({
  engineVersion: ENGINE_VERSION,
  artifactSHA256: createHash('sha256').update(archive).digest('hex'),
  node: process.version,
  scope: 'Public position and longitude crossing entries, checked with the January Neptune reference.',
  ephemeris: ephemeris.name === 'jpl-de440' ? 'de440' : ephemeris.name,
  packSHA256: ephemeris.version,
  neptuneAries: new Date(at).toISOString(),
}, null, 2));
