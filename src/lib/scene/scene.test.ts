/**
 * Scene-model gates:
 *  1. Numerical parity — every SceneBody.lon equals the engine longitude
 *     exactly; drawLon gives interactive markers enough visual space.
 *  2. A committed snapshot of the full Kahlo SceneModel — the fixture the
 *     interactive wheel, inspector, and (later) spatial chapter all render
 *     from. A diff here means the presentation model changed for every
 *     renderer at once; read it before updating.
 *  3. entityId/parseEntityId round-trips (the ?sel= deep-link codec).
 *  4. emphasisFor's one lighting rule.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { computeChart } from '../engine/full';
import { buildSceneModel } from './build';
import { technicalCollisionFan } from '../wheel/technical-layout';
import { emphasisFor, emphasisOpacity } from './emphasis';
import { entityId, parseEntityId, type EntityRef } from './types';

// Frida Kahlo at Coyoacán, 1907-07-06 15:06:36Z: 8:30 on Mexico City's mean
// time, the instant the homepage demo used before it moved to Coyoacán's own
// (15:06:38Z). Kept, with its snapshot, as a fixed input.
const kahlo = () => computeChart({
  utc: new Date('1907-07-06T15:06:36.000Z'),
  latitude: 19.35,
  longitude: -99.16,
  houseSystem: 'whole',
  timeKnown: true,
  flags: ['lmt'],
});

/**
 * Astronomy Engine can differ by a few last-place bits between libc/CPU
 * combinations. Exact engine-to-scene parity is asserted above; the broad
 * presentation snapshot should remain portable while still detecting a
 * change larger than one ten-millionth of a degree.
 */
const stableSnapshot = <T>(value: T): T => JSON.parse(JSON.stringify(
  value,
  (_key, item) => typeof item === 'number' ? Number(item.toFixed(7)) : item,
)) as T;

describe('buildSceneModel parity', () => {
  it('preserves every engine longitude exactly', () => {
    const chart = kahlo();
    const scene = buildSceneModel(chart);
    for (const sb of scene.bodies) {
      const engineBody = chart.bodies.find((b) => b.body === sb.body)!;
      expect(sb.lon).toBe(engineBody.lon);
      expect(sb.speed).toBe(engineBody.speed);
      expect(sb.retrograde).toBe(engineBody.retrograde);
    }
  });

  it('applies the wheel conventions: no South Node, aspects under 6° orb', () => {
    const chart = kahlo();
    const scene = buildSceneModel(chart);
    expect(scene.bodies.some((b) => b.body === 'South Node')).toBe(false);
    expect(scene.aspects.every((a) => a.orb < 6)).toBe(true);
    const full = buildSceneModel(chart, { wheelConventions: false });
    expect(full.bodies.some((b) => b.body === 'South Node')).toBe(true);
  });

  it('separates the crowded Venus/Pluto markers while keeping ticks true', () => {
    const chart = kahlo();
    const scene = buildSceneModel(chart);
    // Venus (84.34°) and Pluto (83.75°) sit 0.6° apart — the fan must
    // separate their markers without moving their true longitudes.
    const venus = scene.bodies.find((b) => b.body === 'Venus')!;
    const pluto = scene.bodies.find((b) => b.body === 'Pluto')!;
    expect(Math.abs(venus.drawLon - pluto.drawLon)).toBeGreaterThanOrEqual(13.999999);
    expect(Math.abs(venus.lon - pluto.lon)).toBeLessThan(1);
  });

  it('houses carry span, midpoint, and occupants', () => {
    const scene = buildSceneModel(kahlo());
    expect(scene.houses).toHaveLength(12);
    for (const house of scene.houses!) {
      expect(house.spanDeg).toBeCloseTo(30, 9); // whole sign
      expect(house.midLon).toBeCloseTo(((house.cuspLon + 15) % 360), 9);
    }
    const sun = scene.bodies.find((b) => b.body === 'Sun')!;
    expect(scene.houses![sun.house! - 1].occupants).toContain('Sun');
  });

  it('anchors to the ASC by default and 0° Aries in teaching mode', () => {
    const chart = kahlo();
    expect(buildSceneModel(chart).anchor).toEqual({ lon: chart.angles!.asc, mode: 'asc' });
    expect(buildSceneModel(chart, { anchorMode: 'aries' }).anchor).toEqual({ lon: 0, mode: 'aries' });
  });

  it('matches the committed Kahlo scene snapshot', () => {
    // rc.16: +0.0739717″ in all longitudes from full IAU 2000B; speeds
    // follow its derivative, and ASC/MC follow its obliquity and sidereal time.
    // The attribution is recorded in site-engine-rc16/numerical-regressions.
    // Scene structure, signs, houses, aspects and the seven-decimal gate stay fixed.
    const scene = buildSceneModel(kahlo());
    const frozen = createRequire(import.meta.url)('./__snapshots__/scene.test.ts.snap')
      ['buildSceneModel parity > matches the committed Kahlo scene snapshot 1'];
    const reference = JSON.parse(frozen.replace(/,\s*([}\]])/g, '$1'));
    const snapshot = stableSnapshot(scene);
    // Central differences magnify last-place libm bits in nodal velocity.
    // Enforce the existing 1e-7 deg/day bound before canonicalizing those two
    // fields; all geometry and other speeds keep the original exact snapshot.
    for (const body of scene.bodies) {
      if (body.body !== 'North Node' && body.body !== 'South Node') continue;
      const expected = reference.bodies.find((value: { body: string }) => value.body === body.body).speed;
      expect(Math.abs(body.speed - expected)).toBeLessThanOrEqual(1e-7);
      snapshot.bodies.find(value => value.body === body.body)!.speed = expected;
    }
    expect(snapshot).toMatchSnapshot();
  });
});

describe('technicalCollisionFan', () => {
  it('retains the technical export default of 11°', () => {
    const fan = technicalCollisionFan([{ body: 'Venus', lon: 84 }, { body: 'Pluto', lon: 83 }]);
    expect(Math.abs(fan.get('Venus')! - fan.get('Pluto')!)).toBe(11);
  });

  it('keeps crowded markers separated across 0° Aries without changing their order', () => {
    const bodies = [
      { body: 'A', lon: 356 },
      { body: 'B', lon: 359 },
      { body: 'C', lon: 1 },
      { body: 'D', lon: 4 },
      { body: 'E', lon: 120 },
    ];
    const fan = technicalCollisionFan(bodies, 11);
    const ordered = [...bodies]
      .sort((a, b) => ((a.lon - 350 + 360) % 360) - ((b.lon - 350 + 360) % 360))
      .map((body) => fan.get(body.body)!);
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index] - ordered[index - 1]).toBeGreaterThanOrEqual(10.999999);
    }
    expect([...fan.keys()].sort()).toEqual(bodies.map(({ body }) => body).sort());
  });

  it('leaves already legible placements at their exact longitude', () => {
    const bodies = [
      { body: 'A', lon: 0 },
      { body: 'B', lon: 120 },
      { body: 'C', lon: 240 },
    ];
    const fan = technicalCollisionFan(bodies);
    bodies.forEach(({ body, lon }) => {
      expect(((fan.get(body)! % 360) + 360) % 360).toBe(lon);
    });
  });
});

describe('entity ids', () => {
  const cases: EntityRef[] = [
    { kind: 'body', body: 'North Node' },
    { kind: 'sign', sign: 'leo' },
    { kind: 'house', house: 7 },
    { kind: 'aspect', a: 'Moon', b: 'Mars', type: 'square' },
    { kind: 'angle', angle: 'asc' },
  ];
  it('round-trips through entityId/parseEntityId', () => {
    for (const ref of cases) {
      expect(parseEntityId(entityId(ref))).toEqual(ref);
    }
  });
  it('rejects malformed ids instead of throwing', () => {
    for (const bad of ['', 'body', 'house:13', 'house:x', 'sign:foobar', 'sign:ophiuchus', 'aspect:Sun-vibes-Moon', 'angle:up', 'nope:1']) {
      expect(parseEntityId(bad)).toBeNull();
    }
  });
});

describe('emphasisFor', () => {
  it('lights nothing when nothing is selected', () => {
    const em = emphasisFor(buildSceneModel(kahlo()), null);
    expect(em.highlight.size).toBe(0);
    expect(emphasisOpacity(em, 'body:Sun')).toBe(1);
  });

  it('a body lights itself and softens its sign, house, aspects, and partners', () => {
    const scene = buildSceneModel(kahlo());
    const sun = scene.bodies.find((b) => b.body === 'Sun')!;
    const em = emphasisFor(scene, { kind: 'body', body: 'Sun' });
    expect(em.highlight.has('body:Sun')).toBe(true);
    expect(em.soft.has(`sign:${sun.sign}`)).toBe(true);
    expect(em.soft.has(`house:${sun.house}`)).toBe(true);
    for (const aspectId of sun.aspects) expect(em.soft.has(aspectId)).toBe(true);
    expect(emphasisOpacity(em, 'body:Sun')).toBe(1);
    expect(emphasisOpacity(em, 'body:Saturn')).toBeLessThan(1);
  });

  it('an aspect lights the chord and both bodies', () => {
    const scene = buildSceneModel(kahlo());
    const a = scene.aspects[0];
    const em = emphasisFor(scene, { kind: 'aspect', a: a.a, b: a.b, type: a.type });
    expect(em.soft.has(`body:${a.a}`)).toBe(true);
    expect(em.soft.has(`body:${a.b}`)).toBe(true);
  });

  it('an angle travels with its axis twin', () => {
    const em = emphasisFor(buildSceneModel(kahlo()), { kind: 'angle', angle: 'asc' });
    expect(em.highlight.has('angle:asc')).toBe(true);
    expect(em.soft.has('angle:dsc')).toBe(true);
  });
});
