import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../scripts/lib/deltat-install.mjs';
import { SiderealTime } from 'astronomy-engine';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { computeChart } from '@zodiacs/engine/internal';
import { repairLegacyPolarChart, POLAR_REPAIR_VERSION } from '../src/lib/profile/polar-repair';
import { resolveSavedChart } from '../src/lib/profile/resolve';
import { legacyPolarFixture } from './legacy-polar-fixture.mjs';

const readJSON = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const frozen = readJSON('./fixtures/legacy-polar-browser.json');
const hourly = readJSON('../src/lib/engine/fixtures/legacy-polar-saved.json');

describe('frozen browser inputs for legacy polar migration', () => {
  it('records the immutable archive and retains all 96 quarter-hour samples', () => {
    const archive = readFileSync(new URL('../vendor/zodiacs-engine-0.1.0.tgz', import.meta.url));
    expect(frozen.artifactSHA256).toBe(createHash('sha256').update(archive).digest('hex'));
    expect(frozen.artifactSHA256).toBe(hourly.artifactSHA256);
    expect(frozen.ephemeris.version).toBe('2.1.19');
    expect(frozen.cases.map(({ minutes }) => minutes)).toEqual(Array.from({ length: 96 }, (_, index) => index * 15));
    for (const { minutes, summary } of frozen.cases) {
      const fixture = legacyPolarFixture(minutes);
      expect(fixture.legacy).toEqual(summary);
      expect(summary.engineVersion).toBe('0.1.0');
      expect(summary.utcISO).toBe(new Date(Date.UTC(2001, 11, 21, 0, minutes)).toISOString());
      expect(summary.bodies).toHaveLength(12);
      expect(fixture.polar.birth.time).toBe(summary.utcISO.slice(11, 16));
    }
  });

  it('matches every overlapping input from the original migration corpus exactly', () => {
    const north = hourly.cases.filter(({ latitude }) => latitude === frozen.input.latitude);
    expect(north).toHaveLength(24);
    for (const { hour, summary } of north) {
      expect(legacyPolarFixture(hour * 60).polar.summary).toEqual(summary);
    }
  });

  it('keeps the original failure despite the installed engine upgrade', () => {
    const fixture = legacyPolarFixture();
    expect(fixture.legacy.engineVersion).toBe('0.1.0');
    expect(fixture.legacy.angles.asc).toBe(203.87198411230202);
    expect(fixture.correctedAsc).toBe(23.871984112302016);
    expect(fixture.positionsOnly.summary).toEqual(fixture.polar.summary);
    expect(fixture.positionsOnly.birth.place).toBeNull();
  });

  it('uses the rising intersection throughout the day, including already-correct samples', () => {
    const radians = Math.PI / 180;
    // Independent east-vector check: r = (cos λ, sin λ cos ε, sin λ sin ε),
    // east = (-sin θ, cos θ, 0). A rising point has east · r > 0.
    // 23.439° approximates this day's obliquity sufficiently for branch sign;
    // these quarter-hour inputs do not include a tangent or singular point.
    const epsilon = 23.439 * radians;
    let reversals = 0;
    for (let minutes = 0; minutes < 1440; minutes += 15) {
      const fixture = legacyPolarFixture(minutes);
      const theta = (SiderealTime(new Date(fixture.legacy.utcISO)) * 15 + frozen.input.longitude) * radians;
      const lambda = fixture.correctedAsc * radians;
      const east = -Math.sin(theta) * Math.cos(lambda) + Math.cos(theta) * Math.sin(lambda) * Math.cos(epsilon);
      expect(east).toBeGreaterThan(0);
      if (fixture.correctedAsc !== fixture.legacy.angles.asc) reversals += 1;
    }
    expect(reversals).toBeGreaterThan(0);
    expect(reversals).toBeLessThan(96);
    expect(legacyPolarFixture(0).correctedAsc).toBe(legacyPolarFixture(0).legacy.angles.asc);
  });

  it('does not let one browser fixture mutate later historical inputs', () => {
    const original = legacyPolarFixture();
    const changed = legacyPolarFixture();
    changed.polar.summary.angles.asc = 1;
    changed.polar.summary.bodies[0].lon = 2;
    changed.positionsOnly.summary.bodies[1].lon = 3;
    changed.legacy.bodies[2].lon = 4;
    expect(legacyPolarFixture()).toEqual(original);
  });

  it('preserves original birth, identity, timestamps and bytes while issuing a current calculation receipt', async () => {
    const fixture = legacyPolarFixture();
    const before = structuredClone(fixture.profile);
    const repaired = repairLegacyPolarChart(fixture.polar);
    expect(repaired).toEqual({
      ...fixture.polar,
      summary: { ...fixture.polar.summary, engineVersion: POLAR_REPAIR_VERSION, angles: { ...fixture.legacy.angles, asc: fixture.correctedAsc } },
    });
    expect(repaired.birth).toBe(fixture.polar.birth);

    const resolved = await resolveSavedChart(fixture.polar, async () => ({ computeChart }));
    const current = computeChart({ utc: new Date(fixture.legacy.utcISO), latitude: frozen.input.latitude,
      longitude: frozen.input.longitude, houseSystem: 'whole', timeKnown: true });
    expect(resolved.summary.engineVersion).toBe(ENGINE_VERSION);
    expect(resolved.summary.engineVersion).not.toBe(fixture.legacy.engineVersion);
    expect(resolved.summary.angles).toEqual({ asc: current.angles.asc, mc: current.angles.mc });
    // The same rising intersection as the repair. Since 0.1.1-rc.7 the engine
    // builds it on the true obliquity where 0.1.0 used the mean, so the two
    // agree to 0.16″ here rather than to the last digit, on the clock 0.1.0
    // used. Since rc.15 the engine reads 2001 as UTC through IERS UT1 − UTC,
    // −0.12 s that day, so the comparison reads the instant as UT1 as 0.1.0 did.
    const onRecordedClock = computeChart({ utc: new Date(fixture.legacy.utcISO), latitude: frozen.input.latitude,
      longitude: frozen.input.longitude, houseSystem: 'whole', timeKnown: true, timeScale: 'ut1' });
    const arcsecondsApart = Math.abs(((onRecordedClock.angles.asc - fixture.correctedAsc + 540) % 360) - 180) * 3600;
    expect(arcsecondsApart).toBeLessThan(0.5);
    expect(resolved.summary.bodies).toEqual(current.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })));
    expect(resolved.summary.houseSystem).toBe(current.houses.system);
    expect(resolved.summary.flags).toEqual(current.flags);

    const positionsOnly = await resolveSavedChart(fixture.positionsOnly, async () => { throw new Error('Positions-only inputs must not recompute'); });
    expect(positionsOnly.summary).toBe(fixture.positionsOnly.summary);
    expect(positionsOnly.summary.engineVersion).toBe('0.1.0');
    expect(fixture.profile).toEqual(before);
    expect(JSON.stringify(fixture.profile, null, 2)).toBe(fixture.raw);
  });

  it.each([NaN, Infinity, -15, 1440, 1, 7.5, '540', null])('rejects an unavailable sample instead of inventing legacy data: %s', (minutes) => {
    expect(() => legacyPolarFixture(minutes)).toThrow(RangeError);
  });
});
