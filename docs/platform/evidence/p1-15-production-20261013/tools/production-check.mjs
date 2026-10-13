// P1.15 in production: zodiacs.org serves the llms files #730 corrected. Each check reads the
// live file and compares it with the expected commit's copy, byte for byte, then holds it to the
// wording the claims ledger records. Run from a clone that has the commit:
//   node docs/platform/evidence/p1-15-production-20261013/tools/production-check.mjs <commit> <alias.json> [--control] > production.json
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment, read just
// before the checks: deploymentId, aliasUpdatedAt, readyState, target, githubCommitSha. Nothing
// else from that reply is read or recorded. With --control, the commit is one production is not
// expected to serve, and the record says the run is a control.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [commit, aliasPath, flag] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(commit ?? '') || !aliasPath || (flag !== undefined && flag !== '--control')) {
  throw new Error('usage: production-check.mjs <40-hex commit> <alias.json> [--control]');
}
const control = flag === '--control';
const raw = JSON.parse(readFileSync(aliasPath, 'utf8'));
const alias = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
const sha = (text) => createHash('sha256').update(text).digest('hex');
const fromCommit = (path) => execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const live = async (url) => {
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  return { status: response.status, text: await response.text() };
};

const checks = [{
  check: 'the zodiacs.org alias names a READY production deployment built from the commit',
  ...alias,
  pass: alias.readyState === 'READY' && alias.target === 'production' && alias.githubCommitSha === commit,
}];
// The retired paths may not be described as live (scripts/trust-privacy-boundary.test.mjs).
const RETIRED = /preview service|link with a preview|calendar feed carries|receive at each refresh/iu;
for (const path of ['public/llms.txt', 'public/llms-full.txt']) {
  const url = `https://zodiacs.org/${path.replace(/^public\//u, '')}`;
  const served = await live(url);
  const committed = fromCommit(path);
  checks.push({ check: `${url} is the commit's ${path}, byte for byte`, status: served.status, servedSha256: sha(served.text), committedSha256: sha(committed), pass: served.status === 200 && served.text === committed });
  checks.push({ check: `${url} describes no retired path as live`, pass: served.status === 200 && !RETIRED.test(served.text) });
}
const full = (await live('https://zodiacs.org/llms-full.txt')).text;
for (const sentence of [
  'Share links keep chart data in the URL fragment, which is not sent in normal HTTP requests, and the links the site makes now carry none in their query string.',
  'Preview links made before those were retired still open',
]) checks.push({ check: `llms-full.txt says: ${sentence}`, pass: full.includes(sentence) });
const passed = checks.filter((check) => check.pass).length;
console.log(JSON.stringify({
  schema: 'zodiacs.p1-15-production.v1',
  base: 'https://zodiacs.org',
  control,
  expectedCommit: commit,
  readAt: new Date().toISOString(),
  passed,
  of: checks.length,
  checks,
}, null, 2));
if (!control && passed !== checks.length) process.exitCode = 1;
