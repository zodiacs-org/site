import { afterEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SYNCED = '22222222-2222-4222-8222-222222222222';
const LOCAL_ONLY = '33333333-3333-4333-8333-333333333333';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('daily chart email chart ids with account sync v2', () => {
  it('returns only the v2 synced self chart and never queries the v1 chart table', async () => {
    vi.stubEnv('PUBLIC_ACCOUNT_SYNC_V2_ENABLED', '1');
    const local = new MemoryStorage();
    local.setItem(`zodiacs.account-sync-v2.account.${USER_ID}.v1`, JSON.stringify({
      version: 1,
      accountId: USER_ID,
      deviceId: '44444444-4444-4444-8444-444444444444',
      serverCursor: null,
      pendingConsentOperation: null,
      charts: [
        { chartId: SYNCED, selectedForSync: true, serverRevision: 2, pendingOperation: null },
        { chartId: LOCAL_ONLY, selectedForSync: false, serverRevision: 0, pendingOperation: null },
      ],
    }));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('window', { localStorage: local, sessionStorage: new MemoryStorage() });
    vi.stubGlobal('document', undefined);
    vi.doMock('../supabase/client', () => {
      throw new Error('The v1 Supabase chart table must not be loaded.');
    });
    const { getSyncedChartIds } = await import('./daily-email-client');
    expect(await getSyncedChartIds(USER_ID)).toEqual([SYNCED]);
    expect(await getSyncedChartIds('not-a-uuid')).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
