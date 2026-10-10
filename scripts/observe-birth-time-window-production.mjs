/**
 * Canonical production observation for B2.b. Runs the unchanged
 * tests/birth-time-window-drive.mjs against https://zodiacs.org and binds the
 * assets production served during that run to a local build of the same
 * source. The deployment's identity (Vercel connector) is observed separately
 * and passed in; this script only asserts what it can observe over anonymous
 * HTTP and in the browser.
 *
 * Usage: PRODUCTION_SOURCE_COMMIT=<sha> PRODUCTION_DEPLOYMENT_ID=<dpl_…>
 *   node observe-birth-time-window-production.mjs <site checkout> <output dir>
 * The checkout must be at PRODUCTION_SOURCE_COMMIT with no tracked change and a
 * completed `npm run build` in dist/.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BASE = 'https://zodiacs.org';
const DRIVE = 'tests/birth-time-window-drive.mjs';
const CONTROLS = 'docs/platform/evidence/birth-time-window-ui-20261010/browser-controls.json';
const SCREENSHOTS = 'tests/visual/artifacts/birth-time-window';

const [repoArg, outArg] = process.argv.slice(2);
assert.ok(repoArg && outArg, 'Usage: observe-birth-time-window-production.mjs <site checkout> <output dir>');
const repo = resolve(repoArg);
const out = resolve(outArg);
const expectedSource = process.env.PRODUCTION_SOURCE_COMMIT ?? '';
const deploymentId = process.env.PRODUCTION_DEPLOYMENT_ID ?? '';
assert.match(expectedSource, /^[0-9a-f]{40}$/, 'PRODUCTION_SOURCE_COMMIT must be a full commit');
assert.match(deploymentId, /^dpl_[A-Za-z0-9]+$/, 'PRODUCTION_DEPLOYMENT_ID must be a Vercel deployment id');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

// Source: the checkout is the deployed commit, with no tracked change.
const head = git('rev-parse', 'HEAD');
assert.equal(head, expectedSource, 'Checkout is the deployed source commit');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'No tracked change before the run');
const tree = git('rev-parse', 'HEAD^{tree}');
const buildReceipt = JSON.parse(await readFile(join(repo, 'dist/.phase1-build-receipt.json'), 'utf8'));

async function served(path) {
  const response = await fetch(BASE + path, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, bytes, cache: response.headers.get('x-vercel-cache'), type: response.headers.get('content-type') };
}

async function compareAsset(path) {
  assert.match(path, /^\/_astro\/[A-Za-z0-9._-]+\.(?:js|css)$/, 'Hashed asset path: ' + path);
  const response = await served(path);
  let built = null;
  try { built = await readFile(join(repo, 'dist', path)); } catch {}
  return {
    path,
    status: response.status,
    bytes: response.bytes.length,
    sha256: sha256(response.bytes),
    gzipLevel9Bytes: gzipSync(response.bytes, { level: 9 }).length,
    builtSha256: built ? sha256(built) : null,
    matchesLocalBuild: built !== null && Buffer.compare(built, response.bytes) === 0,
    vercelCache: response.cache,
  };
}

// The module graph production serves for the page, from its HTML and from the
// relative imports inside each served chunk.
function assetReferences(text, fromChunk) {
  const found = new Set();
  for (const match of text.matchAll(/\/_astro\/[A-Za-z0-9._-]+\.(?:js|css)/g)) found.add(match[0]);
  if (fromChunk) for (const match of text.matchAll(/["'`]\.\/([A-Za-z0-9._-]+\.(?:js|css))["'`]/g)) found.add('/_astro/' + match[1]);
  return found;
}

async function crawlPage(route) {
  const page = await served(route);
  assert.equal(page.status, 200, 'Canonical route answers 200: ' + route);
  const queue = [...assetReferences(page.bytes.toString('utf8'), false)];
  const seen = new Map();
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    const record = await compareAsset(path);
    seen.set(path, record);
    if (path.endsWith('.js') && record.status === 200) {
      const response = await served(path);
      for (const next of assetReferences(response.bytes.toString('utf8'), true)) if (!seen.has(next)) queue.push(next);
    }
  }
  return { route, status: page.status, htmlBytes: page.bytes.length, htmlSha256: sha256(page.bytes), assets: [...seen.values()] };
}

const startedAt = new Date().toISOString();
const before = await crawlPage('/birth-chart/');

// The unchanged drive, against canonical production. It writes its report over
// the committed qualification record, so that record's bytes are kept and put
// back afterwards.
const committedControls = await readFile(join(repo, CONTROLS));
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
assert.ok(chrome, 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH names the browser that runs the drive');
const chromeVersion = execFileSync(chrome, ['--version'], { encoding: 'utf8' }).trim();
await mkdir(out, { recursive: true });
const log = [];
const exitCode = await new Promise((resolveExit, rejectExit) => {
  const child = spawn(process.execPath, [DRIVE], {
    cwd: repo,
    env: { ...process.env, ZODIACS_TEST_BASE_URL: BASE, BIRTH_WINDOW_SERVER_MODE: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const record = (chunk) => { log.push(chunk); process.stdout.write(chunk); };
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  child.once('error', rejectExit);
  child.once('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
});
const finishedAt = new Date().toISOString();
const logBytes = Buffer.concat(log);
await writeFile(join(out, 'drive.log'), logBytes);
const driveReportBytes = await readFile(join(repo, CONTROLS));
await writeFile(join(out, 'drive-browser-controls.json'), driveReportBytes);
await writeFile(join(repo, CONTROLS), committedControls);
assert.equal(sha256(await readFile(join(repo, CONTROLS))), sha256(committedControls), 'Committed qualification record restored');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'No tracked change after the run');

const driveReport = JSON.parse(driveReportBytes.toString('utf8'));
const screenshots = [];
await mkdir(join(out, 'screenshots'), { recursive: true });
for (const name of (await readdir(join(repo, SCREENSHOTS))).filter((file) => file.endsWith('.png')).sort()) {
  await copyFile(join(repo, SCREENSHOTS, name), join(out, 'screenshots', name));
  const bytes = await readFile(join(out, 'screenshots', name));
  screenshots.push({ file: 'screenshots/' + name, bytes: bytes.length, sha256: sha256(bytes) });
}

// The worker each viewport actually created, fetched again and compared with
// the local build.
const workerPaths = new Set();
for (const record of driveReport.records ?? []) {
  for (const created of record.native?.created ?? []) {
    const url = new URL(created);
    assert.equal(url.origin, BASE, 'Worker came from canonical production');
    workerPaths.add(url.pathname);
  }
}
const workers = [];
for (const path of [...workerPaths].sort()) workers.push(await compareAsset(path));
const after = await crawlPage('/birth-chart/');

const sameGraph = JSON.stringify(before.assets.map((asset) => [asset.path, asset.sha256]).sort())
  === JSON.stringify(after.assets.map((asset) => [asset.path, asset.sha256]).sort());
const differing = after.assets.filter((asset) => !asset.matchesLocalBuild).map((asset) => asset.path);
const observation = {
  schema: 'zodiacs.birth-time-window-production-observation.v1',
  base: BASE,
  startedAt,
  finishedAt,
  source: { commit: head, tree, trackedChangesBeforeAndAfter: 'none', localBuildReceipt: buildReceipt },
  expectedDeployment: { id: deploymentId, note: 'Observed separately through the Vercel connector; see connector-observation.json.' },
  observer: {
    script: 'scripts/observe-birth-time-window-production.mjs',
    node: process.version,
    platform: process.platform + ' ' + execFileSync('uname', ['-r'], { encoding: 'utf8' }).trim(),
    browser: chromeVersion,
    drive: { path: DRIVE, sha256: sha256(await readFile(join(repo, DRIVE))), exitCode },
  },
  nativeBrowserExecution: {
    passed: driveReport.passed === true && exitCode === 0,
    viewports: (driveReport.records ?? []).map((record) => ({
      name: record.name,
      viewport: record.viewport,
      summary: record.summary,
      controls: record.controls,
      boundaryInstants: record.boundaryInstants,
      workersCreated: record.native?.created?.length ?? 0,
      workersTerminated: record.native?.terminated?.length ?? 0,
      pageErrors: record.pageErrors,
    })),
    failure: driveReport.failure,
    report: { file: 'drive-browser-controls.json', bytes: driveReportBytes.length, sha256: sha256(driveReportBytes) },
    log: { file: 'drive.log', bytes: logBytes.length, sha256: sha256(logBytes) },
    screenshots,
    reportLimitationsNote: 'The drive writes fixed limitation sentences for its default local-preview mode. In this run ZODIACS_TEST_BASE_URL was ' + BASE + ', so its pages, scripts and worker came from canonical production.',
  },
  assetIdentity: {
    workers,
    pageGraphBefore: before,
    pageGraphAfter: after,
    pageGraphUnchangedDuringRun: sameGraph,
    assetsDifferingFromLocalBuild: differing,
  },
  limitations: [
    'Anonymous GET requests and one headless Chrome session from one machine; no account, private birth data or protection bypass.',
    'The local build ran with the feature flags unset, as Site Check builds; production builds with its own flags, so a chunk that embeds a flag or a public key can differ without a source difference.',
    'Synthetic and public demonstration chart inputs only. Sampled at one-second resolution, as the UI says; no new accuracy measurement and no interval proof.',
  ],
};
const observationBytes = Buffer.from(JSON.stringify(observation, null, 2) + '\n');
await writeFile(join(out, 'observation.json'), observationBytes);
console.log('OBSERVATION ' + JSON.stringify({
  passed: observation.nativeBrowserExecution.passed,
  workers: workers.map((worker) => [worker.path, worker.matchesLocalBuild]),
  assets: after.assets.length,
  differing,
  sameGraph,
  sha256: sha256(observationBytes),
}));
if (!observation.nativeBrowserExecution.passed) process.exitCode = 1;
