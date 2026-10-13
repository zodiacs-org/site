// Controls for S4's production check: each alters one input, runs verify-production.mjs, records which
// checks failed, and restores the input byte for byte (checked by digest) before the next.
//   node controls.mjs <checkout> <flags dist> <snapshot dir> <alias.json> <verify-production.mjs> > controls.json
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [checkout, flagsDist, snapshotDir, aliasFile, tool] = process.argv.slice(2);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const alias = readFileSync(aliasFile, 'utf8');
const commit = JSON.parse(alias).githubCommitSha;

function run(env) {
  try {
    const out = execFileSync('node', [tool, checkout, flagsDist], { env: { ...process.env, EXPECTED_COMMIT: commit, ALIAS_BEFORE: alias, SNAPSHOT: snapshotDir, ...env }, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
    const record = JSON.parse(out);
    return { exited: 0, ok: record.ok, failedChecks: record.checks.filter((check) => !check.ok).map((check) => check.name) };
  } catch (error) {
    const out = error.stdout ?? '';
    let failedChecks = null;
    try { failedChecks = JSON.parse(out).checks.filter((check) => !check.ok).map((check) => check.name); } catch {}
    return { exited: error.status, ok: false, failedChecks, error: failedChecks ? undefined : String(error.stderr ?? '').trim().split('\n').filter((line) => /Error|assert/u.test(line)).slice(0, 2).join(' | ').slice(0, 300) };
  }
}

function altered(file, change, label, expected, env = {}) {
  const original = readFileSync(file);
  writeFileSync(file, change(original));
  let result;
  try { result = run(env); } finally { writeFileSync(file, original); }
  const restored = sha256(readFileSync(file)) === sha256(original);
  return { change: label, expected, result, restored };
}

const controls = [];
controls.push(altered(resolve(flagsDist, 'developers/docs/astrology-api.md'), (bytes) => Buffer.concat([bytes, Buffer.from(' ')]),
  "one byte appended to the production-flags build's developers/docs/astrology-api.md", 'the astrology-api check fails on its twin, and no other check'));
const manifest = JSON.parse(readFileSync(resolve(snapshotDir, 'manifest.json'), 'utf8'));
const entry = manifest.entries.find((candidate) => candidate.path === '/developers/docs/ephemeris-npm/');
controls.push(altered(resolve(snapshotDir, entry.file), (bytes) => { const copy = Buffer.from(bytes); copy[copy.length - 2] ^= 1; return copy; },
  "one bit changed in the snapshot's /developers/docs/ephemeris-npm/ bytes", 'the run stops: the snapshot is not the bytes it recorded'));
const wrong = JSON.stringify({ ...JSON.parse(alias), githubCommitSha: '7d12c0f1e5ee246091f1544531538390963db28d' });
const aliasControl = { change: "the alias read before names #730's merge, 7d12c0f1, as the deployment's commit", expected: 'the alias check fails, and no other check', result: run({ ALIAS_BEFORE: wrong }), restored: true };
controls.push(aliasControl);
console.log(JSON.stringify({ schema: 'zodiacs.developer-query-guides-production-controls.v1', tool: 'tools/verify-production.mjs', expectedCommit: commit, checkedAt: new Date().toISOString(), controls }, null, 2));
