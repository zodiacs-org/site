import { describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { publicBuildEnv, publicBuildMode } from './lib/public-build-env.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const FLAG = 'PUBLIC_ZODIACS_TEST_ONLY_FLAG';

async function withEnvFiles(files, run) {
  const directory = await mkdtemp(join(tmpdir(), 'zodiacs-public-env-'));
  try {
    for (const [name, text] of Object.entries(files)) await writeFile(join(directory, name), text, 'utf8');
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('publicBuildEnv', () => {
  it('reads a PUBLIC_ flag set only in a .env file, as import.meta.env does', async () => {
    await withEnvFiles({ '.env': `${FLAG}=1\n` }, async (root) => {
      expect(publicBuildEnv({ root, mode: 'production', env: {} })(FLAG)).toBe('1');
    });
  });

  it('lets the shell win over a file, as Vite does', async () => {
    await withEnvFiles({ '.env': `${FLAG}=1\n` }, async (root) => {
      expect(publicBuildEnv({ root, mode: 'production', env: { [FLAG]: '0' } })(FLAG)).toBe('0');
    });
  });

  it('reads the mode file for the build that runs', async () => {
    await withEnvFiles({ '.env.development': `${FLAG}=1\n` }, async (root) => {
      expect(publicBuildEnv({ root, mode: 'development', env: {} })(FLAG)).toBe('1');
      expect(publicBuildEnv({ root, mode: 'production', env: {} })(FLAG)).toBeUndefined();
    });
    expect(publicBuildMode({ npm_lifecycle_event: 'predev' })).toBe('development');
    expect(publicBuildMode({ npm_lifecycle_event: 'postbuild' })).toBe('production');
    expect(publicBuildMode({})).toBe('production');
  });

  it('never reads server variables from a file', async () => {
    await withEnvFiles({ '.env': 'PUSH_ENABLED=1\n' }, async (root) => {
      expect(() => publicBuildEnv({ root, mode: 'production', env: {} })('PUSH_ENABLED')).toThrow(/not a PUBLIC_ name/u);
    });
  });
});

async function sourceFiles(directory, keep) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(path, keep));
    else if (keep(path)) output.push(path);
  }
  return output;
}

/** process.env.PUBLIC_X reads not preceded by `import.meta.env.PUBLIC_X ??`. */
function bareProcessEnvReads(text) {
  const bare = [];
  for (const match of text.matchAll(/process\.env\.(PUBLIC_[A-Z0-9_]+)/gu)) {
    const before = text.slice(Math.max(0, match.index - 200), match.index).replace(/\s+/gu, '');
    if (!before.endsWith(`import.meta.env.${match[1]}??`)) bare.push(match[1]);
  }
  return bare;
}

describe('build-time flag readers share one source with the islands', () => {
  it('pages, layouts and components never read a PUBLIC_ name from process.env alone', async () => {
    // Islands read PUBLIC_* through import.meta.env, which includes .env files.
    // Build-time readers must take the same value first. src/server/ is the run
    // time share function, which reads process.env by design (launch-flags.ts).
    const files = await sourceFiles(resolve(ROOT, 'src'), (path) => (
      /\.(?:astro|ts|tsx|mjs)$/u.test(path)
      && !/\.test\.[a-z]+$/u.test(path)
      && !relative(ROOT, path).startsWith(join('src', 'server'))
    ));
    const offenders = [];
    for (const file of files) {
      const names = bareProcessEnvReads(await readFile(file, 'utf8'));
      if (names.length) offenders.push(`${relative(ROOT, file)}: ${names.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the service worker build and the legacy analytics stamper read PUBLIC_ names through publicBuildEnv', async () => {
    for (const script of ['scripts/build-service-worker.mjs', 'scripts/configure-legacy-analytics.mjs']) {
      const text = await readFile(resolve(ROOT, script), 'utf8');
      expect(text, script).toContain("from './lib/public-build-env.mjs'");
      expect(text.match(/process\.env\.PUBLIC_[A-Z0-9_]+/gu) ?? [], script).toEqual([]);
    }
  });

  it('flags the pattern it is meant to catch', () => {
    expect(bareProcessEnvReads('const a = process.env.PUBLIC_X;')).toEqual(['PUBLIC_X']);
    expect(bareProcessEnvReads('const a = import.meta.env.PUBLIC_X ?? process.env.PUBLIC_X;')).toEqual([]);
    expect(bareProcessEnvReads('(import.meta.env.PUBLIC_X\n  ?? process.env.PUBLIC_X) === "1"')).toEqual([]);
    expect(bareProcessEnvReads('import.meta.env.PUBLIC_Y ?? process.env.PUBLIC_X')).toEqual(['PUBLIC_X']);
  });
});
