import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const candidate = JSON.parse(await readFile('src/data/platform-engine-candidate.json', 'utf8'));
const closure = JSON.parse(await readFile('docs/platform/evidence/site-engine-1-0-0-rc2/candidate-engine-closure.json', 'utf8'));
const sourceCommit = process.env.PRODUCTION_SOURCE_COMMIT;
assert.match(sourceCommit || '', /^[a-f0-9]{40}$/, 'Verified deployment source commit required');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function publicResponse(path, options = {}) {
  const response = await fetch('https://zodiacs.org' + path, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'Public production response: ' + path);
  return response;
}
const assets = [];
for (const chunk of closure.chunks) {
  assert.match(chunk.file, /^[A-Za-z0-9._-]+\.js$/);
  const built = await readFile(resolve('dist/_astro', chunk.file));
  const served = Buffer.from(await (await publicResponse('/_astro/' + chunk.file)).arrayBuffer());
  assert.deepEqual(served, built, 'Production candidate bytes: ' + chunk.file);
  const gzipBytes = gzipSync(built, { level: 9 }).length;
  assert.equal(gzipBytes, chunk.gzip, 'Pinned closure budget');
  assets.push({ file: chunk.file, bytes: served.length, sha256: digest(served), gzipBytes });
}
assert.equal(assets.length, 7);
assert.equal(assets.reduce((sum, asset) => sum + asset.gzipBytes, 0), closure.gzipBytes);
const request = {
  instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'],
  bodies: ['Sun', 'Moon', 'Mercury'],
};
const bytes = Buffer.from(await (await publicResponse('/api/v1/positions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
})).arrayBuffer());
const result = JSON.parse(bytes.toString('utf8'));
assert.equal(result.backend.name, candidate.name);
assert.equal(result.backend.version, candidate.version);
assert.equal(result.result.instants.length, 2);
for (let index = 0; index < request.instants.length; index++) {
  const instant = result.result.instants[index];
  assert.equal(instant.instant, new Date(request.instants[index]).toISOString());
  assert.deepEqual(instant.bodies.map((body) => body.body), request.bodies);
  for (const body of instant.bodies) {
    assert.ok(Number.isFinite(body.lon) && body.lon >= 0 && body.lon < 360);
    assert.ok(Number.isFinite(body.lat) && Number.isFinite(body.speed));
  }
}
console.log(JSON.stringify({
  schema: 'zodiacs.programme-production.v1', checkedAt: new Date().toISOString(),
  expectedProductionSourceCommit: sourceCommit,
  candidate: { version: candidate.version, sha256: candidate.sha256, sourceCommit: candidate.sourceCommit },
  assets,
  hostedPositions: { status: 'pass', instants: 2, bodiesPerInstant: 3, backend: result.backend,
    responseSha256: digest(bytes) },
  limitations: ['Source commit is separately verified against Vercel deployment metadata.',
    'Synthetic public probes establish adoption, not independent numerical accuracy or stable publication.',
    'No private birth data, account or authentication bypass was used.'],
}, null, 2));
