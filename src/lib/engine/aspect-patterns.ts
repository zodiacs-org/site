/**
 * Aspect patterns: grand trines, T-squares, grand crosses and kites among the
 * Sun to Pluto, found as complete graphs of the chart's own aspect records.
 * The detection is @zodiacs/engine's (`@zodiacs/engine/techniques` since
 * engine rc.16, which ported this module into the package). The site keeps
 * its result shape: the package refuses malformed input with a RangeError,
 * and the panel reads that as `{ status: 'unavailable', reason }`, with the
 * package's reason, which is the site's own wording.
 *
 * Only the lazily loaded pattern panel and card import this, after a chart
 * has loaded the engine.
 */
import { aspectPatterns } from '@zodiacs/engine/techniques';
import type { AspectPattern, PatternBody, PatternEdgeInput, PatternPoint } from '@zodiacs/engine/techniques';

export { PATTERN_BODIES } from '@zodiacs/engine/techniques';
export type { AspectPattern, PatternBody, PatternEdge, PatternEdgeInput, PatternKind, PatternPoint } from '@zodiacs/engine/techniques';

export type PatternDetection =
  | { status: 'ready'; points: readonly { readonly body: PatternBody; readonly lon: number }[]; patterns: readonly AspectPattern[] }
  | { status: 'unavailable'; reason: string };

/**
 * Reuse the owning inclusive aspect thresholds without rounding or scene cuts.
 * Missing edges are not inferred: each complete required graph must be present.
 * Static geometry validates supplied records; speeds/applying state are irrelevant.
 */
export function detectAspectPatterns(points: readonly PatternPoint[], aspects: readonly PatternEdgeInput[]): PatternDetection {
  try {
    const detected = aspectPatterns(points, aspects);
    return { status: 'ready', points: detected.points, patterns: detected.patterns };
  } catch (error) {
    if (error instanceof RangeError) return { status: 'unavailable', reason: error.message };
    throw error;
  }
}
