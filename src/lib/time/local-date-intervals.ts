import { parseCivilDate } from './civil-date';
import { offsetAt as intlOffsetMinutes } from './localToUtc';

const DAY = 86_400_000;
const DATE_LIMIT = 8_640_000_000_000_000;
const MAX_TRANSITIONS = 32;

/** Integer epoch milliseconds; the exclusive boundary is not a sampling instant. */
export interface LocalDateInterval {
  readonly start: number;
  readonly endExclusive: number;
}

export type LocalDateIntervalsResult =
  | { readonly status: 'existing'; readonly intervals: readonly [LocalDateInterval, ...LocalDateInterval[]] }
  | { readonly status: 'empty'; readonly intervals: readonly [] }
  | { readonly status: 'unresolved'; readonly reason: LocalDateUnresolvedReason };

export type LocalDateUnresolvedReason =
  | 'invalid-input'
  | 'provider-unavailable'
  | 'invalid-provider'
  | 'provider-failed'
  | 'provider-violation'
  | 'transition-limit';

/**
 * Trusted completeness contract, not a claim established by this marker.
 * Methods must be synchronous and stable for the duration of a call. Offsets
 * are integer milliseconds strictly inside ±24h. nextTransition returns the
 * FIRST offset change strictly after its argument, or null if none exists.
 * Transition instants are exact integer milliseconds using the new offset.
 * An implementation must not substitute a sampled search for this obligation.
 * Finite validation cannot detect every deliberately omitted transition.
 */
export interface CompleteTransitionProvider {
  readonly completeness: 'complete-transitions-v1';
  offsetMilliseconds(timeZone: string, instant: number): number;
  nextTransitionMilliseconds(timeZone: string, after: number): number | null;
}

interface TemporalZonedInstant {
  readonly offsetNanoseconds: number;
  readonly epochNanoseconds: bigint;
  getTimeZoneTransition(direction: 'next'): TemporalZonedInstant | null;
}

interface TemporalInstant {
  toZonedDateTimeISO(timeZone: string): TemporalZonedInstant;
}

/**
 * Feature-detect the host Temporal interface when called. No polyfill is loaded.
 * As with Intl, the host supplies the timezone data and its historical limits.
 * Merely importing this module performs no browser, timezone or storage work.
 */
export function createNativeTemporalTransitionProvider(): CompleteTransitionProvider | null {
  const temporal: unknown = Reflect.get(globalThis, 'Temporal');
  if (!temporal || typeof temporal !== 'object') return null;
  const instant: unknown = Reflect.get(temporal, 'Instant');
  const zoned: unknown = Reflect.get(temporal, 'ZonedDateTime');
  if (typeof instant !== 'function' || typeof zoned !== 'function') return null;
  const from: unknown = Reflect.get(instant, 'fromEpochMilliseconds');
  const prototype: unknown = Reflect.get(zoned, 'prototype');
  if (typeof from !== 'function' || !prototype || typeof prototype !== 'object'
    || typeof Reflect.get(prototype, 'getTimeZoneTransition') !== 'function') return null;

  let validatedZone: string | undefined;
  const at = (timeZone: string, milliseconds: number): TemporalZonedInstant => {
    if (validatedZone !== timeZone) {
      // Temporal accepts additional timeZoneLike forms. Keep this API aligned
      // with the existing Intl timezone-identifier boundary, including offsets.
      new Intl.DateTimeFormat('en-US', { timeZone });
      validatedZone = timeZone;
    }
    const value = Reflect.apply(from, instant, [milliseconds]) as TemporalInstant;
    return value.toZonedDateTimeISO(timeZone);
  };
  return Object.freeze({
    completeness: 'complete-transitions-v1' as const,
    offsetMilliseconds(timeZone: string, instantMilliseconds: number) {
      const nanoseconds = at(timeZone, instantMilliseconds).offsetNanoseconds;
      if (!Number.isSafeInteger(nanoseconds) || nanoseconds % 1_000_000 !== 0) {
        throw new ProviderViolation();
      }
      const milliseconds = nanoseconds / 1_000_000;
      // Reuse the existing host Intl offset reader. Its integral-second offset
      // expressed as fractional minutes needs only conversion-noise rounding.
      // Disagreeing host interfaces cannot establish this date's membership.
      if (Math.round(intlOffsetMinutes(timeZone, instantMilliseconds) * 60_000) !== milliseconds) {
        throw new ProviderViolation();
      }
      return milliseconds;
    },
    nextTransitionMilliseconds(timeZone: string, after: number) {
      const next = at(timeZone, after).getTimeZoneTransition('next');
      if (next === null) return null;
      const nanoseconds = next.epochNanoseconds;
      if (typeof nanoseconds !== 'bigint' || nanoseconds % 1_000_000n !== 0n) {
        throw new ProviderViolation();
      }
      return Number(nanoseconds / 1_000_000n);
    },
  });
}

class ProviderViolation extends Error {}

function unresolved(reason: LocalDateUnresolvedReason): LocalDateIntervalsResult {
  return Object.freeze({ status: 'unresolved', reason });
}

function validInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= DATE_LIMIT;
}

/**
 * Existing Date-scale UTC members of a strictly validated Gregorian civil date.
 * No birth-time fold/gap disambiguation is applied. Disconnected dates remain
 * disconnected; an empty result is never a shifted representative instant.
 * Completeness is conditional on the supplied provider honoring its contract.
 * The reference assessment caller uses this for date membership, and
 * moon-day-bounds for the Moon's signs over the date; neither derives the
 * Sun's or changes calculation/receipt inputs.
 */
export function resolveLocalDateIntervals(
  date: unknown,
  timeZone: unknown,
  provider?: CompleteTransitionProvider | null,
): LocalDateIntervalsResult {
  const civil = parseCivilDate(date);
  if (!civil || typeof timeZone !== 'string' || timeZone.trim().length === 0) {
    return unresolved('invalid-input');
  }
  const wall = new Date(0);
  wall.setUTCFullYear(civil.year, civil.month - 1, civil.day);
  wall.setUTCHours(0, 0, 0, 0);
  const midnight = wall.getTime();
  // With offsets strictly inside ±24h, every member is inside this 72h window.
  // Nominal numeric date arithmetic also preserves years 0–99 and the internal
  // exclusive boundary after 9999-12-31 without widening public date syntax.
  const lower = midnight - DAY;
  const upper = midnight + 2 * DAY;
  const intervals: LocalDateInterval[] = [];

  try {
    const source: unknown = provider === undefined ? createNativeTemporalTransitionProvider() : provider;
    if (source === null) return unresolved('provider-unavailable');
    if (!source || typeof source !== 'object'
      || Reflect.get(source, 'completeness') !== 'complete-transitions-v1') {
      return unresolved('invalid-provider');
    }
    const offsetMethod: unknown = Reflect.get(source, 'offsetMilliseconds');
    const transitionMethod: unknown = Reflect.get(source, 'nextTransitionMilliseconds');
    if (typeof offsetMethod !== 'function' || typeof transitionMethod !== 'function') {
      return unresolved('invalid-provider');
    }
    const offsetAt = (instant: number): number => {
      const offset: unknown = Reflect.apply(offsetMethod, source, [timeZone, instant]);
      if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || Math.abs(offset) >= DAY) {
        throw new ProviderViolation();
      }
      return offset;
    };
    const append = (start: number, endExclusive: number, offset: number) => {
      const first = Math.max(start, midnight - offset);
      const end = Math.min(endExclusive, midnight + DAY - offset);
      if (first >= end) return;
      const previous = intervals.at(-1);
      if (previous && previous.endExclusive === first) {
        intervals[intervals.length - 1] = { start: previous.start, endExclusive: end };
      } else {
        intervals.push({ start: first, endExclusive: end });
      }
    };
    let cursor = lower;
    let offset = offsetAt(cursor);
    for (let transitions = 0; transitions <= MAX_TRANSITIONS; transitions += 1) {
      const candidate: unknown = Reflect.apply(transitionMethod, source, [timeZone, cursor]);
      let next: number | null;
      if (candidate === null) next = null;
      else if (validInstant(candidate) && candidate > cursor) next = candidate;
      else throw new ProviderViolation();
      const end = next === null ? upper : Math.min(next, upper);
      // Observable provider violations fail closed. These checks do not prove
      // that an untrusted provider has disclosed every intermediate transition.
      if (offsetAt(end - 1) !== offset) throw new ProviderViolation();
      append(cursor, end, offset);
      if (next === null || next >= upper) {
        const frozen = Object.freeze(intervals.map((interval) => Object.freeze(interval)));
        if (frozen.length === 0) return Object.freeze({ status: 'empty', intervals: Object.freeze([]) as readonly [] });
        return Object.freeze({ status: 'existing', intervals: frozen as readonly [LocalDateInterval, ...LocalDateInterval[]] });
      }
      if (transitions === MAX_TRANSITIONS) return unresolved('transition-limit');
      const nextOffset = offsetAt(next);
      if (nextOffset === offset) throw new ProviderViolation();
      cursor = next;
      offset = nextOffset;
    }
    return unresolved('transition-limit');
  } catch (error) {
    return unresolved(error instanceof ProviderViolation ? 'provider-violation' : 'provider-failed');
  }
}
