// Read from git objects so local changes to the engine checkout cannot enter the scoreboard.
// node scripts/sync-conformance.mjs <engine checkout> v2.0.0 [--check]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [checkout, release, mode] = process.argv.slice(2);
if (!checkout || !/^v\d+\.\d+\.\d+$/u.test(release) || (mode && mode !== '--check')) {
  throw new Error('Usage: node scripts/sync-conformance.mjs <engine checkout> <release tag> [--check]');
}
const git = (...args) => execFileSync('git', ['-C', checkout, ...args]);
const commit = git('rev-parse', '--verify', `refs/tags/${release}^{commit}`).toString().trim();
const read = (path) => git('show', `${commit}:${path}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const path = 'conformance/results/summary.json';
const summaryBytes = read(path);
const summary = JSON.parse(summaryBytes);
const reportPath = 'conformance/RESULTS.md';
const source = {
  repository: 'https://github.com/zodiacs-org/engine',
  release, commit,
  commitDate: git('show', '-s', '--format=%cs', commit).toString().trim(),
  path, sha256: sha256(summaryBytes),
  report: { path: reportPath, sha256: sha256(read(reportPath)) },
  resultSha256: {},
};
const unsupported = {};
for (const run of summary.runs) {
  const bytes = read(`conformance/${run.file}`);
  const result = JSON.parse(bytes);
  assert.deepEqual(result.adapter, run.adapter);
  assert.deepEqual(result.summary, run.summary);
  source.resultSha256[run.adapter.engine] = sha256(bytes);
  const groups = new Map();
  const ids = new Set();
  for (const { id, verdict, detail } of result.results) {
    if (verdict !== 'unsupported') continue;
    assert.ok(typeof id === 'string' && id && !ids.has(id), `Invalid unsupported ID in ${run.file}: ${id}`);
    assert.ok(typeof detail === 'string' && detail.trim(), `Missing adapter reason for ${id}`);
    ids.add(id);
    if (!groups.has(detail)) groups.set(detail, []);
    groups.get(detail).push(id);
  }
  assert.equal(ids.size, run.summary.total.unsupported);
  unsupported[run.adapter.engine] = Object.fromEntries(groups);
}
const reasons = json(unsupported);
const files = {
  'summary.json': summaryBytes,
  'unsupported.json': reasons,
  'source.json': json({ ...source, unsupportedSha256: sha256(reasons) }),
};
for (const [name, bytes] of Object.entries(files)) {
  const url = new URL(`../src/data/conformance/${name}`, import.meta.url);
  if (mode === '--check') assert.deepEqual(readFileSync(url), Buffer.from(bytes), `${name} differs from ${commit}`);
  else writeFileSync(url, bytes);
}
