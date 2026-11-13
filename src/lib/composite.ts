/**
 * The composite chart's points and aspects. Since engine 1.1.0-rc.2 the
 * arithmetic is the engine's own, from `@zodiacs/engine/lite`, which loads no
 * ephemeris; this module keeps the site's names and its mutable shapes,
 * copying the engine's frozen rows.
 */
import {
  compositeAspects as packageCompositeAspects,
  compositeMidpoints as packageCompositeMidpoints,
} from '@zodiacs/engine/lite';
import type { AspectType, BodyName } from './engine/types';

export interface CompositePoint { body: BodyName; lon: number }
export interface CompositeAspect { a: BodyName; b: BodyName; type: AspectType; orb: number }

/**
 * Shorter-arc midpoints of the bodies present in BOTH charts, in chart-a
 * order. Exact opposites (180 degrees apart) take the midpoint of the arc
 * running eastward (increasing longitude) from a's position: a documented
 * convention, asserted in tests. The engine refuses with a RangeError a name
 * that is not one of the twelve bodies, a body listed twice and a longitude
 * that is not a finite number.
 */
export function compositeMidpoints(
  a: readonly { body: BodyName; lon: number }[],
  b: readonly { body: BodyName; lon: number }[],
): CompositePoint[] {
  return packageCompositeMidpoints(a, b).map(({ body, lon }) => ({ body, lon }));
}

/**
 * Aspects between composite points via the natal aspect definitions, among
 * the Sun to Pluto, tightest first. No applying or separating: composite
 * points have no speeds.
 */
export function compositeAspects(points: readonly CompositePoint[]): CompositeAspect[] {
  return packageCompositeAspects(points).map(({ a, b, type, orb }) => ({ a, b, type, orb }));
}
