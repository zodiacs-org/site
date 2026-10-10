/**
 * Composite midpoint positions and aspects from the carried package.
 * The adapter copies the package's frozen rows to preserve the site's mutable
 * result shape. The package owns the calculation and malformed-input refusal.
 */
import {
  compositeAspects as packageCompositeAspects,
  compositeMidpoints as packageCompositeMidpoints,
} from '@zodiacs/engine/techniques';
import type { AspectType, BodyName } from './engine/types';

export interface CompositePoint { body: BodyName; lon: number }
export interface CompositeAspect { a: BodyName; b: BodyName; type: AspectType; orb: number }

/** Shared bodies in first-chart order; exact opposites use the eastward midpoint. */
export function compositeMidpoints(
  a: readonly { body: BodyName; lon: number }[],
  b: readonly { body: BodyName; lon: number }[],
): CompositePoint[] {
  return packageCompositeMidpoints(a, b).map(({ body, lon }) => ({ body, lon }));
}

/** Natal-rule aspects without applying/separating state. */
export function compositeAspects(points: readonly CompositePoint[]): CompositeAspect[] {
  return packageCompositeAspects(points).map(({ a, b, type, orb }) => ({ a, b, type, orb }));
}
