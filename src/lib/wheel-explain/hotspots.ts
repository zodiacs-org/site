/**
 * Where the tap-to-explain hotspots sit over a static wheel, in percent of
 * the wheel's own box, with the finished explanation for each one.
 *
 * The positions repeat the geometry of the static `Wheel` (src/lib/wheel/
 * Wheel.tsx: radii, the 5% viewBox pad, the pinned collision nudge and the
 * cusp + 15 degree numeral) and of `HouseWheel.astro`, rather than changing
 * either renderer: the Wheel's static markup is pinned byte for byte for
 * shared cards. hotspots.test.ts renders the real Wheel and checks every
 * hotspot against the mark it explains, so the two cannot drift apart.
 *
 * Build-time only, like the copy it carries.
 */
import { houseOf } from '../engine/houses';
import { collisionNudge } from '../scene/layout';
import { SIGNS, signForLongitude } from '../signs';
import {
  explainHouse,
  explainPlanet,
  explainSign,
  type ChartContext,
  type Explanation,
  type WheelExplainCopy,
  wheelExplainCopy,
} from './copy';

export interface ExplainSpot extends Explanation {
  /** Centre of the mark, in percent of the wheel's box (0 to 100). */
  x: number;
  y: number;
  /** The sign hue that tints the spot's ring. */
  hue: string;
}

export interface StaticWheelInput {
  bodies: readonly { body: string; lon: number; retrograde?: boolean }[];
  asc?: number | null;
  cusps?: readonly number[] | null;
  /** The Wheel's `size` prop; positions are relative, so any size gives the same percentages. */
  size?: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The static Wheel's frame: the same numbers the component uses. */
export function staticWheelFrame(size = 420) {
  const pad = size * 0.05;
  return {
    size,
    pad,
    frame: size + pad * 2,
    rSigns: size * 0.475,
    rSignsIn: size * 0.395,
    rBodies: size * 0.31,
    rAspects: size * 0.235,
  };
}

/** Hotspots for every planet, sign and house number on a static Wheel. */
export function staticWheelSpots(input: StaticWheelInput, copy: WheelExplainCopy = wheelExplainCopy('en').copy): ExplainSpot[] {
  const { size, pad, frame, rSigns, rSignsIn, rBodies, rAspects } = staticWheelFrame(input.size);
  const anchor = input.asc ?? 0;
  const cx = size / 2;
  const cy = size / 2;
  const at = (lon: number, r: number) => {
    const phi = ((180 + (lon - anchor)) * Math.PI) / 180;
    return {
      x: round(((cx + r * Math.cos(phi) + pad) / frame) * 100),
      y: round(((cy - r * Math.sin(phi) + pad) / frame) * 100),
    };
  };

  const cusps = input.cusps && input.cusps.length === 12 ? input.cusps : null;
  const placements = input.bodies.map((b) => ({
    body: b.body,
    lon: b.lon,
    retrograde: b.retrograde,
    house: cusps ? houseOf(b.lon, [...cusps]) : null,
  }));
  const chart: ChartContext = { bodies: placements };
  const drawLon = collisionNudge(placements);

  const planets = [...placements]
    .sort((a, b) => a.lon - b.lon)
    .map((p): ExplainSpot => ({
      ...explainPlanet(p, copy),
      ...at(drawLon.get(p.body) ?? p.lon, rBodies),
      hue: signForLongitude(p.lon).hue,
    }));

  const signs = SIGNS.map((sign, i): ExplainSpot => ({
    ...explainSign(sign.slug, chart, copy),
    ...at(i * 30 + 15, (rSigns + rSignsIn) / 2),
    hue: sign.hue,
  }));

  const houses = cusps
    ? cusps.map((lon, i): ExplainSpot => ({
        ...explainHouse(i + 1, chart, copy),
        ...at(lon + 15, (rAspects + rBodies) / 2 - size * 0.02),
        hue: signForLongitude(lon + 15).hue,
      }))
    : [];

  return [...planets, ...signs, ...houses];
}

/**
 * Where HouseWheel draws numeral n, in its 200 unit viewBox: midway between
 * the rings (radii 40 and 78), at the middle of the house's 30 degree
 * sector. HouseWheel itself places its numerals with this function.
 */
export function houseWheelNumeral(n: number): { x: number; y: number } {
  const deg = 270 - 30 * (n - 1) - 15;
  const rad = ((deg - 90) * Math.PI) / 180;
  // Rounded exactly as HouseWheel's own fmt() did, so its markup is unchanged.
  return { x: Number((100 + 59 * Math.cos(rad)).toFixed(2)), y: Number((100 + 59 * Math.sin(rad)).toFixed(2)) };
}

/**
 * Hotspots for HouseWheel's twelve numerals. It is a diagram of the houses,
 * not anyone's chart, so the copy carries no chart context.
 */
export function houseWheelSpots(hue: string, copy: WheelExplainCopy = wheelExplainCopy('en').copy): ExplainSpot[] {
  return Array.from({ length: 12 }, (_, i) => {
    const { x, y } = houseWheelNumeral(i + 1);
    return { ...explainHouse(i + 1, null, copy), x: round(x / 2), y: round(y / 2), hue };
  });
}
