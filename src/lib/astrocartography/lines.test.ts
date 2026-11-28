import { describe, expect, it } from 'vitest';
import { tilt, timeBasis } from '@zodiacs/engine/time';
import { computeChart } from '../engine/full.js';
import { distanceToPolylineKm, horizonLine, horizonLongitude, lineDistances, ramcFromMc, wrapLongitude, type EquatorialBody } from './lines';
import { equatorialMoment } from './positions';

const DEG = Math.PI / 180;

/** The sidereal time that puts a body's rising line exactly on a longitude at a latitude. */
function gastPutting(body: Pick<EquatorialBody, 'ra' | 'dec'>, latitude: number, longitude: number): number {
  const h0 = Math.acos(-Math.tan(latitude * DEG) * Math.tan(body.dec * DEG)) / DEG;
  return body.ra - h0 - longitude;
}

describe('distance to a rising or setting line across the date line', () => {
  const venus: EquatorialBody = { body: 'Venus', ra: 30, dec: 20 };

  // Latitudes between the samples the lines are measured on, where the error was largest.
  const LATITUDES = [10.13, -24.37, 41.06, 55.55, 3.3];

  it.each(LATITUDES)('finds a place exactly on the line at the date line, at latitude %s, on the line', (latitude) => {
    for (const side of [180, -179.9999, 179.9999]) {
      const gast = gastPutting(venus, latitude, side);
      const lon = horizonLongitude(venus, gast, latitude, 'ASC')!;
      expect(Math.abs(wrapLongitude(lon - side))).toBeLessThan(1e-9);
      const row = lineDistances({ lat: latitude, lon }, [venus], gast).find((entry) => entry.angle === 'ASC')!;
      expect(row.km, `${latitude} ${side}`).toBeLessThan(0.05);
    }
  });

  it('measures the same distance at the date line as on the same line shifted to Greenwich', () => {
    for (const latitude of LATITUDES) {
      for (const offset of [0, 0.3, -0.7]) {
        const gast = gastPutting(venus, latitude, 180);
        const place = { lat: latitude + offset, lon: 180 };
        const shifted = { lat: latitude + offset, lon: 0 };
        const atDateLine = lineDistances(place, [venus], gast).find((entry) => entry.angle === 'ASC')!.km;
        const atGreenwich = lineDistances(shifted, [venus], gast - 180).find((entry) => entry.angle === 'ASC')!.km;
        expect(Math.abs(atDateLine - atGreenwich), `${latitude} ${offset}`).toBeLessThan(0.01);
      }
    }
  });

  it('refines a segment whose ends sit either side of the date line', () => {
    // Two samples a quarter degree of latitude apart, one at 179.95 east and one at 179.95 west.
    const line = [{ lat: 10, lon: 179.95 }, { lat: 10.25, lon: -179.95 }];
    const midpoint = { lat: 10.125, lon: 180 };
    expect(distanceToPolylineKm(midpoint, line)).toBeLessThan(0.05);
    // The lines the distances are measured on do wrap there: horizonLine's own samples jump from 180 to -180.
    const gast = gastPutting(venus, 10.13, 180);
    const drawn = horizonLine(venus, gast, 'ASC', 0.25, 89.9);
    const crossing = drawn.findIndex((point, index) => index > 0 && Math.abs(point.lon - drawn[index - 1].lon) > 180);
    expect(crossing).toBeGreaterThan(0);
  });

  it('reaches the grazing-latitude endpoint where rising and setting meet (0 km error)', () => {
    const body: EquatorialBody = { body: 'Sun', ra: 90, dec: 23 };
    const gast = 0;
    const grazingLat = 67; // 90 - |dec|
    const ascLon = horizonLongitude(body, gast, grazingLat, 'ASC');
    const dscLon = horizonLongitude(body, gast, grazingLat, 'DSC');
    expect(ascLon).not.toBeNull();
    expect(dscLon).not.toBeNull();
    expect(ascLon!).toBeCloseTo(dscLon!, 9);
    const rows = lineDistances({ lat: grazingLat, lon: ascLon! }, [body], gast);
    expect(rows.find((entry) => entry.angle === 'ASC')!.km).toBeLessThan(0.05);
    expect(rows.find((entry) => entry.angle === 'DSC')!.km).toBeLessThan(0.05);
  });

  it('uses true obliquity of date in equatorialMoment to match the engine angles', () => {
    const utc = new Date('2026-06-21T12:00:00Z');
    const moment = equatorialMoment(utc);
    const chart = computeChart({ utc, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
    const trueObliquity = tilt(timeBasis(utc.getTime()).ttDays).tobl;
    expect(moment.gast).toBeCloseTo(ramcFromMc(chart.angles!.mc, trueObliquity), 9);
  });
});
