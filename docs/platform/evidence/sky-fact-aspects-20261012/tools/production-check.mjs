// A1.b, F-91 and the S4 compare page in production, after #740 merges. Run from a clone that has the
// merge commit:
//   node docs/platform/evidence/sky-fact-aspects-20261012/tools/production-check.mjs <merge commit> <alias.json> [--control] > production.json
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment just before:
// deploymentId, aliasUpdatedAt, readyState, target, githubCommitSha; nothing else is read from it.
// Each check compares what zodiacs.org serves with the merge commit's own files:
// - the MCP adapter's manifest, byte for byte, and its rc.23 archive by the manifest's size and digest;
// - the compute API's documented aspect example (src/lib/compute-api/examples.json): the answer
//   production computes must be the documented one, apart from the receipt fields that name the
//   runtime and the citation digest that covers them;
// - Chart Studio as the hosted MCP serves it (resources/read of its ui:// resource), byte for byte the
//   merge's integrations/generated/chart-studio.mjs, with F-91's wording;
// - /developers/compare/, with its section linking the four guides that compare the engine with
//   other software.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = 'https://zodiacs.org';
const [commit, aliasPath, flag] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(commit ?? '') || !aliasPath || (flag !== undefined && flag !== '--control')) {
  throw new Error('usage: production-check.mjs <40-hex commit> <alias.json> [--control]');
}
const control = flag === '--control';
const raw = JSON.parse(readFileSync(aliasPath, 'utf8'));
const alias = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const show = (path) => execFileSync('git', ['show', `${commit}:${path}`], { maxBuffer: 256 * 1024 * 1024 });
const get = async (path) => {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
};

const checks = [];
const check = (name, ok, detail = {}) => checks.push({ ...detail, name, ok: Boolean(ok) });
check('the zodiacs.org alias names a READY production deployment built from the commit',
  alias.readyState === 'READY' && alias.target === 'production' && alias.githubCommitSha === commit, alias);

const manifestBytes = show('public/examples/mcp-server.json');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const servedManifest = await get('/examples/mcp-server.json');
check("the MCP adapter's manifest is the commit's, byte for byte", servedManifest.status === 200 && servedManifest.bytes.equals(manifestBytes),
  { status: servedManifest.status, sha256: sha256(servedManifest.bytes), version: manifest.version });
const archive = await get(`/examples/${manifest.file}`);
check(`the MCP adapter ${manifest.version} archive has the manifest's size and digest`,
  archive.status === 200 && archive.bytes.length === manifest.bytes && sha256(archive.bytes) === manifest.sha256,
  { status: archive.status, bytes: archive.bytes.length, sha256: sha256(archive.bytes), supersedes: JSON.parse(show('examples/mcp-server/candidate.json').toString('utf8')).supersedes });

const examples = JSON.parse(show('src/lib/compute-api/examples.json').toString('utf8'));
const documented = examples.success['sky-fact'].aspect;
const exampleSource = show('src/lib/compute-api/examples.ts').toString('utf8');
const request = { kind: 'aspect', body: 'Moon', other: 'Saturn', aspect: 'trine', date: '2026-10-14', zone: 'Europe/London' };
const documentedRequest = exampleSource.includes("body: { kind: 'aspect', body: 'Moon', other: 'Saturn', aspect: 'trine', date: '2026-10-14', zone: 'Europe/London' }");
const response = await fetch(`${BASE}/api/v1/sky-fact`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
  cache: 'no-store', signal: AbortSignal.timeout(30000),
});
const answer = await response.json().catch(() => null);
check("the compute API's sky-fact endpoint answers the documented aspect example as documented",
  documentedRequest && response.status === 200 && JSON.stringify(answer?.result) === JSON.stringify(documented.result) && answer?.schema === documented.schema,
  { status: response.status, documentedRequest, answer: answer?.result?.answer ?? null, basis: answer?.result?.basis ?? null });

const studioModule = show('integrations/generated/chart-studio.mjs').toString('utf8');
const studioHtml = (await import(`data:text/javascript;base64,${Buffer.from(studioModule).toString('base64')}`)).STUDIO_HTML;
const mcp = await fetch(`${BASE}/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'ui://zodiacs/chart-studio-v2.html' } }),
  cache: 'no-store', signal: AbortSignal.timeout(30000),
});
const mcpText = await mcp.text();
const message = (() => {
  try { return JSON.parse(mcpText); } catch {}
  const data = mcpText.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
  try { return JSON.parse(data); } catch { return null; }
})();
const served = message?.result?.contents?.[0]?.text ?? '';
check("the hosted MCP's Chart Studio is the commit's, byte for byte, with F-91's wording",
  mcp.status === 200 && served === studioHtml && served.includes('12:00 UTC on your birth date') && !/Sun sign is reliable/u.test(served),
  { status: mcp.status, bytes: Buffer.byteLength(served), sha256: sha256(Buffer.from(served)), committedSha256: sha256(Buffer.from(studioHtml)) });

const compare = await get('/developers/compare/');
const page = compare.bytes.toString('utf8');
const links = ['swiss-ephemeris-alternative-javascript', 'ephemeris-npm', 'python-astrology-library', 'astrology-api']
  .filter((slug) => page.includes(`href="/developers/docs/${slug}/"`));
check('/developers/compare/ has the section linking the four guides that compare the engine with other software',
  compare.status === 200 && page.includes('id="other-software"') && links.length === 4,
  { status: compare.status, sha256: sha256(compare.bytes), linked: links });

const passed = checks.filter((item) => item.ok).length;
console.log(JSON.stringify({ schema: 'zodiacs.sky-fact-aspects-production.v1', base: BASE, control, expectedCommit: commit, readAt: new Date().toISOString(), passed, of: checks.length, checks }, null, 2));
if (!control && passed !== checks.length) process.exitCode = 1;
