import { afterEach, describe, expect, it, vi } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import legacyPolar from '../engine/fixtures/legacy-polar-saved.json';
import * as engine from '../engine/full';
import { ENGINE_VERSION } from '../engine/types';
import { yearCacheFresh, type YearScanCache } from '../year-ahead';
import { resolveSaved } from '../../islands/SynastryCalculator';
import { loadProfile } from './read-store';
import { resolveSavedChart } from './resolve';
import { EMPTY_PROFILE, PROFILE_KEY, type SavedChart } from './schema';
import { currentSavedCalculation, POLAR_REPAIR_VERSION, repairLegacyPolarChart } from './polar-repair';

// The exact vendored 0.1.0 package is the pre-2026-08-24 implementation. At
// this instant it stored the setting intersection (ASC 203.87198411230202°)
// in place of the rising one (23.871984112302016°).
function legacySaved(latitude = 78.2232, hour = 9): SavedChart {
  const fixture = legacyPolar.cases.find((row) => row.latitude === latitude && row.hour === hour);
  if (!fixture) throw new Error('Missing frozen legacy migration input');
  return {
    id: 'polar-regression', name: 'Kept chart name', relationship: 'self',
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z',
    birth: {
      date: '2001-12-21', time: `${String(hour).padStart(2, '0')}:00`, timeKnown: true,
      place: { name: 'Polar fixture', admin1: '', country: '', lat: latitude, lon: 15.6267, tz: 'UTC' },
    },
    summary: structuredClone(fixture.summary) as SavedChart['summary'],
  };
}

function freshChart(saved: SavedChart, houseSystem = saved.summary.houseSystem) {
  return engine.computeChart({
    utc: new Date(saved.summary.utcISO), latitude: saved.birth.place!.lat,
    longitude: saved.birth.place!.lon, houseSystem,
    timeKnown: saved.birth.timeKnown,
  });
}

/**
 * The current engine on the clock the frozen records used: the instant read as
 * UT1. From 0.1.1-rc.15 the engine reads 1972 to 2027-10-02 as UTC, through
 * IERS UT1 − UTC, which on 2001-12-21 was −0.12 s and turns the sidereal time
 * by about 1.8″; the repair keeps the recorded clock, so it is compared on it.
 */
function onRecordedClock(saved: SavedChart) {
  return natalChart({
    utc: saved.summary.utcISO, latitude: saved.birth.place!.lat, longitude: saved.birth.place!.lon,
    houseSystem: 'placidus', timeKnown: true, timeScale: 'ut1',
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('legacy polar saved-chart repair', () => {
  it('repairs the recorded setting intersection without altering identity or birth inputs', () => {
    const saved = legacySaved();
    const before = structuredClone(saved);
    const repaired = repairLegacyPolarChart(saved);
    expect(saved.summary.angles!.asc).toBeCloseTo(203.87198411230202, 10);
    expect(repaired.summary.angles!.asc).toBeCloseTo(23.871984112302016, 10);
    expect(repaired).toEqual({
      ...saved,
      summary: { ...saved.summary, engineVersion: POLAR_REPAIR_VERSION, angles: repaired.summary.angles },
    });
    expect(saved).toEqual(before);
    expect(repaired.birth).toBe(saved.birth);
    expect(repaired.summary.bodies).toBe(saved.summary.bodies);
    expect(repaired.summary.angles!.mc).toBe(saved.summary.angles!.mc);
    expect(repairLegacyPolarChart(repaired)).toBe(repaired);
    // The repaired receipt describes the old engine. The candidate version
    // must recompute known-time records rather than relabel that cached result.
    expect(currentSavedCalculation(repaired.summary.engineVersion)).toBe(false);
  });

  // The frozen 0.1.0 records carry angles on the mean obliquity. Since
  // 0.1.1-rc.7 the engine uses the true obliquity of date, which moves these
  // angles by at most 0.18″ (ASC) and 0.025″ (MC) over the two days below. The
  // repair corrects the 180° axis error; the obliquity is not its concern.
  // Since 0.1.1-rc.8 the engine's clock is observed ΔT, which on these days
  // is within 0.01 s of the formula 0.1.0 used and moves a body by at most
  // 0.005″ (the Moon); the repair keeps the recorded bodies. Since rc.15 the
  // engine reads these instants as UTC, not UT1, so the angles and bodies are
  // compared with it on the recorded clock (onRecordedClock), and the house
  // system and flags with the chart the site now makes.
  const arcsecondsApart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

  it.each([78.2232, -78.2232])('matches the current engine on the recorded clock throughout a day at %s°', (latitude) => {
    let repairedCount = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const saved = legacySaved(latitude, hour);
      const repaired = repairLegacyPolarChart(saved);
      const current = freshChart(saved, 'placidus');
      const recorded = onRecordedClock(saved);
      if (repaired !== saved) repairedCount += 1;
      expect(arcsecondsApart(repaired.summary.angles!.asc, recorded.angles!.asc)).toBeLessThan(0.5);
      expect(arcsecondsApart(repaired.summary.angles!.mc, recorded.angles!.mc)).toBeLessThan(0.05);
      expect(repaired.summary.bodies.map(({ body, retrograde }) => ({ body, retrograde })))
        .toEqual(current.bodies.map(({ body, retrograde }) => ({ body, retrograde })));
      repaired.summary.bodies.forEach(({ lon }, index) => expect(arcsecondsApart(lon, recorded.bodies[index].lon)).toBeLessThan(0.01));
      expect(repaired.summary.houseSystem).toBe(current.houses!.system);
      expect(repaired.summary.flags).toEqual(current.flags);
    }
    expect(repairedCount).toBeGreaterThan(0);
  });

  it('does not alter an already-correct current polar chart', () => {
    const saved = legacySaved();
    const current = freshChart(saved);
    saved.summary.angles = { asc: current.angles!.asc, mc: current.angles!.mc };
    saved.summary.engineVersion = current.engineVersion;
    expect(saved.summary.engineVersion).toBe(ENGINE_VERSION);
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it.each([0, 13.7563, 66, -66, 91, -91, Number.NaN])('does not repair a latitude outside the known defect range: %s', (latitude) => {
    const saved = legacySaved();
    saved.birth.place!.lat = latitude;
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it('does not change an ordinary nonpolar chart', () => {
    const saved = legacySaved(13.7563);
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it('requires the setting-intersection signature, not just polar latitude', () => {
    const saved = legacySaved(78.2232, 0);
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it.each([
    { asc: Number.NaN, mc: 200 }, { asc: 200, mc: Number.NaN },
    { asc: -1, mc: 200 }, { asc: 360, mc: 200 }, { asc: 200, mc: 360 },
  ])('does not treat malformed angles as a repairable legacy record: %j', (angles) => {
    const saved = legacySaved();
    saved.summary.angles = angles;
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it('leaves malformed legacy records alone rather than breaking the profile read', () => {
    const saved = legacySaved();
    saved.birth.time = '25:00';
    expect(repairLegacyPolarChart(saved)).toBe(saved);
    saved.birth.time = '09:00';
    delete (saved.summary as Partial<SavedChart['summary']>).flags;
    expect(repairLegacyPolarChart(saved)).toBe(saved);
    expect(repairLegacyPolarChart(null as unknown as SavedChart)).toBeNull();
  });

  it.each(['older', '0.2.0', POLAR_REPAIR_VERSION])('does not apply the 0.1.0 repair to receipt %s', (version) => {
    const saved = legacySaved();
    saved.summary.engineVersion = version;
    expect(repairLegacyPolarChart(saved)).toBe(saved);
  });

  it('adds the same whole-sign fallback if an old summary retained requested Placidus', () => {
    const saved = legacySaved();
    saved.summary.houseSystem = 'placidus';
    saved.summary.flags = [];
    const repaired = repairLegacyPolarChart(saved);
    expect(repaired.summary.houseSystem).toBe('whole');
    expect(repaired.summary.flags).toEqual(['polar-fallback']);
  });

  it('does not infer missing angles, time, or place', async () => {
    const loader = vi.fn(async () => { throw new Error('must not load'); });
    const positionsOnly = legacySaved();
    positionsOnly.birth.place = null;
    expect(repairLegacyPolarChart(positionsOnly)).toBe(positionsOnly);
    expect((await resolveSavedChart(positionsOnly, loader)).summary).toBe(positionsOnly.summary);
    expect(loader).not.toHaveBeenCalled();
    const unknownTime = legacySaved();
    unknownTime.birth.timeKnown = false;
    unknownTime.birth.time = null;
    unknownTime.summary.angles = null;
    unknownTime.summary.flags = ['no-time'];
    // Current unknown-time records need no refresh. Stale unknown-time
    // recomputation is covered separately and must remain angle-free.
    unknownTime.summary.engineVersion = ENGINE_VERSION;
    expect(repairLegacyPolarChart(unknownTime)).toBe(unknownTime);
    expect((await resolveSavedChart(unknownTime, loader)).asc).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    const noAngles = legacySaved();
    noAngles.summary.angles = null;
    expect(repairLegacyPolarChart(noAngles)).toBe(noAngles);
  });

  it('repairs a restored profile on read without writing storage or requiring network access', () => {
    const saved = legacySaved();
    const raw = JSON.stringify({ ...EMPTY_PROFILE, charts: [saved] });
    const storage = { getItem: vi.fn((key: string) => key === PROFILE_KEY ? raw : null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    const restored = loadProfile().charts[0];
    expect(restored).toEqual(repairLegacyPolarChart(saved));
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(JSON.parse(raw).charts[0]).toEqual(saved);
  });

  it.each([
    { date: '2001-02-29', time: '09:00' },
    { date: '2001-12-21', time: '24:00' },
  ])('keeps an invalid stored birth input without recomputing a different instant: %j', async (input) => {
    const saved = legacySaved(13.7563);
    Object.assign(saved.birth, input);
    const before = structuredClone(saved);
    const computeChart = vi.fn(engine.computeChart);
    const resolved = await resolveSavedChart(saved, async () => ({ computeChart }));
    expect(computeChart).not.toHaveBeenCalled();
    expect(resolved.summary).toBe(saved.summary);
    expect(saved).toEqual(before);
    expect(resolved.summary.engineVersion).not.toBe(ENGINE_VERSION);
  });

  it.each([undefined, '', 'Synthetic/Private_Zone'])('keeps a stored receipt when its timezone is unavailable: %s', async (tz) => {
    const saved = legacySaved(13.7563);
    saved.birth.place!.tz = tz as string;
    const before = structuredClone(saved);
    const computeChart = vi.fn(engine.computeChart);
    const resolved = await resolveSavedChart(saved, async () => ({ computeChart }));
    expect(computeChart).not.toHaveBeenCalled();
    expect(resolved.summary).toBe(saved.summary);
    expect(saved).toEqual(before);
    expect(resolved.summary.engineVersion).not.toBe(ENGINE_VERSION);
  });

  it('does not hide the other saved charts when one legacy record is unfamiliar', () => {
    const ordinary = legacySaved(13.7563);
    ordinary.id = 'ordinary';
    const unfamiliar = legacySaved();
    unfamiliar.summary.houseSystem = 'placidus';
    delete (unfamiliar.summary as Partial<SavedChart['summary']>).flags;
    const repairable = legacySaved();
    repairable.id = 'repairable';
    const raw = JSON.stringify({ ...EMPTY_PROFILE, charts: [ordinary, unfamiliar, repairable] });
    const storage = { getItem: (key: string) => key === PROFILE_KEY ? raw : null, setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    expect(loadProfile().charts).toEqual([ordinary, unfamiliar, repairLegacyPolarChart(repairable)]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('invalidates scans computed from the old ASC even when their timestamps are fresh', () => {
    const saved = legacySaved();
    const repaired = repairLegacyPolarChart(saved);
    const now = new Date('2026-09-04T12:00:00Z');
    const cache = { engineVersion: saved.summary.engineVersion, computedAt: now.toISOString() } as YearScanCache;
    expect(yearCacheFresh(cache, saved.summary.engineVersion, now)).toBe(true);
    expect(yearCacheFresh(cache, repaired.summary.engineVersion, now)).toBe(false);
    expect(yearCacheFresh({ ...cache, engineVersion: repaired.summary.engineVersion }, repaired.summary.engineVersion, now)).toBe(true);
  });
});

describe('saved comparison calculation coherence', () => {
  it('recomputes the legacy receipt consistently throughout the wheel and positions share', async () => {
    const saved = legacySaved();
    const loader = vi.fn(async () => engine);
    const current = freshChart(saved);
    const profileSummary = {
      bodies: current.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
      angles: { asc: current.angles!.asc, mc: current.angles!.mc },
      houseSystem: current.houses!.system,
      engineVersion: current.engineVersion,
    };
    const person = await resolveSaved(saved, loader);
    expect(person.label).toBe(saved.name);
    expect(person.asc).toBe(profileSummary.angles!.asc);
    expect(person.wheel.mc).toBe(profileSummary.angles!.mc);
    expect(person.wheel.bodies).toEqual(profileSummary.bodies);
    expect(person.positions).toEqual({
      bodies: profileSummary.bodies.map(({ body, lon }) => ({ body, lon })),
      angles: profileSummary.angles,
      houseSystem: profileSummary.houseSystem,
      engineVersion: profileSummary.engineVersion,
    });
    expect(loader).toHaveBeenCalledOnce();
  });

  it('uses one newly computed record instead of pairing new bodies with old angles, marks, or version', async () => {
    const saved = legacySaved(13.7563);
    saved.summary.engineVersion = 'old';
    saved.summary.bodies = saved.summary.bodies.map((body) => ({ ...body, lon: 0, retrograde: !body.retrograde }));
    saved.summary.angles = { asc: 0, mc: 0 };
    const current = freshChart(saved);
    const person = await resolveSaved(saved, async () => engine);
    expect(person.bodies).toEqual(current.bodies.map(({ body, lon }) => ({ body, lon })));
    expect(person.wheel.bodies).toEqual(current.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })));
    expect(person.asc).toBe(current.angles!.asc);
    expect(person.wheel.mc).toBe(current.angles!.mc);
    expect(person.positions.angles).toEqual({ asc: current.angles!.asc, mc: current.angles!.mc });
    expect(person.positions.houseSystem).toBe(current.houses!.system);
    expect(person.positions.engineVersion).toBe(current.engineVersion);
    expect(saved.summary.engineVersion).toBe('old');
    expect(saved.summary.angles).toEqual({ asc: 0, mc: 0 });
  });

  it('compares the recomputed summary without writing the saved chart back', async () => {
    const saved = legacySaved();
    const stored = JSON.stringify({ ...EMPTY_PROFILE, charts: [saved] });
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === PROFILE_KEY ? stored : null),
      setItem,
    });
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });

    const person = await resolveSaved(loadProfile().charts[0], async () => engine);

    expect(person.positions.engineVersion).toBe(ENGINE_VERSION);
    expect(person.asc).toBeCloseTo(23.872, 3);
    expect(setItem).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('keeps positions-only comparisons unchanged and never fabricates a house ring or latitude', async () => {
    const saved = legacySaved();
    saved.birth.place = null;
    const loader = vi.fn(async () => engine);
    const person = await resolveSaved(saved, loader);
    expect(person.positions.angles).toBe(saved.summary.angles);
    expect(person.positions.engineVersion).toBe(saved.summary.engineVersion);
    expect(person.wheel.cusps).toBeNull();
    expect(person.depth).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it('keeps unknown-time recomputation angle-free', async () => {
    const saved = legacySaved();
    saved.birth.timeKnown = false;
    saved.birth.time = null;
    saved.summary.engineVersion = 'old';
    const person = await resolveSaved(saved, async () => engine);
    expect(person.timeKnown).toBe(false);
    expect(person.asc).toBeNull();
    expect(person.wheel.mc).toBeNull();
    expect(person.positions.angles).toBeNull();
    expect(person.positions.engineVersion).toBe(ENGINE_VERSION);
  });
});
