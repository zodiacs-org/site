import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phase1TemplateSourceSha256 } from '../tests/visual/phase1-evidence-contract.mjs';

export const PINNED_BROWSER_VERSION = '149.0.7827.55';
export const CAPTURE_OPT_IN = '<!-- browser-evidence -->';
const commitPattern = /^[a-f0-9]{40}$/u;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectories = [
  'docs/acceptance/phase1/screenshots',
  'tests/visual/baselines/linux',
  'tests/visual/artifacts',
];
const provenancePath = 'tests/visual/artifacts/browser-evidence/provenance.json';
const stepNames = [
  'checkout', 'node', 'request', 'install', 'browser', 'build',
  'acceptance', 'receipt', 'visual', 'candidates', 'lighthouse', 'explorer',
];

export function captureMarker(headSha) {
  if (!commitPattern.test(headSha ?? '')) throw new Error('Expected a full lowercase commit SHA.');
  return `<!-- browser-evidence-candidates head=${headSha} -->`;
}

/** PR prose selects a finite operation; it is never interpreted as code. */
export function selectCaptureRequest(event, repository) {
  const pr = event?.pull_request;
  if (typeof repository !== 'string' || repository.length === 0
    || event?.repository?.full_name !== repository
    || pr?.head?.repo?.full_name !== repository) return null;
  if (typeof pr.body !== 'string' || !pr.body.includes(CAPTURE_OPT_IN)) return null;
  if (!commitPattern.test(pr?.head?.sha ?? '') || !commitPattern.test(pr?.base?.sha ?? '')) {
    throw new Error('Capture requires full PR head and base commit SHAs.');
  }
  let mode;
  if (['opened', 'synchronize', 'reopened'].includes(event.action)) {
    mode = 'compare';
  } else if (event.action === 'edited') {
    const marker = captureMarker(pr.head.sha);
    const body = typeof pr.body === 'string' ? pr.body : '';
    const previous = typeof event.changes?.body?.from === 'string' ? event.changes.body.from : '';
    if (!Object.hasOwn(event.changes ?? {}, 'body')
      || !body.includes(marker) || previous.includes(marker)) return null;
    mode = 'candidates';
  } else {
    return null;
  }
  return { mode, headSha: pr.head.sha, baseSha: pr.base.sha };
}

export function assertCaptureRuntime({ nodeVersion, browserVersion }) {
  if (!/^v22\./u.test(nodeVersion ?? '')) throw new Error('Browser evidence requires Node 22.');
  if (browserVersion !== undefined && browserVersion !== PINNED_BROWSER_VERSION) {
    throw new Error(`Browser evidence requires Chromium ${PINNED_BROWSER_VERSION}.`);
  }
}

export function sanitizedStepOutcomes(steps) {
  const outcomes = new Set(['success', 'failure', 'cancelled', 'skipped']);
  return Object.fromEntries(stepNames.map((name) => {
    const outcome = steps?.[name]?.outcome;
    return [name, outcomes.has(outcome) ? outcome : 'unrecorded'];
  }));
}

async function requestFromRuntime() {
  assertCaptureRuntime({ nodeVersion: process.version });
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    throw new Error('Browser evidence only accepts pull_request events.');
  }
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const request = selectCaptureRequest(event, process.env.GITHUB_REPOSITORY);
  if (!request) throw new Error('No new head-bound browser capture was requested.');
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (actualHead !== request.headSha) throw new Error('Checkout does not match the requested PR head.');
  return { ...request, actualHead };
}

async function artifactHashes(relativeDirectory) {
  const entries = await readdir(resolve(root, relativeDirectory), { withFileTypes: true })
    .catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
  const records = await Promise.all(entries.map(async (entry) => {
    const path = `${relativeDirectory}/${entry.name}`;
    if (path === provenancePath) return [];
    if (entry.isDirectory()) return artifactHashes(path);
    if (!entry.isFile()) throw new Error(`Artifact must be a regular file: ${path}`);
    const bytes = await readFile(resolve(root, path));
    return [{ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  }));
  return records.flat();
}

async function main(command) {
  const request = await requestFromRuntime();
  if (command === 'request') {
    await appendFile(process.env.GITHUB_OUTPUT, `mode=${request.mode}\nhead_sha=${request.headSha}\n`);
    console.log(`Browser evidence: ${request.mode} for ${request.headSha}`);
    return;
  }
  if (command === 'browser') {
    const { chromium } = await import('playwright-core');
    const chromePath = chromium.executablePath();
    const versionOutput = execFileSync(chromePath, ['--version'], { encoding: 'utf8' }).trim();
    const browserVersion = versionOutput.match(/\b\d+\.\d+\.\d+\.\d+\b/u)?.[0];
    if (!browserVersion) throw new Error('Could not determine the installed Chromium version.');
    assertCaptureRuntime({ nodeVersion: process.version, browserVersion });
    await appendFile(process.env.GITHUB_ENV,
      `CHROME_PATH=${chromePath}\nPLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${chromePath}\n`);
    await mkdir(resolve(root, 'tests/visual/artifacts/browser-evidence'), { recursive: true });
    await writeFile(resolve(root, 'tests/visual/artifacts/browser-evidence/runtime.json'),
      `${JSON.stringify({ node: process.version, browser: browserVersion }, null, 2)}\n`);
    console.log(versionOutput);
    return;
  }
  if (command === 'provenance') {
    const steps = sanitizedStepOutcomes(JSON.parse(process.env.BROWSER_EVIDENCE_STEPS ?? '{}'));
    const files = (await Promise.all(artifactDirectories.map(artifactHashes))).flat()
      .sort((left, right) => left.path.localeCompare(right.path));
    const evidence = {
      schema: 'zodiacs.browser-evidence.v1',
      ...request,
      repository: process.env.GITHUB_REPOSITORY,
      runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      recordedAt: new Date().toISOString(),
      node: process.version,
      requiredBrowser: PINNED_BROWSER_VERSION,
      templateSourceSha256: await phase1TemplateSourceSha256(root),
      outcomes: steps,
      phase1CaptureSucceeded: steps.acceptance === 'success' && steps.receipt === 'success',
      baselineFiles: request.mode === 'compare' ? 'committed-before' : 'unapproved-candidates',
      files,
    };
    await mkdir(dirname(resolve(root, provenancePath)), { recursive: true });
    await writeFile(resolve(root, provenancePath), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Recorded ${files.length} artifact hashes; outputs still require review and an independent Site Check.`);
    return;
  }
  throw new Error(`Unknown browser evidence command: ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv[2]);
}
