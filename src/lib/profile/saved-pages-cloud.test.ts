import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadSavedPageDetail } from './saved-pages-cloud';

const id = '6b3a3f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
describe('loading a saved assistant reading', () => {
  function client(user: string | null, detail: unknown = null) {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: detail ? { detail } : null, error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    const instance = { from, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: user ? { user: { id: user } } : null }, error: null }) } };
    return { instance: instance as unknown as SupabaseClient, from, query };
  }
  it('never queries for a signed-out visitor', async () => {
    const mock = client(null);
    expect(await loadSavedPageDetail(id, mock.instance)).toBeNull();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('restricts a single row to the current account and assistant source', async () => {
    const detail = { schema: 'zodiacs.assistant-save.v1' };
    const mock = client('current-account', detail);
    expect(await loadSavedPageDetail(id, mock.instance)).toEqual(detail);
    expect(mock.query.select).toHaveBeenCalledWith('detail');
    expect(mock.query.eq.mock.calls).toEqual([['id', id], ['user_id', 'current-account'], ['source', 'assistant']]);
  });
  it('returns no reading for a row hidden by RLS', async () => {
    const mock = client('second-account');
    expect(await loadSavedPageDetail(id, mock.instance)).toBeNull();
  });
});
