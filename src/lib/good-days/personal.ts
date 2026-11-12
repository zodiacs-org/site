/**
 * The good day finder's optional personal reading: the person's own chart,
 * met by the sky on each day of the window. It reads two things:
 * - the Moon's sign that day against the natal Sun's: the same element reads
 *   as harmony, a square or opposite sign as tension;
 * - exact contacts from Venus, Mars, Jupiter and Saturn to the natal Sun and
 *   Venus (and the Moon, with a birth time), from the site's transit scanner
 *   (src/lib/engine/transit-scan.ts), on the day they are exact.
 *
 * The birth details are used for the one request and dropped with it: nothing
 * here stores, logs or returns them, and the result carries only the natal Sun
 * sign. The caller refuses a birth date under 13 before this module is reached.
 */
import { computeChart } from '../engine/full.js';
import { scanTransitContacts, type NatalPoint, type TransitBody } from '../engine/transit-scan';
import { SIGNS } from '../signs';
import type { Factor, GoodDaysClock } from './find';

export interface BirthDetails {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM on the birthplace clock, only when known. Needs zone. */
  time?: string;
  /** The birthplace's time zone. */
  zone?: string;
}

export interface PersonalChart {
  bodies: { body: string; lon: number }[];
  timeKnown: boolean;
  /** The natal Sun sign, or null when the Sun changed sign on an untimed day of birth. */
  sun: string | null;
}

interface PersonalDay { date: string; start: Date; end: Date; moonSign: string }

const HOUR = 3_600_000;
const BENEFICS: readonly TransitBody[] = ['Venus', 'Jupiter'];
const MALEFICS: readonly TransitBody[] = ['Mars', 'Saturn'];
const VERB: Record<string, string> = { conjunction: 'meets', sextile: 'sextiles', square: 'squares', trine: 'trines', opposition: 'opposes' };
const signIndex = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30);
const signName = (slug: string) => SIGNS.find((sign) => sign.slug === slug)!.name;

async function instant(date: string, time: string, zone: string | undefined, clock: GoodDaysClock): Promise<Date> {
  if (!zone) return new Date(`${date}T${time}:00Z`);
  await clock.prepareLocalTime(date, zone);
  return clock.resolveLocalToUtc(date, time, zone).utc;
}

export async function preparePersonal(birth: BirthDetails, clock: GoodDaysClock): Promise<PersonalChart> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(birth.date) || Number.isNaN(Date.parse(`${birth.date}T00:00:00Z`))) throw new RangeError('birthDate must be a real date, such as 1990-05-03.');
  if (birth.time !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(birth.time)) throw new RangeError('birthTime must be HH:MM, such as 08:30.');
  if (birth.time !== undefined && !birth.zone) throw new RangeError('A birth time needs the birthplace time zone.');
  const timeKnown = birth.time !== undefined;
  const utc = await instant(birth.date, birth.time ?? '12:00', birth.zone, clock);
  const chart = computeChart({ utc, houseSystem: 'whole', timeKnown });
  const bodies = chart.bodies.map((row) => ({ body: row.body, lon: row.lon }));
  const sunLon = bodies.find((row) => row.body === 'Sun')!.lon;
  let sun: string | null = SIGNS[signIndex(sunLon)].slug;
  if (!timeKnown) {
    // Without a time, the sign only when the Sun stayed in it the whole day of birth, as get_natal_chart states it.
    const ends = birth.zone
      ? [await instant(birth.date, '00:00', birth.zone, clock), await instant(birth.date, '23:59', birth.zone, clock)]
      : [new Date(Date.parse(`${birth.date}T00:00:00Z`) - 14 * HOUR), new Date(Date.parse(`${birth.date}T23:59:00Z`) + 12 * HOUR)];
    const signs = new Set(ends.map((at) => signIndex(computeChart({ utc: at, houseSystem: 'whole', timeKnown: false }).bodies.find((row) => row.body === 'Sun')!.lon)));
    if (signs.size > 1) sun = null;
  }
  return { bodies, timeKnown, sun };
}

/** The personal factors of each day, in the order the days are given. */
export function personalFactors(chart: PersonalChart, days: readonly PersonalDay[], zone: string): Factor[][] {
  const out: Factor[][] = days.map(() => []);
  if (!days.length) return out;
  if (chart.sun) {
    const sunIndex = SIGNS.findIndex((sign) => sign.slug === chart.sun);
    days.forEach((day, index) => {
      const gap = (SIGNS.findIndex((sign) => sign.slug === day.moonSign) - sunIndex + 12) % 12;
      const moon = signName(day.moonSign);
      const sun = signName(chart.sun!);
      if (gap === 0 || gap === 4 || gap === 8) out[index].push({ points: 4, text: `The Moon is in ${moon}, the same element as your ${sun} Sun: a day tradition reads as in step with you.`, clause: `the Moon in step with your ${sun} Sun` });
      else if (gap === 3 || gap === 6 || gap === 9) out[index].push({ points: -3, text: `The Moon is in ${moon}, square or opposite your ${sun} Sun by sign: a day tradition reads as a little out of step with you.`, clause: `the Moon out of step with your ${sun} Sun` });
    });
  }
  const points: NatalPoint[] = ['Sun', 'Venus', ...(chart.timeKnown ? ['Moon' as const] : [])];
  const contacts = scanTransitContacts({ bodies: chart.bodies as never, angles: null }, days[0].start, days.at(-1)!.end, {
    transitBodies: [...BENEFICS, ...MALEFICS], natalPoints: points,
  });
  const time = (at: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  for (const contact of contacts) {
    const at = new Date(contact.exactUtc);
    const index = days.findIndex((day) => at.getTime() >= day.start.getTime() && at.getTime() < day.end.getTime());
    if (index === -1) continue;
    const harmonious = contact.aspect === 'sextile' || contact.aspect === 'trine' || contact.aspect === 'conjunction';
    const target = `your natal ${contact.natalPoint}`;
    if (BENEFICS.includes(contact.transitBody) && harmonious) {
      const clause = `${contact.transitBody} ${VERB[contact.aspect]} ${target}`;
      out[index].push({ points: 6, text: `${clause} today (exact at ${time(at)}), a supportive contact in your own chart.`, clause });
    } else if (MALEFICS.includes(contact.transitBody) && contact.aspect !== 'sextile' && contact.aspect !== 'trine') {
      const clause = `${contact.transitBody} ${VERB[contact.aspect]} ${target}`;
      out[index].push({ points: -6, text: `${clause} today (exact at ${time(at)}), a contact tradition reads as pressure in your own chart.`, clause });
    }
  }
  return out;
}
