/**
 * The birthplace clock: what resolveLocalToUtc reads a birthplace's wall time
 * on for dates up to 1970, and the tables it needs. prepareLocalTime loads
 * this module lazily, so no page carries it in its initial script and dates
 * after 1970 never load it.
 *
 * Until the zone's local mean time era ended (src/data/tz-lmt.json), the
 * clock showed the birthplace's own mean time; then the zone's legal time,
 * from the pinned tzdb release with backzone before 1970
 * (src/data/tz-history/) and from Intl after.
 */
import { loadModule } from '../module-load';
import {
  LOCAL_MEAN_TIME_ERAS_END_BEFORE,
  birthplaceTimeCanApply,
  localMeanTimeCanApply,
  offsetAt,
  type LocalTimeResolution,
} from './localToUtc';
import type { ZoneHistory } from './tz-history-load';

/** Unix seconds at which each zone's local mean time era ended, once loaded. */
let lmtEraEnd: Readonly<Record<string, number>> | null = null;
/** Each era's own mean time offset (seconds east), from the table rather than the host. */
let lmtOffsets: Readonly<Record<string, number>> = {};
/** For eras that crossed the date line: each line's end (Unix seconds) and offset (seconds east). */
let lmtDateLine: Readonly<Record<string, readonly (readonly number[])[]>> = {};
/**
 * The table's own spelling of each zone, by the lower-cased name. Intl reads
 * a name in any letter case, so the table is read the same way: America/New_York
 * and america/new_york are one zone with one local mean time era.
 */
let lmtNames: ReadonlyMap<string, string> = new Map();
let lmtEraLoad: Promise<void> | null = null;

/**
 * Offsets before 1970 from the pinned release, per lower-cased zone name once
 * loaded (Intl ignores the case of a name, so this does too); null where the
 * host's apply. Only names Intl accepts are kept, so the map holds at most
 * one entry per zone.
 */
const zoneHistories = new Map<string, ZoneHistory | null>();
const zoneHistoryLoads = new Map<string, Promise<void>>();
/** The host's history applies from 1970-01-01T00:00:00Z. */
const ZONE_HISTORY_END = 0;

/** A zone name with its ASCII letters lower-cased, as Intl compares names. */
function nameKey(name: string): string {
  return name.replace(/[A-Z]/gu, (letter) => letter.toLowerCase());
}

function intlAccepts(name: string): boolean {
  try {
    offsetAt(name, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the local mean time era table for dates up to 1953 and the zone's
 * pinned history for dates up to 1970. A failed download rejects with a
 * ModuleLoadError and is not remembered: the next call tries again. A name
 * Intl refuses loads no history; resolving it throws before one is needed.
 */
export function prepare(date: string, timeZone: string): Promise<void> {
  const loads: Promise<void>[] = [];
  if (localMeanTimeCanApply(date) && !lmtEraEnd) {
    if (!lmtEraLoad) {
      const pending = loadModule(() => import('../../data/tz-lmt.json')).then(({ default: table }) => {
        lmtOffsets = table.offsets;
        lmtDateLine = table.dateLine;
        lmtNames = new Map(Object.keys(table.eras).map((name) => [nameKey(name), name]));
        lmtEraEnd = table.eras;
      });
      lmtEraLoad = pending;
      void pending.catch(() => {
        if (lmtEraLoad === pending) lmtEraLoad = null;
      });
    }
    loads.push(lmtEraLoad);
  }
  const key = nameKey(timeZone);
  if (birthplaceTimeCanApply(date) && !zoneHistories.has(key) && intlAccepts(timeZone)) {
    let pending = zoneHistoryLoads.get(key);
    if (!pending) {
      const load = loadModule(async () => (await import('./tz-history-load')).loadZoneHistory(timeZone))
        .then((history) => { zoneHistories.set(key, history); });
      zoneHistoryLoads.set(key, load);
      void load.catch(() => {
        if (zoneHistoryLoads.get(key) === load) zoneHistoryLoads.delete(key);
      });
      pending = load;
    }
    loads.push(pending);
  }
  return Promise.all(loads).then(() => undefined);
}

/**
 * A birthplace's reading of a wall time, or null where its clock is the
 * zone's host clock: the instant, flags, the offset the zone's own pinned
 * clock would have given (null without a pinned history), and whether the
 * instant fell in the birthplace's own mean time.
 */
export function readBirthplace(tz: string, wallMs: number, longitude: number): {
  chosen: { utcMs: number; offset: number };
  flags: LocalTimeResolution['flags'];
  zoneOffset: number | null;
  inEra: boolean;
} | null {
  const place = birthplaceClock(tz, wallMs, longitude);
  if (!place) return null;
  const zoneOffset = place.pinned ? readClock(wallMs, place.zoneAt, place.samples).chosen.offset : null;
  const { chosen, flags } = readClock(wallMs, place.clockAt, place.samples);
  return { chosen, flags, zoneOffset, inEra: chosen.utcMs < place.endMs };
}

/**
 * A birthplace this far from its zone's own mean time is not in that zone.
 * The widest real case in the city index is Gar, in western Tibet, 165
 * minutes from Shanghai's mean time.
 */
const MAX_MEAN_TIME_DEPARTURE_MINUTES = 180;

/** The offset (minutes east) a pinned history gives at an instant before 1970; null where it has none ("-00"). */
function pinnedOffset(history: ZoneHistory, utcMs: number): number | null {
  let lo = 0;
  let hi = history.t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (history.t[mid] * 1000 <= utcMs) lo = mid + 1;
    else hi = mid;
  }
  const offset = history.o[lo];
  return offset === null ? null : offset / 60;
}

/**
 * The birthplace's clock, where it differs from reading the wall time
 * through Intl: a plausible longitude, and either a wall time near or inside
 * the zone's local mean time era, or one near or before 1970 in a zone the
 * pinned release covers. Null leaves Intl's reading.
 *
 * Until the era ended the clock showed the birthplace's mean time, on the
 * side of the date line the zone's own era kept at that instant (Manila and
 * Pohnpei kept the American date until 1844, Alaska the Asian one until
 * 1867); from then on it showed the zone's legal time, from the pinned
 * release before 1970 and from Intl after.
 */
function birthplaceClock(
  tz: string,
  wallMs: number,
  longitude: number | undefined,
): { clockAt: (utcMs: number) => number; zoneAt: (utcMs: number) => number; samples: number[]; endMs: number; pinned: boolean } | null {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  const probe = 36 * 3600_000;
  // No reading of a wall time from 1970-01-02 on falls before 1970 (no
  // offset reaches 24 hours), so later dates never need the pinned history.
  let history: ZoneHistory | null = null;
  if (wallMs < ZONE_HISTORY_END + 86_400_000) {
    const key = nameKey(tz);
    if (!zoneHistories.has(key)) {
      throw new Error('Zone history is not loaded: await prepareLocalTime(date, timeZone) before resolving.');
    }
    history = zoneHistories.get(key)!;
  }
  const zoneAt = (utcMs: number): number => (history && utcMs < ZONE_HISTORY_END
    ? pinnedOffset(history, utcMs) ?? offsetAt(tz, utcMs)
    : offsetAt(tz, utcMs));

  let endMs = Number.NEGATIVE_INFINITY;
  let meanOffset = (utcMs: number): number => zoneAt(utcMs);
  // Every era ended before LOCAL_MEAN_TIME_ERAS_END_BEFORE; no reading of a
  // later wall time can fall inside one, so later instants never need the table.
  if (wallMs - probe - LOCAL_MEAN_TIME_ERAS_END_BEFORE <= 0) {
    if (!lmtEraEnd) {
      throw new Error('Local mean time eras are not loaded: await prepareLocalTime(date, timeZone) before resolving.');
    }
    // The table's spelling of the zone, whatever case it was given in.
    const era = lmtNames.get(nameKey(tz));
    if (era !== undefined && wallMs - probe - lmtEraEnd[era] * 1000 <= 0) {
      const eraEnd = lmtEraEnd[era] * 1000;
      // Mean solar time runs four minutes per degree of longitude, kept to
      // whole seconds as IANA offsets are.
      const meanSeconds = Math.round(longitude * 240);
      // The zone's own mean time during the era, from the table: it fixes
      // the side of the date line, which the host's data can get wrong (it
      // lacks Pohnpei's move in 1844 and puts Midway on the Asian date).
      const own = (table: Readonly<Record<string, unknown>>) => Object.prototype.hasOwnProperty.call(table, era);
      const eraLines = own(lmtDateLine) ? lmtDateLine[era] : null;
      const eraOffset = (utcMs: number): number => {
        if (eraLines) for (const [until, offset] of eraLines) if (utcMs < until * 1000) return offset / 60;
        if (own(lmtOffsets)) return lmtOffsets[era] / 60;
        return zoneAt(utcMs);
      };
      const birthplaceOffset = (utcMs: number): number => {
        const days = Math.round((eraOffset(utcMs) * 60 - meanSeconds) / 86_400);
        return (meanSeconds + days * 86_400) / 60;
      };
      // A longitude hours away from the zone's own mean time belongs to
      // another zone; leave such an input to the zone rather than invent a
      // clock. In whole seconds, so a departure of exactly the bound is
      // treated alike in every zone.
      const eraSample = Math.min(wallMs, eraEnd - 1);
      const departure = Math.abs(Math.round(birthplaceOffset(eraSample) * 60) - Math.round(eraOffset(eraSample) * 60));
      if (departure <= MAX_MEAN_TIME_DEPARTURE_MINUTES * 60) {
        endMs = eraEnd;
        meanOffset = birthplaceOffset;
      }
    }
  }
  if (endMs === Number.NEGATIVE_INFINITY && !history) return null;

  // Without the pinned history, the host can record the change out of the
  // era later than the table does, with another city's offset in between.
  // If the host's offset changes within the probe after the era's end, the
  // birthplace went straight to the later one.
  let legalFrom = endMs;
  if (!history && offsetAt(tz, endMs + probe) !== offsetAt(tz, endMs)) {
    const atEnd = offsetAt(tz, endMs);
    let lo = endMs;
    let hi = endMs + probe;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (offsetAt(tz, mid) === atEnd) lo = mid;
      else hi = mid;
    }
    legalFrom = hi;
  }
  const clockAt = (utcMs: number): number => (utcMs < endMs ? meanOffset(utcMs) : zoneAt(Math.max(utcMs, legalFrom)));
  const samples = [wallMs - probe, wallMs, wallMs + probe];
  if (endMs > Number.NEGATIVE_INFINITY) samples.push(endMs - 1, endMs, legalFrom);
  return { clockAt, zoneAt, samples, endMs, pinned: history !== null };
}

/**
 * Reads a wall time on a clock under the ordinary policy: readings are
 * enumerated against the clock, a repeated reading takes the earlier
 * instant, and a skipped one moves forward by the offset the clock showed
 * just before it jumped.
 */
function readClock(
  wallMs: number,
  clockAt: (utcMs: number) => number,
  samples: number[],
): { chosen: { utcMs: number; offset: number }; flags: LocalTimeResolution['flags'] } {
  const probe = 36 * 3600_000;
  const readings: { utcMs: number; offset: number }[] = [];
  for (const offset of new Set(samples.map(clockAt))) {
    const utcMs = wallMs - Math.round(offset * 60_000);
    if (Math.abs(clockAt(utcMs) - offset) < 1e-9 && !readings.some((reading) => reading.utcMs === utcMs)) {
      readings.push({ utcMs, offset });
    }
  }
  readings.sort((a, b) => a.utcMs - b.utcMs);
  if (readings.length > 0) return { chosen: readings[0], flags: readings.length > 1 ? ['dst-fold'] : [] };
  // Skipped: the clock jumped over this wall time. Find the jump, and apply
  // the offset the clock showed just before it.
  const wallOf = (utcMs: number): number => utcMs + Math.round(clockAt(utcMs) * 60_000);
  let lo = wallMs - probe - 86_400_000;
  let hi = wallMs + probe + 86_400_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (wallOf(mid) > wallMs) hi = mid;
    else lo = mid;
  }
  const utcMs = wallMs - Math.round(clockAt(lo) * 60_000);
  return { chosen: { utcMs, offset: clockAt(utcMs) }, flags: ['dst-gap'] };
}
