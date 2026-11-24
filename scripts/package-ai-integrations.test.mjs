/**
 * The review archives packed on a volume that keeps macOS metadata beside
 * every file. An ExFAT disk grows a ._ AppleDouble file for each file macOS
 * writes, and an archive extracted in the Finder can leave __MACOSX folders.
 * Neither is package material: scripts/package-ai-integrations.py leaves them
 * out, so the archives packed beside them are the committed ones byte for
 * byte, and --check passes on such a checkout.
 */
import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCRIPT = 'scripts/package-ai-integrations.py';
const MANIFEST = 'integrations/packages/manifest.json';
const TRANSITION = 'docs/platform/evidence/site-engine-1-1-0/connector-transition.json';
/** The start of an AppleDouble header: its magic number and version. */
const APPLE_DOUBLE = Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]);

let copy = '';

/** Python on the copy alone: -B writes no bytecode, and -I reads no environment and puts no folder of the checkout on the path. */
const python = (args) => spawnSync('python3', ['-B', '-I', ...args], { cwd: copy, encoding: 'utf8', timeout: 120_000 });

const EXCLUDED_FIXTURE_PARTS = new Set(['node_modules', '.git', '.plugin-data', '__pycache__', '__macosx', '.ds_store']);

/** Refuse symlinks, excluded paths (such as .env*, case-insensitively), or paths resolving outside ROOT before reading any fixture bytes. */
async function safeFixtureSource(rootReal, relPath) {
  const parts = relPath.split('/').filter(Boolean);
  if (parts.length === 0 || relPath.startsWith('/') || relPath.includes('\\') || parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`Invalid relative fixture path: ${relPath}`);
  }
  if (parts.some((part) => {
    const lower = part.toLowerCase();
    return EXCLUDED_FIXTURE_PARTS.has(lower) || lower.startsWith('.env') || lower.startsWith('._');
  })) {
    throw new Error(`Refusing excluded fixture path: ${relPath}`);
  }
  let current = ROOT;
  for (let i = 0; i < parts.length; i += 1) {
    current = resolve(current, parts[i]);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`Refusing symlinked fixture path: ${relPath}`);
    if (i === parts.length - 1 && !info.isFile()) throw new Error(`Expected regular file: ${relPath}`);
  }
  const actual = await realpath(current);
  const rel = relative(rootReal, actual);
  if (!rel || rel.startsWith('..') || rel.startsWith(sep)) {
    throw new Error(`Fixture path resolves outside repository root: ${relPath}`);
  }
  return actual;
}

/**
 * A copy of what the script reads and nothing more: itself, the committed archives and manifest, the developer
 * baseline, and from each plugin only the members its manifest entry declares, so nothing else in a plugin
 * folder of the checkout (a local .env, node_modules, or any symlinked target) is ever copied.
 */
async function copyPackagingTree(target) {
  const rootReal = await realpath(ROOT);
  const manifest = JSON.parse(await readFile(await safeFixtureSource(rootReal, MANIFEST), 'utf8'));
  const { baselineArchive } = JSON.parse(await readFile(await safeFixtureSource(rootReal, TRANSITION), 'utf8')).developer;
  const files = [SCRIPT, MANIFEST, TRANSITION, baselineArchive,
    ...manifest.packages.map((entry) => `integrations/packages/${entry.file}`),
    ...manifest.packages.flatMap((entry) => entry.members.map((member) => `plugins/${entry.name}/${member.path}`))];
  for (const file of files) {
    const source = await safeFixtureSource(rootReal, file);
    await mkdir(dirname(join(target, file)), { recursive: true });
    await copyFile(source, join(target, file));
  }
}

/** A ._ file beside every file, and a __MACOSX folder holding one in every directory, as macOS leaves them. */
async function plantSidecars(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const directories = [directory, ...entries.filter((entry) => entry.isDirectory()).map((entry) => join(entry.parentPath, entry.name))];
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    await writeFile(join(entry.parentPath, `._${entry.name}`), APPLE_DOUBLE);
  }
  for (const folder of directories) {
    await mkdir(join(folder, '__MACOSX'), { recursive: true });
    await writeFile(join(folder, '__MACOSX', 'README.md'), 'Finder metadata\n');
    await writeFile(join(folder, '__MACOSX', '._README.md'), APPLE_DOUBLE);
  }
}

beforeAll(async () => {
  copy = await mkdtemp(join(tmpdir(), 'package-ai-integrations-'));
  await copyPackagingTree(copy);
  for (const name of await readdir(join(copy, 'plugins'))) await plantSidecars(join(copy, 'plugins', name));
}, 120_000);

afterAll(async () => {
  if (copy) await rm(copy, { recursive: true, force: true });
});

describe('the AI integration archives beside macOS metadata', () => {
  it('names a ._ file or a __MACOSX folder anywhere in a path as metadata, and nothing else', () => {
    const run = python(['-c', [
      'import importlib.util, json, sys',
      'from pathlib import PurePosixPath',
      'spec = importlib.util.spec_from_file_location("package_ai_integrations", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'print(json.dumps({path: module.macos_sidecar(PurePosixPath(path)) for path in sys.argv[2:]}))',
    ].join('\n'), join(copy, SCRIPT),
    'mcp/._server.mjs', '.codex-plugin/._plugin.json', 'assets/__MACOSX/icon.png', '__MACOSX/skills/x/SKILL.md', 'skills/._sky/SKILL.md',
    'mcp/server.mjs', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', 'skills/sky/SKILL.md', 'assets/icon._x.png']);
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({
      'mcp/._server.mjs': true,
      '.codex-plugin/._plugin.json': true,
      'assets/__MACOSX/icon.png': true,
      '__MACOSX/skills/x/SKILL.md': true,
      'skills/._sky/SKILL.md': true,
      'mcp/server.mjs': false,
      '.codex-plugin/plugin.json': false,
      '.claude-plugin/plugin.json': false,
      'skills/sky/SKILL.md': false,
      'assets/icon._x.png': false,
    });
  });

  it('packs the committed archives byte for byte with metadata beside every file, so --check passes', async () => {
    // The sidecars are where the packer looks: beside the developer adapter's runtime and in each plugin folder.
    for (const planted of ['plugins/zodiacs-developer/mcp/._server.mjs', 'plugins/zodiacs-developer/.codex-plugin/._plugin.json',
      'plugins/zodiacs-sky/.claude-plugin/__MACOSX/README.md', 'plugins/zodiacs-sky/skills/__MACOSX/._README.md']) {
      await expect(readFile(join(copy, planted))).resolves.toBeDefined();
    }
    const run = python([join(copy, SCRIPT), '--check']);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^Verified zodiacs-sky-[^\n]+\nVerified zodiacs-developer-/u);
  });

  it('would have packed the metadata without the rule: the copy is a real test of it', async () => {
    const source = await readFile(join(copy, SCRIPT), 'utf8');
    const unguarded = source.replace(' and not macos_sidecar(path.relative_to(root))', '');
    expect(unguarded).not.toBe(source);
    await writeFile(join(copy, 'scripts/package-ai-integrations-unguarded.py'), unguarded);
    const run = python([join(copy, 'scripts/package-ai-integrations-unguarded.py'), '--check']);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('Stale zodiacs-sky-');
  });
});
