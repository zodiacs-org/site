import { useBrowserEphemeris } from '../../../tests/helpers/browser-ephemeris';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it, vi } from 'vitest';
import frida from '../../data/demo-chart-frida.json';
import people from '../../data/people.json';
import { computeChart } from '../engine/full';
import type { BodyName, Chart } from '../engine/types';
import { buildSceneModel } from '../scene/build';
import { emphasisFor } from '../scene/emphasis';
import { entityId, type EntityRef } from '../scene/types';
import { houseOf } from '../engine/houses';
import Wheel from './Wheel';

useBrowserEphemeris();

type Point = { x: number; y: number };
type Marker = Point & { body: string; radius: number; stroke: number };
const size = 420;
const norm = (n: number) => (n % 360 + 360) % 360;
const separation = (a: number, b: number) => Math.abs((a - b + 540) % 360 - 180);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '';

const kahlo = computeChart({
  utc: new Date(frida.utc), latitude: 19.35, longitude: -99.16,
  houseSystem: 'whole', timeKnown: true, flags: ['lmt'],
});

// These People inputs are committed *reference* instants, never known birth
// times. Keep their no-angle contract and their civil-day Moon alternatives.
function referenceChart(slug: string): Chart {
  const person = people.people.find((p) => p.slug === slug)!;
  const chart = computeChart({
    utc: new Date(person.computation.utcInstant),
    latitude: person.computation.latitude, longitude: person.computation.longitude,
    houseSystem: 'whole', timeKnown: false, flags: ['no-time'],
  });
  chart.bodies = chart.bodies.filter((body) => person.placements.some((p) => p.body === body.body));
  for (const body of chart.bodies) {
    const committed = person.placements.find((p) => p.body === body.body)!;
    expect(separation(body.lon, committed.longitude)).toBeLessThanOrEqual(0.0051);
  }
  chart.moonSignCandidates = [...new Set([person.moon.signAtCivilDayStart, person.moon.signAtCivilDayEnd])];
  return chart;
}

const fixtures: [string, Chart][] = [
  ['Kahlo', kahlo],
  ...['edgar-allan-poe', 'franz-kafka', 'alexander-graham-bell', 'getulio-vargas']
    .map((slug): [string, Chart] => [slug, referenceChart(slug)]),
];

function svgFor(chart: Chart, selection: EntityRef | null = null, overlay = false) {
  const scene = buildSceneModel(chart);
  return render(h(Wheel, {
    bodies: scene.bodies, asc: scene.angles?.asc, mc: scene.angles?.mc,
    cusps: chart.houses?.cusps, aspects: scene.aspects, size,
    renderOverlay: overlay ? () => null : undefined,
    interactive: {
      scene, selection, emphasis: emphasisFor(scene, selection), label: 'Chart', onSelect: () => {},
      spotlight: selection ? { id: entityId(selection), run: 1, phase: 'settled', motion: 'instant' } : null,
    },
  }));
}

function markers(svg: string): Marker[] {
  return [...svg.matchAll(/<circle\b[^>]*data-body-marker="[^"]+"[^>]*>/g)].map(([tag]) => ({
    body: attr(tag, 'data-body-marker'), x: Number(attr(tag, 'cx')), y: Number(attr(tag, 'cy')),
    radius: Number(attr(tag, 'r')), stroke: Number(attr(tag, 'stroke-width')),
  }));
}

function leaders(svg: string) {
  return [...svg.matchAll(/<path\b[^>]*data-body-leader="[^"]+"[^>]*>/g)].map(([tag]) => {
    const coordinates = attr(tag, 'd').match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    return {
      body: attr(tag, 'data-body-leader'), tag,
      points: Array.from({ length: coordinates.length / 2 }, (_, i) => ({ x: coordinates[i * 2], y: coordinates[i * 2 + 1] })),
    };
  });
}

function longitude(p: Point, anchor: number) {
  return norm(anchor + Math.atan2(size / 2 - p.y, p.x - size / 2) * 180 / Math.PI - 180);
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}

function interiorCrossing(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point) => p.x * q.y - p.y * q.x;
  const ab = { x: b.x - a.x, y: b.y - a.y }, cd = { x: d.x - c.x, y: d.y - c.y };
  const ac = { x: c.x - a.x, y: c.y - a.y }, determinant = cross(ab, cd);
  if (Math.abs(determinant) < 1e-9) return false;
  const t = cross(ac, cd) / determinant, u = cross(ac, ab) / determinant;
  return t > 1e-7 && t < 1 - 1e-7 && u > 1e-7 && u < 1 - 1e-7;
}

describe.each(fixtures)('crowded interactive wheel: %s', (_name, chart) => {
  it('leaves a visible gutter between every rendered, stroked marker', () => {
    const circles = markers(svgFor(chart));
    expect(circles.map((p) => p.body).sort()).toEqual(buildSceneModel(chart).bodies.map((b) => b.body).sort());
    for (let i = 0; i < circles.length; i++) for (const other of circles.slice(i + 1)) {
      const body = circles[i];
      expect(distance(body, other) - body.radius - other.radius - (body.stroke + other.stroke) / 2,
        `${body.body}/${other.body}`).toBeGreaterThan(3);
    }
  });

  it('connects each true tick to its own marker rim without crossing other markers or leaders', () => {
    const scene = buildSceneModel(chart), svg = svgFor(chart), circles = markers(svg), paths = leaders(svg);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const body = scene.bodies.find((b) => b.body === path.body)!;
      const marker = circles.find((p) => p.body === path.body)!;
      expect(separation(longitude(path.points[0], scene.anchor.lon), body.lon)).toBeLessThan(0.004);
      expect(distance(path.points.at(-1)!, marker)).toBeCloseTo(marker.radius, 1);
      expect(separation(longitude(path.points.at(-1)!, scene.anchor.lon), longitude(marker, scene.anchor.lon))).toBeLessThan(0.004);
      expect(attr(path.tag, 'pointer-events')).toBe('none');
      const radii = path.points.map((p) => distance(p, { x: size / 2, y: size / 2 }));
      expect(radii.every((r, i) => i === 0 || r < radii[i - 1])).toBe(true);
      for (let i = 1; i < path.points.length; i++) for (const other of circles.filter((p) => p.body !== path.body)) {
        expect(segmentDistance(other, path.points[i - 1], path.points[i]), `${path.body} leader/${other.body}`)
          .toBeGreaterThan(other.radius + other.stroke / 2 + 0.5);
      }
    }
    for (let i = 0; i < paths.length; i++) for (const other of paths.slice(i + 1)) {
      for (let a = 1; a < paths[i].points.length; a++) for (let b = 1; b < other.points.length; b++) {
        expect(interiorCrossing(paths[i].points[a - 1], paths[i].points[a], other.points[b - 1], other.points[b]),
          `${paths[i].body}/${other.body}`).toBe(false);
      }
    }
  });

  it('preserves source positions, houses, aspects and Moon certainty without mutating the input', () => {
    const original = structuredClone(chart), scene = buildSceneModel(chart);
    expect(chart).toEqual(original);
    expect(scene.angles).toEqual(chart.angles);
    expect(scene.flags).toEqual(chart.flags);
    expect(scene.moonSignCandidates).toEqual(chart.moonSignCandidates);
    expect(scene.aspects.map(({ weight: _weight, ...aspect }) => aspect)).toEqual(chart.aspects.filter((a) => a.orb < 6));
    for (const body of scene.bodies) {
      const source = chart.bodies.find((b) => b.body === body.body)!;
      expect([body.lon, body.speed, body.retrograde]).toEqual([source.lon, source.speed, source.retrograde]);
      expect(body.house).toBe(chart.houses ? houseOf(source.lon, chart.houses.cusps) : null);
    }
    if (!chart.input.timeKnown) {
      expect(scene.angles).toBeNull(); expect(scene.houses).toBeNull();
    }
  });

  it('keeps rendered degree ticks and aspect endpoints at the true longitudes', () => {
    const scene = buildSceneModel(chart), svg = svgFor(chart);
    const ticks = [...svg.matchAll(/<g\b[^>]*data-entity="body:([^"]+)"[^>]*><line\b([^>]*)>/g)];
    expect(ticks).toHaveLength(scene.bodies.length);
    for (const [, name, line] of ticks) {
      const body = chart.bodies.find((b) => b.body === name)!;
      for (const end of ['1', '2']) {
        const point = { x: Number(attr(line, `x${end}`)), y: Number(attr(line, `y${end}`)) };
        expect(separation(longitude(point, scene.anchor.lon), body.lon)).toBeLessThan(1e-9);
      }
    }
    const chords = [...svg.matchAll(/<g\b[^>]*data-entity="aspect:([^"]+)"[^>]*><line\b([^>]*)>/g)];
    expect(chords).toHaveLength(scene.aspects.length);
    for (const [, id, line] of chords) {
      const aspect = scene.aspects.find((a) => `${a.a}-${a.type}-${a.b}` === id)!;
      for (const [name, end] of [[aspect.a, '1'], [aspect.b, '2']]) {
        const point = { x: Number(attr(line, `x${end}`)), y: Number(attr(line, `y${end}`)) };
        expect(separation(longitude(point, scene.anchor.lon), chart.bodies.find((b) => b.body === name)!.lon)).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps each selection and arrival ring centered on its marker with either viewBox', () => {
    for (const body of buildSceneModel(chart).bodies) for (const overlay of [false, true]) {
      const svg = svgFor(chart, { kind: 'body', body: body.body }, overlay);
      const marker = markers(svg).find((p) => p.body === body.body)!;
      const ring = svg.match(/<circle\b[^>]*class="wheel__sel-ring"[^>]*>/)![0];
      expect([Number(attr(ring, 'cx')), Number(attr(ring, 'cy'))]).toEqual([marker.x, marker.y]);
      expect(svg).toContain(`data-spotlight-target="body:${body.body}"`);
    }
  });
});

it('reserves visible natal markers before overlay hit strokes, leaving other overlay targets available', () => {
  const scene = buildSceneModel(kahlo), selected: (EntityRef | null)[] = [];
  const props = { bodies: scene.bodies, size, renderOverlay: () => null,
    interactive: { scene, selection: null, emphasis: emphasisFor(scene, null), label: 'Chart',
      onSelect: (value: EntityRef | null) => selected.push(value) } };
  const svg = Wheel(props);
  const capture = svg.props.onClickCapture as (event: MouseEvent) => void;
  // A nontrivial screen transform checks that viewBox padding/scale does not
  // change ownership. Browser coverage exercises the native DOM matrix.
  vi.stubGlobal('DOMPoint', class {
    constructor(public x: number, public y: number) {}
    matrixTransform() { return { x: (this.x - 17) / 0.6, y: (this.y - 31) / 0.6 }; }
  });
  try {
    for (const marker of markers(svgFor(kahlo))) {
      for (const offset of [0, -0.72, 0.72]) {
        const stop = vi.fn();
        capture({ clientX: (marker.x + marker.radius * offset) * 0.6 + 17,
          clientY: marker.y * 0.6 + 31, stopPropagation: stop,
          currentTarget: { getScreenCTM: () => ({ inverse: () => ({}) }) } } as unknown as MouseEvent);
        expect(stop).toHaveBeenCalledOnce();
        expect(selected.at(-1)).toEqual({ kind: 'body', body: marker.body });
      }
    }
    const count = selected.length, stop = vi.fn();
    capture({ clientX: 17, clientY: 31, stopPropagation: stop,
      currentTarget: { getScreenCTM: () => ({ inverse: () => ({}) }) } } as unknown as MouseEvent);
    expect(stop).not.toHaveBeenCalled();
    expect(selected).toHaveLength(count);
    expect(Wheel({ ...props, renderOverlay: undefined }).props.onClickCapture).toBeUndefined();
    expect(Wheel({ bodies: scene.bodies }).props.onClickCapture).toBeUndefined();
  } finally { vi.unstubAllGlobals(); }
});

describe('interactive layout identity at boundaries', () => {
  const withBodies = (positions: [BodyName, number][]): Chart => ({
    ...kahlo, houses: null, angles: null, aspects: [],
    bodies: positions.map(([body, lon]) => ({ ...kahlo.bodies.find((b) => b.body === body)!, lon })),
  });

  it('preserves circular order across Aries and stays independent of input order, including exact conjunctions', () => {
    for (const positions of [
      [['Sun', 356], ['Moon', 359], ['Mercury', 1], ['Venus', 4], ['Mars', 120]],
      [['Sun', 0], ['Moon', 0], ['Mercury', 0], ['Venus', 0], ['Mars', 120]],
    ] as [BodyName, number][][]) {
      const chart = withBodies(positions), scene = buildSceneModel(chart);
      const reverse = buildSceneModel({ ...chart, bodies: [...chart.bodies].reverse() });
      for (const body of scene.bodies) expect(body.drawLon).toBe(reverse.bodies.find((b) => b.body === body.body)!.drawLon);
      const trueOrder = [...scene.bodies].sort((a, b) => norm(a.lon - 350) - norm(b.lon - 350) || a.body.localeCompare(b.body)).map((b) => b.body);
      const drawnOrder = [...scene.bodies].sort((a, b) => norm(a.drawLon - 300) - norm(b.drawLon - 300)).map((b) => b.body);
      expect(drawnOrder).toEqual(trueOrder);
    }
  });

  it('does not move already-separated markers or draw unnecessary leaders', () => {
    const chart = withBodies([['Sun', 0], ['Moon', 120], ['Mercury', 240]]);
    const scene = buildSceneModel(chart);
    for (const body of scene.bodies) expect(norm(body.drawLon)).toBe(body.lon);
    expect(leaders(svgFor(chart))).toHaveLength(0);
  });

  it('retains distinct, stable marker identities even when every true tick coincides', () => {
    const chart = withBodies(kahlo.bodies.map((b) => [b.body, 0]));
    const scene = buildSceneModel(chart), reversed = buildSceneModel({ ...chart, bodies: [...chart.bodies].reverse() });
    const circles = markers(svgFor(chart));
    expect(new Set(circles.map((p) => p.body)).size).toBe(scene.bodies.length);
    for (let i = 0; i < circles.length; i++) for (const other of circles.slice(i + 1)) {
      expect(distance(circles[i], other)).toBeGreaterThan(circles[i].radius + other.radius + 1);
    }
    for (const body of scene.bodies) {
      expect(body.lon).toBe(0);
      expect(body.drawLon).toBe(reversed.bodies.find((b) => b.body === body.body)!.drawLon);
    }
  });
});
