/**
 * The /your-day/ page's calculation, on this device, loaded only when the form
 * is sent: the birth chart from the chart engine (src/lib/engine/full.ts), the
 * day's two midnights from the site's local-time resolver
 * (src/lib/time/localToUtc.ts), and the ranking and words the get_personal_day
 * tool uses (src/lib/personal-day/). Nothing here leaves the browser.
 */
import { castDayNatal, readPersonalDay, type PersonalDayReading } from '../../lib/personal-day/day';
import { prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';

export { prepareLocalTime };

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
}

const clock = { prepareLocalTime, resolveLocalToUtc };

export async function computeYourDay(input: YourDayInput): Promise<PersonalDayReading> {
  await prepareLocalTime(input.birthDate, input.birthZone);
  const natal = castDayNatal({ birthDate: input.birthDate, time: input.time, zone: input.birthZone, latitude: input.latitude, longitude: input.longitude }, clock);
  return readPersonalDay(natal, { birthDate: input.birthDate, date: input.date, zone: input.zone, today: input.today }, clock);
}
