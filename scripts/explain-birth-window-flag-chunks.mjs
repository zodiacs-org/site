/**
 * Explains served chunks that differ from a local build. It builds the
 * observed commit itself with the production feature flags: from a clean
 * checkout of the observation's source commit, with the environment of the
 * checkout's own site-check.yml production-flags-build job (CI's stand-in
 * values for keys and URLs). For each served chunk it then finds the built
 * chunks with the same name stem, normalizes the content-hash part of every hashed
 * file name, and reports whether one local chunk is then identical. When none
 * is, it lists the string literals left on each side: their length and
 * SHA-256, and the value only for the CI's own stand-in values.
 *
 * Each chunk is fetched again, so it must still be the bytes the observation
 * recorded: a response whose status is not 200 or whose SHA-256 differs from
 * the observation's digest for that path is not analysed, and the result then
 * fails.
 *
 * The flags-on generators rewrite two tracked files; the script puts them back
 * and checks that no tracked file is left changed.
 *
 * Usage: node explain-birth-window-flag-chunks.mjs <observation.json> <clean checkout of its source commit> <build log path>
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [observationPath, checkoutArg, buildLogPath] = process.argv.slice(2);
assert.ok(observationPath && checkoutArg && buildLogPath, 'Usage: explain-birth-window-flag-chunks.mjs <observation.json> <clean checkout of its source commit> <build log path>');
const observation = JSON.parse(await readFile(observationPath, 'utf8'));
const checkout = resolve(checkoutArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), observation.source.commit, 'The checkout is the observation\'s source commit');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'No tracked change before the build');
const envFiles = git('ls-files', '--others', '--ignored', '--exclude-standard', '--', ':(glob).env*', ':(glob)**/.env*')
  .split('\n').filter(Boolean).filter((path) => !path.split('/').includes('node_modules'));
assert.deepEqual(envFiles, [], 'No ignored .env file in the checkout: ' + envFiles.join(', '));

/** The env block of the production-flags-build job in the checkout's own Site Check workflow. */
function flagsEnvironment(workflow) {
  const lines = workflow.split('\n');
  const job = lines.findIndex((line) => /^  production-flags-build:\s*$/.test(line));
  assert.ok(job >= 0, 'site-check.yml has a production-flags-build job');
  const env = lines.findIndex((line, index) => index > job && /^    env:\s*$/.test(line));
  assert.ok(env > job, 'the production-flags-build job has an env block');
  const values = {};
  for (const line of lines.slice(env + 1)) {
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    const match = /^      ([A-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) break;
    values[match[1]] = match[2].replace(/^"(.*)"$/s, '$1');
  }
  return values;
}
const flagsEnv = flagsEnvironment(await readFile(join(checkout, '.github/workflows/site-check.yml'), 'utf8'));
assert.ok(flagsEnv.PUBLIC_SAVED_RECORDS_ENABLED === '1' && Object.keys(flagsEnv).length >= 10, 'the production flags were read');
await rm(join(checkout, 'dist'), { recursive: true, force: true });
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PUBLIC_|SUPABASE_|RESEND_|DAILY_EMAIL_|EMAIL_)|_RPC_URL$/.test(key)));
const buildLog = [];
const buildExit = await new Promise((resolveExit, rejectExit) => {
  const child = spawn('npm', ['run', 'build'], { cwd: checkout, env: { ...inherited, ...flagsEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => buildLog.push(chunk));
  child.stderr.on('data', (chunk) => buildLog.push(chunk));
  child.once('error', rejectExit);
  child.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
});
const buildLogBytes = Buffer.concat(buildLog);
await writeFile(buildLogPath, buildLogBytes);
assert.equal(buildExit, 0, 'the production-flags build succeeds (' + buildLogPath + ')');
const rewritten = git('diff', '--name-only').split('\n').filter(Boolean);
if (rewritten.length) execFileSync('git', ['-C', checkout, 'checkout', '--', ...rewritten]);
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'No tracked change after the build');
const flagsDist = join(checkout, 'dist');
const flagsBuild = {
  commit: git('rev-parse', 'HEAD'),
  tree: git('rev-parse', 'HEAD^{tree}'),
  environment: 'site-check.yml production-flags-build env, read from the checkout',
  keys: Object.keys(flagsEnv),
  node: process.version,
  log: { bytes: buildLogBytes.length, sha256: createHash('sha256').update(buildLogBytes).digest('hex') },
  trackedFilesRewrittenAndRestored: rewritten,
};
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
const recorded = new Map(observation.assetIdentity.pageGraphAfter.assets.map((asset) => [asset.path, asset.sha256]));
const results = [];
for (const path of observation.assetIdentity.assetsDifferingFromLocalBuild) {
  const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  const servedBytes = Buffer.from(await response.arrayBuffer());
  const matchesObservation = response.status === 200 && recorded.get(path) === sha256(servedBytes);
  if (!matchesObservation) {
    results.push({ path, status: response.status, servedSha256: sha256(servedBytes), observedSha256: recorded.get(path) ?? null, matchesObservation, candidates: [], explainedBy: null });
    continue;
  }
  const served = servedBytes.toString('utf8');
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
    matchesObservation,
    servedBytes: servedBytes.length,
    servedSha256: sha256(servedBytes),
    candidates,
    explainedBy: explained ? { file: explained.file, how: explained.identicalAfterHashNormalization ? 'identical after hashed file names are normalized' : 'identical after hashed file names are normalized and the CI stand-in literals are put in place of production\'s values' } : null,
  });
}
console.log(JSON.stringify({
  schema: 'zodiacs.birth-window-flag-chunk-explanation.v3',
  base,
  checkedAt: new Date().toISOString(),
  productionFlagsBuild: flagsBuild,
  results,
  allExplained: results.every((result) => result.matchesObservation && result.explainedBy !== null),
}, null, 2));
if (!results.every((result) => result.matchesObservation && result.explainedBy !== null)) process.exitCode = 1;
