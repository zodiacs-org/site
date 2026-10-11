/**
 * After the merge deploys: what canonical production serves for the engine
 * 1.0.0 adoption. GETs the pages and files that name the engine and the MCP
 * adapter, and sends the compute API's own documented positions request once.
 * Which deployment the zodiacs.org alias names, and its commit, is read before
 * and after this run through the Vercel connector (the CLI's install was gone
 * on the day) and recorded beside the output; ALIAS_BEFORE and ALIAS_AFTER pass
 * those reads in as JSON. Prints JSON; exits non-zero on any failed check.
 *
 *   EXPECTED_COMMIT=<merge commit> ALIAS_BEFORE='{…}' node verify-production.mjs <site checkout> > out.json
 *   ALIAS_AFTER='{…}' node verify-production.mjs --after out.json        # the read made after the run
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://zodiacs.org';
/** A connector read must name the deployment and the alias's update time before anything is compared. */
const complete = (read, name) => {
  assert.ok(read && typeof read.deploymentId === 'string' && /^dpl_[A-Za-z0-9]+$/u.test(read.deploymentId),
    `${name} must name the deployment the alias points at`);
  assert.ok(Number.isInteger(read.aliasUpdatedAt) && read.aliasUpdatedAt > 0, `${name} must carry the alias's updatedAt`);
  return read;
};
if (process.argv[2] === '--after') {
  // Second step: add the connector's read made after the run, and the check that it did not move.
  const record = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const after = complete(JSON.parse(process.env.ALIAS_AFTER ?? 'null'), 'ALIAS_AFTER');
  complete(record.alias.before, 'the recorded ALIAS_BEFORE');
  record.alias.after = after;
  // The read's fields go first, so nothing it carries can replace the computed name or result.
  record.checks.push({ ...after, name: 'alias unchanged during the checks', ok: after.deploymentId === record.alias.before.deploymentId
    && after.aliasUpdatedAt === record.alias.before.aliasUpdatedAt });
  record.ok = record.checks.every((item) => item.ok);
  console.log(JSON.stringify(record, null, 2));
  if (!record.ok) process.exitCode = 1;
  process.exit();
}
const root = resolve(process.argv[2] ?? '.');
const expected = process.env.EXPECTED_COMMIT ?? '';
assert.match(expected, /^[0-9a-f]{40}$/u, 'EXPECTED_COMMIT must be the full merge commit');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const candidate = JSON.parse(readFileSync(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
const mcp = JSON.parse(readFileSync(resolve(root, 'public/examples/mcp-server.json'), 'utf8'));

/** A connector read: { readAt, deploymentId, aliasUpdatedAt, readyState, target, githubCommitSha }. */
const alias = (name) => complete(JSON.parse(process.env[name] ?? 'null'), name);
async function get(path) {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
}

const checks = [];
// Detail first, so no field it carries can replace the check's name or result.
const check = (name, ok, detail = {}) => checks.push({ ...detail, name, ok: Boolean(ok) });
const before = alias('ALIAS_BEFORE');
check('alias names a READY production deployment of the merge', before.readyState === 'READY' && before.target === 'production'
  && before.githubCommitSha === expected, before);

for (const [path, needles] of [
  ['/developers/engine/', [`${candidate.version}, the first stable release`, `npm install ${candidate.name}@${candidate.version}`, candidate.sha256]],
  ['/developers/support/', ['a stable release, on npm.', candidate.sha256]],
  ['/developers/mcp/', ['records it under latest, and get_capabilities labels it published', mcp.version]],
  ['/llms.txt', [`\`@zodiacs/engine\` ${candidate.version}, MIT`, `\`zodiacs-mcp-server\` ${mcp.version}`]],
  ['/llms-full.txt', [`\`@zodiacs/engine\` version ${candidate.version}, the first stable release`, 'engine commit `f8992a4c1dfedd9e69c0783e2c185e22580460f7`']],
]) {
  const { status, bytes } = await get(path);
  // Pages are compared as text: tags, which carry Astro's scoped attributes, are removed.
  const text = path.endsWith('.txt') ? bytes.toString('utf8') : bytes.toString('utf8').replace(/<[^>]+>/gu, '');
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

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ schema: 'zodiacs.engine-1-0-0-production.v1', base: BASE, expectedCommit: expected, checkedAt: new Date().toISOString(),
  alias: { before }, ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
