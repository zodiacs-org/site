import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT, ACCOUNT_V2_PROFILE_ACCESS_KEY } from './profile-access';
import { ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY } from './storage-identity';

/**
 * The save-path loader, alone and over the real chain: the pre-hydration
 * reader Base.astro inlines, the real bootstrap, store and pairs, with only
 * the Supabase session mocked. Every account id is synthetic.
 */
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const sync = {
  configured: true,
  session: null as { user: { id: string } } | null,
  listeners: [] as ((session: { user: { id: string } } | null) => void)[],
  sessionReads: 0,
  sessionFailures: 0,
  // When set, the next session read waits for this instead of answering at once.
  heldSession: null as Promise<{ user: { id: string } } | null> | null,
};
vi.mock('../profile/sync', () => ({
  isSupabaseConfigured: () => sync.configured,
  getSyncSession: async () => {
    sync.sessionReads += 1;
    if (sync.heldSession) {
      const held = sync.heldSession;
      sync.heldSession = null;
      return held;
    }
    if (sync.sessionFailures > 0) {
      sync.sessionFailures -= 1;
      throw new Error('session read failed');
    }
    return sync.session;
  },
  onSyncAuthChange: (listener: (session: { user: { id: string } } | null) => void) => {
    sync.listeners.push(listener);
    return () => { sync.listeners.splice(sync.listeners.indexOf(listener), 1); };
  },
}));

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

/** Runs the exact pre-hydration reader from Base.astro against these stores. */
function installBaseReader(win: object, local: MemoryStorage, session: MemoryStorage) {
  const base = readFileSync(new URL('../../layouts/Base.astro', import.meta.url), 'utf8');
  const start = base.indexOf('profileRetainedOwnerKey: ACCOUNT_V2_RETAINED_OWNER_KEY,');
  const open = base.indexOf('}}>', start) + 3;
  const body = base.slice(open, base.indexOf('</script>', open));
  expect(body).toContain('window.zodiacsProfileAccess = Object.freeze');
  new Function('window', 'localStorage', 'sessionStorage', 'profileAccessKey', 'profileOwnerKey', 'profileRetainedOwnerKey', body)(
    win, local, session, ACCOUNT_V2_PROFILE_ACCESS_KEY, ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY,
  );
}

let local: MemoryStorage;
let session: MemoryStorage;
let v2 = true;
// When set, the next shared (read lease) lock request waits until released.
let holdNextLease: { held: Promise<void> } | null = null;

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  local = new MemoryStorage();
  session = new MemoryStorage();
  v2 = true;
  sync.configured = true; sync.session = null; sync.listeners = []; sync.sessionReads = 0; sync.sessionFailures = 0;
  sync.heldSession = null;
  holdNextLease = null;
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('document', { documentElement: { hasAttribute: (name: string) => v2 && name === 'data-account-sync-v2' } });
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, options: { mode?: string }, callback: () => unknown) => {
    if (options?.mode === 'shared' && holdNextLease) {
      const { held } = holdNextLease;
      holdNextLease = null;
      await held;
    }
    return callback();
  } } });
  vi.stubEnv('PUBLIC_ACCOUNT_SYNC_V2_ENABLED', '1');
  vi.stubEnv('PUBLIC_SUPABASE_URL', '');
  installBaseReader(win, local, session);
});

afterEach(async () => {
  const request = await import('./profile-access-request');
  request.setProfileAccessBootstrapImporterForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function syntheticChart() {
  const now = '2026-11-12T00:00:00.000Z';
  return {
    id: '33333333-3333-4333-8333-333333333333', name: 'Synthetic chart', relationship: 'other' as const,
    createdAt: now, updatedAt: now,
    birth: { date: '2000-01-01', time: '12:00', timeKnown: true,
      place: { name: 'Synthetic place', admin1: '', country: '', lat: 1, lon: 2, tz: 'UTC' } },
    summary: { engineVersion: 'synthetic', utcISO: '2000-01-01T12:00:00.000Z', houseSystem: 'whole' as const,
      bodies: [{ body: 'Sun', lon: 280, retrograde: false }], angles: null, flags: [] },
  };
}

/** A fake bootstrap entry whose decision the test controls. */
function controlledBootstrap(onDecide: () => void) {
  let decide = () => {};
  const decided = new Promise<void>((resolve) => { decide = () => { onDecide(); resolve(); }; });
  const importer = vi.fn(async () => ({ profileAccessDecision: () => decided, profileAccessSettled: () => true }));
  return { importer, decide: () => decide() };
}

const grantUnowned = () => {
  session.setItem(ACCOUNT_V2_PROFILE_ACCESS_KEY, JSON.stringify({ version: 1, mode: 'unowned' }));
  (window as unknown as { zodiacsProfileAccess: { activateLease(): void } }).zodiacsProfileAccess.activateLease();
};

describe('ensureProfileWriteAccess', () => {
  it('answers at once and loads nothing with account sync off', async () => {
    v2 = false;
    const request = await import('./profile-access-request');
    const importer = vi.fn();
    request.setProfileAccessBootstrapImporterForTests(importer);
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(importer).not.toHaveBeenCalled();
  });

  it('answers at once and loads nothing when access is already granted', async () => {
    grantUnowned();
    const request = await import('./profile-access-request');
    const importer = vi.fn();
    request.setProfileAccessBootstrapImporterForTests(importer);
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(importer).not.toHaveBeenCalled();
  });

  it('requests the bootstrap once, waits for the lease, then the save writes', async () => {
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    const bootstrap = controlledBootstrap(grantUnowned);
    request.setProfileAccessBootstrapImporterForTests(bootstrap.importer);
    const first = request.ensureProfileWriteAccess();
    const second = request.ensureProfileWriteAccess();
    await Promise.resolve();
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
    bootstrap.decide();
    await expect(first).resolves.toBe('allowed');
    await expect(second).resolves.toBe('allowed');
    expect(bootstrap.importer).toHaveBeenCalledTimes(1);
    expect(store.saveChart(syntheticChart())).toBe('saved');
    expect(JSON.parse(local.getItem('zodiacs.profile.v1')!).charts).toHaveLength(1);
  });

  it('refuses the save when the bootstrap decides to stay locked', async () => {
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    const bootstrap = controlledBootstrap(() => {});
    request.setProfileAccessBootstrapImporterForTests(bootstrap.importer);
    const access = request.ensureProfileWriteAccess();
    bootstrap.decide();
    await expect(access).resolves.toBe('denied');
    expect(store.saveChart(syntheticChart())).toBe('error');
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
  });

  it('reports a failed load as unavailable, writes nothing, and loads again on the next save', async () => {
    const request = await import('./profile-access-request');
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ profileAccessDecision: async () => { grantUnowned(); }, profileAccessSettled: () => true });
    request.setProfileAccessBootstrapImporterForTests(importer);
    const write = vi.fn();
    const unavailable = vi.fn();
    request.runAfterProfileAccess(write, unavailable);
    await vi.waitFor(() => expect(unavailable).toHaveBeenCalledTimes(1));
    expect(write).not.toHaveBeenCalled();
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('reports a bootstrap that does not decide in time as unavailable', async () => {
    vi.useFakeTimers();
    const request = await import('./profile-access-request');
    request.setProfileAccessBootstrapImporterForTests(async () => ({
      profileAccessDecision: () => new Promise<void>(() => {}), profileAccessSettled: () => false }));
    const access = request.ensureProfileWriteAccess(1_000);
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    void access.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(access).resolves.toBe('unavailable');
  });

  it('runs a write in the same task when access is already granted', async () => {
    grantUnowned();
    const request = await import('./profile-access-request');
    const write = vi.fn();
    request.runAfterProfileAccess(write, () => {});
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('runs a denied write, which then refuses on its own check', async () => {
    const request = await import('./profile-access-request');
    const pairs = await import('../profile/pairs');
    const bootstrap = controlledBootstrap(() => {});
    request.setProfileAccessBootstrapImporterForTests(bootstrap.importer);
    const outcomes: string[] = [];
    request.runAfterProfileAccess(() => {
      outcomes.push(pairs.savePair({ id: 'p', createdAt: '2026-11-12T00:00:00.000Z',
        a: { kind: 'chart', chartId: 'a', label: 'A' }, b: { kind: 'chart', chartId: 'b', label: 'B' } }));
    }, () => outcomes.push('unavailable'));
    bootstrap.decide();
    await vi.waitFor(() => expect(outcomes).toEqual(['error']));
    expect(local.getItem('zodiacs.pairs.v1')).toBeNull();
  });
});

describe('first saves over the real bootstrap', () => {
  it('lets a signed-out guest with an empty browser save a chart and a comparison', async () => {
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    const pairs = await import('../profile/pairs');
    expect(local.length).toBe(0);
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(JSON.parse(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)!)).toEqual({ version: 1, mode: 'unowned' });
    expect(store.saveChart(syntheticChart())).toBe('saved');
    expect(pairs.savePair({ id: 'p', createdAt: '2026-11-12T00:00:00.000Z',
      a: { kind: 'chart', chartId: 'a', label: 'A' }, b: { kind: 'chart', chartId: 'b', label: 'B' } })).toBe('saved');
    // The guest grant creates no owner marker; nothing account-bound was written.
    expect(local.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
  });

  it('keeps a browser owned by another account locked while signed out, and the save refuses', async () => {
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('denied');
    expect(store.saveChart(syntheticChart())).toBe('error');
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
  });

  it('grants the signed-in owner of this browser before the save writes', async () => {
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: A }));
    sync.session = { user: { id: A } };
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(JSON.parse(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)!)).toEqual({ version: 1, mode: 'account', accountId: A });
    expect(store.saveChart(syntheticChart())).toBe('saved');
  });

  it('starts one bootstrap however many saves and loaders ask', async () => {
    const request = await import('./profile-access-request');
    await Promise.all([request.ensureProfileWriteAccess(), request.ensureProfileWriteAccess()]);
    await import('./profile-access-autostart');
    const bootstrap = await import('./profile-access-bootstrap');
    const release = bootstrap.startProfileAccessBootstrap();
    release();
    expect(sync.listeners).toHaveLength(1);
    expect(sync.sessionReads).toBe(1);
  });

  it('waits for an evaluation still in flight instead of reporting the earlier decision', async () => {
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    // A second evaluation (an auth event) starts and holds at its lease acquisition.
    let releaseLease = () => {};
    holdNextLease = { held: new Promise<void>((resolve) => { releaseLease = resolve; }) };
    for (const listener of sync.listeners) listener(null);
    expect((await import('./profile-access-reader')).profileAccessAllowed()).toBe(false);
    let verdict: string | null = null;
    const access = request.ensureProfileWriteAccess().then((value) => { verdict = value; return value; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The first decision is obsolete: the save keeps waiting rather than reporting denied.
    expect(verdict).toBeNull();
    releaseLease();
    await expect(access).resolves.toBe('allowed');
    expect(store.saveChart(syntheticChart())).toBe('saved');
  });

  it('reports a newer denial at once while the superseded session read is still pending', async () => {
    // This browser belongs to B. The start's session read (which would say B is
    // signed in) is held; an auth event then says nobody is signed in here.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    let releaseSession = () => {};
    sync.heldSession = new Promise((resolve) => { releaseSession = () => resolve({ user: { id: B } }); });
    const request = await import('./profile-access-request');
    const bootstrap = await import('./profile-access-bootstrap');
    const reader = await import('./profile-access-reader');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    expect(bootstrap.profileAccessSettled()).toBe(false);
    for (const listener of sync.listeners) listener(null);
    // The newer evaluation decided; the obsolete read does not hold it back.
    await expect(first).resolves.toBe('denied');
    await expect(bootstrap.profileAccessDecision()).resolves.toBeUndefined();
    expect(bootstrap.profileAccessSettled()).toBe(true);
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
    // The obsolete read finally answers with B signed in: it grants nothing.
    releaseSession();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
  });

  it('reports a newer denial at once while the superseded lease request is still pending', async () => {
    // The start's evaluation (an empty browser, signed out) holds at its lease.
    let releaseLease = () => {};
    holdNextLease = { held: new Promise<void>((resolve) => { releaseLease = resolve; }) };
    const request = await import('./profile-access-request');
    const bootstrap = await import('./profile-access-bootstrap');
    const reader = await import('./profile-access-reader');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(holdNextLease).toBeNull());
    expect(bootstrap.profileAccessSettled()).toBe(false);
    // B takes this browser, and the auth event that follows is evaluated and denied.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    for (const listener of sync.listeners) listener(null);
    await expect(first).resolves.toBe('denied');
    await expect(bootstrap.profileAccessDecision()).resolves.toBeUndefined();
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
    // The obsolete lease arrives: it is released, never activated.
    releaseLease();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
  });

  it('never lets a lease superseded by a reevaluation grant after the newer denial', async () => {
    const request = await import('./profile-access-request');
    const reader = await import('./profile-access-reader');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    // A reevaluation holds at its lease; a second one, after B takes the browser, denies.
    let releaseLease = () => {};
    holdNextLease = { held: new Promise<void>((resolve) => { releaseLease = resolve; }) };
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    await vi.waitFor(() => expect(holdNextLease).toBeNull());
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
    releaseLease();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
  });

  it('keeps the start current when a reevaluation arrives before the session is known', async () => {
    // A signed-in owner whose session read is held: a reevaluation then must not
    // replace the start with an evaluation for an account it does not know yet.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: A }));
    let releaseSession = () => {};
    sync.heldSession = new Promise((resolve) => { releaseSession = () => resolve({ user: { id: A } }); });
    const request = await import('./profile-access-request');
    const access = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    releaseSession();
    await expect(access).resolves.toBe('allowed');
    expect(JSON.parse(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)!)).toEqual({ version: 1, mode: 'account', accountId: A });
  });

  it('reports the verdict current at each later save', async () => {
    const request = await import('./profile-access-request');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    // Another account takes this browser while signed out here: the reevaluation locks the tab.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('denied');
    // The marker goes away again; the next save sees the new grant, not the denial.
    local.removeItem(ACCOUNT_V2_LOCAL_OWNER_KEY);
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
  });

  it('reports a failed profile/sync import as unavailable, writes nothing, and the next save starts again', async () => {
    const bootstrap = await import('./profile-access-bootstrap');
    // The nested chunk fails over the network while the save is waiting for it.
    const syncImporter = vi.fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { setTimeout(() => reject(new Error('chunk failed')), 10); }))
      .mockImplementation(() => import('../profile/sync'));
    bootstrap.setProfileSyncImporterForTests(syncImporter);
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    const write = vi.fn();
    const unavailable = vi.fn();
    request.runAfterProfileAccess(write, unavailable);
    await vi.waitFor(() => expect(unavailable).toHaveBeenCalledTimes(1));
    expect(write).not.toHaveBeenCalled();
    expect(store.saveChart(syntheticChart())).toBe('error');
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
    expect(syncImporter).toHaveBeenCalledTimes(1);
    // The import works now; a later save starts the bootstrap again and writes.
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(syncImporter).toHaveBeenCalledTimes(2);
    expect(store.saveChart(syntheticChart())).toBe('saved');
    expect(sync.listeners).toHaveLength(1);
  });

  it('reports a failed session read as unavailable and starts again without a second subscription', async () => {
    sync.sessionFailures = 1;
    const request = await import('./profile-access-request');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('unavailable');
    expect(sync.listeners).toHaveLength(0);
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(sync.sessionReads).toBe(2);
    expect(sync.listeners).toHaveLength(1);
  });

  it('keeps a newer grant when the superseded session read then fails', async () => {
    // An empty browser, signed out. The start's session read is held; an auth
    // event then grants, and only afterwards does the obsolete read fail.
    let failSession = () => {};
    sync.heldSession = new Promise((_resolve, reject) => { failSession = () => reject(new Error('session read failed')); });
    const request = await import('./profile-access-request');
    const bootstrap = await import('./profile-access-bootstrap');
    const reader = await import('./profile-access-reader');
    const store = await import('../profile/store');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    for (const listener of sync.listeners) listener(null);
    await expect(first).resolves.toBe('allowed');
    expect(reader.profileAccessAllowed()).toBe(true);
    failSession();
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The grant, the lease and the one subscription all stand.
    expect(reader.profileAccessAllowed()).toBe(true);
    expect(JSON.parse(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)!)).toEqual({ version: 1, mode: 'unowned' });
    expect(sync.listeners).toHaveLength(1);
    expect(bootstrap.profileAccessSettled()).toBe(true);
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('allowed');
    expect(sync.sessionReads).toBe(1);
    expect(store.saveChart(syntheticChart())).toBe('saved');
    // The kept subscription is the live one: a sign-in elsewhere still reaches this tab.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    for (const listener of sync.listeners) listener(null);
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('denied');
  });

  it('keeps a newer denial settled when the superseded session read then fails', async () => {
    // This browser belongs to B and nobody is signed in here.
    local.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: B }));
    let failSession = () => {};
    sync.heldSession = new Promise((_resolve, reject) => { failSession = () => reject(new Error('session read failed')); });
    const request = await import('./profile-access-request');
    const bootstrap = await import('./profile-access-bootstrap');
    const reader = await import('./profile-access-reader');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    for (const listener of sync.listeners) listener(null);
    await expect(first).resolves.toBe('denied');
    failSession();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bootstrap.profileAccessSettled()).toBe(true);
    expect(sync.listeners).toHaveLength(1);
    // A save now reports the settled denial. It does not start again: a retry
    // whose session read never answered would otherwise report unavailable.
    sync.heldSession = new Promise(() => {});
    await expect(request.ensureProfileWriteAccess(500)).resolves.toBe('denied');
    expect(sync.sessionReads).toBe(1);
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
  });

  it('lets a newer evaluation still in flight grant after the superseded session read fails', async () => {
    let failSession = () => {};
    sync.heldSession = new Promise((_resolve, reject) => { failSession = () => reject(new Error('session read failed')); });
    const request = await import('./profile-access-request');
    const bootstrap = await import('./profile-access-bootstrap');
    const reader = await import('./profile-access-reader');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    // The newer evaluation holds at its lease while the obsolete read fails.
    let releaseLease = () => {};
    holdNextLease = { held: new Promise<void>((resolve) => { releaseLease = resolve; }) };
    for (const listener of sync.listeners) listener(null);
    await vi.waitFor(() => expect(holdNextLease).toBeNull());
    failSession();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bootstrap.profileAccessSettled()).toBe(false);
    // The obsolete failure moved neither the auth version nor the access
    // version, so the current evaluation still grants when its lease arrives.
    releaseLease();
    await expect(first).resolves.toBe('allowed');
    expect(reader.profileAccessAllowed()).toBe(true);
    expect(sync.listeners).toHaveLength(1);
    expect(sync.sessionReads).toBe(1);
  });

  it('stays locked after a failed start until a save starts it again, whatever asks to reevaluate', async () => {
    sync.sessionFailures = 1;
    const request = await import('./profile-access-request');
    const reader = await import('./profile-access-reader');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('unavailable');
    window.dispatchEvent(new Event(ACCOUNT_PROFILE_ACCESS_REEVALUATE_EVENT));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
    // The next save still starts again, and only that grants.
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('allowed');
    expect(sync.sessionReads).toBe(2);
    expect(sync.listeners).toHaveLength(1);
  });

  it('ignores an auth event from the subscription a failed start dropped', async () => {
    let failSession = () => {};
    sync.heldSession = new Promise((_resolve, reject) => { failSession = () => reject(new Error('session read failed')); });
    const request = await import('./profile-access-request');
    const reader = await import('./profile-access-reader');
    const first = request.ensureProfileWriteAccess(2_000);
    await vi.waitFor(() => expect(sync.listeners).toHaveLength(1));
    const dropped = sync.listeners[0];
    // No auth event came first, so this failure is the current start's own.
    failSession();
    await expect(first).resolves.toBe('unavailable');
    expect(sync.listeners).toHaveLength(0);
    // The sync module calls the dropped listener late: it grants nothing.
    dropped(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reader.profileAccessAllowed()).toBe(false);
    expect(session.getItem(ACCOUNT_V2_PROFILE_ACCESS_KEY)).toBeNull();
    await expect(request.ensureProfileWriteAccess(2_000)).resolves.toBe('allowed');
    expect(sync.sessionReads).toBe(2);
    expect(sync.listeners).toHaveLength(1);
  });

  it('stays locked rather than granting when Supabase is not configured', async () => {
    sync.configured = false;
    const request = await import('./profile-access-request');
    const store = await import('../profile/store');
    await expect(request.ensureProfileWriteAccess()).resolves.toBe('denied');
    expect(store.saveChart(syntheticChart())).toBe('error');
  });
});
