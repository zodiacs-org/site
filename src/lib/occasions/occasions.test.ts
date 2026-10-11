import { describe, expect, it } from 'vitest';
import { eveningSky } from './evening';
import { fullMoonsBetween, lifeMilestones, mercuryRetrogradesBetween } from './milestones';
import { skyAt } from './sky';

const FLORENCE = { latitude: 43.7696, longitude: 11.2558 };
const TROMSO = { latitude: 69.6492, longitude: 18.9553 };
const minute = (iso: string | null | undefined) => iso?.slice(0, 16);

describe('occasion sky', () => {
  it('names the bodies, the retrograde planets and the Moon on a wedding evening', () => {
    const sky = skyAt(new Date('2027-06-12T17:00:00Z'));
    const sign = (body: string) => sky.bodies.find((row) => row.body === body)?.sign;
    expect(sign('Sun')).toBe('gemini');
    expect(sign('Moon')).toBe('libra');
    expect(sign('Mercury')).toBe('cancer');
    expect(sky.retrograde).toContain('Mercury');
    expect(sky.moon).toMatchObject({ phase: 'First Quarter', illuminationPercent: 64, waxing: true });
  });

  it('refuses an invalid instant', () => {
    expect(() => skyAt(new Date('nope'))).toThrow(RangeError);
  });
});

describe('evening sky', () => {
  it('gives golden hour, sunset, dusk, the Moon and the evening planets in Florence', () => {
    const evening = eveningSky(FLORENCE, '2027-06-12', 120);
    expect(minute(evening.sunset)).toBe('2027-06-12T18:57');
    expect(minute(evening.goldenHour?.start)).toBe('2027-06-12T18:13');
    expect(evening.goldenHour?.end).toBe(evening.sunset);
    expect(minute(evening.civilDusk)).toBe('2027-06-12T19:33');
    expect(minute(evening.moon.rise)).toBe('2027-06-12T12:25');
    expect(evening.moon.highest).toMatchObject({ altitude: 38 });
    expect(minute(evening.moon.highest?.at)).toBe('2027-06-12T18:14');
    // Venus set at 19:31 local, before dusk; Jupiter and Mars are up after dark.
    expect(evening.planetsAfterDusk).toEqual(['Mars', 'Jupiter']);
    expect(evening.flags).toEqual([]);
  });

  it('has no sunset, golden hour or dusk under the midnight sun', () => {
    const evening = eveningSky(TROMSO, '2027-06-21', 120);
    expect(evening.flags).toEqual(['sun-never-sets']);
    expect(evening).toMatchObject({ sunset: null, goldenHour: null, civilDusk: null, planetsAfterDusk: [] });
  });

  it('has a sunset but no civil dusk on a white night', () => {
    // At 69.6° N in late July the Sun sets but stays within 6° of the horizon.
    const evening = eveningSky(TROMSO, '2027-07-27', 120);
    expect(evening.sunset).not.toBeNull();
    expect(evening.civilDusk).toBeNull();
  });

  it('refuses a malformed date', () => {
    expect(() => eveningSky(FLORENCE, '12/06/2027', 120)).toThrow(RangeError);
  });
});

describe('life milestones', () => {
  const birth = new Date('1997-03-15T12:00:00Z');
  const asOf = new Date('2026-10-11T12:00:00Z');

  it('dates the Saturn return with every pass, and the Jupiter returns', () => {
    const result = lifeMilestones(birth, asOf);
    const saturn = result.milestones.filter((milestone) => milestone.kind === 'saturn-return');
    expect(saturn[0]?.passes.map((pass) => [pass.at.slice(0, 10), pass.retrograde])).toEqual([
      ['2026-04-23', false], ['2026-11-19', true], ['2026-12-31', false],
    ]);
    expect(saturn[0]?.age).toBe(29);
    const jupiter = result.milestones.filter((milestone) => milestone.kind === 'jupiter-return');
    expect(jupiter.slice(0, 3).map((milestone) => milestone.first.slice(0, 7))).toEqual(['2009-02', '2021-02', '2033-01']);
    expect(result.next?.kind).toBe('saturn-return');
    expect(result.numbers.jupiterReturns).toBe(2);
  });

  it('finds the Uranus opposition in the early forties', () => {
    const uranus = lifeMilestones(birth, asOf).milestones.find((milestone) => milestone.kind === 'uranus-opposition');
    expect(uranus?.age).toBeGreaterThanOrEqual(38);
    expect(uranus?.age).toBeLessThanOrEqual(44);
  });

  it('counts full moons and Mercury retrogrades lived through', () => {
    const result = lifeMilestones(birth, asOf);
    expect(result.numbers.fullMoons).toBe(366);
    expect(result.numbers.mercuryRetrogrades).toBe(93);
  });

  it('counts a full moon only once it has happened', () => {
    // Full moon on 26 October 2026 at 04:12 UTC.
    expect(fullMoonsBetween(new Date('2026-10-20T00:00:00Z'), new Date('2026-10-26T04:00:00Z'))).toBe(0);
    expect(fullMoonsBetween(new Date('2026-10-20T00:00:00Z'), new Date('2026-10-26T04:30:00Z'))).toBe(1);
    // 2026 has thirteen full moons: two in May (1 and 31 May).
    expect(fullMoonsBetween(new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))).toBe(13);
  });

  it('counts each Mercury retrograde station once', () => {
    // Mercury turned retrograde three times in 2025 (March, July and November).
    expect(mercuryRetrogradesBetween(new Date('2025-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(3);
  });

  it('refuses an as-of date before the birth', () => {
    expect(() => lifeMilestones(asOf, birth)).toThrow(RangeError);
  });
});
