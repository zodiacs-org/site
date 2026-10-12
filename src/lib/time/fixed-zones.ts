/**
 * Zones whose offset never changes: UTC and Etc/GMT±N, under every name tzdb
 * gives them. The engine's resolver reads these from the host's Intl data at
 * every date, as it reads any zone from 1970, and for them Intl and tzdb cannot
 * differ. This is the engine's own rule (FIXED_ZONE in @zodiacs/engine/geo);
 * src/lib/time/fixed-zones.test.ts holds the two together.
 */
const FIXED_OFFSET_ZONE = /^(?:etc\/)?(?:utc|uct|gmt|gmt0|gmt[+-]0|greenwich|universal|zulu)$|^etc\/gmt[+-]\d{1,2}$/iu;

/** Whether a zone name, in any letter case, names a fixed offset. */
export function isFixedOffsetZone(name: string): boolean {
  return FIXED_OFFSET_ZONE.test(name);
}

/** The pattern itself, for the test that compares it with the engine's. */
export const FIXED_OFFSET_ZONE_SOURCE = FIXED_OFFSET_ZONE.source;
