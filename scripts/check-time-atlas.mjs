/*
 * The checks on the time atlas the site publishes (B3.c), version 0.1.0:
 * the engine repository's atlas at a pinned commit, copied byte for byte to
 * public/developers/time-atlas/0.1.0/ and listed in its files.json.
 *
 * timeAtlasFileProblems(folder) holds a folder to the index it carries: every
 * listed file present, a regular file, with the size, SHA-256 and git blob the
 * index gives it, and nothing else in the folder. scripts/check-dist.mjs runs
 * it on the built folder in dist/, and tests/time-atlas-dataset.test.ts on the
 * committed one, with controls.
 *
 * A plain Node module that imports nothing from the site, so that the build's
 * check, the tests and the evidence folder's production check can all use it.
 */
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** The version's folder, as dist/ and zodiacs.org serve it. */
export const TIME_ATLAS_FOLDER = 'developers/time-atlas/0.1.0';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The git blob id of these bytes: sha1 of "blob <length>\0" and the bytes. */
export const gitBlobId = (bytes) => createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
  .digest('hex');

/** A path relative to the folder that stays inside it. */
export function safeRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\')
    && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** Every entry under `folder` that is not a directory, as sorted relative paths; links are listed, not followed. */
async function entriesUnder(folder, prefix = '') {
  const found = [];
  for (const entry of await readdir(join(folder, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await entriesUnder(folder, path));
    else found.push(path);
  }
  return found.sort();
}

/** The problems with `folder` against its files.json, one string each; none when every listed file is as listed. */
export async function timeAtlasFileProblems(folder) {
  let index;
  try {
    if ((await lstat(join(folder, 'files.json'))).isSymbolicLink()) return ['files.json: a symbolic link, not a file'];
    index = JSON.parse(await readFile(join(folder, 'files.json'), 'utf8'));
  } catch (error) {
    return [error?.code === 'ENOENT' ? 'files.json: missing' : 'files.json: does not parse'];
  }
  if (!Array.isArray(index?.files)) return ['files.json: no list of files'];
  const problems = [];
  const listed = new Set();
  for (const row of index.files) {
    const path = row?.path;
    if (!safeRelativePath(path)) {
      problems.push(`${String(path)}: not a relative path inside the folder`);
      continue;
    }
    if (listed.has(path)) {
      problems.push(`${path}: listed twice`);
      continue;
    }
    listed.add(path);
    if (typeof row.source !== 'string' || !Number.isInteger(row.bytes)
        || !/^[0-9a-f]{64}$/u.test(row.sha256 ?? '') || !/^[0-9a-f]{40}$/u.test(row.gitBlob ?? '')) {
      problems.push(`${path}: files.json lacks its source, bytes, SHA-256 or git blob`);
    }
    let info;
    try {
      info = await lstat(join(folder, path));
    } catch {
      problems.push(`${path}: missing`);
      continue;
    }
    if (info.isSymbolicLink()) {
      problems.push(`${path}: a symbolic link, not a file`);
      continue;
    }
    if (!info.isFile()) {
      problems.push(`${path}: not a regular file`);
      continue;
    }
    const bytes = await readFile(join(folder, path));
    if (bytes.length !== row.bytes) problems.push(`${path}: ${bytes.length} bytes, not ${row.bytes}`);
    const digest = sha256(bytes);
    if (digest !== row.sha256) problems.push(`${path}: SHA-256 ${digest}, not ${row.sha256}`);
    const blob = gitBlobId(bytes);
    if (blob !== row.gitBlob) problems.push(`${path}: git blob ${blob}, not ${row.gitBlob}`);
  }
  for (const path of await entriesUnder(folder)) {
    if (path !== 'files.json' && !listed.has(path)) problems.push(`${path}: not listed in files.json`);
  }
  return problems;
}
