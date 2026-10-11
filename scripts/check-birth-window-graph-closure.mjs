/**
 * Whether each page graph a B2.b production observation recorded is closed:
 * every import in every recorded chunk names a file the same crawl recorded.
 * Observers v1 to v5 read each chunk's imports from a second request for it,
 * which they did not record, so a failed second request could have left
 * imports out of a graph without failing the run. This check reads each
 * chunk's bytes again, from https://zodiacs.org or else from the local dist/,
 * uses them only when their SHA-256 equals the digest the crawl recorded, and
 * finds the imports with the observer's own rule.
 *
 * Usage: node check-birth-window-graph-closure.mjs <site checkout> <observation.json>...
 * Prints JSON; exits non-zero unless every graph is closed.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const BASE = 'https://zodiacs.org';
const [repoArg, ...observationArgs] = process.argv.slice(2);
assert.ok(repoArg && observationArgs.length, 'Usage: check-birth-window-graph-closure.mjs <site checkout> <observation.json>...');
const repo = resolve(repoArg);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The observer's rule (scripts/observe-birth-time-window-production.mjs).
function assetReferences(text, fromChunk) {
  const found = new Set();
  for (const match of text.matchAll(/\/_astro\/[A-Za-z0-9._-]+\.(?:js|css)/g)) found.add(match[0]);
  if (fromChunk) for (const match of text.matchAll(/["'`]\.\/([A-Za-z0-9._-]+\.(?:js|css))["'`]/g)) found.add('/_astro/' + match[1]);
  return found;
}

const servedNow = new Map();
async function servedBytes(path) {
  if (!servedNow.has(path)) {
    let response;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await fetch(BASE + path, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000 * attempt));
      }
    }
    servedNow.set(path, response.status === 200 ? Buffer.from(await response.arrayBuffer()) : null);
  }
  return servedNow.get(path);
}
async function builtBytes(path) {
  try { return await readFile(join(repo, 'dist', path)); } catch { return null; }
}

/** The recorded chunk's bytes, from wherever bytes with its digest can be had now. */
async function recordedBytes(asset) {
  const served = await servedBytes(asset.path);
  if (served && sha256(served) === asset.sha256) return { from: 'production', bytes: served };
  const built = await builtBytes(asset.path);
  if (built && sha256(built) === asset.sha256) return { from: 'local build', bytes: built };
  return null;
}

async function checkGraph(graph) {
  const recorded = new Set(graph.assets.map((asset) => asset.path));
  const bytesFrom = { production: 0, 'local build': 0 };
  const unavailable = [];
  const missing = [];
  let chunks = 0;
  for (const asset of graph.assets) {
    if (!asset.path.endsWith('.js')) continue;
    chunks += 1;
    const found = await recordedBytes(asset);
    if (!found) { unavailable.push(asset.path); continue; }
    bytesFrom[found.from] += 1;
    for (const reference of assetReferences(found.bytes.toString('utf8'), true)) {
      if (!recorded.has(reference)) missing.push({ from: asset.path, reference });
    }
  }
  return { files: recorded.size, chunks, bytesFrom, bytesUnavailable: unavailable, missingReferences: missing, closed: unavailable.length === 0 && missing.length === 0 };
}

const runs = [];
for (const observationArg of observationArgs) {
  const observationPath = resolve(observationArg);
  const bytes = await readFile(observationPath);
  const observation = JSON.parse(bytes.toString('utf8'));
  const identity = observation.assetIdentity;
  runs.push({
    observation: relative(repo, observationPath),
    observationSha256: sha256(bytes),
    schema: observation.schema,
    commit: observation.source?.commit ?? null,
    before: await checkGraph(identity.pageGraphBefore),
    after: await checkGraph(identity.pageGraphAfter),
  });
}

// Which build dist/ holds does not matter: its bytes are used only where their
// digest equals the recorded one.
const receipt = JSON.parse(await readFile(join(repo, 'dist/.phase1-build-receipt.json'), 'utf8').catch(() => 'null'));
const passed = runs.every((run) => run.before.closed && run.after.closed);
console.log(JSON.stringify({
  schema: 'zodiacs.birth-window-graph-closure.v1',
  checkedAt: new Date().toISOString(),
  base: BASE,
  localBuild: { builtAt: receipt?.builtAt ?? null },
  rule: 'every relative or /_astro/ import in a recorded chunk is a file the same crawl recorded; a chunk is read only from bytes whose SHA-256 equals the recorded digest',
  passed,
  runs,
}, null, 2));
if (!passed) process.exitCode = 1;
