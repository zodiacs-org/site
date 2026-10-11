/**
 * After the merge deploys: what canonical production serves for the engine
 * 1.0.0 adoption. Reads, through the Vercel CLI's existing login, which
 * deployment the zodiacs.org alias names and that deployment's commit, before
 * and after; then GETs the pages and files that name the engine and the MCP
 * adapter, and sends the compute API's own committed synthetic positions
 * request once. Prints JSON; exits non-zero on any failed check.
 *
 *   EXPECTED_COMMIT=<merge commit> node verify-production.mjs <site checkout>
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://zodiacs.org';
const TEAM = 'team_Ue0ac8HT1b3TAzaDDZBTFhQt';
const root = resolve(process.argv[2] ?? '.');
const expected = process.env.EXPECTED_COMMIT ?? '';
assert.match(expected, /^[0-9a-f]{40}$/u, 'EXPECTED_COMMIT must be the full merge commit');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const candidate = JSON.parse(readFileSync(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
const mcp = JSON.parse(readFileSync(resolve(root, 'public/examples/mcp-server.json'), 'utf8'));

function vercel(path) {
  return JSON.parse(execFileSync('vercel', ['api', path, '--method', 'GET'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
}
function alias() {
  const readAt = new Date().toISOString();
  const record = vercel(`/v4/aliases/zodiacs.org?teamId=${TEAM}`);
  const deployment = vercel(`/v13/deployments/${encodeURIComponent(record.deploymentId)}?teamId=${TEAM}`);
  return { readAt, deploymentId: record.deploymentId, aliasUpdatedAt: record.updatedAt, readyState: deployment.readyState,
    target: deployment.target, githubCommitSha: deployment.meta?.githubCommitSha ?? null };
}
async function get(path) {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
}

const checks = [];
const check = (name, ok, detail = {}) => checks.push({ name, ok: Boolean(ok), ...detail });
const before = alias();
check('alias names a READY production deployment of the merge', before.readyState === 'READY' && before.target === 'production'
  && before.githubCommitSha === expected, before);

for (const [path, needles] of [
  ['/developers/engine/', [`${candidate.version}, the first stable release`, `npm install ${candidate.name}@${candidate.version}`, candidate.sha256]],
  ['/developers/support/', ['a stable release, on npm.', candidate.sha256]],
  ['/developers/mcp/', [`it under <code>latest</code>`, mcp.version]],
  ['/llms.txt', [`\`@zodiacs/engine\` ${candidate.version}, MIT`, `\`zodiacs-mcp-server\` ${mcp.version}`]],
  ['/llms-full.txt', [`\`@zodiacs/engine\` version ${candidate.version}, the first stable release`, `engine commit f8992a4c1dfedd9e69c0783e2c185e22580460f7`]],
]) {
  const { status, bytes } = await get(path);
  const text = bytes.toString('utf8');
  const missing = needles.filter((needle) => !text.includes(needle));
  check(`${path} names engine ${candidate.version}`, status === 200 && missing.length === 0, { status, missing });
}

const provenance = await get('/developers/engine/reference/provenance.json');
const reference = JSON.parse(provenance.bytes.toString('utf8'));
check('TypeDoc provenance names 1.0.0 and its archive', provenance.status === 200 && reference.version === candidate.version
  && reference.sha256 === candidate.sha256 && reference.sourceCommit === candidate.sourceCommit, { status: provenance.status, version: reference.version });

const manifest = await get('/examples/mcp-server.json');
const served = JSON.parse(manifest.bytes.toString('utf8'));
check('MCP manifest is the committed one', manifest.status === 200 && JSON.stringify(served) === JSON.stringify(mcp), { status: manifest.status, version: served.version });
const archive = await get(`/examples/${mcp.file}`);
check('MCP archive has the manifest digest', archive.status === 200 && sha256(archive.bytes) === mcp.sha256 && archive.bytes.length === mcp.bytes,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes) });

// The compute API's own documented positions example (src/lib/compute-api/examples.ts, positions.two):
// two instants and three bodies, no person's data.
const body = { instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'] };
assert.match(readFileSync(resolve(root, 'src/lib/compute-api/examples.ts'), 'utf8'),
  /instants: \['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'\], bodies: \['Sun', 'Moon', 'Mercury'\]/u, 'the documented example is unchanged');
const response = await fetch(BASE + '/api/v1/positions', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  cache: 'no-store', signal: AbortSignal.timeout(30000),
});
const answer = await response.json().catch(() => null);
check('compute API answers on engine 1.0.0', response.status === 200 && answer?.backend?.version === candidate.version
  && answer?.receipt?.engine?.version === candidate.version, { status: response.status, backend: answer?.backend, receiptEngine: answer?.receipt?.engine });

const after = alias();
check('alias unchanged during the checks', after.deploymentId === before.deploymentId && after.aliasUpdatedAt === before.aliasUpdatedAt, after);
const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ schema: 'zodiacs.engine-1-0-0-production.v1', base: BASE, expectedCommit: expected, checkedAt: new Date().toISOString(),
  alias: { before, after }, ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
