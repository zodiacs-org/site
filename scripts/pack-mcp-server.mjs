/**
 * Packs examples/mcp-server into the versioned archive the site distributes,
 * and writes the manifest the developer page reads.
 *
 *   node scripts/pack-mcp-server.mjs                          # pack and write the manifest
 *   node scripts/pack-mcp-server.mjs --artifact-commit <sha>   # …and pin the immutable URL
 *   node scripts/pack-mcp-server.mjs --check                   # fail on drift (CI)
 *
 * `npm pack` is byte-deterministic — it stamps every entry with a fixed mtime —
 * so the archive can be a committed artifact with a drift gate over it, the
 * same way the generated bundle inside it is.
 *
 * `artifactCommit` pins the download to an immutable raw.githubusercontent URL,
 * which is stronger than a site path: a commit's contents cannot change, so the
 * digest and the bytes cannot be replaced together. No commit can name itself,
 * so the field is filled by a second pass after the archive lands, and `--check`
 * requires it before the artifact may be advertised.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildServerBundle } from './build-mcp-server.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE = resolve(ROOT, 'examples/mcp-server');
const PUBLIC = resolve(ROOT, 'public/examples');
const MANIFEST = join(PUBLIC, 'mcp-server.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function packInto(destination) {
  const result = spawnSync('npm', ['pack', '--pack-destination', destination, '--silent'], {
    cwd: PACKAGE, encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`npm pack failed: ${result.stderr || result.stdout}`);
  const [file] = (await readdir(destination)).filter((name) => name.endsWith('.tgz'));
  if (!file) throw new Error('npm pack produced no archive');
  return { file, bytes: await readFile(join(destination, file)) };
}

/** The manifest, built from the package's own metadata so the two cannot skew. */
export async function manifestFor(file, bytes, artifactCommit) {
  const pkg = JSON.parse(await readFile(join(PACKAGE, 'package.json'), 'utf8'));
  const candidate = JSON.parse(await readFile(join(PACKAGE, 'candidate.json'), 'utf8'));
  return {
    schemaVersion: 1,
    name: pkg.name,
    version: pkg.version,
    releaseStatus: 'unpublished-candidate',
    file,
    bytes: bytes.length,
    sha256: sha256(bytes),
    artifactCommit,
    artifactRepository: 'https://github.com/zodiacs-org/site',
    artifactPath: `public/examples/${file}`,
    engine: { package: candidate.bundled.engine.package, version: candidate.bundled.engine.version },
    dependencies: candidate.dependencies,
    node: pkg.engines.node,
    transport: candidate.protocol.transport,
  };
}

export async function packMcpServer({ check = false, artifactCommit = undefined } = {}) {
  const [{ bytes: fresh }, built] = await Promise.all([
    buildServerBundle(),
    readFile(join(PACKAGE, 'server.mjs')),
  ]);
  if (!built.equals(fresh)) {
    throw new Error('examples/mcp-server/server.mjs is stale; run node scripts/build-mcp-server.mjs first');
  }

  const staging = mkdtempSync(join(tmpdir(), 'zodiacs-mcp-pack-'));
  try {
    return await packFrom(staging, { check, artifactCommit });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

async function packFrom(staging, { check, artifactCommit }) {
  const { file, bytes } = await packInto(staging);
  const existing = await readFile(MANIFEST, 'utf8').then(JSON.parse).catch(() => null);
  const commit = artifactCommit ?? existing?.artifactCommit ?? null;
  const manifest = await manifestFor(file, bytes, commit);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;

  if (!check) {
    await copyFile(join(staging, file), join(PUBLIC, file));
    await writeFile(MANIFEST, text);
    return { manifest, wrote: true };
  }

  const committed = await readFile(join(PUBLIC, file)).catch(() => null);
  if (committed === null) throw new Error(`public/examples/${file} is missing; run node scripts/pack-mcp-server.mjs`);
  if (!committed.equals(bytes)) throw new Error(`public/examples/${file} differs from a fresh pack of examples/mcp-server`);
  if (JSON.stringify(existing) !== JSON.stringify(manifest)) {
    throw new Error('public/examples/mcp-server.json is stale; run node scripts/pack-mcp-server.mjs');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.artifactCommit ?? '')) {
    throw new Error('public/examples/mcp-server.json has no artifactCommit;'
      + ' run node scripts/pack-mcp-server.mjs --artifact-commit <sha> once the archive is committed');
  }
  // The all-zero commit is the placeholder the first of the two commits
  // carries. A production build refuses it, so it must not reach main: CI
  // fails here instead, on the pull request, before the merge.
  if (/^0{40}$/.test(manifest.artifactCommit)) {
    throw new Error('public/examples/mcp-server.json still names the placeholder commit 0000…;'
      + ' run node scripts/pack-mcp-server.mjs --artifact-commit <sha> with the commit that holds the archive');
  }
  return { manifest, wrote: false };
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const index = process.argv.indexOf('--artifact-commit');
  const artifactCommit = index >= 0 ? process.argv[index + 1] : undefined;
  if (artifactCommit !== undefined && !/^[0-9a-f]{40}$/.test(artifactCommit)) {
    console.error('pack-mcp-server: --artifact-commit needs a full 40-character commit SHA');
    process.exit(1);
  }
  try {
    const { manifest, wrote } = await packMcpServer({ check: process.argv.includes('--check'), artifactCommit });
    console.log(`pack-mcp-server: ${wrote ? 'wrote' : 'verified'} ${manifest.file}`
      + ` (${manifest.bytes} bytes, sha256 ${manifest.sha256.slice(0, 12)}…,`
      + ` commit ${manifest.artifactCommit ?? 'not yet pinned'})`);
  } catch (error) {
    console.error(`pack-mcp-server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
