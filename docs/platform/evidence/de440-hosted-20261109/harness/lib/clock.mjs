/**
 * Instants on the engine's own time basis (@zodiacs/engine/time, the same
 * engine the bundle carries): TT of a UTC millisecond, and the UTC
 * millisecond whose TT is nearest a TT Julian date (the preregistration's
 * pinned clock).
 */
import { timeBasis } from '@zodiacs/engine/time';

export const DAY_MS = 86_400_000;
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const J2000_JD = 2451545.0;

/** TT days from J2000 of a UTC millisecond, as the engine computes it. */
export const ttDaysOf = (ms) => timeBasis(ms).ttDays;
export const jdTtOf = (ms) => J2000_JD + ttDaysOf(ms);
export const isoOf = (ms) => new Date(ms).toISOString();

/**
 * The whole UTC millisecond whose engine TT is nearest the TT given (days from
 * J2000), and the residual in milliseconds (TT of that millisecond minus the
 * target).
 */
export function utcForTt(targetTtDays) {
  let ms = Math.round(J2000_MS + targetTtDays * DAY_MS);
  for (let n = 0; n < 8; n += 1) ms = Math.round(ms + (targetTtDays - ttDaysOf(ms)) * DAY_MS);
  let best = ms;
  for (let candidate = ms - 3; candidate <= ms + 3; candidate += 1) {
    if (Math.abs(ttDaysOf(candidate) - targetTtDays) < Math.abs(ttDaysOf(best) - targetTtDays)) best = candidate;
  }
  return { ms: best, residualMs: (ttDaysOf(best) - targetTtDays) * DAY_MS };
}
