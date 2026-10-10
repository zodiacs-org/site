/**
 * Explains served chunks that differ from a local build. For each served chunk
 * it finds the local chunks with the same name stem in a build made with the
 * production feature flags, normalizes the content-hash part of every hashed
 * file name, and reports whether one local chunk is then identical. When none
 * is, it lists the string literals left on each side: their length and
 * SHA-256, and the value only for the CI's own stand-in values.
 *
 * Usage: node explain-birth-window-flag-chunks.mjs <observation.json> <production-flags dist>
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const [observationPath, flagsDist] = process.argv.slice(2);
const observation = JSON.parse(await readFile(observationPath, 'utf8'));
const base = observation.base;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stemOf = (file) => file.replace(/[.-][A-Za-z0-9_-]{8}\.(?:js|css)$/, '');
const normalize = (text) => text.replace(/([A-Za-z0-9_-]+)[.-][A-Za-z0-9_-]{8}\.(js|css)\b/g, '$1.HASH.$2');
const literals = (text) => [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)]
  .map((match) => match[1] ?? match[2] ?? match[3])
  .filter((value) => value.length > 0);
const STAND_IN = /stand[-_]in|127\.0\.0\.1|ci\.invalid/;
const replaceAll = (text, values) => [...values].sort((a, b) => b.length - a.length)
  .reduce((acc, value) => acc.split(value).join('\u0000LITERAL\u0000'), text);

const localFiles = await readdir(join(flagsDist, '_astro'));
const results = [];
for (const path of observation.assetIdentity.assetsDifferingFromLocalBuild) {
  const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  const served = await response.text();
  const stem = stemOf(path.split('/').pop());
  const candidates = [];
  for (const file of localFiles.filter((name) => stemOf(name) === stem).sort()) {
    const local = await readFile(join(flagsDist, '_astro', file), 'utf8');
    const candidate = { file, bytes: Buffer.byteLength(local), identicalAfterHashNormalization: normalize(local) === normalize(served) };
    if (!candidate.identicalAfterHashNormalization) {
      const servedLiterals = new Set(literals(normalize(served)));
      const localLiterals = new Set(literals(normalize(local)));
      const onlyServed = [...servedLiterals].filter((value) => !localLiterals.has(value));
      const onlyLocal = [...localLiterals].filter((value) => !servedLiterals.has(value));
      candidate.literalsOnlyInServed = onlyServed.length;
      candidate.literalsOnlyInLocal = onlyLocal.length;
      if (onlyServed.length <= 4 && onlyLocal.length <= 4) {
        candidate.servedLiterals = onlyServed.map((value) => ({ length: value.length, sha256: sha256(value) }));
        candidate.localLiterals = onlyLocal.map((value) => ({ length: value.length, sha256: sha256(value), ...(STAND_IN.test(value) ? { ciStandIn: value } : {}) }));
        candidate.identicalAfterReplacingThoseLiterals = replaceAll(normalize(served), onlyServed) === replaceAll(normalize(local), onlyLocal);
      }
    }
    candidates.push(candidate);
  }
  const explained = candidates.find((candidate) => candidate.identicalAfterHashNormalization)
    ?? candidates.find((candidate) => candidate.identicalAfterReplacingThoseLiterals
      && candidate.localLiterals.every((literal) => literal.ciStandIn));
  results.push({
    path,
    status: response.status,
    servedBytes: Buffer.byteLength(served),
    servedSha256: sha256(served),
    candidates,
    explainedBy: explained ? { file: explained.file, how: explained.identicalAfterHashNormalization ? 'identical after hashed file names are normalized' : 'identical after hashed file names are normalized and the CI stand-in literals are put in place of production\'s values' } : null,
  });
}
console.log(JSON.stringify({
  schema: 'zodiacs.birth-window-flag-chunk-explanation.v1',
  base,
  checkedAt: new Date().toISOString(),
  productionFlagsBuild: 'npm run build with site-check.yml production-flags-build env (CI stand-in values for keys and URLs)',
  results,
  allExplained: results.every((result) => result.explainedBy !== null),
}, null, 2));
