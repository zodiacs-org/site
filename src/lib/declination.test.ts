/**
 * The claim declination aspects rest on: two bodies can be tied to each
 * other by a measurement the chart wheel never draws. If the pairs this
 * finds were always pairs the wheel already shows, the family would be
 * redundant — so the fixtures pin both the arithmetic and the gap.
 */
import { describe, expect, it } from 'vitest';
import {
  DECLINATION_ORB,
  DECLINATION_ORB_LUMINARY,
  declinationOf,
  declinationOrb,
  findDeclinationAspects,
  type DeclinationBody,
} from './declination';
import { OBLIQUITY } from './wheel/ecliptic3d';

/** Ecliptic longitude that lands on a wanted declination, at latitude 0. */
function lonForDeclination(dec: number, obliquity = 23.44): number {
  return Math.asin(Math.sin(dec * Math.PI / 180) / Math.sin(obliquity * Math.PI / 180))
    * 180 / Math.PI;
}

// Moved from wheel/ecliptic3d.test.ts with declinationOf (engine 1.1.0-rc.2, @zodiacs/engine/lite).
describe('declination', () => {
  it('reaches the obliquity at the solstice points and zero at the equinoxes', () => {
    expect(declinationOf(90, 0)).toBeCloseTo(OBLIQUITY, 9);
    expect(declinationOf(270, 0)).toBeCloseTo(-OBLIQUITY, 9);
    expect(declinationOf(0, 0)).toBeCloseTo(0, 9);
    expect(declinationOf(180, 0)).toBeCloseTo(0, 9);
  });

  it('puts the ecliptic pole one obliquity short of the celestial pole', () => {
    expect(declinationOf(0, 90)).toBeCloseTo(90 - OBLIQUITY, 9);
  });
});

describe('declination orbs', () => {
  it('widens for the luminaries and holds elsewhere', () => {
    expect(declinationOrb('Mars', 'Saturn')).toBe(DECLINATION_ORB);
    expect(declinationOrb('Sun', 'Saturn')).toBe(DECLINATION_ORB_LUMINARY);
    expect(declinationOrb('Mars', 'Moon')).toBe(DECLINATION_ORB_LUMINARY);
    expect(DECLINATION_ORB_LUMINARY).toBeGreaterThan(DECLINATION_ORB);
  });
});

describe('finding parallels and contraparallels', () => {
  it('reads same-side declinations as a parallel', () => {
    const bodies: DeclinationBody[] = [
      { body: 'Mars', lon: lonForDeclination(12), lat: 0 },
      { body: 'Saturn', lon: lonForDeclination(12.4), lat: 0 },
    ];
    const [found] = findDeclinationAspects(bodies);
    expect(found.type).toBe('parallel');
    expect(found.orb).toBeCloseTo(0.4, 2);
  });

  it('reads mirrored declinations as a contraparallel', () => {
    const bodies: DeclinationBody[] = [
      { body: 'Mars', lon: lonForDeclination(12), lat: 0 },
      { body: 'Saturn', lon: lonForDeclination(-12.4), lat: 0 },
    ];
    const [found] = findDeclinationAspects(bodies);
    expect(found.type).toBe('contraparallel');
    expect(found.orb).toBeCloseTo(0.4, 2);
  });

  it('agrees with the sign rule on every side of the equator', () => {
    // The implementation picks the smaller of |δa−δb| and |δa+δb| rather
    // than testing signs. Those agree for all inputs; a sweep across the
    // equator is where they would part company if they did not.
    for (let a = -20; a <= 20; a += 0.5) {
      for (let b = -20; b <= 20; b += 0.5) {
        if (a === 0 || b === 0) continue; // no side to be on; covered below
        const bodies: DeclinationBody[] = [
          { body: 'Mars', lon: lonForDeclination(a), lat: 0 },
          { body: 'Saturn', lon: lonForDeclination(b), lat: 0 },
        ];
        const [found] = findDeclinationAspects(bodies);
        if (!found) continue;
        const sameSign = a > 0 === b > 0;
        expect(found.type, `${a} / ${b}`).toBe(sameSign ? 'parallel' : 'contraparallel');
      }
    }
  });

  it('calls the equator its own mirror', () => {
    // A body at 0° declination is the same distance from the equator as
    // its partner whichever way you read it, so both relationships are
    // exact at the same orb. That reading is reported as a parallel.
    const bodies: DeclinationBody[] = [
      { body: 'Mars', lon: 0, lat: 0 },
      { body: 'Saturn', lon: lonForDeclination(-0.6), lat: 0 },
    ];
    const [found] = findDeclinationAspects(bodies);
    expect(found.decA).toBeCloseTo(0, 6);
    expect(found.type).toBe('parallel');
    expect(found.orb).toBeCloseTo(0.6, 2);
  });

  it('drops pairs past their orb and keeps luminary pairs a half-degree longer', () => {
    const wide = (a: string, b: string) => findDeclinationAspects([
      { body: a, lon: lonForDeclination(10), lat: 0 },
      { body: b, lon: lonForDeclination(11.2), lat: 0 },
    ]);
    expect(wide('Mars', 'Saturn')).toHaveLength(0);
    expect(wide('Sun', 'Saturn')).toHaveLength(1);
  });

  it('takes ecliptic latitude into account rather than longitude alone', () => {
    // Two bodies on the same longitude but different latitudes stand at
    // different declinations — the whole reason this cannot be read off a
    // wheel. Pluto's 17° of latitude is the extreme case.
    const flat = declinationOf(90, 0);
    const tilted = declinationOf(90, 8);
    expect(Math.abs(flat - tilted)).toBeGreaterThan(5);
  });

  it('orders by orb and reports the pair’s ecliptic separation', () => {
    const bodies: DeclinationBody[] = [
      { body: 'Mars', lon: lonForDeclination(12), lat: 0 },
      { body: 'Saturn', lon: lonForDeclination(12.8), lat: 0 },
      { body: 'Venus', lon: lonForDeclination(12.05), lat: 0 },
    ];
    const found = findDeclinationAspects(bodies);
    expect(found.length).toBeGreaterThan(1);
    for (let i = 1; i < found.length; i += 1) {
      expect(found[i].orb).toBeGreaterThanOrEqual(found[i - 1].orb);
    }
    expect(found[0].separation).toBeGreaterThan(0);
    expect(found[0].separation).toBeLessThanOrEqual(180);
  });
});

/**
 * Real charts, computed by the engine and recorded here the way the horizon
 * fixtures record angles. The point of each is a tie the wheel misses.
 */
describe('real charts carry ties the wheel does not draw', () => {
  const greenwich2026: DeclinationBody[] = [
    { body: 'Sun', lon: 125.443, lat: 0 },
    { body: 'Moon', lon: 293.063, lat: -3.138 },
    { body: 'Mercury', lon: 107.327, lat: -3.042 },
    { body: 'Venus', lon: 170.399, lat: 0.271 },
    { body: 'Mars', lon: 80.696, lat: 0.046 },
    { body: 'Jupiter', lon: 126.186, lat: 0.472 },
    { body: 'Saturn', lon: 14.745, lat: -2.509 },
    { body: 'Uranus', lon: 64.891, lat: -0.154 },
    { body: 'Neptune', lon: 4.304, lat: -1.387 },
    { body: 'Pluto', lon: 304.257, lat: -4.274 },
  ];
  const obliquity = 23.435823;

  it('finds Venus parallel Saturn across half the zodiac', () => {
    const found = findDeclinationAspects(greenwich2026, obliquity);
    const pair = found.find((a) => a.a === 'Venus' && a.b === 'Saturn');
    expect(pair).toBeDefined();
    expect(pair!.type).toBe('parallel');
    expect(pair!.orb).toBeCloseTo(0.56, 1);
    // Both a little over 4° north of the equator, and 155° apart on the
    // wheel — no longitude aspect reaches that far.
    expect(pair!.decA).toBeCloseTo(4.05, 1);
    expect(pair!.decB).toBeCloseTo(3.5, 1);
    expect(pair!.separation).toBeGreaterThan(150);
  });

  it('finds Mars contraparallel Pluto, mirrored across the equator', () => {
    const found = findDeclinationAspects(greenwich2026, obliquity);
    const pair = found.find((a) => a.a === 'Mars' && a.b === 'Pluto');
    expect(pair).toBeDefined();
    expect(pair!.type).toBe('contraparallel');
    expect(pair!.decA).toBeGreaterThan(0);
    expect(pair!.decB).toBeLessThan(0);
    expect(pair!.orb).toBeLessThan(0.25);
    expect(pair!.separation).toBeGreaterThan(130);
  });

  it('reports a handful rather than a wall of them', () => {
    const found = findDeclinationAspects(greenwich2026, obliquity);
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.length).toBeLessThanOrEqual(12);
  });
});
