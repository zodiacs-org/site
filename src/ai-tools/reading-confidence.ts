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

export function readingConfidenceLabel(detail: ReadingDetail, tightOrb = false): string {
  return `Reading confidence ${readingConfidence(detail, tightOrb)}%`;
}
