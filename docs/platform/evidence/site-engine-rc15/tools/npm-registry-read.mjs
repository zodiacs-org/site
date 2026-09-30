/**
 * What the npm registry records for the engine version the site vendors: its
 * dist-tags, the version's tarball digests and its provenance attestation.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/npm-registry-read.mjs 0.1.1-rc.15 > npm-registry.json
 *
 * Reads with the npm CLI and curl, which use the environment's registry and
 * proxy settings. The provenance statement is decoded from the Sigstore bundle
 * at `dist.attestations.url`; decoding does not verify it. Verification is
 * `npm audit signatures`, run in a scratch project that installs the version
 * from the registry: its JSON report lists what failed, and its summary lines
 * say what it verified. Both are kept.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const name = '@zodiacs/engine';
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version ?? '')) {
  throw new Error('usage: node npm-registry-read.mjs <version>');
}
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 << 20, ...options });
const npmJson = (...args) => JSON.parse(run('npm', [...args, '--json']));

const readAt = new Date().toISOString();
const distTags = npmJson('view', name, 'dist-tags');
const dist = npmJson('view', `${name}@${version}`, 'dist');
const published = npmJson('view', name, 'time')[version];

const bundles = JSON.parse(run('curl', ['-sS', '--fail', dist.attestations.url])).attestations;
const decode = ({ predicateType, bundle }) => ({
  predicateType,
  statement: JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8')),
  logIndexes: (bundle.verificationMaterial?.tlogEntries ?? []).map((entry) => entry.logIndex),
});
const attestations = bundles.map(decode);
const slsa = attestations.find((entry) => entry.predicateType === 'https://slsa.dev/provenance/v1');
if (!slsa) throw new Error('no SLSA provenance attestation');
const { buildDefinition, runDetails } = slsa.statement.predicate;
const [subject] = slsa.statement.subject;

// Verification, in a project with nothing above it but the scratch directory.
const scratch = mkdtempSync(join(tmpdir(), 'npm-registry-read-'));
let audit;
try {
  writeFileSync(join(scratch, 'package.json'), JSON.stringify({ name: 'npm-registry-read', version: '0.0.0', private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', `${name}@${version}`], { cwd: scratch, stdio: ['ignore', 'ignore', 'ignore'] });
  const installed = JSON.parse(run('npm', ['ls', name, '--json'], { cwd: scratch })).dependencies[name].version;
  audit = {
    installed,
    report: JSON.parse(run('npm', ['audit', 'signatures', '--json'], { cwd: scratch })),
    summary: run('npm', ['audit', 'signatures'], { cwd: scratch }).split('\n').map((line) => line.trim()).filter((line) => /verified/u.test(line)),
  };
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(JSON.stringify({
  tool: 'docs/platform/evidence/site-engine-rc15/tools/npm-registry-read.mjs',
  readAt,
  npm: run('npm', ['--version']).trim(),
  node: process.version,
  package: name,
  version,
  distTags,
  published,
  dist: {
    tarball: dist.tarball,
    shasum: dist.shasum,
    integrity: dist.integrity,
    fileCount: dist.fileCount,
    unpackedSize: dist.unpackedSize,
    attestations: dist.attestations,
  },
  attestations: attestations.map(({ predicateType, statement, logIndexes }) => ({
    predicateType,
    subject: statement.subject,
    logIndexes,
  })),
  provenance: {
    predicateType: slsa.predicateType,
    subject: { name: subject.name, sha512: subject.digest.sha512 },
    buildType: buildDefinition.buildType,
    workflow: buildDefinition.externalParameters.workflow,
    event: buildDefinition.internalParameters?.github?.event_name,
    resolvedDependencies: buildDefinition.resolvedDependencies,
    builder: runDetails.builder.id,
    invocation: runDetails.metadata.invocationId,
  },
  auditSignatures: audit,
}, null, 2));
