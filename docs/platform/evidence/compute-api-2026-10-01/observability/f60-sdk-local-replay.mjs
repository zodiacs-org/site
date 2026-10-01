// Isolated local source replay. No network and no access to the real process.env.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const site = resolve(root, '../site');
const sourceSha = '9cfafa3e742de943062c9174338472781724a4b5';
const bundle = execFileSync('git', ['show', `${sourceSha}:api/_compute/compute.mjs`], { cwd: site, encoding: 'utf8' });
const sdk = await readFile(resolve(site, 'node_modules/@vercel/firewall/dist/rate-limit.js'), 'utf8');
const start = bundle.indexOf('async function computeApiRateLimit(');
const end = bundle.indexOf('async function firewallVerdict(', start);
assert(start > 0 && end > start);
const guard = bundle.slice(start, end);
const calls = [];
let responseStatus = 204;
let deferred = null;
const fakeProcess = { env: Object.freeze({ NODE_ENV: 'production' }) };
const context = vm.createContext({
  module: { exports: {} }, Headers, TextEncoder, crypto: webcrypto,
  process: fakeProcess, console: { warn() {} },
  fetch: async (url, init) => {
    assert.equal(new URL(url).hostname, 'synthetic.invalid');
    calls.push({ url, headers: init.headers, method: init.method, redirect: init.redirect });
    if (deferred) await deferred;
    return { status: responseStatus };
  },
});
vm.runInContext(sdk + '\nconst COMPUTE_RATE_LIMIT_ID = "zodiacs-compute-api";\n' + guard, context);
const check = (headers) => context.computeApiRateLimit({ headers });
const headers = { host: 'synthetic.invalid', 'x-real-ip': '198.51.100.23', 'x-forwarded-for': '198.51.100.23' };
for (let i = 0; i < 41; i++) assert.equal(await check(headers), 'allowed');
assert.equal(calls.length, 41);
const keyCount = new Set(calls.map(c => c.headers.get('x-vercel-rate-limit-key'))).size;
assert.equal(keyCount, 1);
assert(calls.every(c => c.headers.get('x-vercel-rate-limit-api') === 'zodiacs-compute-api'));
assert(calls.every(c => new URL(c.url).pathname === '/.well-known/vercel/rate-limit-api/zodiacs-compute-api'));
assert(calls.every(c => c.method === 'GET' && c.redirect === 'manual'));

const statusVerdicts = {};
for (const status of [204, 429, 403, 404, 500]) {
  responseStatus = status;
  statusVerdicts[status] = await check(headers);
}
assert.deepEqual(statusVerdicts, { 204: 'allowed', 429: 'limited', 403: 'limited', 404: 'unavailable', 500: 'unavailable' });
responseStatus = 204;
let release;
deferred = new Promise(resolve => { release = resolve; });
let settled = false;
const pending = check(headers).then(x => { settled = true; return x; });
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(settled, false);
release();
assert.equal(await pending, 'allowed');
deferred = null;
const beforeMissingIp = calls.length;
assert.equal(await check({ host: 'synthetic.invalid' }), 'unavailable');
assert.equal(calls.length, beforeMissingIp);
fakeProcess.env = Object.freeze({ NODE_ENV: 'development' });
assert.equal(await check(headers), 'unavailable');
assert.equal(calls.length, beforeMissingIp);

const report = {
  schema: 'zodiacs.compute-api.f60-local-sdk-replay.v1', sourceSha,
  productionBundleSha256: createHash('sha256').update(bundle).digest('hex'),
  installedSdkSha256: createHash('sha256').update(sdk).digest('hex'),
  networkCalls: 0, realEnvironmentRead: false,
  syntheticSequentialChecks: 41, interceptedFetchCallsForSequentialChecks: 41,
  distinctDerivedKeyCountForIdenticalSyntheticHeaders: keyCount,
  matchedExpectedRuleIdAndSameHostSdkPath: true, statusVerdicts,
  pendingDecisionAwaited: true, missingIpFailsClosedBeforeFetch: true,
  developmentGuardFailsClosedBeforeFetch: true,
  interpretation: 'The production-source guard and installed SDK await every decision and keep a stable key for identical synthetic headers and fixed synthetic environment. A stubbed upstream 204 permits every request; there is no SDK-local threshold counter. This does not reproduce or identify the live platform cause, prove live response codes, or verify deployed SDK bytes.',
};
await writeFile(resolve(root, 'f60-sdk-local-replay.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
