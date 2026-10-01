import type { BodyName, BodyPosition } from './engine/types';
import { signForLongitude } from './signs';

/**
 * The shared sign at two supplied positions, or null if either is missing or
 * they differ. Agreement does not establish stability between the samples or
 * across the whole local date.
 */
export function stableBodySignSlug(
  body: BodyName,
  startBodies: readonly BodyPosition[],
  endBodies: readonly BodyPosition[],
): string | null {
  const start = startBodies.find((position) => position.body === body);
  const end = endBodies.find((position) => position.body === body);
  if (!start || !end) return null;
  const startSlug = signForLongitude(start.lon).slug;
  return startSlug === signForLongitude(end.lon).slug ? startSlug : null;
}

export function bodySignIsAmbiguous(
  body: BodyName,
  startBodies: readonly BodyPosition[],
  endBodies: readonly BodyPosition[],
): boolean {
  return stableBodySignSlug(body, startBodies, endBodies) === null;
}
