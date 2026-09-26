/**
 * The limits every request crosses before it reaches a calculation.
 *
 * Arguments here arrive from a language model, so the rule this module exists
 * to keep is narrow and absolute: a model-supplied value becomes a number, a
 * date, or one of a fixed set of option strings, and nothing else. It never
 * becomes a command to run, a path to open, a module to import, a URL to
 * fetch, or a version to download. The adapter imports no filesystem, process
 * or network module at all, so that property is structural rather than a
 * check that could be forgotten — `scripts/mcp-artifact.test.mjs` asserts it against the
 * built artifact.
 */
import { NATAL_ENVELOPE_LIMITS } from '@zodiacs/engine/receipt';

/** This adapter's own version, distinct from the engine's. */
export const ADAPTER_VERSION = '0.1.0-rc.9';
export const ADAPTER_NAME = 'zodiacs-mcp-server';

/**
 * The epoch the site supports everywhere else — every date input on
 * zodiacs.org carries `min="1800-01-01" max="2199-12-31"`, and the transit
 * scanner refuses outside it. The adapter adopts that bound rather than
 * inventing a wider one: the engine's own receipts record
 * `broadDateRange: "not-certified"`.
 */
export const EPOCH_MIN_UTC = '1800-01-01T00:00:00.000Z';
export const EPOCH_MAX_UTC = '2199-12-31T23:59:59.999Z';
const EPOCH_MIN = Date.parse(EPOCH_MIN_UTC);
const EPOCH_MAX = Date.parse(EPOCH_MAX_UTC);

/**
 * The engine's twelve house systems, the default first. Anything else is
 * refused, not substituted.
 */
export const HOUSE_SYSTEMS = Object.freeze([
  'placidus', 'whole', 'porphyry', 'equal', 'vehlow', 'koch', 'regiomontanus',
  'campanus', 'topocentric', 'alcabitius', 'morinus', 'meridian',
] as const);
export type HouseSystemName = (typeof HOUSE_SYSTEMS)[number];

/**
 * The references this adapter can actually produce. Omission never infers noon.
 *
 * The envelope vocabulary has a third value, `local-noon`, and it is not
 * offered here: the codec refuses it unless the record also carries a captured
 * local resolution — a date, a wall time, an IANA zone and the offset in force
 * at that instant — and this adapter resolves no timezones, so it has none to
 * supply. Advertising an option that is refused in every combination is worse
 * than not offering it. An AI review found it advertised and unusable.
 */
export const REFERENCES = Object.freeze(['supplied-instant', 'utc-noon'] as const);
export type ReferenceName = (typeof REFERENCES)[number];

/**
 * `utc-noon` has two preconditions the codec enforces and neither the schema
 * nor the documentation used to state: the instant must be exactly midday UTC,
 * and the birth time must be declared unknown. That is what the value means —
 * "no time was known, so midday UTC stands in" — and a caller who sets it
 * beside a real birth time is describing something else.
 */
export const UTC_NOON_MS = 12 * 60 * 60 * 1000;
export function utcNoonMisused(instant: Date, timeKnown: boolean): string | null {
  if (timeKnown) {
    return 'reference "utc-noon" records that no birth time was known, so it needs timeKnown: false.'
      + ' For a real birth time use "supplied-instant", or omit reference entirely';
  }
  if (((instant.getTime() % 86_400_000) + 86_400_000) % 86_400_000 !== UTC_NOON_MS) {
    return 'reference "utc-noon" needs utc to be exactly 12:00:00Z on the date in question';
  }
  return null;
}

/**
 * The engine does not compute angles at the exact geographic poles — its own
 * receipts record `angleExclusions: "exact-geographic-poles-and-ecliptic-horizon-coincidence"`.
 * The schema still admits ±90 because a chart with no known time has no angles
 * to compute and succeeds there; this is the case the schema bound alone got
 * wrong, and it was refused with an internal error code until an AI review
 * pointed at it.
 */
export function polarAngleExclusion(
  coordinates: { readonly latitude: number } | null,
  timeKnown: boolean,
): string | null {
  if (!coordinates || !timeKnown || Math.abs(coordinates.latitude) !== 90) return null;
  return 'the engine does not compute angles at the exact poles, so latitude 90 or -90 needs'
    + ' timeKnown: false. Use 89.999999 for a chart that is nearly there';
}

export const OUTPUTS = Object.freeze(['summary', 'record'] as const);
export type OutputName = (typeof OUTPUTS)[number];

export const COMPARE_OUTPUTS = Object.freeze(['summary', 'full'] as const);
export type CompareOutputName = (typeof COMPARE_OUTPUTS)[number];

/**
 * Rows whose two values ARE the finding, rather than a birth detail or a
 * computed position.
 *
 * "The two charts asked for different house systems" is only useful if the
 * answer says which two, and `placidus` is not anybody's birth detail. The
 * instants, the coordinates, the supplied zone and every body, angle, cusp and
 * aspect value are the other kind: the caller supplied both records to this
 * call, so echoing their contents back tells them nothing they did not already
 * have, while adding a second copy to whatever the result travels through.
 *
 * This is minimisation, not anonymisation. It shortens what travels onward; it
 * hides nothing from a host that already received both records as arguments.
 *
 * One member is not strictly a setting, and an AI review was right to say so.
 * `engine-version` is the record's own unauthenticated claim about itself, and
 * SemVer build and prerelease identifiers admit `[0-9A-Za-z-]`, so a record
 * author can carry an arbitrary digits-and-hyphens payload there and see it
 * repeated in the default answer. It is kept anyway, for the same reason
 * `houses-actual` is: an engine-version difference whose answer will not say
 * which two versions is not an answer. The payload comes out of a record the
 * caller passed in, not out of a chart this adapter computed, so it adds
 * nothing the caller did not already send. Every other member carries a closed
 * enum, a boolean, an array length, or a frozen conventions value — verified
 * over the wire against the full row vocabulary, not a sample.
 */
const SETTING_ROW = /^(time-known|reference|houses-|cusps-shape|angles-presence|engine-version|schema|result-flags|input-flags|convention-)/u;

export function rowValueIsTheFinding(id: string): boolean {
  return SETTING_ROW.test(id);
}

/**
 * Request and response sizes.
 *
 * `RECORD_BYTES` is the engine's own envelope limit, checked here before the
 * string reaches `JSON.parse` so an oversized argument costs a length test
 * rather than a parse. `INSTANT_CHARS` bounds the date argument so a
 * megabyte-long string is refused by the schema, not by a regex walking it.
 *
 * `resultBytes`, `differences` and `explanations` are headroom rather than
 * operative limits, and an AI review was right that they should not be
 * described as bounds a caller could reach. The comparison's own structure caps
 * it near 206 rows and a dozen candidate causes, and the largest result anyone
 * has produced from it is 20,756 bytes — under 8% of the byte cap. They are
 * here so the bound is a fixed number rather than an assumption, and so an
 * engine change that made results much larger is refused with its size named
 * instead of returned.
 */
export const LIMITS = Object.freeze({
  recordBytes: NATAL_ENVELOPE_LIMITS.bytes,
  recordDepth: NATAL_ENVELOPE_LIMITS.depth,
  recordNodes: NATAL_ENVELOPE_LIMITS.nodes,
  instantChars: 64,
  /**
   * The transport's read buffer, set explicitly rather than left at the SDK's
   * 10 MB default. The largest legitimate request carries two records at the
   * byte limit; JSON string escaping can roughly quadruple those in the worst
   * case, which lands near 0.5 MB, so 1 MB admits every valid request and
   * refuses an order of magnitude less than the default would.
   */
  requestBytes: 1048576,
  resultBytes: 262144,
  differences: 512,
  explanations: 64,
});

export type InstantParse =
  | { readonly ok: true; readonly instant: Date; readonly supplied: string }
  | { readonly ok: false; readonly reason: string };

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * An ISO-8601 instant with an explicit zone designator, validated as a
 * calendar date before it is parsed as a timestamp.
 *
 * A naked wall time is refused rather than assumed to be UTC: the caller knows
 * which zone they mean and the adapter does not resolve timezones. `2001-02-29`
 * is refused as a date that does not exist, which `Date.parse` would otherwise
 * roll forward into March.
 */
export function parseInstant(value: string): InstantParse {
  if (value.length > LIMITS.instantChars) return { ok: false, reason: 'utc is too long to be an instant' };
  const match = INSTANT.exec(value);
  if (!match) {
    return {
      ok: false,
      // The example date here is deliberately not one any test supplies as
      // input. A refusal that names a fixed example is fine; a check for an
      // echoed argument cannot tell the two apart if they are the same string.
      reason: 'utc must be an ISO-8601 instant with an explicit zone, such as 2000-01-01T00:00:00Z or 2000-01-01T05:30:00+05:30',
    };
  }
  const [, y, mo, d, h, mi, s, , zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return { ok: false, reason: 'utc names a month outside 1-12' };
  if (day < 1 || day > daysInMonth(year, month)) return { ok: false, reason: 'utc names a day that does not exist in that month' };
  if (Number(h) > 23 || Number(mi) > 59 || (s !== undefined && Number(s) > 59)) {
    return { ok: false, reason: 'utc names a time outside 00:00:00-23:59:59; leap seconds are not accepted' };
  }
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    if (offsetMinutes > 59 || offsetHours * 60 + offsetMinutes > 14 * 60) {
      return { ok: false, reason: 'utc names a zone offset beyond ±14:00' };
    }
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return { ok: false, reason: 'utc is not a resolvable instant' };
  if (parsed < EPOCH_MIN || parsed > EPOCH_MAX) {
    return { ok: false, reason: `utc must fall within ${EPOCH_MIN_UTC} to ${EPOCH_MAX_UTC}` };
  }
  return { ok: true, instant: new Date(parsed), supplied: value };
}

export type CoordinateParse =
  | { readonly ok: true; readonly coordinates: { readonly latitude: number; readonly longitude: number } | null }
  | { readonly ok: false; readonly reason: string };

/**
 * Coordinates, or neither. Supplying one alone is refused rather than
 * defaulted: a chart at longitude zero is a different chart, and the engine's
 * own `missing-location` path is the honest result when a place is unknown.
 */
export function parseCoordinates(latitude: number | undefined, longitude: number | undefined): CoordinateParse {
  if (latitude === undefined && longitude === undefined) return { ok: true, coordinates: null };
  if (latitude === undefined || longitude === undefined) {
    return { ok: false, reason: 'supply both latitude and longitude, or neither' };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, reason: 'latitude must be a finite number within -90 to 90' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, reason: 'longitude must be a finite number within -180 to 180' };
  }
  return { ok: true, coordinates: { latitude, longitude } };
}

/**
 * The size gate on an imported record, applied to bytes rather than characters
 * because the engine's limit is a byte limit and a record may carry non-ASCII
 * text in its extensions.
 */
export function recordTooLarge(record: string): number | null {
  const bytes = Buffer.byteLength(record, 'utf8');
  return bytes > LIMITS.recordBytes ? bytes : null;
}

/**
 * The gate on what goes back. A result over the cap is refused with its size
 * named, never trimmed into something that reads complete.
 */
export function resultTooLarge(result: unknown): number | null {
  const bytes = Buffer.byteLength(JSON.stringify(result) ?? '', 'utf8');
  return bytes > LIMITS.resultBytes ? bytes : null;
}
