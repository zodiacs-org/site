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
