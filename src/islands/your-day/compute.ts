/**
 * The /your-day/ page's calculation, on this device, loaded only when the form
 * is sent: the birth chart from the chart engine (src/lib/engine/full.ts), the
 * day's two midnights from the site's local-time resolver
 * (src/lib/time/localToUtc.ts), and the ranking and words the get_personal_day
 * tool uses (src/lib/personal-day/). Nothing here leaves the browser.
 */
import { castDayNatal, readPersonalDay, settledSunSign, type PersonalDayReading } from '../../lib/personal-day/day';
import type { ShareSign } from '../../lib/share-results';
import { ZONE_PER_HISTORY_FILE, prepareEveryZoneHistory } from '../../lib/time/every-zone-history';
import { isFixedOffsetZone } from '../../lib/time/fixed-zones';
import { birthplaceTimeCanApply, prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';

export { prepareEveryZoneHistory, prepareLocalTime };

export interface YourDayInput {
  birthDate: string;
  /** HH:MM on the birthplace clock, only when the person knows it. */
  time?: string | undefined;
  /** The birthplace's zone and coordinates. */
  birthZone: string;
  latitude: number;
  longitude: number;
  /** The day to read and the clock it is read on: the browser's own. */
  date: string;
  zone: string;
  today: string;
  /** The instant of the reading: the under-18 rule reads the calendar date at UTC-12 from it. */
  now: Date;
}

const HISTORY_DATE = '1900-01-01';

/** The engine's history-shard bucket (FNV-1a over lower-cased zone name, modulo ZONE_PER_HISTORY_FILE.length). */
function zoneHistoryBucket(zone: string): number {
  let hash = 2166136261;
  for (const char of zone.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash % ZONE_PER_HISTORY_FILE.length;
}

export async function computeYourDay(
  input: YourDayInput,
  preload: (date: string, zone: string) => Promise<void> = prepareLocalTime,
): Promise<PersonalDayReading & { sunSign: ShareSign | null }> {
  // Load the resolver and all 16 zone history files uniformly (independent of birth date or zone) so request logs
  // never hint at either. Tolerate individual unused shard failures without retrying any birth-specific file:
  // for a pre-1970 date, decode from the already-loaded shard when its bucket succeeded, or fail without retrying.
  const settled = await Promise.allSettled([
    preload('2026-01-01', 'UTC'),
    ...ZONE_PER_HISTORY_FILE.map((zone) => preload(HISTORY_DATE, zone)),
  ]);
  if (settled[0].status === 'rejected') throw settled[0].reason;
  const shardResults = settled.slice(1);
  const clock = {
    prepareLocalTime: async (date: string, zone: string) => {
      if (!birthplaceTimeCanApply(date) || isFixedOffsetZone(zone)) return;
      const bucket = shardResults[zoneHistoryBucket(zone)];
      if (bucket?.status === 'rejected') throw bucket.reason;
      await prepareLocalTime(date, zone);
    },
    resolveLocalToUtc,
  };
  await clock.prepareLocalTime(input.birthDate, input.birthZone);
  const natal = castDayNatal({ birthDate: input.birthDate, time: input.time, zone: input.birthZone, latitude: input.latitude, longitude: input.longitude }, clock);
  const reading = await readPersonalDay(natal, { birthDate: input.birthDate, date: input.date, zone: input.zone, today: input.today, now: input.now }, clock);
  const sunSign = await settledSunSign(natal, { birthDate: input.birthDate, zone: input.birthZone, longitude: input.longitude }, clock);
  return { ...reading, sunSign };
}
