import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_V2_LOCAL_OWNER_KEY } from '../lib/account-v2/storage-identity';

/**
 * Drives the real bootstrap effect synchronously: `useEffect` runs at once,
 * the sync module and record discovery are mocked, storage is in memory and
 * Web Locks are an immediate fake. Every account id is synthetic.
 */
const A = '11111111-1111-4111-8111-111111111111';

let effectCleanup: (() => void) | null = null;
vi.mock('preact/hooks', () => ({
  useEffect: (effect: () => void | (() => void)) => { effectCleanup = effect() ?? null; },
}));

const sync = {
  configured: true,
  session: null as { user: { id: string } } | null,
  listeners: [] as ((session: { user: { id: string } } | null) => void)[],
};
vi.mock('../lib/profile/sync', () => ({
  isSupabaseConfigured: () => sync.configured,
  getSyncSession: async () => sync.session,
  onSyncAuthChange: (listener: (session: { user: { id: string } } | null) => void) => {
    sync.listeners.push(listener);
    return () => { sync.listeners.splice(sync.listeners.indexOf(listener), 1); };
  },
}));

type DiscoveryStatus = 'empty' | 'guest-records' | 'pending' | 'unavailable' | 'unsupported';
const discovery = { status: 'empty' as DiscoveryStatus, calls: 0, sequence: [] as DiscoveryStatus[] };
vi.mock('../lib/profile/saved-record-access', () => ({
  discoverSavedRecordBoundary: async () => {
    discovery.calls += 1;
    const status = discovery.sequence.shift() ?? discovery.status;
    return { status, guestRecords: status === 'guest-records' ? 2 : 0 };
  },
}));
const flags = { enabled: true, retained: false };
vi.mock('../lib/profile/saved-record-flags', () => ({
  savedRecordsEnabled: () => flags.enabled,
  savedRecordsRetainedOnDevice: async () => flags.retained,
}));

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

async function settle(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

let local: MemoryStorage;
let session: MemoryStorage;
let lease: { active: boolean };

beforeEach(() => {
  vi.resetModules();
  local = new MemoryStorage();
  session = new MemoryStorage();
  lease = { active: false };
  sync.session = null; sync.listeners = []; sync.configured = true;
  discovery.status = 'empty'; discovery.calls = 0;
  flags.enabled = true;
  flags.retained = false;
  effectCleanup = null;
  const target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, {
    localStorage: local,
    sessionStorage: session,
    zodiacsProfileAccess: {
      activateLease: () => { lease.active = true; },
      revokeLease: () => { lease.active = false; },
      canRead: () => lease.active,
    },
  }));
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: () => unknown) => callback() } });
  vi.stubGlobal('crypto', { randomUUID: () => '99999999-9999-4999-8999-999999999999' });
});
afterEach(() => { effectCleanup?.(); vi.unstubAllGlobals(); });

async function mount() {
  const { default: Bootstrap } = await import('./AccountProfileAccessBootstrap');
  Bootstrap();
  await settle();
}

describe('bootstrap auto-bind discovers guest calculation records first', () => {
  it('binds an empty browser to the signed-in account exactly as before when no records exist', async () => {
    sync.session = { user: { id: A } };
    await mount();
    expect(JSON.parse(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY) ?? 'null')).toEqual({ version: 1, accountId: A });
    expect(JSON.parse(session.getItem('zodiacs.account-sync-v2.profile-access.v1') ?? 'null')).toEqual({ version: 1, mode: 'account', accountId: A });
    expect(lease.active).toBe(true);
    // Discovered once before the lock and once again under it.
    expect(discovery.calls).toBe(2);
  });

  it('never binds while guest records exist: the browser stays locked for the hand-off decision', async () => {
    sync.session = { user: { id: A } };
    discovery.status = 'guest-records';
    await mount();
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    expect(session.getItem('zodiacs.account-sync-v2.profile-access.v1')).toBeNull();
    expect(lease.active).toBe(false);
  });

  it.each(['pending', 'unavailable'] as const)('stays locked instead of binding when record storage is %s', async (status) => {
    sync.session = { user: { id: A } };
    discovery.status = status;
    await mount();
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    expect(lease.active).toBe(false);
  });

  it('refuses to bind when a guest save lands between the first discovery and the recheck under the lock', async () => {
    sync.session = { user: { id: A } };
    discovery.sequence = ['empty', 'guest-records'];
    await mount();
    expect(discovery.calls).toBe(2);
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    expect(lease.active).toBe(false);
  });

  it('binds exactly as before when record storage is unsupported, because this client cannot have kept records there', async () => {
    sync.session = { user: { id: A } };
    discovery.status = 'unsupported';
    await mount();
    expect(discovery.calls).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY) ?? 'null')).toEqual({ version: 1, accountId: A });
    expect(lease.active).toBe(true);
  });

  it('skips discovery entirely and keeps today’s behaviour when the record feature is off', async () => {
    sync.session = { user: { id: A } };
    flags.enabled = false;
    await mount();
    expect(discovery.calls).toBe(0);
    expect(JSON.parse(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY) ?? 'null')).toEqual({ version: 1, accountId: A });
  });

  it('refuses to bind over records kept while the feature was on, after the flag goes off again', async () => {
    // A rollback must not let sign-in silently claim a browser that still holds
    // records and record a clear decision the visitor never made.
    sync.session = { user: { id: A } };
    flags.enabled = false;
    flags.retained = true;
    await mount();
    expect(discovery.calls).toBe(0);
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    expect(lease.active).toBe(false);
  });

  it('grants the account-free lease signed out without touching record storage', async () => {
    await mount();
    expect(discovery.calls).toBe(0);
    expect(JSON.parse(session.getItem('zodiacs.account-sync-v2.profile-access.v1') ?? 'null')).toEqual({ version: 1, mode: 'unowned' });
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
  });

  it('drops a discovery that resolves after a newer auth event', async () => {
    await mount();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const api = await import('../lib/profile/saved-record-access');
    (api as { discoverSavedRecordBoundary: unknown }).discoverSavedRecordBoundary = async () => { await gate; return { status: 'empty', guestRecords: 0 }; };
    for (const listener of sync.listeners) listener({ user: { id: A } });
    await settle(2);
    // A sign-out arrives while the first evaluation awaits discovery.
    for (const listener of sync.listeners) listener(null);
    await settle(2);
    release();
    await settle();
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    expect(JSON.parse(session.getItem('zodiacs.account-sync-v2.profile-access.v1') ?? 'null')).toEqual({ version: 1, mode: 'unowned' });
  });
});

describe('bootstrap access announcements', () => {
  const B = '22222222-2222-4222-8222-222222222222';
  let events = 0;
  const count = () => { events += 1; };
  beforeEach(() => {
    events = 0;
    window.addEventListener('zodiacs:profile-access', count);
  });

  it('announces only the grant when a locked tab starts, never the opening revoke', async () => {
    await mount();
    expect(lease.active).toBe(true);
    expect(events).toBe(1);
  });

  it('announces nothing when a locked tab is reevaluated and stays locked', async () => {
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    await mount();
    expect(lease.active).toBe(false);
    window.dispatchEvent(new Event('zodiacs:profile-access-reevaluate'));
    await settle();
    expect(events).toBe(0);
  });

  it('announces a revoke of access that was held, and an account change on a locked tab', async () => {
    await mount();
    events = 0;
    window.dispatchEvent(new Event('zodiacs:profile-lease-revoke'));
    expect(lease.active).toBe(false);
    expect(events).toBe(1);
    // Locked now; a different account signing in is still an account change.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    events = 0;
    for (const listener of sync.listeners) listener({ user: { id: A } });
    expect(events).toBe(1);
    await settle();
    expect(lease.active).toBe(false);
  });
});
