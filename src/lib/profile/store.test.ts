import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as engine from '../engine/full';
import { ENGINE_VERSION } from '../engine/types';
import type { Chart, HouseSystem } from '../engine/types';
import { signForLongitude } from '../signs';
import { PROFILE_DELETIONS_KEY, loadChartDeletions } from './deletions';
import { EMPTY_PROFILE, MAX_CHARTS, PROFILE_KEY } from './schema';
import type { SavedChart, SavedChartRelationship, SavedPlace } from './schema';
import {
  deleteChart,
  getPrimarySelfChart,
  loadProfileSunSign,
  loadProfile,
  markPrimarySelfChart,
  PROFILE_SUN_SIGN_KEY,
  replaceProfile,
  saveChart,
  setProfileSunSign,
  updateChartSummaries,
} from './store';
import { refreshSavedChartSummaries } from './refresh';
import { resolveSavedChart, type SavedChartEngineLoader } from './resolve';

const sync = vi.hoisted(() => ({ scheduleCloudSync: vi.fn() }));
vi.mock('./sync', () => sync);
// The birthplace clock's tables load only through prepareLocalTime.
const time = vi.hoisted(() => ({ prepareLocalTime: vi.fn() }));
vi.mock('../time/localToUtc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../time/localToUtc')>();
  time.prepareLocalTime.mockImplementation(actual.prepareLocalTime);
  return { ...actual, prepareLocalTime: time.prepareLocalTime };
});

const YEAR_AHEAD_CACHE_KEY = 'zodiacs.yearahead.v1';
const NOW = '2026-07-10T12:00:00.000Z';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

interface ChartOptions {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  time?: string | null;
  timeKnown?: boolean;
  place?: boolean;
  lat?: number;
  lon?: number;
  houseSystem?: HouseSystem;
  engineVersion?: string;
  relationship?: SavedChartRelationship;
}

function makeChart(id: string, options: ChartOptions = {}): SavedChart {
  const time = options.time === undefined ? '12:00' : options.time;
  return {
    id,
    name: options.name ?? id,
    ...(options.relationship ? { relationship: options.relationship } : {}),
    createdAt: options.createdAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: options.updatedAt ?? '2026-07-01T00:00:00.000Z',
    birth: {
      date: options.date ?? '1990-01-01',
      time,
      timeKnown: options.timeKnown ?? time !== null,
      place: options.place === false ? null : {
        name: 'Bangkok',
        admin1: 'Bangkok',
        country: 'TH',
        lat: options.lat ?? 13.7563,
        lon: options.lon ?? 100.5018,
        tz: 'Asia/Bangkok',
      },
    },
    summary: {
      engineVersion: options.engineVersion ?? ENGINE_VERSION,
      utcISO: '1990-01-01T05:00:00.000Z',
      houseSystem: options.houseSystem ?? 'whole',
      bodies: [{ body: 'Sun', lon: 280, retrograde: false }],
      angles: { asc: 12, mc: 102 },
      flags: [],
    },
  };
}

let storage: MemoryStorage;

function seedProfile(charts: SavedChart[]): void {
  storage.setItem(PROFILE_KEY, JSON.stringify({ ...EMPTY_PROFILE, charts }));
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  sync.scheduleCloudSync.mockClear();
  time.prepareLocalTime.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('saveChart', () => {
  it('preserves a rename when an opened chart is saved again without an explicit name', () => {
    const existing = makeChart('kept-id', {
      name: 'Mom',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    seedProfile([existing]);
    storage.setItem(PROFILE_DELETIONS_KEY, JSON.stringify([
      { id: existing.id, deletedAt: '2026-07-09T00:00:00.000Z' },
    ]));

    const incoming = makeChart('new-random-id', {
      name: 'Fresh calculation',
      createdAt: '2026-07-10T11:59:00.000Z',
      engineVersion: 'next-engine',
    });

    expect(saveChart(incoming)).toBe('updated');
    const [saved] = loadProfile().charts;
    expect(loadProfile().charts).toHaveLength(1);
    expect(saved.id).toBe(existing.id);
    expect(saved.createdAt).toBe(existing.createdAt);
    expect(saved.updatedAt).toBe(NOW);
    expect(saved.name).toBe('Mom');
    expect(saved.summary.engineVersion).toBe('next-engine');
    expect(loadChartDeletions()).toEqual([]);
  });

  it('uses an explicit name for matched updates and new charts', () => {
    seedProfile([makeChart('existing', { name: 'Mom' })]);

    expect(saveChart(makeChart('incoming', { name: 'Auto name' }), {
      explicitName: '  Aunt Ana  ',
    })).toBe('updated');
    expect(loadProfile().charts[0].name).toBe('Aunt Ana');

    expect(saveChart(makeChart('new-person', { lat: 14, name: 'Auto name' }), {
      explicitName: 'Friend',
    })).toBe('saved');
    expect(loadProfile().charts[0].name).toBe('Friend');
  });

  it('treats an empty explicit name as non-explicit', () => {
    seedProfile([makeChart('existing', { name: 'Mom' })]);

    expect(saveChart(makeChart('incoming', { name: 'Auto name' }), {
      explicitName: '   ',
    })).toBe('updated');
    expect(loadProfile().charts[0].name).toBe('Mom');
  });

  it.each<[string, ChartOptions]>([
    ['date', { date: '1990-01-02' }],
    ['time', { time: '13:00' }],
    ['latitude', { lat: 14 }],
    ['longitude', { lon: 101 }],
    ['house system', { houseSystem: 'placidus' }],
  ])('mints a new chart when %s differs', (_field, difference) => {
    seedProfile([makeChart('existing')]);

    expect(saveChart(makeChart('incoming', difference))).toBe('saved');
    expect(loadProfile().charts.map((chart) => chart.id)).toEqual(['incoming', 'existing']);
  });

  it('does not dedupe charts that have no stored coordinates', () => {
    seedProfile([makeChart('existing', { place: false })]);

    expect(saveChart(makeChart('incoming', { place: false }))).toBe('saved');
    expect(loadProfile().charts).toHaveLength(2);
  });

  it('updates an input match at capacity but rejects a new input', () => {
    const charts = Array.from({ length: MAX_CHARTS }, (_, index) => (
      makeChart(`chart-${index}`, { lat: index })
    ));
    seedProfile(charts);

    expect(saveChart(makeChart('replacement-id', { lat: 10, name: 'Updated ten' }), {
      explicitName: 'Updated ten',
    })).toBe('updated');
    expect(loadProfile().charts).toHaveLength(MAX_CHARTS);
    expect(loadProfile().charts.find((chart) => chart.id === 'chart-10')?.name).toBe('Updated ten');
    expect(saveChart(makeChart('overflow', { lat: 100 }))).toBe('full');
  });

  it('preserves a saved relationship when a recalculation does not classify the chart', () => {
    seedProfile([makeChart('existing', { relationship: 'self' })]);

    expect(saveChart(makeChart('incoming'))).toBe('updated');
    expect(loadProfile().charts[0].relationship).toBe('self');
  });

  it('makes an incoming self chart canonical and classifies every other chart as other', () => {
    seedProfile([
      makeChart('legacy-self', { relationship: 'self' }),
      makeChart('unclassified', { lat: 14 }),
    ]);

    expect(saveChart(makeChart('new-self', { lat: 15, relationship: 'self' }))).toBe('saved');
    expect(loadProfile().charts.map(({ id, relationship }) => ({ id, relationship }))).toEqual([
      { id: 'new-self', relationship: 'self' },
      { id: 'legacy-self', relationship: 'other' },
      { id: 'unclassified', relationship: 'other' },
    ]);
  });

  it('lets an explicit incoming other classification replace a saved self classification', () => {
    seedProfile([makeChart('existing', { relationship: 'self' })]);

    expect(saveChart(makeChart('incoming', { relationship: 'other' }))).toBe('updated');
    expect(getPrimarySelfChart()).toBeNull();
    expect(loadProfile().charts[0].relationship).toBe('other');
  });
});

describe('markPrimarySelfChart', () => {
  it('marks exactly one canonical self chart and demotes every other saved chart', () => {
    seedProfile([
      makeChart('old-self', { relationship: 'self' }),
      makeChart('chosen', { lat: 14 }),
      makeChart('third', { lat: 15 }),
    ]);

    expect(markPrimarySelfChart('chosen')).toBe(true);
    expect(getPrimarySelfChart()?.id).toBe('chosen');
    expect(loadProfile().charts.map(({ id, relationship }) => ({ id, relationship }))).toEqual([
      { id: 'old-self', relationship: 'other' },
      { id: 'chosen', relationship: 'self' },
      { id: 'third', relationship: 'other' },
    ]);
  });

  it('does not rewrite the profile when the requested chart is missing', () => {
    const existing = makeChart('existing', { relationship: 'self' });
    seedProfile([existing]);

    expect(markPrimarySelfChart('missing')).toBe(false);
    expect(loadProfile().charts).toEqual([existing]);
  });

  it('fails closed when legacy data contains more than one self chart', () => {
    seedProfile([
      makeChart('first-self', { relationship: 'self' }),
      makeChart('second-self', { relationship: 'self', lat: 14 }),
    ]);

    expect(getPrimarySelfChart()).toBeNull();
  });
});

describe('deleteChart', () => {
  it('prunes only the deleted chart from the year-ahead cache', () => {
    seedProfile([makeChart('remove-me'), makeChart('keep-me', { lat: 14 })]);
    storage.setItem(YEAR_AHEAD_CACHE_KEY, JSON.stringify({
      'remove-me': { computedAt: 'old' },
      'keep-me': { computedAt: 'current' },
    }));

    expect(deleteChart('remove-me')).toBe(true);
    expect(loadProfile().charts.map((chart) => chart.id)).toEqual(['keep-me']);
    expect(JSON.parse(storage.getItem(YEAR_AHEAD_CACHE_KEY)!)).toEqual({
      'keep-me': { computedAt: 'current' },
    });
    expect(loadChartDeletions().map((deletion) => deletion.id)).toEqual(['remove-me']);
  });

  it('does not let a malformed derived cache block profile deletion', () => {
    seedProfile([makeChart('remove-me')]);
    storage.setItem(YEAR_AHEAD_CACHE_KEY, '{not-json');

    expect(deleteChart('remove-me')).toBe(true);
    expect(loadProfile().charts).toEqual([]);
    expect(storage.getItem(YEAR_AHEAD_CACHE_KEY)).toBe('{not-json');
  });
});

describe('replaceProfile', () => {
  it('prunes cached years for charts removed by a remote profile merge', () => {
    storage.setItem(YEAR_AHEAD_CACHE_KEY, JSON.stringify({
      'remote-deleted': { computedAt: 'old' },
      'remote-kept': { computedAt: 'current' },
    }));
    const profile = {
      ...EMPTY_PROFILE,
      charts: [makeChart('remote-kept')],
    };

    expect(replaceProfile(profile)).toBe(true);
    expect(loadProfile()).toEqual(profile);
    expect(JSON.parse(storage.getItem(YEAR_AHEAD_CACHE_KEY)!)).toEqual({
      'remote-kept': { computedAt: 'current' },
    });
  });
});

describe('profile Sun sign', () => {
  it('stores and reads a bounded sign preference without creating a chart', () => {
    vi.stubGlobal('CustomEvent', class {
      type: string;
      detail: unknown;

      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.detail = init.detail;
      }
    });

    expect(setProfileSunSign('aries')).toBe(true);
    expect(storage.getItem(PROFILE_SUN_SIGN_KEY)).toBe('aries');
    expect(loadProfileSunSign()).toBe('aries');
    expect(loadProfile().charts).toEqual([]);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'zodiacs:profile-sun-sign',
      detail: { sign: 'aries' },
    }));
  });

  it('rejects unknown signs and malformed stored values', () => {
    expect(setProfileSunSign('ophiuchus')).toBe(false);
    expect(storage.getItem(PROFILE_SUN_SIGN_KEY)).toBeNull();

    storage.setItem(PROFILE_SUN_SIGN_KEY, 'ophiuchus');
    expect(loadProfileSunSign()).toBeNull();
  });
});

describe('resolveSavedChart', () => {
  it('returns a current stored summary without loading the engine', async () => {
    let loads = 0;
    const loader: SavedChartEngineLoader = async () => {
      loads += 1;
      throw new Error('must stay lazy');
    };

    const chart = makeChart('current');
    await expect(resolveSavedChart(chart, loader)).resolves.toEqual({
      bodies: [{ body: 'Sun', lon: 280 }],
      asc: 12,
      timeKnown: true,
      summary: chart.summary,
    });
    expect(loads).toBe(0);
  });

  it('does not load the engine for a stale chart without source coordinates', async () => {
    let loads = 0;
    const loader: SavedChartEngineLoader = async () => {
      loads += 1;
      throw new Error('must stay lazy');
    };

    const resolved = await resolveSavedChart(makeChart('stale', {
      engineVersion: 'old',
      place: false,
    }), loader);
    expect(resolved.bodies).toEqual([{ body: 'Sun', lon: 280 }]);
    expect(loads).toBe(0);
  });

  it('recomputes a stale chart from birth input with the injected lazy engine', async () => {
    let received: Chart['input'] | null = null;
    const loader: SavedChartEngineLoader = async () => ({
      computeChart(input) {
        received = input;
        return {
          input,
          bodies: [{ body: 'Sun', lon: 42, lat: 0, speed: 1, retrograde: false }],
          angles: { asc: 5, mc: 95, dsc: 185, ic: 275 },
          houses: null,
          aspects: [],
          flags: input.flags ?? [],
          engineVersion: ENGINE_VERSION,
        };
      },
    });

    const resolved = await resolveSavedChart(makeChart('stale', {
      engineVersion: 'old',
      time: null,
      timeKnown: false,
      houseSystem: 'placidus',
    }), loader);

    expect(received).not.toBeNull();
    expect(received!.utc.toISOString()).toBe('1990-01-01T05:00:00.000Z');
    expect(received).toMatchObject({
      latitude: 13.7563,
      longitude: 100.5018,
      houseSystem: 'placidus',
      timeKnown: false,
      flags: [],
    });
    expect(resolved).toEqual({
      bodies: [{ body: 'Sun', lon: 42 }],
      asc: 5,
      timeKnown: false,
      summary: {
        engineVersion: ENGINE_VERSION,
        utcISO: '1990-01-01T05:00:00.000Z',
        houseSystem: 'placidus',
        bodies: [{ body: 'Sun', lon: 42, retrograde: false }],
        angles: { asc: 5, mc: 95 },
        flags: [],
      },
    });
  });

  function buffalo1870(utcISO: string): SavedChart {
    const chart = makeChart('buffalo', { date: '1870-06-01', time: '12:00' });
    return {
      ...chart,
      birth: {
        ...chart.birth,
        place: { name: 'Buffalo', admin1: 'New York', country: 'US', lat: 42.886, lon: -78.878, tz: 'America/New_York' },
      },
      summary: { ...chart.summary, utcISO },
    };
  }

  it('keeps a current summary before standard time while its instant matches the birthplace clock', async () => {
    let loads = 0;
    const loader: SavedChartEngineLoader = async () => {
      loads += 1;
      throw new Error('must stay lazy');
    };
    const chart = buffalo1870('1870-06-01T17:15:31.000Z');

    await expect(resolveSavedChart(chart, loader)).resolves.toMatchObject({ summary: chart.summary });
    expect(loads).toBe(0);
  });

  it('recomputes a current summary saved on the zone reference city clock', async () => {
    let received: Chart['input'] | null = null;
    const loader: SavedChartEngineLoader = async () => ({
      computeChart(input) {
        received = input;
        return {
          input,
          bodies: [{ body: 'Sun', lon: 70, lat: 0, speed: 1, retrograde: false }],
          angles: { asc: 150, mc: 60, dsc: 330, ic: 240 },
          houses: null,
          aspects: [],
          flags: input.flags ?? [],
          engineVersion: ENGINE_VERSION,
        };
      },
    });

    // New York's mean time, 4 h 56 min 2 s behind Greenwich, as saved before
    // 2026-09; Buffalo's own is 5 h 15 min 31 s behind.
    const resolved = await resolveSavedChart(buffalo1870('1870-06-01T16:56:02.000Z'), loader);

    expect(received!.utc.toISOString()).toBe('1870-06-01T17:15:31.000Z');
    expect(received!.flags).toEqual(['lmt']);
    expect(resolved.summary).toMatchObject({ utcISO: '1870-06-01T17:15:31.000Z', flags: ['lmt'] });
    expect(resolved.bodies).toEqual([{ body: 'Sun', lon: 70 }]);
    expect(resolved.asc).toBe(150);
  });

  it('recomputes a current summary from 1954 to 1970 saved on the browser\'s zone history', async () => {
    let received: Chart['input'] | null = null;
    const loader: SavedChartEngineLoader = async () => ({
      computeChart(input) {
        received = input;
        return {
          input,
          bodies: [{ body: 'Sun', lon: 99, lat: 0, speed: 1, retrograde: false }],
          angles: { asc: 200, mc: 110, dsc: 20, ic: 290 },
          houses: null,
          aspects: [],
          flags: input.flags ?? [],
          engineVersion: ENGINE_VERSION,
        };
      },
    });
    const chart = makeChart('oslo', { date: '1960-07-01', time: '12:00' });
    // Browsers give Oslo Berlin's history, +1:00 in July 1960; Norway kept
    // summer time that year, +2:00, which the pinned history has.
    const saved: SavedChart = {
      ...chart,
      birth: {
        ...chart.birth,
        place: { name: 'Oslo', admin1: 'Oslo', country: 'NO', lat: 59.913, lon: 10.75, tz: 'Europe/Oslo' },
      },
      summary: { ...chart.summary, utcISO: '1960-07-01T11:00:00.000Z' },
    };

    const resolved = await resolveSavedChart(saved, loader);

    expect(received!.utc.toISOString()).toBe('1960-07-01T10:00:00.000Z');
    expect(resolved.summary).toMatchObject({ utcISO: '1960-07-01T10:00:00.000Z' });
  });

  it('recomputes a current summary from 1947 saved on Berlin\'s summer time', async () => {
    let received: Chart['input'] | null = null;
    const loader: SavedChartEngineLoader = async () => ({
      computeChart(input) {
        received = input;
        return {
          input,
          bodies: [{ body: 'Sun', lon: 98, lat: 0, speed: 1, retrograde: false }],
          angles: { asc: 187, mc: 100, dsc: 7, ic: 280 },
          houses: null,
          aspects: [],
          flags: input.flags ?? [],
          engineVersion: ENGINE_VERSION,
        };
      },
    });
    const chart = makeChart('stockholm', { date: '1947-07-01', time: '12:00' });
    // Browsers give Stockholm Berlin's history, +2:00 in July 1947; Sweden
    // kept +1:00 all year, which the pinned history has.
    const saved: SavedChart = {
      ...chart,
      birth: {
        ...chart.birth,
        place: { name: 'Stockholm', admin1: 'Stockholm', country: 'SE', lat: 59.33, lon: 18.07, tz: 'Europe/Stockholm' },
      },
      summary: { ...chart.summary, utcISO: '1947-07-01T10:00:00.000Z' },
    };

    const resolved = await resolveSavedChart(saved, loader);

    expect(received!.utc.toISOString()).toBe('1947-07-01T11:00:00.000Z');
    expect(resolved.summary).toMatchObject({ utcISO: '1947-07-01T11:00:00.000Z' });
  });

  it('falls back to the stored summary when stale recomputation fails', async () => {
    const loader: SavedChartEngineLoader = async () => {
      throw new Error('offline');
    };
    const chart = makeChart('stale', { engineVersion: 'old' });

    await expect(resolveSavedChart(chart, loader)).resolves.toEqual({
      bodies: [{ body: 'Sun', lon: 280 }],
      asc: 12,
      timeKnown: true,
      summary: chart.summary,
    });
  });
});

describe('refreshSavedChartSummaries', () => {
  it("remembers its checks under the tzdb release the engine reads, so a new release checks every chart again", async () => {
    const { TZDB } = await import('@zodiacs/engine/geo');
    const source = (await import('node:fs')).readFileSync(new URL('./refresh.ts', import.meta.url), 'utf8');
    expect(source).toContain(`const CHECKED_KEY = 'zodiacs.profile.birthplace-checks-${TZDB.version}.v1';`);
  });

  const STOCKHOLM: SavedPlace ={ name: 'Stockholm', admin1: 'Stockholm', country: 'SE', lat: 59.33, lon: 18.07, tz: 'Europe/Stockholm' };
  const OSLO: SavedPlace = { name: 'Oslo', admin1: 'Oslo', country: 'NO', lat: 59.913, lon: 10.75, tz: 'Europe/Oslo' };
  const NEW_YORK: SavedPlace = { name: 'New York', admin1: 'New York', country: 'US', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };

  /** A noon birth as the real engine saved it at `utcISO`, on whichever clock gave that instant. */
  function savedAt(id: string, place: SavedPlace, date: string, utcISO: string, options: ChartOptions = {}): SavedChart {
    const chart = makeChart(id, { ...options, date, time: '12:00' });
    const result = engine.computeChart({
      utc: new Date(utcISO),
      latitude: place.lat,
      longitude: place.lon,
      houseSystem: 'whole',
      timeKnown: true,
      flags: [],
    });
    return {
      ...chart,
      birth: { ...chart.birth, place },
      summary: {
        engineVersion: result.engineVersion,
        utcISO,
        houseSystem: 'whole',
        bodies: result.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
        angles: { asc: result.angles!.asc, mc: result.angles!.mc },
        flags: result.flags,
      },
    };
  }

  // Browsers read Stockholm on Berlin's summer time in July 1947 (10:00Z for
  // a noon birth); Sweden kept +1:00, so the birth was at 11:00Z.
  const staleStockholm = (id = 'stockholm', options: ChartOptions = {}) =>
    savedAt(id, STOCKHOLM, '1947-07-01', '1947-07-01T10:00:00.000Z', options);
  const moon = (summary: SavedChart['summary']) => summary.bodies.find((body) => body.body === 'Moon')!.lon;

  it('rewrites a stale 1947 Stockholm summary on the real engine: the ASC moves from Virgo to Libra', async () => {
    const saved = staleStockholm();
    seedProfile([saved]);
    expect(saved.summary.angles!.asc).toBeCloseTo(177.91, 2);
    expect(signForLongitude(saved.summary.angles!.asc).slug).toBe('virgo');
    expect(moon(saved.summary)).toBeCloseTo(256.61, 2);
    const loader = vi.fn<SavedChartEngineLoader>(async () => engine);

    await expect(refreshSavedChartSummaries(loader)).resolves.toBe(1);

    const [refreshed] = loadProfile().charts;
    expect(refreshed.summary.utcISO).toBe('1947-07-01T11:00:00.000Z');
    expect(refreshed.summary.engineVersion).toBe(ENGINE_VERSION);
    expect(refreshed.summary.angles!.asc).toBeCloseTo(187.38, 2);
    expect(signForLongitude(refreshed.summary.angles!.asc).slug).toBe('libra');
    expect(moon(refreshed.summary)).toBeCloseTo(257.10, 2);
    expect({ ...refreshed, summary: saved.summary }).toEqual(saved);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('changes only placed charts dated up to 1970, keeping id, createdAt and updatedAt', async () => {
    const stockholm = staleStockholm('stockholm', {
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    });
    const newest = makeChart('bangkok-1990', { updatedAt: '2026-06-01T00:00:00.000Z' });
    const placeless = { ...makeChart('placeless-1947', { date: '1947-07-01', place: false }), summary: stockholm.summary };
    const bangkok1971 = makeChart('bangkok-1971', { date: '1971-01-01', lat: 14 });
    seedProfile([newest, stockholm, placeless, bangkok1971]);

    await expect(refreshSavedChartSummaries(async () => engine)).resolves.toBe(1);

    const [first, refreshed, ...rest] = loadProfile().charts;
    expect(first).toEqual(newest);
    expect(rest).toEqual([placeless, bangkok1971]);
    expect(refreshed).toEqual({ ...stockholm, summary: refreshed.summary });
    expect(refreshed.summary.utcISO).toBe('1947-07-01T11:00:00.000Z');
  });

  it('writes one profile event and one sync for the batch; a second run does nothing and loads nothing', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://sync.example');
    // Oslo kept summer time in 1960, which browsers miss (the stale 11:00Z);
    // New York's July 1960 clock was EDT either way, so its summary stands.
    seedProfile([
      staleStockholm(),
      savedAt('oslo', OSLO, '1960-07-01', '1960-07-01T11:00:00.000Z', { lat: 1 }),
      savedAt('new-york', NEW_YORK, '1960-07-01', '1960-07-01T16:00:00.000Z', { lat: 2 }),
    ]);
    const first = vi.fn<SavedChartEngineLoader>(async () => engine);

    await expect(refreshSavedChartSummaries(first)).resolves.toBe(2);
    await vi.dynamicImportSettled();

    expect(loadProfile().charts.map((chart) => chart.summary.utcISO)).toEqual([
      '1947-07-01T11:00:00.000Z',
      '1960-07-01T10:00:00.000Z',
      '1960-07-01T16:00:00.000Z',
    ]);
    expect(time.prepareLocalTime).toHaveBeenCalledTimes(3);
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
    expect(vi.mocked(window.dispatchEvent).mock.calls[0][0].type).toBe('zodiacs:profile');
    expect(sync.scheduleCloudSync).toHaveBeenCalledOnce();

    const stored = storage.getItem(PROFILE_KEY);
    time.prepareLocalTime.mockClear();
    const second = vi.fn<SavedChartEngineLoader>(async () => engine);

    await expect(refreshSavedChartSummaries(second)).resolves.toBe(0);
    await vi.dynamicImportSettled();

    expect(second).not.toHaveBeenCalled();
    expect(time.prepareLocalTime).not.toHaveBeenCalled();
    expect(storage.getItem(PROFILE_KEY)).toBe(stored);
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
    expect(sync.scheduleCloudSync).toHaveBeenCalledOnce();
  });

  it('leaves a chart saved again while its summary was recomputed', async () => {
    seedProfile([staleStockholm()]);
    // The same birth saved again from the calculator, on the corrected clock.
    const resaved = savedAt('recalculated', STOCKHOLM, '1947-07-01', '1947-07-01T11:00:00.000Z');
    const loader = vi.fn<SavedChartEngineLoader>(async () => {
      expect(saveChart(resaved)).toBe('updated');
      return engine;
    });

    await expect(refreshSavedChartSummaries(loader)).resolves.toBe(0);

    expect(loader).toHaveBeenCalledOnce();
    expect(loadProfile().charts).toEqual([{ ...resaved, id: 'stockholm', name: 'stockholm', updatedAt: NOW }]);
    // The save's own write; the refresh adds none.
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });

  it('never loads the engine or the time tables for a chart after 1970 or without a place', async () => {
    seedProfile([
      makeChart('bangkok-1990', { engineVersion: 'old' }),
      makeChart('placeless-1947', { date: '1947-07-01', place: false, engineVersion: 'old' }),
    ]);
    const loader = vi.fn<SavedChartEngineLoader>(async () => engine);

    await expect(refreshSavedChartSummaries(loader)).resolves.toBe(0);
    await vi.dynamicImportSettled();

    expect(loader).not.toHaveBeenCalled();
    expect(time.prepareLocalTime).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('checks a chart again on the next run after its recomputation could not load', async () => {
    seedProfile([staleStockholm()]);

    await expect(refreshSavedChartSummaries(async () => {
      throw new Error('offline');
    })).resolves.toBe(0);
    expect(loadProfile().charts[0].summary.utcISO).toBe('1947-07-01T10:00:00.000Z');

    await expect(refreshSavedChartSummaries(async () => engine)).resolves.toBe(1);
    expect(loadProfile().charts[0].summary.utcISO).toBe('1947-07-01T11:00:00.000Z');
  });
});

describe('updateChartSummaries', () => {
  it('replaces a summary only while the stored chart keeps the instant it was recomputed from', () => {
    const kept = makeChart('kept', { lat: 1 });
    const resaved = makeChart('resaved', { lat: 2 });
    seedProfile([kept, resaved]);
    const summary = { ...kept.summary, utcISO: '1990-01-01T06:00:00.000Z', angles: { asc: 27, mc: 117 } };

    expect(updateChartSummaries([
      { id: 'kept', utcISO: kept.summary.utcISO, summary },
      { id: 'resaved', utcISO: '1990-01-01T04:00:00.000Z', summary },
      { id: 'deleted', utcISO: kept.summary.utcISO, summary },
    ])).toEqual(['kept']);

    expect(loadProfile().charts).toEqual([{ ...kept, summary }, resaved]);
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });

  it('writes nothing when no stored chart still matches', () => {
    const chart = makeChart('chart');
    seedProfile([chart]);
    const stored = storage.getItem(PROFILE_KEY);

    expect(updateChartSummaries([
      { id: 'chart', utcISO: '1990-01-01T04:00:00.000Z', summary: chart.summary },
    ])).toEqual([]);

    expect(storage.getItem(PROFILE_KEY)).toBe(stored);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});
