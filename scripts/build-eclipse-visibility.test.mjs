/**
 * Holds src/data/eclipse-visibility.json (scripts/build-eclipse-visibility.mjs)
 * to NASA's published eclipse predictions (Fred Espenak, NASA GSFC), saved in
 * scripts/fixtures/eclipse-visibility/nasa-reference.json with their
 * addresses and SHA-256: the greatest-eclipse point and every central-line
 * point of eight central solar eclipses, the length of each lunar eclipse's
 * umbral phase, and named places inside and outside the regions NASA's decade
 * tables describe. It also checks the shadow-axis construction against
 * astronomy-engine's own greatest-eclipse point.
 */
import './lib/deltat-install.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MakeTime, SearchGlobalSolarEclipse } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { shadowAxisPoint } from './lib/eclipse-shadow.mjs';

const root = resolve(import.meta.dirname, '..');
const data = JSON.parse(readFileSync(resolve(root, 'src/data/eclipse-visibility.json'), 'utf8'));
const land = JSON.parse(readFileSync(resolve(root, 'src/data/astrocartography-land.json'), 'utf8'));
const eclipses = JSON.parse(readFileSync(resolve(root, 'src/data/eclipses.json'), 'utf8')).eclipses;
const nasa = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/eclipse-visibility/nasa-reference.json'), 'utf8'));

const DEG = Math.PI / 180;
const EARTH_KM = 6371;
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const isoDate = (nasaDate) => { const [y, m, d] = nasaDate.split(' '); return `${y}-${MONTHS[m]}-${d}`; };
const byDate = (date, type) => data.eclipses.find((e) => e.peak.startsWith(date) && e.type === type);

function km(a, b) {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance from a place to the drawn central path, in km (each segment cut into 1 km steps). */
function kmToPath(place, path) {
  let best = Infinity;
  for (const seg of path.segments) {
    for (let i = 1; i < seg.length; i += 1) {
      const a = { lon: seg[i - 1][0], lat: seg[i - 1][1] };
      const b = { lon: seg[i][0], lat: seg[i][1] };
      const steps = Math.max(1, Math.ceil(km(a, b)));
      for (let s = 0; s <= steps; s += 1) {
        const u = s / steps;
        best = Math.min(best, km(place, { lat: a.lat + (b.lat - a.lat) * u, lon: a.lon + (b.lon - a.lon) * u }));
      }
    }
  }
  return best;
}

/** Whether the land cell holding a place sees the eclipse; throws when no land cell holds it. */
function sees(eclipse, place) {
  const row = Math.floor((place.lat + 90) / land.cellDegrees);
  const col = Math.floor((place.lon + 180) / land.cellDegrees);
  const index = land.cells.findIndex(([r, c]) => r === row && c === col);
  if (index < 0) throw new Error(`no land cell holds ${place.name}`);
  const bytes = Buffer.from(eclipse.visible, 'base64');
  return (bytes[index >> 3] & (0x80 >> (index & 7))) !== 0;
}

const P = (name, lat, lon) => ({ name, lat, lon });
// Places well inside or well outside the regions NASA's decade tables give (quoted in the fixture).
const PLACES = {
  '2026-08-12 solar': {
    inside: [P('Reykjavik', 64.15, -21.94), P('Madrid', 40.42, -3.70), P('London', 51.51, -0.13), P('Dakar', 14.69, -17.44), P('Montreal', 45.50, -73.57)],
    outside: [P('Sydney', -33.87, 151.21), P('Tokyo', 35.69, 139.69), P('Buenos Aires', -34.60, -58.38), P('Johannesburg', -26.20, 28.05)],
  },
  '2027-08-02 solar': {
    inside: [P('Luxor', 25.69, 32.64), P('Cairo', 30.04, 31.24), P('Jeddah', 21.49, 39.19), P('Madrid', 40.42, -3.70), P('Mumbai', 19.08, 72.88), P('Nairobi', -1.29, 36.82)],
    outside: [P('Tokyo', 35.69, 139.69), P('Sydney', -33.87, 151.21), P('Buenos Aires', -34.60, -58.38), P('Los Angeles', 34.05, -118.24)],
  },
  '2028-07-22 solar': {
    inside: [P('Sydney', -33.87, 151.21), P('Perth', -31.95, 115.86), P('Auckland', -36.85, 174.76), P('Jakarta', -6.21, 106.85)],
    outside: [P('London', 51.51, -0.13), P('New York', 40.71, -74.01), P('Cairo', 30.04, 31.24), P('Buenos Aires', -34.60, -58.38)],
  },
  '2029-01-14 solar': {
    inside: [P('Mexico City', 19.43, -99.13), P('Chicago', 41.88, -87.63), P('Los Angeles', 34.05, -118.24), P('Guatemala City', 14.63, -90.51)],
    outside: [P('London', 51.51, -0.13), P('Tokyo', 35.69, 139.69), P('Sydney', -33.87, 151.21), P('Lima', -12.05, -77.04)],
  },
  '2030-06-01 solar': {
    inside: [P('Athens', 37.98, 23.73), P('Moscow', 55.76, 37.62), P('Beijing', 39.90, 116.40), P('Tunis', 36.81, 10.18), P('Tokyo', 35.69, 139.69)],
    outside: [P('Sydney', -33.87, 151.21), P('Buenos Aires', -34.60, -58.38), P('Johannesburg', -26.20, 28.05), P('Mexico City', 19.43, -99.13)],
  },
  '2026-03-03 lunar': {
    inside: [P('Tokyo', 35.69, 139.69), P('Sydney', -33.87, 151.21), P('Los Angeles', 34.05, -118.24), P('Honolulu', 21.31, -157.86), P('Lima', -12.05, -77.04)],
    outside: [P('London', 51.51, -0.13), P('Cairo', 30.04, 31.24), P('Lagos', 6.52, 3.38), P('Paris', 48.86, 2.35)],
  },
  '2028-12-31 lunar': {
    inside: [P('Paris', 48.86, 2.35), P('Delhi', 28.61, 77.21), P('Tokyo', 35.69, 139.69), P('Sydney', -33.87, 151.21), P('Nairobi', -1.29, 36.82)],
    outside: [P('Buenos Aires', -34.60, -58.38), P('Lima', -12.05, -77.04), P('Mexico City', 19.43, -99.13)],
  },
  '2029-06-26 lunar': {
    inside: [P('Buenos Aires', -34.60, -58.38), P('New York', 40.71, -74.01), P('Lagos', 6.52, 3.38), P('Madrid', 40.42, -3.70)],
    outside: [P('Tokyo', 35.69, 139.69), P('Sydney', -33.87, 151.21), P('Beijing', 39.90, 116.40)],
  },
};

describe('eclipse visibility data', () => {
  it('covers every eclipse the page lists, in order, on the current land cells', () => {
    expect(data.eclipses.map((e) => `${e.type} ${e.kind} ${e.peak}`)).toEqual(eclipses.map((e) => `${e.type} ${e.kind} ${e.peak}`));
    expect(data.land.cells).toBe(land.cells.length);
    for (const e of data.eclipses) {
      const bytes = Buffer.from(e.visible, 'base64');
      expect(bytes.length).toBe(Math.ceil(land.cells.length / 8));
      const count = [...bytes].reduce((n, b) => n + b.toString(2).split('1').length - 1, 0);
      expect(e.sweep).toMatch(new RegExp(`^[0-7]{${count}}$`));
      expect(e.regions.reduce((n, r) => n + r[1], 0)).toBeLessThanOrEqual(count);
    }
  });

  it('builds the shadow axis exactly as astronomy-engine builds its greatest-eclipse point', () => {
    for (const e of data.eclipses.filter((x) => x.type === 'solar' && x.kind !== 'partial')) {
      const global = SearchGlobalSolarEclipse(MakeTime(new Date(Date.parse(e.peak) - 86400000)));
      const p = shadowAxisPoint(global.peak);
      expect(Math.abs(p.lat - global.latitude)).toBeLessThan(1e-9);
      expect(Math.abs(p.lon - global.longitude)).toBeLessThan(1e-9);
      expect(e.greatest.lat).toBeCloseTo(global.latitude, 3);
      expect(e.greatest.lon).toBeCloseTo(global.longitude, 3);
    }
  });

  // Tolerances: 10 km for the greatest-eclipse point and 10 km from every NASA central-line point to the drawn
  // path. NASA's predictions use their own ephemerides and a predicted Delta T; the drawn path keeps a point
  // every quarter degree, so its straight pieces stray from the true line by well under a kilometre.
  for (const ref of nasa.paths) {
    const date = isoDate(ref.date);
    it(`matches NASA's greatest eclipse and central line for ${date}`, () => {
      const e = byDate(date, 'solar');
      expect(e, date).toBeTruthy();
      expect(km(e.greatest, ref.greatest)).toBeLessThan(10);
      expect(ref.centralLine.length).toBeGreaterThan(20);
      for (const row of ref.centralLine) {
        expect(kmToPath(row, e.path), `${date} ${row.time}`).toBeLessThan(10);
      }
    });
  }

  // Two minutes, or 5% for a shallow eclipse (2028-01-12 dips 0.066 of the Moon's diameter into the umbra), whose
  // umbral phase lengthens or shortens by minutes with the smallest change in the shadow's assumed size. The
  // table gives whole minutes.
  it("matches the length of each lunar eclipse's umbral phase in NASA's decade table", () => {
    for (const [date, [type, minutes]] of Object.entries(nasa.lunarDecade.eclipses)) {
      const e = byDate(date, 'lunar');
      expect(e, date).toBeTruthy();
      expect(e.kind).toBe(type.toLowerCase());
      if (minutes === null) { expect(e.phase).toBe('penumbral'); continue; }
      expect(e.phase).toBe('umbral');
      const length = (Date.parse(e.to) - Date.parse(e.from)) / 60000;
      expect(Math.abs(length - minutes), date).toBeLessThanOrEqual(Math.max(2, minutes * 0.05));
    }
  });

  for (const [key, { inside, outside }] of Object.entries(PLACES)) {
    const [date, type] = key.split(' ');
    it(`places inside and outside the ${key} eclipse's region, as NASA describes it`, () => {
      const e = byDate(date, type);
      expect(type === 'solar' ? nasa.solarDecade.regions[date] : nasa.lunarDecade.eclipses[date]).toBeTruthy();
      for (const place of inside) expect(sees(e, place), `${place.name} should see ${key}`).toBe(true);
      for (const place of outside) expect(sees(e, place), `${place.name} should not see ${key}`).toBe(false);
    });
  }
});
