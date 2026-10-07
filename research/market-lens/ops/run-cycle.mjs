import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, readdir, mkdtemp, rm, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const execute = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = await realpath(path.resolve(process.argv[2] ?? 'frozen'));
const state = await realpath(path.resolve(process.argv[3] ?? 'state'));
if (process.argv.length > 4 || state === runtime || state.startsWith(runtime + path.sep)) throw Error('Use: node ops/run-cycle.mjs frozen state (state must be outside frozen runtime)');
const manifest = JSON.parse(await readFile(path.join(runtime, 'research/market-lens/prospective-manifest.json'), 'utf8'));
const cli = path.join(runtime, 'scripts/market-lens-paper.mjs');
const now = new Date();
const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
const errors = [], witnesses = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = async (command, args) => (await execute(command, args, {maxBuffer: 1024 * 1024, timeout: 180000})).stdout;
const paper = async command => JSON.parse(await run(process.execPath, [cli, command, '--dir', state]));
// Validate the full frozen implementation and all prior decisions before acquisition.
const before = await paper('report');
const witnessDirectory = path.join(state, 'witnesses');
await mkdir(witnessDirectory, {recursive: true, mode: 0o700});
const ca = path.join(here, 'freetsa-ca.pem');
async function verifyWitness(base, decision) {
  await run('openssl', ['ts', '-verify', '-queryfile', base + '.tsq', '-in', base + '.tsr', '-CAfile', ca]);
  await run('openssl', ['ts', '-verify', '-digest', decision.sha256, '-in', base + '.tsr', '-CAfile', ca]);
  const text = await run('openssl', ['ts', '-reply', '-in', base + '.tsr', '-text']);
  if (!/Status: Granted\./u.test(text)) throw Error('Timestamp authority did not grant the request');
  const timestamp = text.match(/^Time stamp: (.+)$/mu)?.[1];
  const at = Date.parse(timestamp ?? '');
  if (!Number.isFinite(at)) throw Error('Timestamp authority returned an unreadable time');
  const deadline = Date.parse(decision.payload.executionAt) - manifest.decisionLeadSeconds * 1000;
  if (at > deadline) throw Error('Independent timestamp missed the decision lead deadline');
  return {day: decision.payload.executionAt.slice(0, 10), decisionHash: decision.sha256, witnessedAt: new Date(at).toISOString(), service: 'https://freetsa.org/tsr', querySha256: hash(await readFile(base + '.tsq')), responseSha256: hash(await readFile(base + '.tsr')), caSha256: hash(await readFile(ca)), verified: true};
}
async function witness(decision, day) {
  const base = path.join(witnessDirectory, day);
  const existing = new Set(await readdir(witnessDirectory));
  if (existing.has(day + '.tsq') || existing.has(day + '.tsr')) {
    if (!existing.has(day + '.tsq') || !existing.has(day + '.tsr')) throw Error('Incomplete stored timestamp; preserve it for operator review');
    return verifyWitness(base, decision);
  }
  if (Date.now() > Date.parse(decision.payload.executionAt) - manifest.decisionLeadSeconds * 1000) throw Error('Unwitnessed decision is past its deadline; no retroactive attestation');
  const scratch = await mkdtemp(path.join(tmpdir(), 'lens-witness-'));
  const candidate = path.join(scratch, day);
  try {
    await run('openssl', ['ts', '-query', '-digest', decision.sha256, '-sha256', '-cert', '-out', candidate + '.tsq']);
    await run('curl', ['--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--max-filesize', '50000', '--proto', '=https', '-H', 'Content-Type: application/timestamp-query', '--data-binary', '@' + candidate + '.tsq', 'https://freetsa.org/tsr', '--output', candidate + '.tsr']);
    const receipt = await verifyWitness(candidate, decision);
    for (const extension of ['.tsq', '.tsr']) await writeFile(base + extension, await readFile(candidate + extension), {flag: 'wx', mode: 0o600});
    await writeFile(base + '.json', JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    return receipt;
  } finally { await rm(scratch, {recursive: true, force: true}); }
}
let record = 'outside-window';
if (tomorrow >= new Date(manifest.start) && tomorrow < new Date(manifest.endExclusive)) {
  const day = tomorrow.toISOString().slice(0, 10);
  const decisions = await readdir(path.join(state, 'decisions')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  if (decisions.includes(day + '.json')) record = 'already-recorded';
  else try { await paper('record'); record = 'recorded'; } catch { record = 'failed'; errors.push({stage: 'record', day}); }
}
const decisionNames = await readdir(path.join(state, 'decisions')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
for (const name of decisionNames.filter(name => /^\d{4}-\d{2}-\d{2}\.json$/u.test(name)).sort()) {
  const decision = JSON.parse(await readFile(path.join(state, 'decisions', name), 'utf8'));
  try { witnesses.push(await witness(decision, name.slice(0, 10))); }
  catch { errors.push({stage: 'witness', day: name.slice(0, 10)}); }
}
try { await paper('settle'); } catch { errors.push({stage: 'settle'}); }
const report = await paper('report');
const health = {at: new Date().toISOString(), protocolHash: before.protocolHash, record, recordedDecisions: report.recordedDecisions, matchedDays: report.matchedDays, pendingDays: report.pendingDays, witnessedDecisions: witnesses.length, witnesses, errors};
const reports = path.join(state, 'reports');
await mkdir(reports, {recursive: true, mode: 0o700});
await writeFile(path.join(reports, Date.now() + '-' + process.pid + '.json'), JSON.stringify({health, report}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
// Logs contain operational counts and hashes, never raw candles or individual actions.
console.log(JSON.stringify({at: health.at, protocolHash: health.protocolHash, record, recordedDecisions: health.recordedDecisions, witnessedDecisions: health.witnessedDecisions, matchedDays: health.matchedDays, pendingDays: health.pendingDays, errors}, null, 2));
if (errors.length) process.exitCode = 1;
