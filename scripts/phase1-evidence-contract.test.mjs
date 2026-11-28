import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';
import vitestConfig from '../vitest.config.mts';
import {
  PHASE1_TEMPLATE_SOURCE_DIRECTORIES,
  isPhase1ExcludedTestFile,
  phase1TemplateSourceSha256,
} from '../tests/visual/phase1-evidence-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Vitest matches its include globs with picomatch; use the copy vitest itself resolves.
const picomatch = createRequire(createRequire(import.meta.url).resolve('vitest/package.json'))('picomatch');
const vitestInclude = '**/*.{test,spec}.?(c|m)[jt]s?(x)';

const names = [
  'a.test.ts', 'a.test.tsx', 'a.spec.ts', 'a.test.mjs', 'a.test.cjs', 'a.test.js',
  'a.test.jsx', 'a.test.mts', 'a.spec.cts', 'a.ts', 'a.tsx', 'a.astro', 'a.css',
  'a.test-helpers.ts', 'test-fixtures.ts', 'a.test.ts.snap', 'a.test-d.ts',
  'a.test.json', 'contest.ts', 'a.tests.ts',
];

describe('Phase 1 template source fingerprint and test files', () => {
  it('uses the same test file pattern as vitest', () => {
    expect(configDefaults.include).toEqual([vitestInclude]);
    expect(vitestConfig.test?.include).toBeUndefined();
    const matches = picomatch(vitestInclude);
    for (const name of names) {
      const path = `src/lib/x/${name}`;
      expect(isPhase1ExcludedTestFile(path), path).toBe(matches(path));
    }
  });

  it('leaves routes, public files and vendored files hashed whatever their name', () => {
    expect(isPhase1ExcludedTestFile('src/lib/profile/store.test.ts')).toBe(true);
    expect(isPhase1ExcludedTestFile('src/components/Wheel.test.tsx')).toBe(true);
    expect(isPhase1ExcludedTestFile('src/pages/today/index.test.ts')).toBe(false);
    expect(isPhase1ExcludedTestFile('public/fonts/a.test.js')).toBe(false);
    expect(isPhase1ExcludedTestFile('vendor/http-cache-semantics/a.test.js')).toBe(false);
  });

  describe('over a repository tree', () => {
    let fixture;
    afterEach(async () => {
      if (fixture) await rm(fixture, { recursive: true, force: true });
      fixture = undefined;
    });

    async function tree(files) {
      fixture = await mkdtemp(join(tmpdir(), 'phase1-contract-'));
      for (const directory of PHASE1_TEMPLATE_SOURCE_DIRECTORIES) {
        await mkdir(join(fixture, directory), { recursive: true });
      }
      for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(fixture, path)), { recursive: true });
        await writeFile(join(fixture, path), text);
      }
    }

    // Explicitly listed paths need not exist in the fixture tree.
    async function digest() {
      return phase1TemplateSourceSha256(fixture, {
        readSource: (path) => readFile(path).catch((error) => {
          if (error?.code === 'ENOENT') return Buffer.from('');
          throw error;
        }),
      });
    }

    it('does not move when only a test file changes', async () => {
      await tree({ 'src/lib/a.ts': 'one', 'src/lib/a.test.ts': 'one' });
      const before = await digest();
      await writeFile(join(fixture, 'src/lib/a.test.ts'), 'two');
      await writeFile(join(fixture, 'src/components/B.test.tsx'), 'new');
      expect(await digest()).toBe(before);
    });

    it('still moves when a source, helper, snapshot or route changes', async () => {
      await tree({ 'src/lib/a.ts': 'one' });
      const before = await digest();
      for (const path of [
        'src/lib/a.ts',
        'src/lib/a.test-helpers.ts',
        'src/lib/__snapshots__/a.test.ts.snap',
        'src/pages/today/a.test.ts',
      ]) {
        await mkdir(dirname(join(fixture, path)), { recursive: true });
        await writeFile(join(fixture, path), `changed ${path}`);
        expect(await digest(), path).not.toBe(before);
        await rm(join(fixture, path));
        if (path === 'src/lib/a.ts') await writeFile(join(fixture, path), 'one');
        expect(await digest()).toBe(before);
      }
    });
  });

  it('excludes test files no source file imports', async () => {
    // Guard the soundness assumption: if non-test source ever imports a test
    // file, excluding tests would hide a render input.
    const { execFileSync } = await import('node:child_process');
    const listed = execFileSync('git', ['ls-files', '-z', 'src'], { cwd: root, encoding: 'utf8' })
      .split('\0').filter(Boolean);
    const importer = /(?:from\s*|import\s*\(?\s*|require\(\s*)['"][^'"]*\.(?:test|spec)(?:\.[cm]?[jt]sx?)?['"]/u;
    const offenders = [];
    for (const path of listed) {
      if (isPhase1ExcludedTestFile(path) || !/\.(?:[cm]?[jt]sx?|astro|mdx)$/u.test(path)) continue;
      if (importer.test(await readFile(resolve(root, path), 'utf8'))) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
