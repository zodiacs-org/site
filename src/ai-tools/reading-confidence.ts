/**
 * Reading confidence, one rule for every forecast the assistant tools return.
 *
 * The number says how specific the details were. It is not the chance that
 * something happens, and it does not change with the wording of the reading.
 *
 * - 40%: a Sun sign only, with no date
 * - 55%: a date, without both a clock time and a place
 * - 70%: a date, a clock time, and a place (latitude and longitude together)
 * - add 5 percentage points when a named contact's orb is under 1 degree,
 *   and never past 95
 *
 * A clock time raises the reading only together with a place. A time alone,
 * or a place alone, stays with the date. An exact transit counts as an orb
 * under 1 degree. The label is exactly "Reading confidence NN%".
 */
export type ReadingDetail = 'sign' | 'date' | 'timed-place';

const RANK: Record<ReadingDetail, number> = { sign: 0, date: 1, 'timed-place': 2 };

export function readingDetail(input: { hasDate: boolean; hasTime: boolean; hasPlace: boolean }): ReadingDetail {
  if (input.hasDate && input.hasTime && input.hasPlace) return 'timed-place';
  if (input.hasDate) return 'date';
  return 'sign';
}

/** The less specific of two charts, which limits a reading that uses both. */
export function coarserDetail(a: ReadingDetail, b: ReadingDetail): ReadingDetail {
  return RANK[a] <= RANK[b] ? a : b;
}

export function readingConfidence(detail: ReadingDetail, tightOrb = false): number {
  const base = detail === 'timed-place' ? 70 : detail === 'date' ? 55 : 40;
  return Math.min(95, base + (tightOrb ? 5 : 0));
}

/** The label for a value this rule gives, as a share card prints it. */
export function readingConfidenceText(value: number): string {
  return `Reading confidence ${value}%`;
}

export function readingConfidenceLabel(detail: ReadingDetail, tightOrb = false): string {
  return readingConfidenceText(readingConfidence(detail, tightOrb));
}

/**
 * The values a reading of two dated charts can have: a date, or a date with a
 * time and a place, each with or without a contact under 1 degree. A
 * compatibility share link may carry only one of these.
 */
export const PAIR_CONFIDENCES: readonly number[] = Object.freeze([...new Set((['date', 'timed-place'] as const)
  .flatMap((detail) => [readingConfidence(detail), readingConfidence(detail, true)]))]);

/** The values a dated day's reading can have, with no contact to tighten it. An occasion share link may carry only one of these. */
export const DAY_CONFIDENCES: readonly number[] = Object.freeze([readingConfidence('date'), readingConfidence('timed-place')]);
