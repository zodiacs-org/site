/**
 * Every time-zone history the engine ships, loaded at once, for a page that
 * must not let its downloads say anything about a birth.
 *
 * `prepareLocalTime(date, timeZone)` downloads a zone's history only for a
 * date up to 1970, and only the one of the engine's sixteen history files
 * that holds that zone (its name's FNV-1a hash, modulo 16). So the request,
 * or its absence, tells the host that a birth is from 1970 or before and
 * narrows its zone to a sixteenth of the world's. A page that awaits
 * `prepareEveryZoneHistory()` first asks for all sixteen files every time,
 * whatever the date and zone, and the later `prepareLocalTime` call then
 * downloads nothing more.
 *
 * Opt in: only a page that calls it pays for it (16 files, about 189 KB
 * uncompressed and 54 KB gzipped, once per visit). Every other caller of
 * `prepareLocalTime` is unchanged.
 */
import { prepareLocalTime } from './localToUtc';

/**
 * One zone held by each of the engine's sixteen history files, in file order
 * (`every-zone-history.test.ts` checks the order against the engine's hash and
 * that every zone's history is loaded afterwards).
 */
export const ZONE_PER_HISTORY_FILE: readonly string[] = Object.freeze([
  'Asia/Taipei', 'Asia/Shanghai', 'Australia/Sydney', 'Europe/Warsaw',
  'America/Los_Angeles', 'Asia/Kolkata', 'America/Bogota', 'America/Mexico_City',
  'Asia/Manila', 'America/Sao_Paulo', 'Africa/Lagos', 'Europe/Lisbon',
  'America/New_York', 'Europe/Rome', 'Europe/London', 'Europe/Paris',
]);

/** A date the engine reads from a zone's history (up to 1970); it only selects the files. */
const HISTORY_DATE = '1900-01-01';

/**
 * Loads all sixteen history files. A failed download rejects with the
 * resolver's ModuleLoadError, like prepareLocalTime, and is not remembered.
 */
export async function prepareEveryZoneHistory(): Promise<void> {
  await Promise.all(ZONE_PER_HISTORY_FILE.map((zone) => prepareLocalTime(HISTORY_DATE, zone)));
}
