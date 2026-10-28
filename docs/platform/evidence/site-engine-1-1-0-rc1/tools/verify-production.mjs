/**
 * After the merge deploys: what canonical production serves for the engine
 * 1.1.0-rc.1 adoption (R44). Adapted from
 * ../../site-engine-1-0-0/tools/verify-production.mjs. GETs the pages and
 * files that name the engine and the MCP adapter, and sends the compute API's
 * own documented positions request once.
 *
 * The expected values are read from the merge commit, not the working tree:
 * the candidate record, the MCP manifest and the documented example. The alias
 * read (deploymentId, aliasUpdatedAt, readyState, target, githubCommitSha),
 * made through the Vercel connector just before the run, comes in as a file,
 * as conventions-check.mjs takes it; nothing else is read from it. Run from a
 * clone of zodiacs-org/site that contains the merge:
 *
 *   node verify-production.mjs <alias.json> <40-hex merge commit> <out.json> [base URL]
 *
 * Exits non-zero on any failed check.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [aliasPath, merge, out, base = 'https://zodiacs.org'] = process.argv.slice(2);
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(merge ?? '') || !out) {
  throw new Error('usage: verify-production.mjs <alias.json> <40-hex merge commit> <out.json> [base URL]');
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const atMerge = (path) => git('show', `${merge}:${path}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (text) => text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (whole, dec, hex, name) => {
  if (dec) return String.fromCodePoint(Number(dec));
  if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()] ?? whole;
});
async function get(path) {
  try {
    const response = await fetch(base + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'zodiacs-programme-check' } });
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, bytes: Buffer.alloc(0), error: String(error) };
  }
}

const candidate = JSON.parse(atMerge('src/data/platform-engine-candidate.json'));
const mcp = JSON.parse(atMerge('public/examples/mcp-server.json'));
const version = candidate.version;

const checks = [];
// Detail first, so no field it carries can replace the check's name or result.
const check = (name, ok, detail = {}) => {
  checks.push({ ...detail, name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` · ${JSON.stringify(detail).slice(0, 400)}`}`);
};

const raw = JSON.parse(await readFile(aliasPath, 'utf8'));
const deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
let containsMerge = false;
try {
  git('merge-base', '--is-ancestor', merge, deployment.githubCommitSha);
  containsMerge = true;
} catch {}
check('the zodiacs.org alias names a READY production deployment built from a commit that contains the merge',
  deployment.readyState === 'READY' && deployment.target === 'production' && containsMerge, { containsMerge });

// The candidate wording: a release candidate npm does not carry, with npm's 1.0.0 beside it.
for (const [path, needles] of [
  ['/developers/engine/', [`This revision vendors ${version}, a release candidate that is not on npm.`,
    'records 1.0.0 under latest', 'npm install @zodiacs/engine@1.0.0 installs 1.0.0', candidate.sha256]],
  ['/developers/support/', [`This revision vendors the ${version} archive below, a release candidate that is not on npm.`,
    'records 1.0.0 under latest', 'npm install @zodiacs/engine@1.0.0 installs 1.0.0', candidate.sha256]],
  ['/developers/mcp/', [`The engine (@zodiacs/engine ${version})`, `zodiacs-mcp-server ${mcp.version}`, mcp.sha256]],
  ['/llms.txt', [`\`@zodiacs/engine\` ${version}, MIT`, 'a release candidate that npm does not carry', 'npm\'s `latest` is 1.0.0',
    `\`zodiacs-mcp-server\` ${mcp.version}`]],
  ['/llms-full.txt', [`\`@zodiacs/engine\` version ${version}, a release candidate after 1.0.0`,
    'records 1.0.0, the first stable release, under `latest`', `\`zodiacs-mcp-server\` candidate version ${mcp.version}`]],
]) {
  const { status, bytes } = await get(path);
  // Pages are compared as text: tags, which carry Astro's scoped attributes, are removed and entities decoded.
  const text = path.endsWith('.txt') ? bytes.toString('utf8') : decode(bytes.toString('utf8').replace(/<[^>]+>/gu, ''));
  const missing = needles.filter((needle) => !text.includes(needle));
  check(`${path} names engine ${version} as a candidate npm does not carry`, status === 200 && missing.length === 0,
    { status, sha256: sha256(bytes), missing });
}

const provenance = await get('/developers/engine/reference/provenance.json');
let reference = null;
try { reference = JSON.parse(provenance.bytes.toString('utf8')); } catch {}
check(`TypeDoc provenance names ${version} and its archive`, provenance.status === 200 && reference?.version === version
  && reference?.sha256 === candidate.sha256 && reference?.sourceCommit === candidate.sourceCommit && reference?.license === 'MIT AND CC-BY-4.0',
  { status: provenance.status, version: reference?.version ?? null, sha256: sha256(provenance.bytes) });

const manifest = await get('/examples/mcp-server.json');
let served = null;
try { served = JSON.parse(manifest.bytes.toString('utf8')); } catch {}
check('MCP manifest is the merge\'s', manifest.status === 200 && JSON.stringify(served) === JSON.stringify(mcp),
  { status: manifest.status, version: served?.version ?? null });
const archive = await get(`/examples/${mcp.file}`);
check(`MCP archive ${mcp.version} has the manifest's digest`, archive.status === 200 && sha256(archive.bytes) === mcp.sha256 && archive.bytes.length === mcp.bytes,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes) });

// The compute API's own documented positions example (src/lib/compute-api/examples.ts, positions.two):
// two instants and three bodies, no person's data.
const body = { instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'] };
const documented = /instants: \['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'\], bodies: \['Sun', 'Moon', 'Mercury'\]/u
  .test(atMerge('src/lib/compute-api/examples.ts'));
check('the documented positions example is the one sent', documented);
let answer = null;
let status = 0;
try {
  const response = await fetch(base + '/api/v1/positions', {
    method: 'POST', headers: { 'content-type': 'application/json', 'User-Agent': 'zodiacs-programme-check' }, body: JSON.stringify(body),
    cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  status = response.status;
  answer = await response.json().catch(() => null);
} catch {}
const ids = answer?.receipt?.conventionIds;
check(`compute API answers on engine ${version}, with the receipt's convention ids`, status === 200 && answer?.backend?.version === version
  && answer?.receipt?.engine?.version === version && Array.isArray(ids) && ids.length > 0,
  { status, backend: answer?.backend?.version ?? null, receiptEngine: answer?.receipt?.engine?.version ?? null, conventionIds: Array.isArray(ids) ? ids.length : null });

const record = {
  schema: 'zodiacs.engine-1-1-0-rc1-production.v1',
  checkedAt: new Date().toISOString(),
  base,
  merge,
  deployment,
  candidate: { version, sha256: candidate.sha256, sourceCommit: candidate.sourceCommit },
  mcp: { version: mcp.version, sha256: mcp.sha256 },
  checks,
  passed: checks.filter((item) => item.ok).length,
  failed: checks.filter((item) => !item.ok).length,
};
await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${record.passed} passed, ${record.failed} failed`);
process.exitCode = record.failed ? 1 : 0;
