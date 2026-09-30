/**
 * Local birth time → UTC, honoring the history available for the IANA zone —
 * DST, wartime shifts, pre-standardization local mean time (which can
 * carry seconds, e.g. America/Mexico_City at −6:36:36 before 1922).
 *
 * The browser/Node host's ICU data exposes its tzdb history through Intl.
 * Coverage and tzdb version therefore depend on that runtime. Without a
 * birthplace, and for every instant from 1970 on, legal offsets come from
 * there; nothing here hand-rolls a legal offset.
 *
 * One era needs more than the zone: before a place adopted a legal time, its
 * clocks kept that place's own mean solar time, and tzdb records that only
 * for the zone's reference city. Given the birthplace's longitude, instants
 * before the zone's local mean time era ended use the birthplace's mean time
 * (four minutes of time per degree of longitude) instead of the reference
 * city's. When each era ended comes from src/data/tz-lmt.json, generated
 * from a pinned tzdb release that includes backzone.
 *
 * Given a longitude, instants before 1970 also take the zone's legal offsets
 * from that pinned release (src/data/tz-history/), not from Intl: browsers
 * carry tzdb's default build, which gives many places another city's history
 * before 1970 (Stockholm keeps Berlin's). Every later instant is Intl's. Both
 * tables load on demand, only for dates that can need them: await
 * prepareLocalTime(date, timeZone) before resolving a birthplace time.
 */
import { loadModule } from '../module-load';
import { TECHNICAL_OFFSET_LOCALE, TECHNICAL_WALL_LOCALE } from './technical-locales';
import { parseCivilDate, parseCivilTime } from './civil-date';

export interface LocalTimeOptions {
  /**
   * The birthplace's longitude, degrees east. Without it, a time from the
   * local mean time era uses the zone reference city's mean time, and a time
   * before 1970 the host's history.
   */
  longitude?: number;
}

export interface LocalTimeResolution {
  utc: Date;
  /** Offset applied, minutes east of UTC (may be fractional for LMT). */
  offsetMinutes: number;
  flags: ('dst-gap' | 'dst-fold' | 'lmt')[];
  /**
   * Present when the instant falls in the birthplace's own local mean time:
   * the longitude used, and the offset the zone alone would have applied.
   */
  localMeanTime?: { longitude: number; zoneOffsetMinutes: number };
}

type BirthplaceClock = typeof import('./birthplace-clock');
/** The birthplace clock, once prepareLocalTime has loaded it. */
let birthplace: BirthplaceClock | null = null;
let birthplaceLoad: Promise<BirthplaceClock> | null = null;
/** A wall time from 1970-01-02 on never reads before 1970, so it never needs the birthplace clock. */
const BIRTHPLACE_WALL_END = 86_400_000;

/**
 * Every era in the table ends before this instant (the last, Niue and
 * Rarotonga, in October 1952); a test holds the table to it.
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
 * Whether a birthplace's longitude can change how a wall time on this local
 * date (YYYY-MM-DD) resolves, through its local mean time or its zone's
 * pinned history: for dates up to 1970.
 */
export function birthplaceTimeCanApply(date: string): boolean {
  return !(Number(String(date).slice(0, 4)) > 1970);
}

/**
 * Loads what resolving a birthplace time on `date` (YYYY-MM-DD) in
 * `timeZone` can need: for dates up to 1970, the birthplace clock with the
 * local mean time era table (up to 1953) and the zone's pinned history.
 * Later dates need nothing. Resolving such a date with a longitude without
 * them throws rather than guess. A failed download rejects with a
 * ModuleLoadError, like the calculators' other code downloads, and is not
 * remembered: the next call tries again. The rejection counts as observed,
 * so a caller that starts preparing early and stops waiting (the chart
 * calculator, when its engine fails to load first) raises no unhandled
 * rejection; a caller that awaits still sees it.
 */
export function prepareLocalTime(date: string, timeZone: string): Promise<void> {
  if (!birthplaceTimeCanApply(date)) return Promise.resolve();
  if (!birthplaceLoad) {
    const pending = loadModule(() => import('./birthplace-clock'));
    birthplaceLoad = pending;
    void pending.catch(() => {
      if (birthplaceLoad === pending) birthplaceLoad = null;
    });
  }
  const ready = birthplaceLoad.then((module) => {
    birthplace = module;
    return module.prepare(date, timeZone);
  });
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
 * Resolve a wall-clock date + time in an IANA zone to UTC.
 * Inputs must be a real proleptic Gregorian YYYY-MM-DD (0000–9999) and
 * HH:MM (00:00–23:59). This syntax is not an astronomical accuracy claim;
 * callers such as birth sharing enforce their own narrower year window.
 * An explicit timezone supported by the host's Intl data is required;
 * omitted or invalid zones never fall back to the machine's timezone.
 *
 * Ambiguous times (clocks fell back — two instants match) resolve to the
 * earlier instant with a `dst-fold` flag. Skipped times (clocks sprang
 * forward — no instant matches) shift forward by the gap with a
 * `dst-gap` flag. With a longitude, a wall time read on a local mean time
 * adds `lmt`, as @zodiacs/engine defines the flag from 0.1.1-rc.15: the
 * birthplace's own mean time, or the zone's, before the zone's local mean time
 * era ended (src/data/tz-lmt.json). A legal time that ran to seconds, such as
 * Paris Mean Time from 1891 or Madras time, does not, and a local mean time in
 * whole minutes does. Without a longitude nothing is claimed: the host's
 * history cannot tell a zone's local mean time from the national mean time
 * that kept its offset (Paris 1891–1911, Dublin 1880–1916).
 *
 * Pass the birthplace's longitude whenever it is known: before the zone's
 * local mean time era ended, it replaces the reference city's mean time with
 * the birthplace's own, and the change out of that era is a gap or a fold
 * under the same policy; before 1970, the zone's legal offsets come from the
 * pinned release rather than the host. With a longitude, await
 * prepareLocalTime(date, tz) first.
 */
export function resolveLocalToUtc(
  date: string, // 'YYYY-MM-DD'
  time: string, // 'HH:MM'
  tz: string,
  options: LocalTimeOptions = {},
): LocalTimeResolution {
  // Reject before any Date normalization or timezone conversion. An
  // impossible date must not become a different date marked as a DST gap.
  const civilDate = parseCivilDate(date);
  const civilTime = parseCivilTime(time);
  if (!civilDate || !civilTime) {
    throw new RangeError('resolveLocalToUtc needs a valid YYYY-MM-DD date and HH:MM time.');
  }
  // Date.UTC remaps years 0–99 into 1900–1999. Preserve the typed year,
  // including year 0000's leap day, before asking Intl about its offset.
  const wallDate = new Date(0);
  wallDate.setUTCFullYear(civilDate.year, civilDate.month - 1, civilDate.day);
  wallDate.setUTCHours(civilTime.hour, civilTime.minute, 0, 0);
  const wallMs = wallDate.getTime();
  // HH:MM denotes exactly zero seconds/milliseconds. Shortening a candidate
  // to its minute hides historical gaps and creates false folds.
  const wallStr = `${date}T${time}:00.000`;

  // Candidate offsets sampled around the wall instant.
  const sampled = [
    offsetAt(tz, wallMs - 36 * 3600_000),
    offsetAt(tz, wallMs),
    offsetAt(tz, wallMs + 36 * 3600_000),
  ];
  const candidates = [...new Set(sampled)];

  const matches: { utcMs: number; offset: number }[] = [];
  for (const off of candidates) {
    // IANA offsets have integral seconds. Remove floating-point conversion
    // noise at millisecond precision without rounding away historical seconds.
    const utcMs = wallMs - Math.round(off * 60_000);
    if (wallStringAt(tz, utcMs) === wallStr) {
      matches.push({ utcMs, offset: offsetAt(tz, utcMs) });
    }
  }

  let flags: LocalTimeResolution['flags'] = [];
  let chosen: { utcMs: number; offset: number };

  if (matches.length === 1) {
    chosen = matches[0];
  } else if (matches.length > 1) {
    // Fold: two readings of the same wall clock — take the earlier.
    matches.sort((a, b) => a.utcMs - b.utcMs);
    chosen = matches[0];
    flags.push('dst-fold');
  } else {
    // Gap: this wall time never happened. Shift forward by the gap —
    // apply the offset that was valid just before the transition.
    const before = offsetAt(tz, wallMs - 36 * 3600_000);
    const utcMs = wallMs - Math.round(before * 60_000);
    chosen = { utcMs, offset: offsetAt(tz, utcMs) };
    flags.push('dst-gap');
  }

  let zoneOffset = chosen.offset;
  let inEra = false;
  let readByBirthplace = false;
  const { longitude } = options;
  if (typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    && wallMs < BIRTHPLACE_WALL_END) {
    if (!birthplace) {
      throw new Error('The birthplace clock is not loaded: await prepareLocalTime(date, timeZone) before resolving.');
    }
    const place = birthplace.readBirthplace(tz, wallMs, longitude);
    if (place) {
      ({ chosen, flags, inEra } = place);
      if (place.zoneOffset !== null) zoneOffset = place.zoneOffset;
      readByBirthplace = true;
    }
  }

  // The birthplace clock read the wall time on a local mean time: before the
  // zone's era ended in its table.
  if (readByBirthplace && birthplace!.inMeanTimeEra(tz, chosen.utcMs)) flags.push('lmt');

  return {
    utc: new Date(chosen.utcMs),
    offsetMinutes: chosen.offset,
    flags,
    ...(inEra ? { localMeanTime: { longitude: longitude!, zoneOffsetMinutes: zoneOffset } } : {}),
  };
}
