import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { assertEngineCandidate } from './platform-engine-candidate.mjs';
import { readPackageArchive } from './verify-platform-starter.mjs';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const candidate = JSON.parse(read('src/data/platform-engine-candidate.json'));
const archive = readFileSync(resolve(root, candidate.artifactPath));
// Read named members without extracting files or making network requests.
const packed = (path) => execFileSync('tar', ['-xOf', resolve(root, candidate.artifactPath), `package/${path}`], { encoding: 'utf8' });
const manifest = JSON.parse(packed('package.json'));
// The SDK and site repositories moved from ZodiacsOfficial to zodiacs-org on
// 2026-09-24. An archive packed from them, and the evidence ledger written for
// it, keep the address they were written with. The engine repository was made
// under zodiacs-org, so its addresses never changed.
const beforeMove = (url) => url.replace(/^https:\/\/(github\.com|raw\.githubusercontent\.com)\/zodiacs-org\/(sdk|site)\//u, 'https://$1/ZodiacsOfficial/$2/');
// The package directory in its source repository: packages/engine of the SDK up
// to rc.6, the repository root from rc.7.
const packagePrefix = candidate.sourcePackagePath ? `${candidate.sourcePackagePath}/` : '';
// The draft envelope specification stays in the SDK repository, as written for rc.3 to rc.6.
const RECEIPT_SPEC = 'https://github.com/zodiacs-org/sdk/blob/fb57af7a2cd7c30983cc8fb655183d5a11f9cf30/docs/platform/receipt-draft-v1.md';
// What the npm registry recorded for this version on 2026-09-30, written by
// docs/platform/evidence/site-engine-rc15/tools/npm-registry-read.mjs.
const registry = JSON.parse(read('docs/platform/evidence/site-engine-rc15/npm-registry.json'));
const currentRegistry = JSON.parse(read('docs/platform/evidence/site-engine-rc16/npm-release/verification-receipt.json'));
// What npm served on 2026-10-06, when the site vendored rc.17, which is not on npm: the same tool's read of
// the version under `next`, and the registry's list of versions (docs/platform/evidence/site-engine-rc17/).
const registryNow = JSON.parse(read('docs/platform/evidence/site-engine-rc17/npm-registry-rc16.json'));
const currentRegistryRead = JSON.parse(read('docs/platform/evidence/site-engine-1-0-0-rc2/npm-registry-rc16.json'));
const npmView = read('docs/platform/evidence/site-engine-1-0-0-rc2/npm-view.txt');

describe('developer candidate documentation', () => {
  it('identifies the installed public engine and exact archived package', () => {
    expect(assertEngineCandidate(candidate)).toBe(candidate);
    expect(candidate.schemaVersion).toBe(1);
    expect(candidate.name).toBe(manifest.name);
    expect(candidate.version).toBe(manifest.version);
    expect(candidate.version).toBe(ENGINE_VERSION);
    expect(candidate.sha256).toBe(createHash('sha256').update(archive).digest('hex'));
    const siteManifest = JSON.parse(read('package.json'));
    expect(siteManifest.dependencies[candidate.name]).toBe(`file:${candidate.artifactPath}`);
    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.packages[`node_modules/${candidate.name}`].integrity)
      .toBe(`sha512-${createHash('sha512').update(archive).digest('base64')}`);
    const files = readPackageArchive(archive);
    expect(files.size).toBe(74);
    for (const [path, bytes] of files) {
      // Buffer.equals checks length and every byte without walking a large
      // archive member through the assertion library's generic object comparer.
      expect(readFileSync(resolve(root, 'node_modules/@zodiacs/engine', path)).equals(bytes), path).toBe(true);
    }
  });

  it('uses the recorded immutable public URL for that archive', () => {
    const url = new URL(candidate.artifactUrl);
    expect(url.origin).toBe('https://raw.githubusercontent.com');
    expect(url.username + url.password + url.search + url.hash).toBe('');
    const [, owner, repository, commit, ...path] = url.pathname.split('/');
    expect(`https://github.com/${owner}/${repository}`).toBe(candidate.artifactRepository);
    expect(commit).toBe(candidate.artifactCommit);
    expect(path.join('/')).toBe(candidate.artifactRepositoryPath);
    expect(read(candidate.evidencePaths.ledger)).toContain(beforeMove(candidate.artifactUrl));
  });

  it('cross-checks source provenance and the linked packaged documents', () => {
    expect(candidate.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.repository.url).toBe(`git+${beforeMove(candidate.sourceRepository)}.git`);
    expect(manifest.repository.directory ?? '').toBe(candidate.sourcePackagePath);
    const provenance = read('vendor/README.md');
    expect(provenance).toContain(`Source commit: \`${candidate.sourceCommit}\``);
    expect(provenance).toContain(`Artifact SHA-256: \`${candidate.sha256}\``);
    for (const path of ['README.md', 'CHANGELOG.md', 'LICENSING.md', 'NOTICE']) {
      expect(packed(path).trim().length, path).toBeGreaterThan(0);
    }
    // A source checkout is not required: the archive must expose the documented
    // public ESM/type paths, independent of its internal site-only subpaths.
    for (const entry of ['.', './geo', './receipt']) {
      expect(packed(manifest.exports[entry].import.replace(/^\.\//, ''))).not.toBe('');
      expect(packed(manifest.exports[entry].types.replace(/^\.\//, ''))).not.toBe('');
    }
  });

  it.each([
    ['artifactCommit', 'main'],
    ['artifactCommit', 'a'.repeat(40) + '\n'],
    ['sourceCommit', 'a'.repeat(40) + '\r'],
    ['evidenceCommit', null],
    ['artifactRepository', 'https://github.com/another/sdk'],
    ['artifactRepositoryPath', 'artifacts/%2e%2e/private.tgz'],
    ['artifactPath', '../private.tgz'],
    ['artifactUrl', candidate.artifactUrl + '?token=synthetic'],
    ['sha256', '0'.repeat(64) + '\n'],
    ['version', candidate.version + '\r'],
    ['version', '00.1.1-rc.5'],
    ['version', '0.1.1-rc.05'],
    // Each of the three alone, set as the other state has it, contradicts the record's state.
    ['releaseStatus', candidate.releaseStatus === 'published' ? 'vendored-candidate' : 'published'],
    ['releaseLabel', candidate.releaseStatus === 'published' ? 'Vendored candidate' : 'On npm'],
    ['registryVersion', candidate.releaseStatus === 'published' ? '0.1.1-rc.15' : candidate.version],
    ['registryObservedOn', '2026-09-30\n'],
    ['schemaVersion', 2],
  ])('rejects inconsistent or noncanonical metadata: %s', (key, value) => {
    const validFixture = { ...candidate, evidenceCommit: 'a'.repeat(40) };
    expect(assertEngineCandidate(validFixture)).toBe(validFixture);
    expect(() => assertEngineCandidate({ ...validFixture, [key]: value }))
      .toThrow('Invalid engine candidate metadata');
  });

  it('rejects extra metadata fields and evidence path traversal', () => {
    const validFixture = { ...candidate, evidenceCommit: 'a'.repeat(40) };
    expect(assertEngineCandidate(validFixture)).toBe(validFixture);
    expect(() => assertEngineCandidate({ ...validFixture, evidenceCommit: '0'.repeat(40) })).toThrow();
    expect(() => assertEngineCandidate({ ...validFixture, anotherIdentity: true })).toThrow();
    expect(() => assertEngineCandidate({ ...validFixture, evidencePaths: {
      ...candidate.evidencePaths, node22: 'docs/platform/../private.json',
    } })).toThrow();
  });

  it('links existing evidence for the same artifact rather than another candidate', () => {
    expect(candidate.evidenceRepository).toBe('https://github.com/zodiacs-org/site');
    expect(candidate.evidenceCommit).toMatch(/^[a-f0-9]{40}$/);
    for (const path of Object.values(candidate.evidencePaths)) {
      expect(path).toMatch(/^docs\/platform\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/);
      expect(read(path).trim().length, path).toBeGreaterThan(0);
    }
    for (const key of ['node22', 'node24']) {
      const report = JSON.parse(read(candidate.evidencePaths[key]));
      expect(report.engineVersion).toBe(candidate.version);
      expect(report.artifactSHA256).toBe(candidate.sha256);
    }
    const log = read(candidate.evidencePaths.publicConsumer);
    const receipt = JSON.parse(log.slice(log.indexOf('\n{') + 1));
    expect(receipt.version).toBe(candidate.version);
    expect(receipt.sha256).toBe(candidate.sha256);
    expect(receipt.publicExamples).toBe('passed');
    expect(receipt.types).toBe('passed');
  });

  it('records the vendored rc17 candidate beside the verified rc16 next release, and retains earlier rc15 provenance', () => {
    // rc.17 is vendored and not on npm (docs/platform/programme/DECISIONS-2026-10-05.md §7).
    expect(candidate.releaseStatus).toBe('vendored-candidate');
    expect(candidate.releaseLabel).toBe('Vendored candidate');
    expect(candidate.registryObservedOn).toBe(currentRegistryRead.readAt.slice(0, 10));
    expect(currentRegistryRead.version).toBe(candidate.registryVersion);
    expect(currentRegistryRead.distTags).toEqual(registryNow.distTags);
    expect(currentRegistryRead.dist).toEqual(registryNow.dist);
    expect(registryNow.version).toBe(candidate.registryVersion);
    expect(registryNow.distTags).toEqual({ latest: registry.version, next: candidate.registryVersion });
    const versions = JSON.parse(npmView.slice(npmView.indexOf('{'), npmView.indexOf('\n}\n') + 2)).versions;
    expect(versions).toContain(candidate.registryVersion);
    expect(versions).not.toContain(candidate.version);
    expect(npmView).toContain(`'${candidate.name}@${candidate.version}' is not in this registry.`);
    // npm's rc.16 tarball is the rc.16 archive the site keeps, read again on 2026-10-06 with its attestation verified.
    const published = readFileSync(resolve(root, `vendor/zodiacs-engine-${candidate.registryVersion}.tgz`));
    expect(registryNow.dist.shasum).toBe(createHash('sha1').update(published).digest('hex'));
    expect(registryNow.dist.integrity).toBe(`sha512-${createHash('sha512').update(published).digest('base64')}`);
    expect(registryNow.auditSignatures.installed).toBe(candidate.registryVersion);
    expect(registryNow.auditSignatures.report).toEqual({ invalid: [], missing: [] });
    expect(registryNow.auditSignatures.summary).toContain('1 package has a verified attestation');
    // The rc.16 release record of 2026-10-01.
    expect(currentRegistry.version).toBe(candidate.registryVersion);
    expect(currentRegistry.tags).toEqual({ latest: registry.version, next: candidate.registryVersion });
    expect(currentRegistry.registryTarball.sha256).toBe(createHash('sha256').update(published).digest('hex'));
    expect(currentRegistry.registryTarball.bytes).toBe(published.length);
    expect(currentRegistry.registryTarball.sha1).toBe(createHash('sha1').update(published).digest('hex'));
    expect(currentRegistry.registryTarball.integritySha512).toBe(`sha512-${createHash('sha512').update(published).digest('base64')}`);
    expect(currentRegistry.attestation.subjectDigestMatchesArchive).toBe(true);
    expect(currentRegistry.attestation.workflowAndHeadAndRunMatch).toBe(true);
    expect(currentRegistry.attestation.npmAuditSignaturesExitCode).toBe(0);
    expect(currentRegistry.attestation.invalid).toEqual([]);
    expect(currentRegistry.attestation.missing).toEqual([]);
    const registryArchive = readFileSync(resolve(root, `vendor/zodiacs-engine-${registry.version}.tgz`));
    expect(manifest.version).toMatch(/-rc\.[0-9]+$/);
    // The registry read of 2026-09-30, committed with the tool that made it.
    expect(registry.package).toBe(candidate.name);
    expect(registry.version).toBe('0.1.1-rc.15');
    expect(registry.distTags).toEqual({ latest: registry.version, next: registry.version });
    // npm's tarball is the vendored archive: the same SHA-1 and SHA-512.
    expect(registry.dist.shasum).toBe(createHash('sha1').update(registryArchive).digest('hex'));
    expect(registry.dist.integrity).toBe(`sha512-${createHash('sha512').update(registryArchive).digest('base64')}`);
    expect(registry.dist.fileCount).toBe(54);
    // The SLSA provenance names the source repository, the workflow and the
    // commit the package was built from, for these bytes; npm verified it.
    const archiveSha512 = createHash('sha512').update(registryArchive).digest('hex');
    expect(registry.dist.attestations.provenance.predicateType).toBe('https://slsa.dev/provenance/v1');
    expect(registry.provenance.subject).toEqual({ name: 'pkg:npm/%40zodiacs/engine@' + registry.version, sha512: archiveSha512 });
    expect(registry.provenance.workflow).toEqual({
      ref: 'refs/heads/main', repository: candidate.sourceRepository, path: '.github/workflows/release.yml',
    });
    expect(registry.provenance.resolvedDependencies).toHaveLength(1);
    expect(registry.provenance.resolvedDependencies[0].uri).toBe(`git+${candidate.sourceRepository}@refs/heads/main`);
    expect(registry.provenance.resolvedDependencies[0].digest.gitCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(registry.auditSignatures.installed).toBe(registry.version);
    expect(registry.auditSignatures.report).toEqual({ invalid: [], missing: [] });
    expect(registry.auditSignatures.summary).toContain('1 package has a verified attestation');
  });

  it('makes both developer pages consume one candidate identity', () => {
    for (const path of ['src/pages/developers/index.astro', 'src/pages/developers/support/index.astro']) {
      const page = read(path);
      expect(page, path).toMatch(/import candidate from ['"][^'"]*\/data\/platform-engine-candidate\.json['"]/);
      expect(page, path).toContain('candidate.version');
      expect(page, path).toContain('candidate.releaseLabel');
      expect(page, path).not.toContain(candidate.version);
      expect(page, path).not.toContain(candidate.sha256);
      expect(page, path).not.toContain(candidate.sourceCommit);
    }
  });

  it('identifies current source documentation separately from the archived TypeDoc and starter', () => {
    const guide = read('public/llms-full.txt');
    expect(guide).toContain(`candidate version ${candidate.version}`);
    expect(guide).toContain(`${candidate.sourceRepository}/blob/${candidate.sourceCommit}/${packagePrefix}README.md`);
    expect(guide).toContain(RECEIPT_SPEC);
    expect(read('src/pages/developers/support/index.astro')).toContain(RECEIPT_SPEC);
    expect(guide).toContain('Archived rc.1 typed API reference (earlier candidate)');
    expect(read('public/sdk/engine/index.html')).toContain('<title>@zodiacs/engine 0.1.1-rc.1</title>');
    const support = read('src/pages/developers/support/index.astro');
    expect(support).toContain('current candidate API guide');
    expect(support).toContain('archived rc.1 API reference');
    expect(support).toContain('site saved-chart/account format is unchanged');
  });
});
