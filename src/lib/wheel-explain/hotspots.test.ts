import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import Wheel from '../wheel/Wheel';
import { SIGNS } from '../signs';
import { SAMPLE_PLACEMENTS, SAMPLE_WHEEL } from '../sample-chart';
import frida from '../../data/demo-chart-frida.json';
import { houseWheelNumeral, houseWheelSpots, staticWheelFrame, staticWheelSpots } from './hotspots';

type FixtureBody = { body: string; lon: number; retrograde: boolean };
const fridaBodies = (frida.bodies as FixtureBody[]).filter((b) => b.body !== 'South Node');

const num = (attrs: string, name: string) => Number(attrs.match(new RegExp(`\\b${name}="([^"]+)"`))![1]);

/** Centres of the marks the static Wheel actually draws, in percent of its box. */
function drawnMarks(props: Parameters<typeof Wheel>[0]) {
  const size = props.size ?? 420;
  const { pad, frame } = staticWheelFrame(size);
  const pct = (v: number) => ((v + pad) / frame) * 100;
  const svg = render(h(Wheel, props));

  const bodies = new Map<string, { x: number; y: number }>();
  const groups = svg.split('<g class="wheel__body">').slice(1);
  groups.forEach((group, i) => {
    const marker = group.match(/<circle ([^>]*fill="rgba\(15,18,26,0\.92\)"[^>]*)>/)![1];
    bodies.set(props.bodies[i].body, { x: pct(num(marker, 'cx')), y: pct(num(marker, 'cy')) });
  });

  const signs = new Map<string, { x: number; y: number }>();
  for (const match of svg.matchAll(/<image ([^>]*)>/g)) {
    const slug = match[1].match(/zodiac-icons\/128\/([a-z]+)\.webp/)![1];
    const w = num(match[1], 'width');
    signs.set(slug, { x: pct(num(match[1], 'x') + w / 2), y: pct(num(match[1], 'y') + w / 2) });
  }

  const houses = new Map<number, { x: number; y: number }>();
  for (const match of svg.matchAll(/<text ([^>]*fill="rgba\(95,103,121,0\.9\)"[^>]*)>(\d+)<\/text>/g)) {
    houses.set(Number(match[2]), { x: pct(num(match[1], 'x')), y: pct(num(match[1], 'y')) });
  }
  return { bodies, signs, houses };
}

function expectOnMarks(props: Parameters<typeof Wheel>[0]) {
  const spots = staticWheelSpots(props);
  const marks = drawnMarks(props);
  for (const spot of spots) {
    const [kind, key] = spot.id.split(':');
    const mark = kind === 'body' ? marks.bodies.get(key)
      : kind === 'sign' ? marks.signs.get(key)
        : marks.houses.get(Number(key));
    expect(mark, spot.id).toBeDefined();
    expect(spot.x, `${spot.id} x`).toBeCloseTo(mark!.x, 1);
    expect(spot.y, `${spot.id} y`).toBeCloseTo(mark!.y, 1);
  }
  return spots;
}

describe('static wheel hotspots', () => {
  it('sit on the marks the Wheel draws, for the birth chart sample', () => {
    const spots = expectOnMarks({ ...SAMPLE_WHEEL, size: 430 });
    expect(spots.filter((s) => s.kind === 'planet')).toHaveLength(SAMPLE_WHEEL.bodies.length);
    expect(spots.filter((s) => s.kind === 'sign').map((s) => s.id)).toEqual(SIGNS.map((s) => `sign:${s.slug}`));
    expect(spots.filter((s) => s.kind === 'house').map((s) => s.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `house:${i + 1}`),
    );
  });

  it('sit on the marks for a Placidus chart with a crowded stellium', () => {
    expectOnMarks({ bodies: fridaBodies, asc: frida.angles.asc, mc: frida.angles.mc, cusps: frida.houses.cusps, size: 420 });
  });

  it('leave out house numbers, and houses in the copy, when the chart has no time', () => {
    const spots = expectOnMarks({ bodies: fridaBodies, size: 420 });
    expect(spots.some((s) => s.kind === 'house')).toBe(false);
    for (const planet of spots.filter((s) => s.kind === 'planet')) {
      expect(planet.text).not.toMatch(/house/u);
    }
  });

  it('give the same percentages at any size', () => {
    const small = staticWheelSpots({ ...SAMPLE_WHEEL, size: 300 });
    const large = staticWheelSpots({ ...SAMPLE_WHEEL, size: 640 });
    expect(small.map(({ x, y }) => [x, y])).toEqual(large.map(({ x, y }) => [x, y]));
  });

  it('place each planet in the sign and house the sample page lists', () => {
    const spots = staticWheelSpots({ ...SAMPLE_WHEEL, size: 430 });
    for (const placement of SAMPLE_PLACEMENTS) {
      const spot = spots.find((s) => s.id === `body:${placement.body}`)!;
      expect(spot.title).toBe(`${placement.body} in ${placement.sign.name}`);
      expect(spot.label).toContain(`${placement.sign.name}, ${placement.house}`);
      expect(spot.hue).toBe(placement.sign.hue);
    }
  });

  it('list planets in zodiac order, then signs, then houses, for arrow keys', () => {
    const spots = staticWheelSpots({ ...SAMPLE_WHEEL, size: 430 });
    const kinds = spots.map((s) => s.kind);
    expect(kinds.lastIndexOf('planet')).toBeLessThan(kinds.indexOf('sign'));
    expect(kinds.lastIndexOf('sign')).toBeLessThan(kinds.indexOf('house'));
    const order = spots.filter((s) => s.kind === 'planet').map((s) => SAMPLE_WHEEL.bodies.find((b) => `body:${b.body}` === s.id)!.lon);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('house wheel hotspots', () => {
  it('sit on the numerals HouseWheel draws, ascendant on the left, houses running counterclockwise', () => {
    const spots = houseWheelSpots('#B6D4E4');
    expect(spots.map((s) => s.id)).toEqual(Array.from({ length: 12 }, (_, i) => `house:${i + 1}`));
    spots.forEach((spot, i) => {
      const numeral = houseWheelNumeral(i + 1);
      expect(spot.x).toBeCloseTo(numeral.x / 2, 1);
      expect(spot.y).toBeCloseTo(numeral.y / 2, 1);
      expect(spot.hue).toBe('#B6D4E4');
      expect(spot.text).not.toMatch(/this chart/u);
    });
    const at = (n: number) => spots[n - 1];
    // First house just below the ascendant on the left; tenth near the top; seventh on the right.
    expect(at(1).x).toBeLessThan(30);
    expect(at(1).y).toBeGreaterThan(50);
    expect(at(10).y).toBeLessThan(25);
    expect(at(7).x).toBeGreaterThan(70);
    expect(at(4).y).toBeGreaterThan(75);
  });
});
