/**
 * Read-only provenance check of the exports this label runs.
 *
 *   node provenance.mjs --repo=DIR --out=FILE
 *
 * For each (export directory, commit, path prefix) pair below, lists the
 * commit's blobs under the prefix with `git ls-tree` (object database
 * only: no index, no working tree, no refs touched) and compares them with
 * the export's files by git blob hash. Nothing in the repository is
 * written.
 */
import { readFileSync, readdirSync, writeFileSync, lstatSync, readlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const REPO = args.get('repo');
const OUT = args.get('out');
const SP = '<scratch>';

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
const blobOf = (p) => {
  const bytes = lstatSync(p).isSymbolicLink() ? Buffer.from(readlinkSync(p)) : readFileSync(p);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const walk = (dir, rel = '', out = []) => {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) walk(join(dir, d.name), r, out);
    else out.push(r);
  }
  return out;
};

function check(label, exportDir, commit, prefix) {
  const listing = git('ls-tree', '-r', '-z', '--full-tree', commit, '--', prefix).split('\0').filter(Boolean);
  const expected = new Map();
  for (const line of listing) {
    const tab = line.indexOf('\t');
    const [, type, sha] = line.slice(0, tab).split(' ');
    if (type !== 'blob') continue;
    expected.set(line.slice(tab + 1).slice(prefix.length + 1), sha);
  }
  const present = walk(exportDir);
  const missing = [...expected.keys()].filter((p) => !present.includes(p));
  const extra = present.filter((p) => !expected.has(p));
  const differing = [...expected].filter(([rel]) => !missing.includes(rel)).filter(([rel, sha]) => blobOf(join(exportDir, rel)) !== sha).map(([rel]) => rel);
  return { label, exportDir, commit, prefix, files: expected.size, missing, extra, differing, identical: missing.length === 0 && extra.length === 0 && differing.length === 0 };
}

function checkFile(label, file, commit, path) {
  const sha = git('rev-parse', `${commit}:${path}`).trim();
  return { label, file, commit, path, expected: sha, actual: blobOf(file), identical: sha === blobOf(file) };
}

const V1 = `${SP}/p45/v1/examples/precision-alpha`;
const HEAD = `${SP}/p45/prior-versions/head/examples/precision-alpha`;
const BUNDLE = `${SP}/p45/prior-versions/bundle/examples/precision-alpha`;
const C = {
  original: '23dd8cb7567995d645871e0b481f79589de690a1',
  main: '931e3281',
  head860: 'ad34668044b8c750f7b3d61e38d667be727103a0',
  bundle: 'dfa19aa9077c14c0add9b018cfc80b860d11954a',
};
const mainFull = git('rev-parse', `${C.main}^{commit}`).trim();
const results = [
  check('v1 src against the original runtime 23dd8cb7', `${V1}/src`, C.original, 'examples/precision-alpha/src'),
  check('v1 src against main 931e3281', `${V1}/src`, mainFull, 'examples/precision-alpha/src'),
  check('#860 head src against ad346680', `${HEAD}/src`, C.head860, 'examples/precision-alpha/src'),
  checkFile('v1 deflected reference against 23dd8cb7', `${V1}/test/tier-b/_deflected-reference.mjs`, C.original, 'examples/precision-alpha/test/tier-b/_deflected-reference.mjs'),
  checkFile('#860 head deflected reference against ad346680', `${HEAD}/test/tier-b/_deflected-reference.mjs`, C.head860, 'examples/precision-alpha/test/tier-b/_deflected-reference.mjs'),
  checkFile('bundle harness partition-evaluation-v2.mjs against dfa19aa9', `${BUNDLE}/tools/measure/partition-evaluation-v2.mjs`, C.bundle, 'examples/precision-alpha/tools/measure/partition-evaluation-v2.mjs'),
  checkFile('bundle rule PARTITION-EVALUATION-V2.md against dfa19aa9', `${BUNDLE}/PARTITION-EVALUATION-V2.md`, C.bundle, 'examples/precision-alpha/PARTITION-EVALUATION-V2.md'),
  checkFile('#860 V-4 harness corpus-versions.mjs against ad346680', `${HEAD}/tools/measure/corpus-versions.mjs`, C.head860, 'examples/precision-alpha/tools/measure/corpus-versions.mjs'),
];
const record = { tool: 'provenance.mjs (label ladder)', readOnly: 'git ls-tree and git rev-parse on the object database only', commits: { ...C, mainFull }, results, allIdentical: results.every((r) => r.identical) };
writeFileSync(OUT, `${JSON.stringify(record, null, 1)}\n`);
for (const r of results) process.stdout.write(`${r.identical ? 'IDENTICAL' : 'DIFFERS'}  ${r.label}${r.files !== undefined ? ` (${r.files} files)` : ''}\n`);
