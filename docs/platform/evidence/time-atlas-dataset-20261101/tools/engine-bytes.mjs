#!/usr/bin/env node
/*
 * Check C3 of the time atlas dataset's preregistration: the published files
 * are the engine repository's bytes at a commit.
 *
 *   node engine-bytes.mjs <engine clone> <commit> <folder> <out.json>
 *
 * For each file that <folder>/files.json lists, it reads the blob at the
 * file's source path with `git -C <engine clone> cat-file blob
 * <commit>:<source>` and compares its SHA-256 with that of the folder's file
 * and with the index's. It records the tree of atlas/ at <commit> (from `git
 * ls-tree`) beside the tree the index names, and the clone's HEAD before and
 * after, which must be the same: it reads objects only and never checks
 * anything out. It reads nothing but atlas/ paths at <commit>.
 *
 * It writes { schema, commit, tree, indexTree, cloneHead, passed, of, files }
 * with one { path, source, ok, detail } per file, and exits 1 when a file
 * differs, when the tree is not the index's or when HEAD moved.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [clone, commit, folder, out] = process.argv.slice(2);
if (!clone || !/^[0-9a-f]{40}$/u.test(commit ?? '') || !folder || !out) {
  throw new Error('usage: node engine-bytes.mjs <engine clone> <40-hex commit> <folder> <out.json>');
}

const git = (...args) => execFileSync('git', ['-C', clone, ...args], { maxBuffer: 1 << 28 });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const head = () => git('show', '-s', '--format=%H', 'HEAD').toString('utf8').trim();

const index = JSON.parse(readFileSync(join(folder, 'files.json'), 'utf8'));
const headBefore = head();
const treeLine = git('ls-tree', commit, 'atlas').toString('utf8').trim();
const tree = /^040000 tree ([0-9a-f]{40})\tatlas$/u.exec(treeLine)?.[1] ?? null;

const files = index.files.map(({ path, source, sha256: indexed }) => {
  if (!/^atlas\/[^\0]+$/u.test(source) || source.split('/').includes('..')) {
    return { path, source, ok: false, detail: 'the source is not a path under atlas/' };
  }
  let engine;
  try {
    engine = sha256(execFileSync('git', ['-C', clone, 'cat-file', 'blob', `${commit}:${source}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return { path, source, ok: false, detail: `no blob at ${commit.slice(0, 8)}:${source}` };
  }
  const served = sha256(readFileSync(join(folder, path)));
  const ok = engine === served && engine === indexed;
  return {
    path,
    source,
    ok,
    detail: ok
      ? `SHA-256 ${engine}, as the folder and the index give it`
      : `engine ${engine}, folder ${served}, index ${indexed}`,
  };
});
const headAfter = head();

const passed = files.filter((file) => file.ok).length;
const report = {
  schema: 'zodiacs.time-atlas-engine-bytes.v1',
  commit,
  tree,
  indexTree: index.source?.tree ?? null,
  cloneHead: headBefore === headAfter ? headAfter : { before: headBefore, after: headAfter },
  passed,
  of: files.length,
  files,
};
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`engine bytes at ${commit.slice(0, 8)}: ${passed} of ${files.length} files; atlas tree ${tree?.slice(0, 8)}${tree === report.indexTree ? ', as indexed' : `, not the index's ${String(report.indexTree).slice(0, 8)}`}`);
for (const file of files.filter((entry) => !entry.ok)) console.log(`  ${file.path}: ${file.detail}`);
if (passed !== files.length || tree !== report.indexTree || headBefore !== headAfter) process.exitCode = 1;
