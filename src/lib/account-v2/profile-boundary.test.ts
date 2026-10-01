import { CalendarIdbBackend, CalendarIdbFactory } from '../../../tests/helpers/calendar-idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_V2_LOCAL_OWNER_KEY,
  ACCOUNT_V2_RETAINED_OWNER_KEY,
  accountSyncMetadataKey,
  inspectLocalAccountBoundary,
  retainedProfileAccessAllowed,
  type AccountV2Storage,
} from './local-state';
import {
  ACCOUNT_BOUNDARY_PROFILE_KEYS,
  clearAccountBoundLocalProfileData,
  clearAccountBoundLocalProfileEverywhere,
  clearAccountDataFromDevice,
  clearAllZodiacsDataFromDevice,
  completeAccountBoundaryDecision,
  completeDeletedAccountLocalData,
  hasAccountBoundLocalProfileData,
  isolateLocalProfileForAccountSwitch,
  localProfileArchiveKey,
  retainAccountBoundProfileAfterDeletion,
} from './profile-boundary';
import {
  LIVING_CHART_CHANGE_EVENT,
  LIVING_CHART_CLEAR_REQUEST_KEY,
} from '../living-chart/store';
import { livingChartSyncMetadataKeys } from '../living-chart/sync-metadata';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_C = '33333333-3333-4333-8333-333333333333';
const FIRST_READING_STORAGE_KEY = 'zodiacs.first-reading.v1';
const LIVING_CHART_GUEST_VAULT_KEY = 'zodiacs.living-chart.guest-vault.v1';

class MemoryStorage implements AccountV2Storage {
  readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class FailingOwnerStorage extends MemoryStorage {
  failOwnerWrites = false;
  override setItem(key: string, value: string) {
    if (this.failOwnerWrites && key === ACCOUNT_V2_LOCAL_OWNER_KEY) throw new Error('blocked');
    super.setItem(key, value);
  }
}

class FailingFirstReadingStorage extends MemoryStorage {
  failFirstReadingWrites = false;
  override setItem(key: string, value: string) {
    if (this.failFirstReadingWrites && key === FIRST_READING_STORAGE_KEY) {
      throw new Error('blocked');
    }
    super.setItem(key, value);
  }
}

function profile(label: string) {
  return JSON.stringify({ version: 1, settings: { houseSystem: 'whole' }, charts: [{ id: label }] });
}

describe('account-bound local profile data', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('treats malformed or non-profile account surfaces conservatively', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], JSON.stringify({ version: 1, charts: [] }));
    expect(hasAccountBoundLocalProfileData(storage)).toBe(false);
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], '{private but malformed');
    expect(hasAccountBoundLocalProfileData(storage)).toBe(true);
  });

  it('leaves account-free first-reading progress byte-identical and non-triggering', () => {
    const storage = new MemoryStorage();
    const progress = JSON.stringify({
      version: 1,
      status: 'in_progress',
      step: 2,
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    storage.setItem(FIRST_READING_STORAGE_KEY, progress);

    expect(hasAccountBoundLocalProfileData(storage)).toBe(false);
    expect(storage.getItem(FIRST_READING_STORAGE_KEY)).toBe(progress);
  });

  it('scrubs legacy exact first-reading identity before isolation and never archives it', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));
    livingChartSyncMetadataKeys(ACCOUNT_A).forEach((key) => storage.setItem(key, 'account-a-sync'));
    livingChartSyncMetadataKeys(ACCOUNT_B).forEach((key) => storage.setItem(key, 'account-b-sync'));
    storage.setItem(FIRST_READING_STORAGE_KEY, JSON.stringify({
      version: 1,
      status: 'in_progress',
      step: 2,
      chartKey: '1990-06-15T16:30:00.000Z|1|40.7128|-74.0060',
      updatedAt: '2026-07-17T00:00:00.000Z',
    }));

    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_A, ACCOUNT_B)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect(JSON.parse(storage.getItem(FIRST_READING_STORAGE_KEY)!)).toEqual({
      version: 1,
      status: 'in_progress',
      step: 2,
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    const archive = storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)!;
    expect(archive).not.toContain('chartKey');
    expect(archive).not.toContain(FIRST_READING_STORAGE_KEY);
  });

  it('scrubs legacy exact first-reading identity before clearing account data', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(FIRST_READING_STORAGE_KEY, JSON.stringify({
      version: 1,
      status: 'complete',
      step: 3,
      chartKey: '1990-06-15T16:30:00.000Z|1|40.7128|-74.0060',
      updatedAt: '2026-07-17T00:00:00.000Z',
    }));

    expect(clearAccountBoundLocalProfileData(storage)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBeNull();
    expect(JSON.parse(storage.getItem(FIRST_READING_STORAGE_KEY)!)).toEqual({
      version: 1,
      status: 'complete',
      step: 3,
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
  });

  it('fails a boundary transition closed when legacy first-reading identity cannot be scrubbed', () => {
    const storage = new FailingFirstReadingStorage();
    const activeProfile = profile('account-a');
    const owner = JSON.stringify({ version: 1, accountId: ACCOUNT_A });
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], activeProfile);
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, owner);
    const boundary = inspectLocalAccountBoundary(storage, ACCOUNT_B, true);
    const legacyProgress = JSON.stringify({
      version: 1,
      status: 'in_progress',
      step: 1,
      chartKey: '1990-06-15T16:30:00.000Z|1|40.7128|-74.0060',
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
    storage.setItem(FIRST_READING_STORAGE_KEY, legacyProgress);
    storage.failFirstReadingWrites = true;

    expect(completeAccountBoundaryDecision(storage, boundary, 'isolate')).toEqual({
      ok: false,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(activeProfile);
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBe(owner);
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem(FIRST_READING_STORAGE_KEY)).toBe(legacyProgress);
  });

  it('archives one account and restores the other without touching ownership metadata', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[2], '[{"id":"pair-a"}]');
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));

    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_A, ACCOUNT_B)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBeNull();
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toContain('account-a');
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toContain(ACCOUNT_A);

    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-b'));
    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_B, ACCOUNT_A)).toEqual({
      ok: true,
      restoredPreviousArchive: true,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_B)!)).toContain('account-b');
  });

  it('invalidates mounted Living Chart data after an account switch', () => {
    const storage = new MemoryStorage();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent });
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));

    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_A, ACCOUNT_B).ok).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe(LIVING_CHART_CHANGE_EVENT);
    expect(event.detail).toMatchObject({ operation: 'invalidate', owner: null, momentId: null });
  });

  it('clears only account-sensitive profile surfaces', () => {
    const storage = new MemoryStorage();
    for (const key of ACCOUNT_BOUNDARY_PROFILE_KEYS) storage.setItem(key, 'private');
    storage.setItem('unrelated', 'keep');
    expect(clearAccountBoundLocalProfileData(storage).ok).toBe(true);
    expect(ACCOUNT_BOUNDARY_PROFILE_KEYS.every((key) => storage.getItem(key) === null)).toBe(true);
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('can remove the current account archive during sign-out or deletion', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(localProfileArchiveKey(ACCOUNT_A)!, 'archived-private-data');
    storage.setItem('unrelated', 'keep');
    expect(clearAccountBoundLocalProfileEverywhere(storage, ACCOUNT_A).ok).toBe(true);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBeNull();
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('atomically removes active charts, owner archive, and account sync metadata', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(localProfileArchiveKey(ACCOUNT_A)!, 'archived-private-data');
    storage.setItem(`zodiacs.account-sync-v2.account.${ACCOUNT_A}.v1`, '{"metadata":true}');
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));
    livingChartSyncMetadataKeys(ACCOUNT_A).forEach((key) => storage.setItem(key, 'account-a-sync'));
    livingChartSyncMetadataKeys(ACCOUNT_B).forEach((key) => storage.setItem(key, 'account-b-sync'));
    storage.setItem('unrelated', 'keep');

    expect(clearAccountDataFromDevice(storage, ACCOUNT_A).ok).toBe(true);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBeNull();
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem(`zodiacs.account-sync-v2.account.${ACCOUNT_A}.v1`)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBeNull();
    livingChartSyncMetadataKeys(ACCOUNT_A).forEach((key) => expect(storage.getItem(key)).toBeNull());
    livingChartSyncMetadataKeys(ACCOUNT_B).forEach((key) => expect(storage.getItem(key)).toBe('account-b-sync'));
    expect(storage.getItem('unrelated')).toBe('keep');
  });

  it('records a content-free Living Chart clear request before device cleanup returns', () => {
    const storage = new MemoryStorage();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent,
      zodiacsProfileAccess: { canRead: () => false },
    });
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: (name: string) => name === 'data-account-sync-v2' },
    });
    vi.stubGlobal('crypto', { randomUUID: () => ACCOUNT_C });
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));

    expect(clearAccountDataFromDevice(storage, ACCOUNT_A).ok).toBe(true);
    expect(JSON.parse(storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY)!)).toEqual({
      version: 2,
      requestId: ACCOUNT_C,
      targets: [`account:${ACCOUNT_A}`],
    });
    expect(dispatchEvent.mock.calls.some(([event]) => (
      (event as Event).type === LIVING_CHART_CHANGE_EVENT
      && (event as CustomEvent).detail?.operation === 'invalidate'
    ))).toBe(true);
  });

  it('clears the known guest Living Chart vault even after shared profile access is denied', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      zodiacsProfileAccess: { canRead: () => false },
    });
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: (name: string) => name === 'data-account-sync-v2' },
    });
    vi.stubGlobal('crypto', { randomUUID: () => ACCOUNT_C });
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('guest'));
    storage.setItem(LIVING_CHART_GUEST_VAULT_KEY, JSON.stringify({
      version: 1,
      vaultId: ACCOUNT_B,
    }));

    expect(clearAccountBoundLocalProfileData(storage).ok).toBe(true);
    expect(JSON.parse(storage.getItem(LIVING_CHART_CLEAR_REQUEST_KEY)!)).toMatchObject({
      version: 2,
      targets: [`guest:${ACCOUNT_B}`],
    });
  });

  it('refuses device deletion unless the current owner exactly matches', () => {
    for (const owner of [null, ACCOUNT_B]) {
      const storage = new MemoryStorage();
      storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
      storage.setItem(accountSyncMetadataKey(ACCOUNT_A)!, '{"metadata":true}');
      if (owner) {
        storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: owner }));
      }

      expect(clearAccountDataFromDevice(storage, ACCOUNT_A).ok).toBe(false);
      expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
      expect(storage.getItem(accountSyncMetadataKey(ACCOUNT_A)!)).toBe('{"metadata":true}');
      expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBe(
        owner ? JSON.stringify({ version: 1, accountId: owner }) : null,
      );
    }
  });

  it('does not let a cleared prior-account archive reappear on a later switch', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a-active'));
    storage.setItem(localProfileArchiveKey(ACCOUNT_A)!, JSON.stringify({
      version: 1,
      accountId: ACCOUNT_A,
      values: { [ACCOUNT_BOUNDARY_PROFILE_KEYS[0]]: profile('account-a-archive') },
    }));
    expect(clearAccountBoundLocalProfileEverywhere(storage, ACCOUNT_A).ok).toBe(true);

    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-b'));
    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_B, ACCOUNT_A)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBeNull();
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
  });

  it('rejects invalid owners and malformed target archives without clearing active data', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    expect(isolateLocalProfileForAccountSwitch(storage, 'invalid', ACCOUNT_B).ok).toBe(false);
    storage.setItem(localProfileArchiveKey(ACCOUNT_B)!, '{bad');
    expect(isolateLocalProfileForAccountSwitch(storage, ACCOUNT_A, ACCOUNT_B).ok).toBe(false);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
  });

  it('rolls back archive changes when owner rebinding fails', () => {
    const storage = new FailingOwnerStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));
    const boundary = inspectLocalAccountBoundary(storage, ACCOUNT_B, true);
    storage.failOwnerWrites = true;

    expect(completeAccountBoundaryDecision(storage, boundary, 'isolate').ok).toBe(false);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toContain(ACCOUNT_A);
  });

  it('rejects a stale boundary snapshot before changing charts or ownership', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));
    const boundary = inspectLocalAccountBoundary(storage, ACCOUNT_B, true);

    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_C }));
    expect(completeAccountBoundaryDecision(storage, boundary, 'isolate')).toEqual({
      ok: false,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(localProfileArchiveKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toContain(ACCOUNT_C);
  });

  it('keeps deleted-account charts bound to their former owner when retained', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(accountSyncMetadataKey(ACCOUNT_A)!, '{"metadata":true}');
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));

    expect(retainAccountBoundProfileAfterDeletion(storage, ACCOUNT_A)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(accountSyncMetadataKey(ACCOUNT_A)!)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toBe(
      JSON.stringify({ version: 1, accountId: ACCOUNT_A }),
    );
    expect(storage.getItem(ACCOUNT_V2_RETAINED_OWNER_KEY)).toBe(
      JSON.stringify({ version: 1, accountId: ACCOUNT_A }),
    );
    expect(retainedProfileAccessAllowed(storage, ACCOUNT_A)).toBe(true);
    expect(retainedProfileAccessAllowed(storage, ACCOUNT_B)).toBe(false);
    expect(inspectLocalAccountBoundary(storage, ACCOUNT_B, true)).toMatchObject({
      status: 'decision-required',
      reason: 'owner-mismatch',
      localOwnerAccountId: ACCOUNT_A,
    });
  });

  it('keeps an inactive deleted-account archive tagged without touching the active owner', () => {
    const storage = new MemoryStorage();
    const archive = localProfileArchiveKey(ACCOUNT_B)!;
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(archive, profile('account-b-archive'));
    storage.setItem(accountSyncMetadataKey(ACCOUNT_B)!, '{"metadata":true}');
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));

    expect(completeDeletedAccountLocalData(storage, ACCOUNT_B, false).ok).toBe(true);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(archive)).toBe(profile('account-b-archive'));
    expect(storage.getItem(accountSyncMetadataKey(ACCOUNT_B)!)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toContain(ACCOUNT_A);
  });

  it('removes only an inactive deleted-account archive when device cleanup is selected', () => {
    const storage = new MemoryStorage();
    const archive = localProfileArchiveKey(ACCOUNT_B)!;
    storage.setItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0], profile('account-a'));
    storage.setItem(archive, profile('account-b-archive'));
    storage.setItem(accountSyncMetadataKey(ACCOUNT_B)!, '{"metadata":true}');
    storage.setItem(ACCOUNT_V2_LOCAL_OWNER_KEY, JSON.stringify({ version: 1, accountId: ACCOUNT_A }));

    expect(completeDeletedAccountLocalData(storage, ACCOUNT_B, true).ok).toBe(true);
    expect(storage.getItem(ACCOUNT_BOUNDARY_PROFILE_KEYS[0])).toBe(profile('account-a'));
    expect(storage.getItem(archive)).toBeNull();
    expect(storage.getItem(accountSyncMetadataKey(ACCOUNT_B)!)).toBeNull();
    expect(storage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY)).toContain(ACCOUNT_A);
  });

  it('enumerates and removes all Zodiacs local and session keys only', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    for (const key of [
      'zodiacs.profile.v1',
      `zodiacs.local-profile.account.${ACCOUNT_A}.v1`,
      `zodiacs.account-sync-v2.account.${ACCOUNT_A}.v1`,
      'zodiacs.daily-chart-selection.v1',
      'zodiacs:today-sun-sign:v1',
    ]) local.setItem(key, 'private');
    session.setItem('zodiacs.account-sync-v2.profile-access.v1', 'private');
    session.setItem('zodiacs.transient', 'private');
    local.setItem('unrelated', 'keep-local');
    session.setItem('unrelated', 'keep-session');

    expect(await clearAllZodiacsDataFromDevice(local, session)).toEqual({
      ok: true,
      restoredPreviousArchive: false,
    });
    expect([...local.values.keys()].filter((key) => key.startsWith('zodiacs'))).toEqual([]);
    expect([...session.values.keys()].filter((key) => key.startsWith('zodiacs'))).toEqual([]);
    expect(local.getItem('unrelated')).toBe('keep-local');
    expect(session.getItem('unrelated')).toBe('keep-session');
  });

  it('records the durable IndexedDB clear after removing all other Zodiacs keys', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    vi.stubGlobal('window', {
      localStorage: local,
      indexedDB: new CalendarIdbFactory(new CalendarIdbBackend()).indexedDB,
      dispatchEvent: vi.fn(),
      zodiacsProfileAccess: { canRead: () => false },
    });
    vi.stubGlobal('document', {
      documentElement: { hasAttribute: (name: string) => name === 'data-account-sync-v2' },
    });
    vi.stubGlobal('crypto', { randomUUID: () => ACCOUNT_C });
    local.setItem('zodiacs.profile.v1', 'private');
    local.setItem('zodiacs:today-sun-sign:v1', 'private');
    session.setItem('zodiacs.account-sync-v2.profile-access.v1', 'private');

    expect((await clearAllZodiacsDataFromDevice(local, session)).ok).toBe(true);
    expect([...local.values.keys()].filter((key) => key.startsWith('zodiacs'))).toEqual([
      LIVING_CHART_CLEAR_REQUEST_KEY,
    ]);
    expect(JSON.parse(local.getItem(LIVING_CHART_CLEAR_REQUEST_KEY)!)).toEqual({
      version: 2,
      requestId: ACCOUNT_C,
      targets: ['all'],
    });
    expect([...session.values.keys()].filter((key) => key.startsWith('zodiacs'))).toEqual([]);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'zodiacs:calendar-feeds-cleared' }));
  });

  it('does not report volatile calendar erasure when local clearing fails', async () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    local.setItem('zodiacs.calendar-feeds.v1', 'private');
    vi.stubGlobal('window', { localStorage: local, indexedDB: new CalendarIdbFactory(new CalendarIdbBackend()).indexedDB, dispatchEvent: vi.fn() });
    const original = local.removeItem.bind(local);
    local.removeItem = (key) => {
      if (key === 'zodiacs.calendar-feeds.v1') throw new Error('Storage refused');
      original(key);
    };
    expect((await clearAllZodiacsDataFromDevice(local, session)).ok).toBe(false);
    expect(vi.mocked(window.dispatchEvent).mock.calls.some(([event]) => event.type === 'zodiacs:calendar-feeds-cleared')).toBe(false);
  });

  it('waits for the calendar transaction to commit before reporting whole-device erasure', async () => {
    const local = new MemoryStorage();
    const backend = new CalendarIdbBackend();
    backend.seed({ fence: ACCOUNT_A, feeds: [] });
    const factory = new CalendarIdbFactory(backend);
    factory.holdCompletion = true;
    vi.stubGlobal('window', { localStorage: local, indexedDB: factory.indexedDB, dispatchEvent: vi.fn() });
    local.setItem('zodiacs.profile.v1', 'private');
    let settled = false;
    const clearing = clearAllZodiacsDataFromDevice(local, new MemoryStorage()).then((result) => {
      settled = true;
      return result;
    });
    await vi.waitFor(() => expect(factory.transactions).toBe(1));
    expect(settled).toBe(false);
    expect(local.getItem('zodiacs.profile.v1')).toBe('private');
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    factory.holdCompletion = false;
    factory.completeTransactions();
    expect((await clearing).ok).toBe(true);
    expect(backend.rows.size).toBe(0);
    expect(local.getItem('zodiacs.profile.v1')).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'zodiacs:calendar-feeds-cleared' }));
  });

  it.each(['write', 'abort', 'blocked'] as const)('does not report clear-all success when calendar deletion is %s', async (fault) => {
    const local = new MemoryStorage();
    const backend = new CalendarIdbBackend();
    const before = { fence: ACCOUNT_A, feeds: [] };
    backend.seed(before);
    const factory = new CalendarIdbFactory(backend);
    factory.faults[fault] = true;
    vi.stubGlobal('window', { localStorage: local, indexedDB: factory.indexedDB, dispatchEvent: vi.fn() });
    local.setItem('zodiacs.profile.v1', 'private');
    expect((await clearAllZodiacsDataFromDevice(local, new MemoryStorage())).ok).toBe(false);
    expect(backend.state()).toEqual(before);
    expect(local.getItem('zodiacs.profile.v1')).toBe('private');
    expect(window.dispatchEvent).not.toHaveBeenCalled();
    factory.faults[fault] = false;
    factory.releaseBlocked();
    await backend.idle();
    expect(backend.state()).toEqual(before);
  });
});
