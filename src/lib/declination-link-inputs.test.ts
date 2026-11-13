/**
 * The 3D view hands the declination functions (./declination.ts, over
 * @zodiacs/engine/lite since engine 1.1.0-rc.2) the bodies of a chart that a
 * shared code carried: the relationship page's sphere gives a decoded side
 * latitude 0 (RelationshipWheel's sphereBodies), and the view keeps the ten
 * bodies it draws and passes { body, lon, lat }. The engine refuses with a
 * RangeError, which the adapter does not catch, a body that is not a plain
 * object of finite numbers and a body named twice. So a code must not be able
 * to carry either: every decoded body is plain, finite and named once, and
 * the view's rows and aspects of it never throw. A code that breaks the rules
 * decodes to null and never reaches the view.
 */
import { describe, expect, it } from 'vitest';
import { declinationRows, findDeclinationAspects } from './declination';
import { decodePositionsLink, encodePositionsLink, POSITION_BODY_ORDER } from './share-positions';
import { OBLIQUITY } from './wheel/ecliptic3d';

/** The bodies EclipticView draws (its GLYPH): the nodes are left out. */
const VIEW_BODIES = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

/** A decoded side as the sphere and then the view pass it on. */
function asTheViewPassesThem(bodies: readonly { body: string; lon: number }[]) {
  return bodies
    .map(({ body, lon }) => ({ body, lon, lat: 0 }))
    .filter((row) => VIEW_BODIES.has(row.body))
    .map(({ body, lon, lat }) => ({ body, lon, lat }));
}

/** A seeded stream of synthetic longitudes, so the corpus is the same on every run. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A v2 code spelled by hand: the encoder would refuse to write these. */
function handWritten(wire: unknown): string {
  return `2.${Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url')}`;
}

describe('a shared code\'s bodies, as the 3D view passes them to the declination functions', () => {
  it('are plain, finite and named once, and the view\'s rows and aspects of them never throw', () => {
    const random = mulberry32(20261104);
    const longitude = () => random() * 360;
    let decoded = 0;
    for (let index = 0; index < 500; index += 1) {
      const token = encodePositionsLink({
        bodies: POSITION_BODY_ORDER.map((body) => ({ body, lon: longitude() })),
        angles: index % 2 === 0 ? { asc: longitude(), mc: longitude() } : null,
        houseSystem: index % 3 === 0 ? 'placidus' : 'whole',
        engineVersion: '1.1.0-rc.2',
      });
      const chart = token === null ? null : decodePositionsLink(token);
      expect(chart, `case ${index}`).not.toBeNull();
      if (!chart) continue;
      decoded += 1;
      const { bodies } = chart;
      expect(Object.getPrototypeOf(bodies)).toBe(Array.prototype);
      expect(new Set(bodies.map(({ body }) => body)).size).toBe(bodies.length);
      for (const row of bodies) {
        expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
        expect(Object.keys(row)).toEqual(['body', 'lon']);
        expect(Number.isFinite(row.lon)).toBe(true);
      }
      const view = asTheViewPassesThem(bodies);
      expect(view).toHaveLength(10);
      for (const obliquity of [OBLIQUITY, 23.43, 0]) {
        expect(() => declinationRows(view, obliquity)).not.toThrow();
        expect(() => findDeclinationAspects(view, obliquity)).not.toThrow();
      }
    }
    expect(decoded).toBe(500);
  });

  it('a code with a longitude out of range, a body missing or a longitude that is not a number decodes to null', () => {
    const longitudes = POSITION_BODY_ORDER.map((_, index) => index * 30 + 0.5);
    expect(decodePositionsLink(handWritten({ b: longitudes, h: 'w', v: '1.1.0-rc.2' }))).not.toBeNull();
    for (const b of [
      longitudes.map((lon, index) => (index === 3 ? 360 : lon)),
      longitudes.map((lon, index) => (index === 3 ? -1 : lon)),
      longitudes.slice(1),
      longitudes.map((lon, index) => (index === 3 ? '45' : lon)),
      longitudes.map((lon, index) => (index === 3 ? null : lon)),
    ]) {
      expect(decodePositionsLink(handWritten({ b, h: 'w', v: '1.1.0-rc.2' }))).toBeNull();
    }
  });
});
