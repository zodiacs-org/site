/**
 * Local civil time through @zodiacs/engine/geo, the resolver the birth chart
 * calculator also reads local times with (src/lib/time/localToUtc.ts delegates
 * to it): before 1970 the history of tzdata 2025c with its backzone file, which
 * the engine ships; from 1970 the runtime's Intl data; and before standard
 * time a birthplace's own mean time. Nothing here converts a time itself.
 *
 * The function receives the resolver as a dependency: api/_compute/handler.ts
 * passes api/_compute/local-time.mjs, which scripts/build-compute-local-time.mjs
 * bundles from local-time-source.ts with the engine's histories inlined, a
 * fresh copy for each request; tests pass the source module itself.
 */
import type { LocalTimeResolution as EngineLocalTimeResolution, TZDB } from '@zodiacs/engine/geo';
import type { LocalInput } from './validate.js';
import { isFixedOffsetZone } from '../time/fixed-zones.js';

export interface LocalTimeModule {
  prepareLocalTime(date: string, timeZone: string): Promise<void>;
  resolveLocalToUtc(date: string, time: string, timeZone: string, options?: { longitude?: number }): EngineLocalTimeResolution;
  /** The tzdb spelling of a zone name given in any letter case, or null (src/lib/time/zone-names.ts). */
  canonicalZoneName(name: string): Promise<string | null>;
  /** The tzdb release the engine ships. */
  TZDB: typeof TZDB;
}

export type LocalTimeFlag = EngineLocalTimeResolution['flags'][number];

export interface LocalResolution {
  input: LocalInput;
  utc: Date;
  /** Offset applied, minutes east of UTC; fractional before standard time. */
  offsetMinutes: number;
  flags: LocalTimeFlag[];
  /** The birthplace's own mean time, where the resolver used it. */
  localMeanTime: { longitude: number; zoneOffsetMinutes: number } | null;
  /**
   * Where the offset came from: the tzdb release the engine ships, with
   * backzone, which answers before 1970 for every zone it has a local time
   * for; otherwise the runtime's Intl data, as for a fixed offset such as UTC.
   */
  zoneHistory: 'pinned' | 'runtime';
  /**
   * True for a wall time before 1970-01-02 read on the runtime's data: a span
   * the release records as having no local time ("-00"), whose host reading
   * may give another city's clock. Never for a fixed offset, which cannot
   * differ.
   */
  zoneUncertain: boolean;
  /** Forward wall-clock shift of a DST gap, in minutes; 0 otherwise. */
  gapShiftMinutes: number;
  /**
   * The runtime's Intl offset of the zone at the same instant, minutes east,
   * where the pinned history answered; null otherwise. Intl carries tzdb's
   * default build, which before 1970 can give another offset (the engine's
   * docs/time.md lists 122 such zones against tzdata 2025c).
   */
  intlOffsetMinutes: number | null;
}

/** A wall time from 1970-01-02 on never reads before 1970, so the pinned history cannot apply. */
const PINNED_HISTORY_LAST_DATE = '1970-01-01';

function wallMilliseconds({ date, time }: LocalInput): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, 0, 0);
  return wall.getTime();
}

/**
 * Resolve a validated local time as the calculator does: prepare the history
 * the date can need, then read the wall time with the longitude when there is
 * one. Refusals from the resolver (an unsupported zone) surface as RangeError.
 */
export async function resolveLocal(
  module: LocalTimeModule,
  input: LocalInput,
  longitude: number | null,
): Promise<LocalResolution> {
  await module.prepareLocalTime(input.date, input.zone);
  const options = longitude === null ? {} : { longitude };
  const resolved = module.resolveLocalToUtc(input.date, input.time, input.zone, options);
  const early = input.date <= PINNED_HISTORY_LAST_DATE;
  const pinned = resolved.zone.source === 'tzdb';
  const gapShiftMinutes = (resolved.utc.getTime() + resolved.offsetMinutes * 60_000 - wallMilliseconds(input)) / 60_000;
  return {
    input,
    utc: resolved.utc,
    offsetMinutes: resolved.offsetMinutes,
    flags: [...resolved.flags],
    localMeanTime: resolved.localMeanTime ? { ...resolved.localMeanTime } : null,
    zoneHistory: pinned ? 'pinned' : 'runtime',
    zoneUncertain: early && !pinned && !isFixedOffsetZone(input.zone),
    gapShiftMinutes,
    intlOffsetMinutes: pinned ? resolved.intlOffsetMinutes : null,
  };
}

/**
 * Whether the two time zone histories the resolver can read disagree here:
 * the pinned history answered, and the runtime's Intl gives the zone another
 * offset at the same instant. Compared with the zone's own offset, so a time
 * read on the birthplace's own mean time is compared by the zone's clock.
 */
export function zoneHistoriesDisagree(local: LocalResolution): boolean {
  if (local.intlOffsetMinutes === null) return false;
  const zoneOffset = local.localMeanTime ? local.localMeanTime.zoneOffsetMinutes : local.offsetMinutes;
  return Math.abs(local.intlOffsetMinutes - zoneOffset) > 1e-9;
}

/** The runtime's own tzdb version, which Intl reads from 1970 on. */
export function runtimeTzdbVersion(): string | null {
  const version = typeof process === 'object' ? process.versions?.tz : undefined;
  return typeof version === 'string' && version ? version : null;
}

export type RuntimeIdentity = { name: 'node'; tzdbVersion?: string } | { name: 'browser' };

/**
 * The runtime that computes a receipt, as the receipt names it: Node, with the
 * tzdb release its Intl reads, or a browser running the developer
 * playground's bundle, which reports none.
 */
export function runtimeIdentity(): RuntimeIdentity {
  if (typeof process !== 'object' || process === null || typeof process.versions?.node !== 'string') return { name: 'browser' };
  const tzdb = runtimeTzdbVersion();
  return { name: 'node', ...(tzdb ? { tzdbVersion: tzdb } : {}) };
}

export interface TimeResolutionFacts {
  resolver: '@zodiacs/engine/geo';
  policy: { fold: 'earlier'; gap: 'shift-forward' };
  pinnedTzdb: { release: string; sha256: string; dataForm: 'main+backzone'; appliesBefore: '1970-01-02' };
  runtimeTzdb: string | null;
}

/** What a receipt records about how local times were read, without any input value. */
export function timeResolutionFacts(module: Pick<LocalTimeModule, 'TZDB'>): TimeResolutionFacts {
  return {
    resolver: '@zodiacs/engine/geo',
    policy: { fold: 'earlier', gap: 'shift-forward' },
    pinnedTzdb: { release: module.TZDB.version, sha256: module.TZDB.sha256, dataForm: 'main+backzone', appliesBefore: '1970-01-02' },
    runtimeTzdb: runtimeTzdbVersion(),
  };
}
