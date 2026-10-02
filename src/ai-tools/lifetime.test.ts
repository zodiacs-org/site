import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
function once(source: string, marker: string, replacement: string) {
  expect(source.split(marker).length, marker).toBe(2);
  return source.replace(marker, replacement);
}

for (const local of [false, true]) it(`clears actual ${local ? 'stdio' : 'HTTP'} bundle state after success and failure`, async () => {
  // A disposable fixture keeps ordinary imports beside the real node_modules.
  // Only the local transport startup is omitted; calculation and cleanup are
  // the generated production code, with test-only private-state readers.
  const directory = await mkdtemp(join(root, 'node_modules/.ai-lifetime-'));
  try {
    let source = await readFile(join(root, local ? 'plugins/zodiacs-developer/mcp/server.mjs' : 'api/_ai/runtime.mjs'), 'utf8');
    if (local) {
      const start = source.indexOf('var pending = [];');
      const end = source.indexOf('// Calculations are synchronous;');
      expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
      source = source.slice(0, start) + source.slice(end);
    }
    source = once(source, 'return localTimeModule;', 'auditResolvers.push(localTimeModule); return localTimeModule;');
    source = once(source, 'dispose() {', 'auditState() { return [offsetFormatters.size, wallFormatters.size, zoneHistories?.size ?? 0, zoneHistoryLoads?.size ?? 0]; }, dispose() {');
    source = once(source, '  return last;\n}', '  if (auditFail) throw new Error("synthetic engine failure");\n  return last;\n}');
    source += `\nconst auditResolvers = []; let auditFail = false;
export function auditState() { return [last ?? null, pluto_cache.length, CalcMoonCount]; }
export function auditSetFailure(value) { auditFail = value; }
export { executeAiTool, executeAiToolWithoutLifetimeBoundary, auditResolvers${local ? ', respond, calculateNatalChart' : ''} };\n`;
    await writeFile(join(directory, 'bundle.mjs'), source);
    await writeFile(join(directory, 'run.mjs'), `
import assert from 'node:assert/strict';
import * as bundle from './bundle.mjs';
const args = { instant: '2082-03-14T05:29:17Z', zone: 'Asia/Bangkok' };
const empty = () => { assert.deepEqual(bundle.auditState(), [null, 0, 0]); for (const resolver of bundle.auditResolvers) assert.deepEqual(resolver.auditState(), [0, 0, 0, 0]); };
// Positive control proves that the reader observes the real retained canary.
const prior = await bundle.executeAiToolWithoutLifetimeBoundary('get_sky', args, {});
assert.equal(prior.ok, true); assert.notEqual(bundle.auditState()[0], null);
assert.ok(bundle.auditState()[1] > 0); assert.ok(bundle.auditState()[2] > 0);
assert.deepEqual(await bundle.executeAiTool('get_sky', args, {}), prior); empty();
const concurrent = await Promise.all(['Asia/Bangkok', 'Europe/Paris', 'America/New_York'].map(zone => bundle.executeAiTool('get_sky', { ...args, zone }, {})));
assert.ok(concurrent.every(result => result.ok)); empty();
assert.equal((await bundle.executeAiTool('get_sky', { ...args, zone: 'Invalid/Zone' }, {})).ok, false); empty();
assert.equal((await bundle.executeAiTool('get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' }, { allowEvents: async () => 'limited' })).ok, false); empty();
bundle.auditSetFailure(true);
assert.equal((await bundle.executeAiTool('get_sky', args, {})).ok, false); empty();
bundle.auditSetFailure(false);
${local ? `const natal = { utc: '1990-06-15T12:00:00Z', timeKnown: false, reference: 'utc-noon', output: 'record' };
assert.equal(bundle.respond(() => bundle.calculateNatalChart(natal)).isError, undefined); empty();
bundle.auditSetFailure(true); assert.equal(bundle.respond(() => bundle.calculateNatalChart(natal)).isError, true); empty();` : ''}
console.log('private-state success, refusal, failure and concurrent resolvers passed');
`);
    const run = spawnSync(process.execPath, [join(directory, 'run.mjs')], { encoding: 'utf8', timeout: 60000 });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('private-state success');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 65000);
