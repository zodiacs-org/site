/**
 * Local civil time through the site's own resolver, src/lib/time/localToUtc.ts:
 * the function the birth chart calculator calls, with its pinned zone history
 * before 1970 and a birthplace's own mean time before standard time. Nothing
 * here converts a time itself.
 *
 * The resolver cannot be imported by a Vercel function as it is (extensionless
 * relative imports, and JSON loaded without import attributes), so the function
 * receives it as a dependency: api/_compute/handler.ts passes api/_compute/local-time.mjs,
 * which scripts/build-compute-local-time.mjs bundles from that same source with
 * its tables, and tests pass the source module itself.
 */
import type { LocalTimeResolution } from '../time/localToUtc.js';
import { PINNED_TZDB_RELEASE } from './constants.js';
import type { LocalInput } from './validate.js';

export interface LocalTimeModule {
  prepareLocalTime(date: string, timeZone: string): Promise<void>;
  resolveLocalToUtc(date: string, time: string, timeZone: string, options?: { longitude?: number }): LocalTimeResolution;
  loadZoneHistory(name: string): Promise<unknown>;
  /** The tzdb spelling of a zone name given in any letter case, or null (src/lib/time/zone-names.ts). */
  canonicalZoneName(name: string): Promise<string | null>;
}

export type LocalTimeFlag = LocalTimeResolution['flags'][number];

export interface LocalResolution {
  input: LocalInput;
  utc: Date;
  /** Offset applied, minutes east of UTC; fractional before standard time. */
  offsetMinutes: number;
  flags: LocalTimeFlag[];
  /** The birthplace's own mean time, where the resolver used it. */
  localMeanTime: { longitude: number; zoneOffsetMinutes: number } | null;
  /**
   * Where the offset came from: the pinned tzdb release with backzone, which
   * the resolver reads before 1970 when it has the birthplace's longitude and
   * the release has the zone; otherwise the runtime's Intl data.
   */
  zoneHistory: 'pinned' | 'runtime';
  /**
   * True for a wall time before 1970-01-02 read on the runtime's data. Default
   * tzdb builds, which Intl carries, merge zones that have agreed since 1970,
   * so before then they can give another city's clock changes.
   */
  zoneUncertain: boolean;
  /** Forward wall-clock shift of a DST gap, in minutes; 0 otherwise. */
  gapShiftMinutes: number;
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
 * Resolve a validated local time as the calculator does: prepare the tables
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
  const pinned = early && longitude !== null && (await module.loadZoneHistory(input.zone)) !== null;
  const gapShiftMinutes = (resolved.utc.getTime() + resolved.offsetMinutes * 60_000 - wallMilliseconds(input)) / 60_000;
  return {
    input,
    utc: resolved.utc,
    offsetMinutes: resolved.offsetMinutes,
    flags: [...resolved.flags],
    localMeanTime: resolved.localMeanTime ? { ...resolved.localMeanTime } : null,
    zoneHistory: pinned ? 'pinned' : 'runtime',
    zoneUncertain: early && !pinned,
    gapShiftMinutes,
  };
}

/** The runtime's own tzdb version, which Intl reads from 1970 on. */
export function runtimeTzdbVersion(): string | null {
  const version = typeof process === 'object' ? process.versions?.tz : undefined;
  return typeof version === 'string' && version ? version : null;
}

export interface TimeResolutionFacts {
  resolver: 'src/lib/time/localToUtc.ts';
  policy: { fold: 'earlier'; gap: 'shift-forward' };
  pinnedTzdb: { release: string; dataForm: 'main+backzone'; appliesBefore: '1970-01-02'; requires: 'longitude' };
  runtimeTzdb: string | null;
}

/** What a receipt records about how local times were read, without any input value. */
export function timeResolutionFacts(): TimeResolutionFacts {
  return {
    resolver: 'src/lib/time/localToUtc.ts',
    policy: { fold: 'earlier', gap: 'shift-forward' },
    pinnedTzdb: { release: PINNED_TZDB_RELEASE, dataForm: 'main+backzone', appliesBefore: '1970-01-02', requires: 'longitude' },
    runtimeTzdb: runtimeTzdbVersion(),
  };
}
