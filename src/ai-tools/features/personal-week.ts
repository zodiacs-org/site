/**
 * "Your week" for the horoscope tool: where the moving planets meet the
 * person's own birth chart over the next seven days, as forecast lines.
 * It reuses Chart Studio's week scan (src/ai-tools/studio/week.ts) on the
 * bundled engine. Pure apart from the clock it is given; nothing is stored.
 */
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { computeChart } from '../../lib/engine/full.js';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { computeYourWeek } from '../studio/week-local';
import { weekDates, weekLine, weekTitle } from '../studio/week-words';

export interface PersonalWeekInput { birthDate: string; birthTime?: string; birthZone?: string }
export interface PersonalWeek {
  timeKnown: boolean;
  items: { title: string; line: string; when: string }[];
  note: string;
}

export const PERSONAL_WEEK_NOTE = 'From your own birth chart: astrology’s forecast for your week, not a guarantee.';

export async function personalWeek(
  input: PersonalWeekInput,
  now: Date,
  clock: Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>,
  zone?: string,
): Promise<PersonalWeek> {
  const date = parseCivilDate(input.birthDate);
  if (!date || date.year < 1800 || date.year > 2199) throw new RangeError('The birth date must be a real date from 1800 to 2199.');
  if (input.birthTime !== undefined && !parseCivilTime(input.birthTime)) throw new RangeError('The birth time must be HH:MM.');
  if (input.birthTime !== undefined && !input.birthZone) throw new RangeError('A birth time needs the birthplace time zone.');
  const timeKnown = input.birthTime !== undefined;
  const time = input.birthTime ?? '12:00';
  let utc: Date;
  if (input.birthZone) {
    await clock.prepareLocalTime(input.birthDate, input.birthZone);
    utc = clock.resolveLocalToUtc(input.birthDate, time, input.birthZone).utc;
  } else {
    utc = new Date(`${input.birthDate}T${time}:00Z`);
  }
  const chart = computeChart({ utc, houseSystem: 'whole', timeKnown });
  const week = computeYourWeek({
    natal: { bodies: chart.bodies.map(({ body, lon }) => ({ body, lon })), angles: null },
    timeKnown,
    fromUtc: now.toISOString(),
  });
  return {
    timeKnown,
    items: week.items.map((item) => ({ title: weekTitle(item), line: weekLine(item), when: weekDates(item, zone) })),
    note: PERSONAL_WEEK_NOTE,
  };
}
