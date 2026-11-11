import { AuthSessionMissingError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function savedChart(id: string, updatedAt: string) {
  return {
    id, name: 'Fixture', relationship: 'self', createdAt: updatedAt, updatedAt,
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: { name: 'London', admin1: '', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
    summary: { engineVersion: '0.1.0', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole', bodies: [], angles: null, flags: [] },
  };
}

describe('chart sync is paused: read and delete only', () => {
  const kept = '11111111-1111-4111-8111-111111111111';
  const removed = '33333333-3333-4333-8333-333333333333';
  const localOnly = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    fake.client = null;
    device.replaced = null;
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
    expect(JSON.stringify(writes)).not.toMatch(/1990-01-01|London|51\.5|"birth"|"summary"|utcISO/u);
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
