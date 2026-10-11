/**
 * Local birth time → UTC, through @zodiacs/engine/geo, the engine's own
 * resolver. Nothing here converts a wall time itself: this module keeps the
 * site's signatures, input checks and error messages, and maps the engine's
 * resolution onto them.
 *
 * The engine reads a wall time in an IANA zone (docs/time.md in the engine):
 * - before 1970, on the zone's history from tzdata 2025c compiled with its
 *   backzone file, which the engine ships in 16 files and loads lazily, one per
 *   call of prepareLocalTime(date, timeZone);
 * - from 1970, and in the fixed zones, on the host's Intl data;
 * - given the birthplace's longitude, before the zone's local mean time era
 *   ended, on the birthplace's own mean time instead of the zone's reference
 *   city's (four minutes of time per degree of longitude).
 * A wall time the clock showed twice takes the earlier instant; one it skipped
 * moves forward by the jump. Await prepareLocalTime(date, timeZone) before
 * resolving any wall time: it loads the engine's resolver, which no page loads
 * until a calculation needs it, and for a date up to 1970 the zone's history;
 * resolving without them throws.
 *
 * offsetAt and localDateContainsUtc read the host's Intl data directly: they
 * answer questions about the host's clock, not about a birth.
 */
import { ModuleLoadError } from '../module-load';
import { TECHNICAL_OFFSET_LOCALE, TECHNICAL_WALL_LOCALE } from './technical-locales';
import { parseCivilDate, parseCivilTime } from './civil-date';

export interface LocalTimeOptions {
  /**
   * The birthplace's longitude, degrees east. Without it, a time from the
   * local mean time era uses the zone reference city's mean time.
   */
  longitude?: number;
}

export interface LocalTimeResolution {
  utc: Date;
  /** Offset applied, minutes east of UTC (may be fractional for LMT). */
  offsetMinutes: number;
  flags: ('dst-gap' | 'dst-fold' | 'lmt')[];
  /**
   * Present when the birthplace's own mean time read the wall time (also in
   * the gap at the end of its era): the longitude used, and the offset the
   * zone alone would have applied.
   */
  localMeanTime?: { longitude: number; zoneOffsetMinutes: number };
}

/**
 * Every local mean time era ends before this instant (the last, Niue and
 * Rarotonga, in October 1952).
 */
export const LOCAL_MEAN_TIME_ERAS_END_BEFORE = Date.UTC(1953, 0, 1);

/**
 * Whether a local date (YYYY-MM-DD) could fall in a local mean time era, so
 * that a birthplace's longitude can change how its wall time resolves. False
 * only for years after the last era ended.
 */
export function localMeanTimeCanApply(date: string): boolean {
  const year = Number(String(date).slice(0, 4));
  return !(Number.isFinite(year) && year > new Date(LOCAL_MEAN_TIME_ERAS_END_BEFORE).getUTCFullYear());
}

/**
 * Whether a wall time on this local date (YYYY-MM-DD) can need the zone's
 * shipped history, and so prepareLocalTime: for dates up to 1970. Saved charts
 * on such dates are the ones an earlier reading of the birthplace clock can
 * have left with another summary (src/lib/profile/refresh.ts).
 */
export function birthplaceTimeCanApply(date: string): boolean {
  return !(Number(String(date).slice(0, 4)) > 1970);
}

/**
 * Whether the host's Intl accepts a zone name; the engine is never asked about
 * one it refuses. Uses offsetAt's formatter cache, which holds only accepted
 * names and starts again at 1,024.
 */
function intlAccepts(timeZone: string): boolean {
  try {
    offsetFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether resolveLocalToUtc can read this wall time once its zone's history is
 * loaded: a real YYYY-MM-DD date, an HH:MM time and a zone the host's Intl
 * accepts. It converts nothing and loads nothing, so a caller that only checks
 * a stored record need not prepare the zone first.
 */
export function isResolvableLocalTime(date: string, time: string, timeZone: string): boolean {
  return Boolean(parseCivilDate(date) && parseCivilTime(time)) && intlAccepts(timeZone);
}

type EngineGeo = typeof import('@zodiacs/engine/geo');
/** The engine's resolver, once prepareLocalTime has loaded it. */
let geo: EngineGeo | null = null;
let geoLoad: Promise<EngineGeo> | null = null;

/**
 * Loads the engine's geo entry once; a failed download rejects with a
 * ModuleLoadError and is not remembered. The import is made here rather than
 * through loadModule, which callers' tests replace for their own downloads.
 */
function loadGeo(): Promise<EngineGeo> {
  if (!geoLoad) {
    const pending = import('@zodiacs/engine/geo').catch((cause: unknown) => {
      throw new ModuleLoadError(cause);
    });
    geoLoad = pending;
    void pending.catch(() => {
      if (geoLoad === pending) geoLoad = null;
    });
  }
  return geoLoad.then((module) => {
    geo = module;
    return module;
  });
}

/**
 * Loads what resolving a wall time on `date` (YYYY-MM-DD) in `timeZone`
 * needs: the engine's resolver, and for dates up to 1970 the zone's history
 * from the engine. A failed download rejects with a ModuleLoadError, like the
 * calculators' other code downloads, and is not remembered: the next call
 * tries again. A name Intl refuses loads no history; resolving it then throws.
 * The rejection counts as observed, so a caller that starts preparing early
 * and stops waiting (the chart calculator, when its engine fails to load
 * first) raises no unhandled rejection; a caller that awaits still sees it.
 */
export function prepareLocalTime(date: string, timeZone: string): Promise<void> {
  const ready = (async () => {
    const engine = await loadGeo();
    if (!birthplaceTimeCanApply(date) || !intlAccepts(timeZone)) return;
    try {
      await engine.prepareLocalTime(date, timeZone);
    } catch (cause) {
      throw new ModuleLoadError(cause);
    }
  })();
  void ready.catch(() => {});
  return ready;
}

/**
 * Formatters by zone name, as the caller gave it. Intl reads a name in any
 * letter case and also takes UTC offsets as names (+05:30), so a caller can
 * send thousands of names; each cache starts again once it holds 1,024, more
 * than there are named zones, and a name Intl refuses is never stored. The
 * compute API passes only a name's tzdb spelling (./zone-names.ts).
 */
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  // Intl treats undefined as the machine's timezone. Imported or stored
  // inputs must select an explicit zone, including at this public offset boundary.
  if (typeof tz !== 'string' || tz.length === 0) {
    throw new RangeError('An explicit supported timezone is required.');
  }
  let f = offsetFormatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(TECHNICAL_OFFSET_LOCALE, { timeZone: tz, timeZoneName: 'longOffset' });
    } catch {
      // Do not include a potentially private, untrusted zone value in errors.
      throw new RangeError('An explicit supported timezone is required.');
    }
    if (offsetFormatters.size >= 1024) offsetFormatters.clear();
    offsetFormatters.set(tz, f);
  }
  return f;
}

function wallFormatter(tz: string): Intl.DateTimeFormat {
  let f = wallFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat(TECHNICAL_WALL_LOCALE, {
      timeZone: tz,
      calendar: 'gregory', numberingSystem: 'latn', era: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3, hourCycle: 'h23',
    });
    if (wallFormatters.size >= 1024) wallFormatters.clear();
    wallFormatters.set(tz, f);
  }
  return f;
}

/** UTC offset of `tz` at a UTC instant, in minutes east (LMT-precise). */
export function offsetAt(tz: string, utcMs: number): number {
  const parts = offsetFormatter(tz).formatToParts(utcMs);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  // "GMT", "GMT+5", "GMT-06:36:36", "GMT+05:30"
  const m = name.match(/GMT([+-])?(\d{1,2})?(?::(\d{2}))?(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const h = Number(m[2] ?? 0);
  const min = Number(m[3] ?? 0);
  const s = Number(m[4] ?? 0);
  return sign * (h * 60 + min + s / 60);
}

function wallStringAt(tz: string, utcMs: number): string {
  const parts = wallFormatter(tz).formatToParts(utcMs);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  // Intl's Gregorian years are unpadded and count BCE from 1; ISO/Date
  // use astronomical years, where 1 BCE is 0000. Compare civil fields,
  // independently of the locale's display order and punctuation.
  const era = part('era');
  if (era !== 'AD' && era !== 'BC') throw new RangeError('Could not read Gregorian era.');
  const year = era === 'BC' ? 1 - Number(part('year')) : Number(part('year'));
  const isoYear = year >= 0 && year <= 9999
    ? String(year).padStart(4, '0')
    : `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`;
  return `${isoYear}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}.${part('fractionalSecond')}`;
}

/**
 * Whether this instant belongs to the requested local Gregorian date under
 * the host's timezone data. A false result refuses this representative; it
 * does not prove that the date is empty or establish whole-date coverage.
 * Invalid input or unavailable formatting throws without exposing input data.
 */
export function localDateContainsUtc(date: string, utc: Date, timeZone: string): boolean {
  try {
    if (!parseCivilDate(date) || typeof timeZone !== 'string' || timeZone.length === 0) {
      throw new RangeError();
    }
    // Read the Date's internal value once, including cross-realm Dates. Do not
    // invoke a caller's getTime override or normalize a date-like string.
    const instant = Date.prototype.getTime.call(utc);
    if (!Number.isFinite(instant)) throw new RangeError();
    return wallStringAt(timeZone, instant).split('T')[0] === date;
  } catch {
    throw new RangeError('Could not determine local-date membership from the supplied date, instant and explicit timezone.');
  }
}

/**
 * Resolve a wall-clock date + time in an IANA zone to UTC, through
 * @zodiacs/engine/geo. Inputs must be a real proleptic Gregorian YYYY-MM-DD
 * (0000–9999) and HH:MM (00:00–23:59). This syntax is not an astronomical
 * accuracy claim; callers such as birth sharing enforce their own narrower
 * year window. An explicit timezone supported by the host's Intl data is
 * required; omitted or invalid zones never fall back to the machine's
 * timezone, and the error never repeats the zone given.
 *
 * Ambiguous times (clocks fell back: two instants match) resolve to the
 * earlier instant with a `dst-fold` flag. Skipped times (clocks sprang
 * forward: no instant matches) shift forward by the gap with a `dst-gap`
 * flag. A wall time read on a local mean time adds `lmt`: the birthplace's own
 * mean time with a longitude, the zone's reference city's without one. A legal
 * time that ran to seconds, such as Paris Mean Time from 1891 or Madras time,
 * does not.
 *
 * Pass the birthplace's longitude whenever it is known: before the zone's
 * local mean time era ended, it replaces the reference city's mean time with
 * the birthplace's own, and the change out of that era is a gap or a fold
 * under the same policy. Await prepareLocalTime(date, tz) first.
 */
export function resolveLocalToUtc(
  date: string, // 'YYYY-MM-DD'
  time: string, // 'HH:MM'
  tz: string,
  options: LocalTimeOptions = {},
): LocalTimeResolution {
  // Reject before any conversion. An impossible date must not become a
  // different date marked as a DST gap.
  if (!parseCivilDate(date) || !parseCivilTime(time)) {
    throw new RangeError('resolveLocalToUtc needs a valid YYYY-MM-DD date and HH:MM time.');
  }
  // Intl treats undefined as the machine's timezone, and its own refusal
  // repeats the name given. Imported or stored inputs must select an explicit
  // zone, and the error must not carry a potentially private value.
  if (!intlAccepts(tz)) throw new RangeError('An explicit supported timezone is required.');
  const { longitude } = options;
  // A longitude the site cannot place is not a birthplace: as before, it is ignored.
  const place = typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { longitude } : {};
  if (!geo) {
    throw new Error('The local-time resolver is not loaded: await prepareLocalTime(date, timeZone) before resolving.');
  }
  let resolved: ReturnType<EngineGeo['resolveLocalToUtc']>;
  try {
    resolved = geo.resolveLocalToUtc(date, time, tz, place);
  } catch (error) {
    // Not loaded yet: the caller must await prepareLocalTime first.
    if (error instanceof geo.ZoneHistoryNotLoadedError) throw error;
    if (error instanceof RangeError) throw new RangeError('An explicit supported timezone is required.');
    throw error;
  }
  return {
    utc: resolved.utc,
    offsetMinutes: resolved.offsetMinutes,
    flags: [...resolved.flags],
    ...(resolved.localMeanTime ? { localMeanTime: { ...resolved.localMeanTime } } : {}),
  };
}
