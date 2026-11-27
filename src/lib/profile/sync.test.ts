import { AuthSessionMissingError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
const fake = vi.hoisted(() => ({ client: null as unknown }));
const device = vi.hoisted(() => ({
  profile: { version: 1, settings: { houseSystem: 'whole' }, charts: [] as unknown[] },
  deletions: [] as { id: string; deletedAt: string }[],
  replaced: null as unknown,
}));

vi.mock('../supabase/client', () => ({
  getSupabaseClient: () => fake.client ?? { auth },
  isSupabaseConfigured: () => true,
}));
vi.mock('./store', () => ({
  loadProfile: () => device.profile,
  replaceProfile: (profile: unknown) => { device.replaced = profile; return true; },
}));
vi.mock('./deletions', () => ({
  loadChartDeletions: () => device.deletions,
  replaceChartDeletions: () => true,
  recordChartDeletion: () => true,
}));

import { fakeSupabase } from '../privacy/fake-supabase';
import {
  CHART_UPLOAD_PAUSED,
  accountChartIdsFromLastRead,
  chartFoundInAccount,
  getChartSaveStatus,
  getSyncSession,
  signOutOfSync,
  signOutOfSyncLocal,
  syncNow,
} from './sync';

const BIRTH_DATE = '1990-01-01';
const PLACE = 'London';
const LAT = 51.5;
const LON = -0.1278;

function savedChart(id: string, updatedAt: string) {
  return {
    id, name: 'Fixture', relationship: 'self', createdAt: updatedAt, updatedAt,
    birth: { date: BIRTH_DATE, time: '12:00', timeKnown: true, place: { name: PLACE, admin1: '', country: 'GB', lat: LAT, lon: LON, tz: 'Europe/London' } },
    summary: { engineVersion: '0.1.0', utcISO: `${BIRTH_DATE}T12:00:00Z`, houseSystem: 'whole', bodies: [], angles: null, flags: [] },
  };
}

// Keys that only a chart carries. A write may send `id` and `settings.houseSystem`, never these.
const CHART_KEYS = ['birth', 'summary', 'utcISO', 'date', 'time', 'timeKnown', 'place', 'lat', 'lon', 'tz', 'name', 'bodies', 'angles'];

/** Every object key and every leaf value in what the writes would send, however deeply nested. */
function walkSent(value: unknown, keys: string[] = [], leaves: unknown[] = []): { keys: string[]; leaves: unknown[] } {
  if (Array.isArray(value)) {
    for (const item of value) walkSent(item, keys, leaves);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      walkSent(item, keys, leaves);
    }
  } else {
    leaves.push(value);
  }
  return { keys, leaves };
}

// The profile upsert stamps updated_at from the clock. The clock is pinned so that stamp is
// known exactly and is the one value the guards below set aside.
const SYNC_NOW = new Date('2026-11-27T13:00:00.000Z');

describe('chart sync is paused: read and delete only', () => {
  const kept = '11111111-1111-4111-8111-111111111111';
  const removed = '33333333-3333-4333-8333-333333333333';
  const localOnly = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    fake.client = null;
    device.replaced = null;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SYNC_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads and merges the account, removes deleted charts, and never sends a chart', async () => {
    expect(CHART_UPLOAD_PAUSED).toBe(true);
    device.profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [savedChart(localOnly, '2026-11-01T00:00:00Z')] };
    device.deletions = [{ id: removed, deletedAt: '2026-11-02T00:00:00Z' }];
    const db = fakeSupabase({
      profiles: [{ settings: { houseSystem: 'placidus' } }],
      charts: [
        { id: kept, payload: savedChart(kept, '2026-10-01T00:00:00Z'), updated_at: '2026-10-01T00:00:00Z' },
        { id: removed, payload: savedChart(removed, '2026-10-01T00:00:00Z'), updated_at: '2026-10-01T00:00:00Z' },
      ],
      chart_deletions: [],
    });
    fake.client = db.client;

    await expect(syncNow()).resolves.toBe(true);
    expect(getChartSaveStatus()).toBe('paused');

    const writes = db.requests.filter((request) => request.op !== 'select');
    expect(writes.filter((request) => request.table === 'charts' && request.op !== 'delete')).toEqual([]);
    expect(writes.map((request) => `${request.table}:${request.op}`).sort()).toEqual(['chart_deletions:upsert', 'charts:delete', 'profiles:upsert']);
    // The clock's stamp is set aside before any substring check: its digits are not a birth detail.
    const stamp = SYNC_NOW.toISOString();
    const { keys, leaves } = walkSent(writes);
    expect(leaves).toContain(stamp);
    const sent = leaves.filter((leaf) => leaf !== stamp);
    expect(keys.filter((key) => CHART_KEYS.includes(key))).toEqual([]);
    expect(sent.filter((leaf) => leaf === LAT || leaf === LON || leaf === String(LAT) || leaf === String(LON))).toEqual([]);
    expect(sent.filter((leaf) => typeof leaf === 'string' && (leaf.includes(BIRTH_DATE) || leaf.includes(PLACE)))).toEqual([]);
    expect(JSON.stringify(writes).replaceAll(JSON.stringify(stamp), '"<now>"')).not.toMatch(/1990-01-01|London|51\.5|-?0\.1278|"birth"|"summary"|utcISO/u);
    expect(writes.find((request) => request.table === 'chart_deletions')!.payload).toEqual([
      { id: removed, user_id: '22222222-2222-4222-8222-222222222222', deleted_at: '2026-11-02T00:00:00Z' },
    ]);
    expect(writes.find((request) => request.table === 'charts')!.filters).toEqual([
      ['user_id', '22222222-2222-4222-8222-222222222222'], ['id', [removed]],
    ]);
    expect(Object.keys(writes.find((request) => request.table === 'profiles')!.payload as object).sort()).toEqual(['settings', 'updated_at', 'user_id']);

    // The account's chart is merged into the device; the device-only chart stays on the device only.
    const merged = device.replaced as { charts: { id: string }[] };
    expect(merged.charts.map((chart) => chart.id).sort()).toEqual([kept, localOnly].sort());

    // Features that need a chart row in the account are offered only for what the read found there.
    expect(chartFoundInAccount(kept)).toBe(true);
    expect(chartFoundInAccount(removed)).toBe(false);
    expect(chartFoundInAccount(localOnly)).toBe(false);
    expect(accountChartIdsFromLastRead()).toEqual([kept]);
  });

  it('sends nothing for a signed-out visitor', async () => {
    const db = fakeSupabase({}, null);
    fake.client = db.client;
    await expect(syncNow()).resolves.toBe(false);
    expect(db.requests).toEqual([]);
  });
});

describe('profile sync auth outcomes', () => {
  beforeEach(() => {
    fake.client = null;
    auth.getSession.mockReset();
    auth.signOut.mockReset();
  });

  it('treats an absent or explicitly missing session as signed out', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getSyncSession()).resolves.toBeNull();

    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthSessionMissingError(),
    });
    await expect(getSyncSession()).resolves.toBeNull();
  });

  it('propagates session-read failures instead of reporting signed out', async () => {
    const error = new Error('storage unavailable');
    auth.getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(getSyncSession()).rejects.toBe(error);
  });

  it('propagates global and local sign-out failures', async () => {
    const globalError = new Error('global sign-out failed');
    auth.signOut.mockResolvedValueOnce({ error: globalError });
    await expect(signOutOfSync()).rejects.toBe(globalError);
    expect(auth.signOut).toHaveBeenNthCalledWith(1);

    const localError = new Error('local sign-out failed');
    auth.signOut.mockResolvedValueOnce({ error: localError });
    await expect(signOutOfSyncLocal()).rejects.toBe(localError);
    expect(auth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
  });

  it('resolves only after successful global and local sign-out responses', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOutOfSync()).resolves.toBeUndefined();
    await expect(signOutOfSyncLocal()).resolves.toBeUndefined();
  });
});
