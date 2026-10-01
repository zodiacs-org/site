/** Read-only validation of the complete output comparison and source binding. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const evidence = 'docs/platform/evidence/site-engine-rc16/';
const read = (p) => readFileSync(resolve(root, p));
const json = (p) => JSON.parse(read(p));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const output = json(`${evidence}site-outputs.json`);
const original = json('docs/platform/evidence/site-engine-rc15/site-outputs.json');
const controls = json(`${evidence}site-outputs-controls.json`);
const checks = [];
function checked(name, fn) { fn(); checks.push(name); }
checked('full original comparison call coverage retained', () => {
  assert.equal(output.corpus.instants, 14610);
  assert.equal(output.summary.smokeOnly, false);
  for (const key of ['instants', 'cadenceDays', 'from', 'to', 'locations', 'houseSystems', 'timeBasisEdges', 'timeBasisEdgeOffsetsMs']) assert.deepEqual(output.corpus[key], original.corpus[key], key);
  assert.equal(output.summary.calls, original.summary.calls);
  // Value counts can move when aspects enter/leave or shape changes. Counts
  // of calls in each original section cannot be silently reduced.
  assert.deepEqual(Object.fromEntries(Object.entries(output.sections).map(([k,v]) => [k,v.calls])),
    Object.fromEntries(Object.entries(original.sections).map(([k,v]) => [k,v.calls])));
});
checked('extra compared values are exactly the expanded time-scale leaves', () => {
  const addedLeaves = { 'before-1972': 3, '1972-to-2027-10-02': 6, 'after-2027-10-02': 5 };
  const added = original.differences.filter((row) => row.path === 'chart.timeScale')
    .reduce((sum, row) => sum + row.count * addedLeaves[row.era], 0);
  assert.equal(output.summary.values - original.summary.values, added);
});
checked('exact intended versions, base and immutable archives', () => {
  assert.equal(output.old.sourceCommit, 'ed55dacb449ada6e4893676c80bd0d9ba73db576');
  assert.equal(output.old.engineVersion, '0.1.1-rc.15');
  assert.equal(output.new.engineVersion, '0.1.1-rc.16');
  assert.equal(output.old.archiveSha256, '24eeb597b0157598c0faa26bb615c0cb5dfaaeac0393d62c73fbd37c5da4d348');
  assert.equal(output.new.archiveSha256, '43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8');
  for (const side of [output.old, output.new]) assert.equal(sha(read(side.archive)), side.archiveSha256);
});
let files = 0;
checked('installed rc.16 byte-identical to every file in archive', () => {
  const names = execFileSync('tar', ['-tzf', output.new.archive], { encoding: 'utf8' }).trim().split('\n').filter((p) => !p.endsWith('/'));
  for (const name of names) {
    assert.ok(name.startsWith('package/') && !name.includes('..'));
    const bytes = execFileSync('tar', ['-xOzf', output.new.archive, name], { maxBuffer: 1 << 25 });
    assert.equal(sha(read(`node_modules/@zodiacs/engine/${name.slice(8)}`)), sha(bytes), name);
    files += 1;
  }
  assert.equal(files, 69);
});
checked('exact comparison and witness source hashes match current tools', () => {
  for (const [name, digest] of Object.entries(output.toolSources)) assert.equal(sha(read(`${evidence}tools/${name}`)), digest, name);
  for (const [name, digest] of Object.entries(output.new.sources)) assert.equal(sha(read(name)), digest, name);
});
checked('all differences accounted for exactly once by passing numerical witnesses', () => {
  assert.equal(output.summary.unexplainedValues, 0);
  assert.equal(output.summary.unexplainedPaths, 0);
  assert.equal(output.summary.mechanismFailures, 0);
  assert.equal(output.mechanisms.failures, 0);
  for (const [name, check] of Object.entries(output.mechanisms.checks)) {
    assert.ok(check.checks > 0, name);
    assert.equal(check.failures, 0, name);
  }
  for (const entry of output.differences) assert.equal(Object.values(entry.causes).reduce((a,b) => a+b, 0), entry.count);
  assert.equal(output.differences.reduce((sum, row) => sum + row.count, 0), output.summary.differingValues);
  assert.equal(Object.values(output.classes.byClass).reduce((a,b) => a+b, 0), output.summary.differingValues);
});
checked('longitude latitude speed replays remain exact, no tolerance widening', () => {
  for (const side of ['old', 'new']) for (const quantity of ['longitude', 'latitude', 'speed']) assert.equal(output.mechanisms.maxima[`${side} ${quantity} replay residual`].maxAbsolute, 0);
  assert.equal(output.mechanisms.arithmeticLimits.longitudeResidualDegrees, 1e-9);
  assert.equal(output.mechanisms.arithmeticLimits.latitudeResidualDegrees, 1e-10);
  assert.equal(output.mechanisms.noAccuracyGateChanged, true);
});
checked('negative controls prevent path-only explanations', () => {
  assert.equal(controls.pass, true);
  assert.equal(controls.negativeControls.length, 7);
  for (const control of controls.negativeControls) assert.equal(control.result, 'unexplained, correctly refused');
});
console.log(JSON.stringify({ schema: 'zodiacs-site-output-evidence-validation/v1', node: process.version, pass: true,
  checks, installedArchiveFilesChecked: files, reportSha256: sha(read(`${evidence}site-outputs.json`)),
  sourceBindings: output.toolSources, calls: output.summary.calls, comparedValues: output.summary.values,
  differingValues: output.summary.differingValues, unexplainedValues: 0, mechanismFailures: 0,
  accuracyGateAcceptance: 'No gate accepted or weakened; this is migration equivalence evidence only.' }, null, 2));
