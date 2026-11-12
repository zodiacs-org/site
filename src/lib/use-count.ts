/**
 * The `use` bucket for `good_day_check` (docs/ANALYTICS.md, "Growth test
 * events"): first, second or a later check on this device.
 *
 * The count lives in this browser's local storage and stops at 3, so the
 * device holds no more than "a later one" and never a history. It is the same
 * small number on every device that has checked as often, so it identifies
 * nobody, and it never leaves the device: only the bucket word goes into the
 * event. Nothing calls this yet; the good-days page does in a later change.
 */
import { USE_BUCKET_VALUES } from './analytics-config.mjs';

export type UseBucket = 'first' | 'second' | 'more';
export const USE_BUCKETS = USE_BUCKET_VALUES as readonly UseBucket[];

export const GOOD_DAY_CHECKS_KEY = 'zodiacs.good-day-checks.v1';

const CAP = 3;

type LocalStore = Pick<Storage, 'getItem' | 'setItem'>;

function localStore(): LocalStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function bucketForCount(count: number): UseBucket {
  if (count <= 1) return 'first';
  if (count === 2) return 'second';
  return 'more';
}

/**
 * Counts one more good-day check on this device and returns its bucket.
 * Without storage the check is counted as a first, since nothing can show an
 * earlier one.
 */
export function countGoodDayCheck(store: LocalStore | null = localStore()): UseBucket {
  if (!store) return 'first';
  let previous = 0;
  try {
    const raw = store.getItem(GOOD_DAY_CHECKS_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    previous = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, CAP) : 0;
  } catch {
    return 'first';
  }
  const next = Math.min(previous + 1, CAP);
  try {
    store.setItem(GOOD_DAY_CHECKS_KEY, String(next));
  } catch {
    // A full or blocked store still answers with the bucket it read.
  }
  return bucketForCount(next);
}
