import { describe, expect, it } from 'vitest';
import { resolveOneTimeAllowance, oneTimeAllowancePath } from './phase1-scope-guard.mjs';
import { signPageAllowance } from './write-sign-page-allowance.mjs';

const baseCommit = 'a'.repeat(40);
const id = 'generated-sign-pages-test';

describe('the publication scope allowance for generated sign pages', () => {
  it('writes nothing when no protected path changed', () => {
    expect(signPageAllowance({ baseCommit, id, changed: ['src/data/daily.json'] })).toBeNull();
  });

  it('covers exactly the changed sign pages, sorted and pinned to the base', () => {
    const changed = ['src/data/daily.json', 'public/registry/virgo/index.html', 'public/registry/aries/index.html'];
    const allowance = signPageAllowance({ baseCommit, id, changed });
    expect(allowance).toEqual({
      version: 1,
      id,
      baseCommit,
      protectedPaths: ['public/registry/aries/index.html', 'public/registry/virgo/index.html'],
    });
    // The guard accepts it exactly as written.
    expect([...resolveOneTimeAllowance({ allowance, baseCommit, changed: [...changed, oneTimeAllowancePath] })])
      .toEqual(allowance.protectedPaths);
  });

  it('refuses when any other protected path changed', () => {
    for (const other of ['public/registry/index.html', 'src/pages/es/index.astro', 'scripts/build-sign-pages.mjs']) {
      expect(signPageAllowance({ baseCommit, id, changed: ['public/registry/leo/index.html', other] }), other).toBe(false);
    }
  });
});

describe('the allowance writer as a command', () => {
  it('runs from a path with a space and prints its verdict', async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'allowance writer '));
    const run = (...args) => execFileSync(args[0], args.slice(1), { cwd: dir, encoding: 'utf8' }).trim();
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'public/registry/leo'), { recursive: true });
    copyFileSync(new URL('./phase1-scope-guard.mjs', import.meta.url), join(dir, 'scripts/phase1-scope-guard.mjs'));
    copyFileSync(new URL('./write-sign-page-allowance.mjs', import.meta.url), join(dir, 'scripts/write-sign-page-allowance.mjs'));
    writeFileSync(join(dir, 'public/registry/leo/index.html'), 'old');
    run('git', 'init', '-q');
    run('git', 'add', '-A');
    run('git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
    const base = run('git', 'rev-parse', 'HEAD');
    expect(run('node', 'scripts/write-sign-page-allowance.mjs', base)).toBe('none');
    writeFileSync(join(dir, 'public/registry/leo/index.html'), 'new');
    run('git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'daily');
    expect(run('node', 'scripts/write-sign-page-allowance.mjs', base)).toBe('written');
    const allowance = JSON.parse(readFileSync(join(dir, '.github/phase1-scope-allowance.json'), 'utf8'));
    expect(allowance.protectedPaths).toEqual(['public/registry/leo/index.html']);
    expect(allowance.baseCommit).toBe(base);
    const { rmSync } = await import('node:fs');
    rmSync(dir, { recursive: true, force: true });
  });
});
