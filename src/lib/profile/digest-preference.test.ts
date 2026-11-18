import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: '10000000-0000-4000-8000-000000000002' } as { id: string } | null,
  row: { digest_opt_in: true } as { digest_opt_in: boolean | null } | null,
  calls: [] as Array<{ op: string; args: unknown[] }>,
}));

vi.mock('../supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (table: string) => {
      state.calls.push({ op: 'from', args: [table] });
      const query = {
        select: (...args: unknown[]) => { state.calls.push({ op: 'select', args }); return query; },
        eq: (...args: unknown[]) => { state.calls.push({ op: 'eq', args }); return query; },
        maybeSingle: async () => ({ data: state.row, error: null }),
        upsert: async (...args: unknown[]) => { state.calls.push({ op: 'upsert', args }); return { error: null }; },
      };
      return query;
    },
  }),
}));

import { getDigestOptIn, setDigestOptIn } from './digest-preference';

describe('weekly digest preference', () => {
  beforeEach(() => {
    state.user = { id: '10000000-0000-4000-8000-000000000002' };
    state.row = { digest_opt_in: true };
    state.calls = [];
  });

  it('reads only the signed-in account’s own digest_opt_in', async () => {
    await expect(getDigestOptIn()).resolves.toBe(true);
    expect(state.calls).toEqual([
      { op: 'from', args: ['profiles'] },
      { op: 'select', args: ['digest_opt_in'] },
      { op: 'eq', args: ['user_id', '10000000-0000-4000-8000-000000000002'] },
    ]);
    state.row = null;
    await expect(getDigestOptIn()).resolves.toBe(false);
  });

  it('writes only the digest column for the signed-in account', async () => {
    await expect(setDigestOptIn(false)).resolves.toBe(true);
    expect(state.calls.at(-1)).toEqual({
      op: 'upsert',
      args: [{ user_id: '10000000-0000-4000-8000-000000000002', digest_opt_in: false }, { onConflict: 'user_id' }],
    });
  });

  it('does nothing when no one is signed in', async () => {
    state.user = null;
    await expect(getDigestOptIn()).resolves.toBe(false);
    await expect(setDigestOptIn(true)).resolves.toBe(false);
    expect(state.calls).toEqual([]);
  });
});
