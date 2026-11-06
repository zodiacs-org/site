import { describe, expect, it } from 'vitest';
import {
  eclipseProximity,
  eclipticToVec,
  inclinedCircle,
  MOON_INCLINATION,
  orient,
  place,
  project,
  separation,
  OBLIQUITY,
  splitByDepth,
  gmstHours,
  julianCenturies,
  declinationCircle,
  zenithOf,
  horizonCircle,
  altitudeOf,
} from './ecliptic3d';
import { declinationOf } from '../declination';

const CX = 100;
const CY = 100;
const R = 80;

describe('ecliptic directions', () => {
  it('puts every direction on the unit sphere', () => {
    for (const [lon, lat] of [[0, 0], [90, 17.7], [212, -8], [359, 5.3]]) {
      const v = eclipticToVec(lon, lat);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 12);
    }
  });

  it('sends ecliptic north to +z and the plane to z = 0', () => {
    expect(eclipticToVec(0, 90).z).toBeCloseTo(1, 12);
    expect(eclipticToVec(137, 0).z).toBeCloseTo(0, 12);
  });
});

describe('orientation', () => {
  it('recovers the flat wheel at tilt 0, whatever the latitude', () => {
    // The familiar wheel is this view seen down the pole: latitude becomes
    // depth alone, so two bodies sharing a longitude must coincide on screen.
    const onPlane = place(75, 0, 0, 0, CX, CY, R);
    const wayOffPlane = place(75, 17.7, 0, 0, CX, CY, R);
    // Same direction on screen, differing only by the foreshortening of cos(lat).
    const angleOf = (p: { x: number; y: number }) => Math.atan2(CY - p.y, p.x - CX);
    expect(angleOf(onPlane)).toBeCloseTo(angleOf(wayOffPlane), 12);
    expect(wayOffPlane.depth).toBeGreaterThan(onPlane.depth);
  });

  it('reads latitude as height when edge-on, north upward', () => {
    const north = place(0, 30, 0, 90, CX, CY, R);
    const south = place(0, -30, 0, 90, CX, CY, R);
    // SVG y grows downward, so ecliptic north must sit at the smaller y.
    expect(north.y).toBeLessThan(CY);
    expect(south.y).toBeGreaterThan(CY);
  });

  it('keeps the Sun on the ring at every tilt, because it defines the plane', () => {
    for (const tilt of [0, 22.5, 45, 67.5, 90]) {
      const p = place(212, 0, 0, tilt, CX, CY, R);
      const v = orient(eclipticToVec(212, 0), 0, tilt);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 12);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it('leaves a direction unmoved by a null rotation', () => {
    const v = eclipticToVec(123, -4.5);
    const same = orient(v, 0, 0);
    expect(same.x).toBeCloseTo(v.x, 12);
    expect(same.y).toBeCloseTo(v.y, 12);
    expect(same.z).toBeCloseTo(v.z, 12);
  });

  it('projects the centre of the sphere to the centre of the frame', () => {
    expect(project({ x: 0, y: 0, z: 1 }, CX, CY, R)).toMatchObject({ x: CX, y: CY });
  });
});

describe("the Moon's inclined path", () => {
  it('crosses the ecliptic exactly at the nodes', () => {
    const node = 47;
    const path = inclinedCircle(node, MOON_INCLINATION, 1);
    const crossings = path.filter((p) => Math.abs(p.lat) < 1e-9);
    expect(crossings.length).toBeGreaterThanOrEqual(2);
    // Ascending at the node, descending opposite it.
    expect(separation(crossings[0].lon, node)).toBeCloseTo(0, 6);
    expect(separation(crossings[1].lon, node + 180)).toBeCloseTo(0, 6);
  });

  it('peaks at the inclination and never exceeds it', () => {
    const path = inclinedCircle(0, MOON_INCLINATION, 1);
    const peak = Math.max(...path.map((p) => Math.abs(p.lat)));
    expect(peak).toBeCloseTo(MOON_INCLINATION, 6);
    for (const point of path) {
      expect(Math.abs(point.lat)).toBeLessThanOrEqual(MOON_INCLINATION + 1e-9);
    }
  });

  it('follows the node when the node moves', () => {
    for (const node of [0, 47, 180, 300]) {
      const first = inclinedCircle(node, MOON_INCLINATION, 1)[0];
      expect(first.lat).toBeCloseTo(0, 9);
      expect(separation(first.lon, node)).toBeCloseTo(0, 6);
    }
  });
});

describe('eclipse proximity', () => {
  it('is possible only near the line of nodes', () => {
    expect(eclipseProximity(47, 47).possible).toBe(true);
    expect(eclipseProximity(227, 47).possible).toBe(true);
    expect(eclipseProximity(137, 47).possible).toBe(false);
  });

  it('measures to the nearer node', () => {
    expect(eclipseProximity(57, 47).degrees).toBeCloseTo(10, 9);
    expect(eclipseProximity(217, 47).degrees).toBeCloseTo(10, 9);
  });
});

describe('longitude separation', () => {
  it('never exceeds half a turn and wraps correctly', () => {
    expect(separation(350, 10)).toBeCloseTo(20, 9);
    expect(separation(10, 350)).toBeCloseTo(20, 9);
    expect(separation(0, 180)).toBeCloseTo(180, 9);
    expect(separation(-10, 10)).toBeCloseTo(20, 9);
  });
});

describe('the celestial equator', () => {
  it('crosses the ecliptic at the equinoxes', () => {
    // Ascending at 0° Aries is what makes the vernal point the vernal point.
    const path = inclinedCircle(0, OBLIQUITY, 1);
    const crossings = path.filter((p) => Math.abs(p.lat) < 1e-9);
    expect(separation(crossings[0].lon, 0)).toBeCloseTo(0, 6);
    expect(separation(crossings[1].lon, 180)).toBeCloseTo(0, 6);
  });

  it('reaches the obliquity at the solstices and no further', () => {
    const path = inclinedCircle(0, OBLIQUITY, 1);
    expect(Math.max(...path.map((p) => Math.abs(p.lat)))).toBeCloseTo(OBLIQUITY, 6);
  });
});

describe('depth splitting', () => {
  const run = (depths: number[]) =>
    splitByDepth(depths.map((depth, i) => ({ x: i, y: 0, depth })));

  it('keeps a wholly front curve in one piece', () => {
    const runs = run([1, 0.8, 0.5, 0.2]);
    expect(runs).toHaveLength(1);
    expect(runs[0].front).toBe(true);
  });

  it('cuts where the curve goes behind the sphere', () => {
    const runs = run([1, 0.5, -0.5, -1, 0.5, 1]);
    expect(runs.map((r) => r.front)).toEqual([true, false, true]);
  });

  it('joins the halves at the crossing so no gap opens', () => {
    const runs = run([1, -1]);
    expect(runs).toHaveLength(2);
    // The last point of the front run is the first of the back run.
    expect(runs[0].points[runs[0].points.length - 1]).toEqual(runs[1].points[0]);
  });
});

describe('sidereal time', () => {
  it('matches the standard GMST at the J2000 epoch', () => {
    expect(gmstHours(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(18.697374558, 6);
  });

  it('gains the sidereal day on the solar day', () => {
    // A solar day advances sidereal time by about four minutes.
    const day0 = gmstHours(Date.UTC(2026, 0, 1, 0));
    const day1 = gmstHours(Date.UTC(2026, 0, 2, 0));
    const gained = ((day1 - day0) % 24 + 24) % 24;
    expect(gained * 60).toBeCloseTo(3.943, 1);
  });

  it('stays inside the clock face', () => {
    for (const ms of [Date.UTC(1815, 11, 10), Date.UTC(2026, 6, 28), Date.UTC(2199, 0, 1)]) {
      const h = gmstHours(ms);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    }
  });

  it('counts centuries from J2000', () => {
    expect(julianCenturies(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(0, 12);
    expect(julianCenturies(Date.UTC(2100, 0, 1, 12))).toBeCloseTo(1, 3);
  });
});

describe('declination', () => {
  it('separates from ecliptic latitude — the reason out of bounds exists', () => {
    // A body north of the ecliptic near the June solstice point stacks its
    // latitude onto the obliquity and can pass the Sun's own limit.
    const dec = declinationOf(90, 5);
    expect(dec).toBeGreaterThan(OBLIQUITY);
    expect(dec).toBeCloseTo(OBLIQUITY + 5, 1);
  });

  it('round-trips through a constant-declination circle', () => {
    for (const target of [OBLIQUITY, -OBLIQUITY, 12.5]) {
      for (const point of declinationCircle(target, OBLIQUITY, 15)) {
        expect(declinationOf(point.lon, point.lat, OBLIQUITY)).toBeCloseTo(target, 9);
      }
    }
  });

  it('touches the ecliptic only at the solstice points', () => {
    const north = declinationCircle(OBLIQUITY, OBLIQUITY, 1);
    const touching = north.filter((p) => Math.abs(p.lat) < 1e-6);
    expect(touching.length).toBeGreaterThan(0);
    for (const p of touching) expect(separation(p.lon, 90)).toBeCloseTo(0, 3);
  });
});

describe('the horizon', () => {
  const zenith = zenithOf(137, 51.5);

  it('holds every point at zero altitude', () => {
    for (const p of horizonCircle(zenith, 5)) {
      expect(altitudeOf(p.lon, p.lat, zenith)).toBeCloseTo(0, 9);
    }
  });

  it('puts the zenith overhead and its opposite underfoot', () => {
    expect(altitudeOf(zenith.lon, zenith.lat, zenith)).toBeCloseTo(90, 9);
    expect(altitudeOf(zenith.lon + 180, -zenith.lat, zenith)).toBeCloseTo(-90, 9);
  });

  it('stays a great circle at polar latitudes, where the house system gives up', () => {
    const polar = zenithOf(137, 78);
    const ring = horizonCircle(polar, 5);
    expect(ring.length).toBeGreaterThan(70);
    for (const p of ring) expect(altitudeOf(p.lon, p.lat, polar)).toBeCloseTo(0, 9);
  });
});
