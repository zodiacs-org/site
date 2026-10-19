/**
 * Which sign the lockup's ring brings to the front on an image made for one
 * person (DESIGN.md, "Brand Lockup"): their Sun sign, stated only as far as
 * their chart settles it (src/lib/profile/settled-signs.ts). Null keeps the
 * brand's own ring, so a chart without a birth time born near a sign
 * boundary never has a sign guessed for it.
 */
import { TILTED_RING_SIGNS } from './brand-lockup.mjs';
import { settledSignIndex } from './profile/settled-signs.js';

/** The Sun's sign from a chart's bodies, when the chart settles it. */
export function ringFront(
  bodies: readonly { body: string; lon: number }[] | null | undefined,
  timeKnown: boolean,
): string | null {
  const sun = bodies?.find((row) => row.body === 'Sun');
  const index = sun ? settledSignIndex('Sun', sun.lon, timeKnown) : null;
  return index === null ? null : TILTED_RING_SIGNS[index];
}

/**
 * The same from a Sun given to the whole degree, as a preview link carries
 * it: the Sun was somewhere in that degree, so both its ends must settle in
 * the same sign.
 */
export function ringFrontForWholeDegree(sun: number, timeKnown: boolean): string | null {
  const low = settledSignIndex('Sun', sun, timeKnown);
  const high = settledSignIndex('Sun', sun + 0.999, timeKnown);
  return low !== null && low === high ? TILTED_RING_SIGNS[low] : null;
}
