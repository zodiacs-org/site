import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChartBackup, parseChartBackup, mergeChartBackup, restoreChartBackup, BACKUP_LIMIT, type ChartBackup } from './backup';
import { PROFILE_KEY, EMPTY_PROFILE, type SavedChart } from './schema';
import { ME_KEY, CIRCLE_KEY } from './page-keys';

class MemoryStorage {
  values = new Map<string, string>(); failKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failKey === key) { this.failKey = null; throw new Error('quota'); }
    this.values.set(key, String(value));
  }
  removeItem(key: string) { this.values.delete(key); }
}
let storage: MemoryStorage;
let events: string[];
beforeEach(() => {
  storage = new MemoryStorage(); events = [];
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: (e: Event) => { events.push(e.type); return true; } });
});
afterEach(() => vi.unstubAllGlobals());
const chart = (id: string, date = '1990-01-01'): SavedChart => ({
  id, name: id, relationship: 'self', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  birth: { date, time: '12:00', timeKnown: true, place: { name: 'London', admin1: '', country: 'GB', lat: 51.5, lon: 0, tz: 'Europe/London' } },
  summary: { engineVersion: '0.1.0', utcISO: `${date}T12:00:00Z`, houseSystem: 'whole', bodies: [{ body: 'Sun', lon: 10, retrograde: false }], angles: { asc: 10, mc: 280 }, flags: [] },
});
const backup = (charts = [chart('source')]): ChartBackup => ({ format: 'zodiacs-chart-backup', version: 1, createdAt: '2026-10-02T12:00:00Z',
  profile: { ...EMPTY_PROFILE, charts }, me: { version: 1, displayName: 'Maya', keepCloseDismissed: false }, circle: [] });

describe('chart backup validation', () => {
  it('round trips birth details, identity and photo without exporting unrelated storage', () => {
    const original = backup(); original.me.photo = 'data:image/jpeg;base64,/9j/AA==';
    storage.setItem(PROFILE_KEY, JSON.stringify(original.profile)); storage.setItem(ME_KEY, JSON.stringify(original.me));
    storage.setItem('auth-token', 'private-session'); storage.setItem('zodiacs.observations', 'private-observation');
    const restored = parseChartBackup(JSON.stringify(createChartBackup()));
    expect(restored.profile.charts).toEqual(original.profile.charts);
    expect(restored.me).toEqual(original.me);
    expect(JSON.stringify(restored)).not.toMatch(/private-session|private-observation/);
  });
  it.each(['{', '{}', JSON.stringify({ ...backup(), version: 2 }), ' '.repeat(BACKUP_LIMIT + 1)])('rejects invalid envelopes without writes', raw => {
    expect(() => parseChartBackup(raw)).toThrow(); expect(storage.values.size).toBe(0);
  });
  it.each(['date', 'coordinates', 'body', 'angles', 'duplicate'])('rejects malformed %s', defect => {
    const b = backup(); const c = b.profile.charts[0]!;
    if (defect === 'date') c.birth.date = '1990-02-30';
    if (defect === 'coordinates') c.birth.place!.lat = 120;
    if (defect === 'body') c.summary.bodies[0]!.lon = Number.NaN;
    if (defect === 'angles') { c.birth.timeKnown = false; c.birth.time = null; }
    if (defect === 'duplicate') b.profile.charts.push(c);
    expect(() => parseChartBackup(JSON.stringify(b))).toThrow();
  });
  it('does not admit a remote or SVG photo into a restored identity', () => {
    const b = backup(); b.me.photo = 'https://example.com/track.jpg';
    expect(parseChartBackup(JSON.stringify(b)).me.photo).toBeUndefined();
  });
});
describe('restore preserves existing saves', () => {
  it('keeps existing data and owner when a backup has another self chart', () => {
    const current = { ...EMPTY_PROFILE, charts: [chart('existing')] };
    const merged = mergeChartBackup(current, [], backup([chart('different', '1991-01-01')]));
    expect(merged.profile.charts[0]).toEqual(current.charts[0]);
    expect(merged.profile.charts[1]!.relationship).toBe('other'); expect(merged.added).toBe(1);
  });
  it('skips a duplicate birth record saved under a different id', () => {
    expect(mergeChartBackup({ ...EMPTY_PROFILE, charts: [chart('existing')] }, [], backup()).added).toBe(0);
  });
  it('keeps existing name/photo unless explicitly chosen and restores repeatedly without duplicates', () => {
    const me = { version: 1, displayName: 'Existing', keepCloseDismissed: false };
    storage.setItem(ME_KEY, JSON.stringify(me));
    expect(restoreChartBackup(backup(), false)).toBe(1);
    expect(JSON.parse(storage.getItem(ME_KEY)!)).toEqual(me);
    expect(restoreChartBackup(backup(), true)).toBe(0);
    expect(JSON.parse(storage.getItem(ME_KEY)!).displayName).toBe('Maya');
    expect(JSON.parse(storage.getItem(PROFILE_KEY)!).charts).toHaveLength(1);
  });
  it('rolls back writes if browser storage refuses a later key', () => {
    storage.setItem(PROFILE_KEY, JSON.stringify(EMPTY_PROFILE));
    const old = storage.getItem(PROFILE_KEY); storage.failKey = CIRCLE_KEY;
    expect(() => restoreChartBackup(backup(), true)).toThrow(/could not save/);
    expect(storage.getItem(PROFILE_KEY)).toBe(old); expect(storage.getItem(ME_KEY)).toBeNull(); expect(events).toEqual([]);
  });
  it('refuses capacity overflow before changing any chart', () => {
    const charts = Array.from({ length: 40 }, (_, i) => chart(`c${i}`, `19${60 + i}-01-01`));
    storage.setItem(PROFILE_KEY, JSON.stringify({ ...EMPTY_PROFILE, charts }));
    const old = storage.getItem(PROFILE_KEY);
    expect(() => restoreChartBackup(backup([chart('new', '2001-01-01')]), false)).toThrow(/room/);
    expect(storage.getItem(PROFILE_KEY)).toBe(old);
  });
});
