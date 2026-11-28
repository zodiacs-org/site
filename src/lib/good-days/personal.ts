/**
 * The good day finder's optional personal reading: the person's own chart,
 * met by the sky on each day of the window. It reads two things:
 * - the Moon's sign that day against the natal Sun's: the same element reads
 *   as harmony, a square or opposite sign as tension;
 * - exact contacts from Venus, Mars, Jupiter and Saturn to the natal Sun and
 *   Venus (and the Moon, with a birth time), from the site's transit scanner
 *   (src/lib/engine/transit-scan.ts), on the day they are exact. Without a
 *   birth time the natal points are only known to within the birth day, so a
 *   contact counts only when the chart cast at both ends of that day puts it
 *   on the same day of the window, and it carries no clock time.
 *
 * The birth details are used for the one request and dropped with it: nothing
 * here stores, logs or returns them, and the result carries only the natal Sun
 * sign. The caller refuses a birth date under 13 before this module is reached.
 */
import { computeChart } from '../engine/full.js';
import { scanTransitContacts, type NatalPoint, type TransitBody, type TransitContact } from '../engine/transit-scan';
import { SIGNS } from '../signs';
import { parseCivilDate, parseCivilTime } from '../time/civil-date';
import type { Factor, GoodDaysClock } from './find';

export interface BirthDetails {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM on the birthplace clock, only when known. Needs zone. */
  time?: string;
  /** The birthplace's time zone. */
  zone?: string;
}

type Bodies = { body: string; lon: number }[];

export interface PersonalChart {
  bodies: Bodies;
  timeKnown: boolean;
  /** The natal Sun sign, or null when the Sun changed sign on an untimed day of birth. */
  sun: string | null;
  /** Without a birth time: the chart at the first and the last minute of the birth day. */
  early?: Bodies;
  late?: Bodies;
}

export interface PersonalFactors {
  /** The personal factors of each day, in the order the days are given. */
  days: Factor[][];
  /** Without a birth time: whether a contact was left out because it could not be dated to one day. */
  dropped: boolean;
}

export const UNTIMED_DROPPED_MESSAGE = 'No birth time was given, so contacts from Venus, Mars, Jupiter and Saturn are counted only on the rare days a birth date alone can date them; most, often all, are left out.';

export interface PersonalDay {
  date: string;
  start: Date;
  end: Date;
  moonSign: string;
  /** On a day the Moon changes sign in the waking hours: when it holds moonSign, the sign it holds longest ("from 12:18"). */
  moonWhen?: string;
}

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
  if (!parseCivilDate(birth.date)) throw new RangeError('birthDate must be a real date, such as 1994-05-14.');
  if (birth.time !== undefined && !parseCivilTime(birth.time)) throw new RangeError('birthTime must be HH:MM, such as 09:15.');
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
    const [early, late] = ends.map((at) => computeChart({ utc: at, houseSystem: 'whole', timeKnown: false }).bodies.map((row) => ({ body: row.body, lon: row.lon })));
    const signs = new Set([early, late].map((set) => signIndex(set.find((row) => row.body === 'Sun')!.lon)));
    if (signs.size > 1) sun = null;
    return { bodies, timeKnown, sun, early, late };
  }
  return { bodies, timeKnown, sun };
}

const contactKey = (contact: TransitContact) => `${contact.transitBody}|${contact.aspect}|${contact.natalPoint}`;
const dayIndex = (days: readonly PersonalDay[], at: number) => days.findIndex((day) => at >= day.start.getTime() && at < day.end.getTime());

/**
 * Pairs the contacts of the scans from the two ends of an untimed birth day (same transit body, aspect and
 * natal point, nearest exact moments first) and keeps those both scans place on the same day of the window.
 * Each kept contact comes back with that day's index. A contact without a partner is dropped.
 */
export function pairUntimedContacts(early: readonly TransitContact[], late: readonly TransitContact[], days: readonly PersonalDay[]): { kept: { contact: TransitContact; index: number }[]; dropped: number } {
  const groups = new Map<string, { early: TransitContact[]; late: TransitContact[] }>();
  for (const [side, list] of [['early', early], ['late', late]] as const) {
    for (const contact of list) {
      const group = groups.get(contactKey(contact)) ?? { early: [], late: [] };
      group[side].push(contact);
      groups.set(contactKey(contact), group);
    }
  }
  const kept: { contact: TransitContact; index: number }[] = [];
  let dropped = 0;
  for (const group of groups.values()) {
    const candidates = group.early.flatMap((a, i) => group.late.map((b, j) => ({ i, j, gap: Math.abs(Date.parse(a.exactUtc) - Date.parse(b.exactUtc)) })))
      .sort((x, y) => x.gap - y.gap || x.i - y.i || x.j - y.j);
    const usedEarly = new Set<number>();
    const usedLate = new Set<number>();
    for (const { i, j } of candidates) {
      if (usedEarly.has(i) || usedLate.has(j)) continue;
      usedEarly.add(i);
      usedLate.add(j);
      const first = dayIndex(days, Date.parse(group.early[i].exactUtc));
      const second = dayIndex(days, Date.parse(group.late[j].exactUtc));
      if (first !== -1 && first === second) kept.push({ contact: group.early[i], index: first });
      else dropped += 1;
    }
    dropped += group.early.length - usedEarly.size + group.late.length - usedLate.size;
  }
  kept.sort((a, b) => Date.parse(a.contact.exactUtc) - Date.parse(b.contact.exactUtc));
  return { kept, dropped };
}


/** The personal factors of each day, in the order the days are given. */
export function personalFactors(chart: PersonalChart, days: readonly PersonalDay[], zone: string): PersonalFactors {
  const out: Factor[][] = days.map(() => []);
  if (!days.length) return { days: out, dropped: false };
  if (chart.sun) {
    const sunIndex = SIGNS.findIndex((sign) => sign.slug === chart.sun);
    days.forEach((day, index) => {
      const gap = (SIGNS.findIndex((sign) => sign.slug === day.moonSign) - sunIndex + 12) % 12;
      const moon = signName(day.moonSign);
      const sun = signName(chart.sun!);
      const when = day.moonWhen ? ` ${day.moonWhen}` : '';
      // On a sign-change day the clause says which sign it means and when, as the day's own reason does.
      const which = when ? ` in ${moon}${when},` : '';
      if (gap === 0 || gap === 4 || gap === 8) out[index].push({ points: 4, text: `The Moon is in ${moon}${when}, the same element as your ${sun} Sun: a day tradition reads as in step with you.`, clause: `the Moon${which} in step with your ${sun} Sun` });
      else if (gap === 3 || gap === 6 || gap === 9) out[index].push({ points: -3, text: `The Moon is in ${moon}${when}, square or opposite your ${sun} Sun by sign: a day tradition reads as a little out of step with you.`, clause: `the Moon${which} out of step with your ${sun} Sun` });
    });
  }
  const points: NatalPoint[] = ['Sun', 'Venus', ...(chart.timeKnown ? ['Moon' as const] : [])];
  const scan = (bodies: Bodies) => scanTransitContacts({ bodies: bodies as never, angles: null }, days[0].start, days.at(-1)!.end, {
    transitBodies: [...BENEFICS, ...MALEFICS], natalPoints: points,
  }).filter((contact) => readsAs(contact) !== null);
  let dated: { contact: TransitContact; index: number }[];
  let dropped = 0;
  if (chart.timeKnown || !chart.early || !chart.late) {
    dated = scan(chart.bodies).map((contact) => ({ contact, index: dayIndex(days, Date.parse(contact.exactUtc)) })).filter((row) => row.index !== -1);
  } else {
    ({ kept: dated, dropped } = pairUntimedContacts(scan(chart.early), scan(chart.late), days));
  }
  const time = (at: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  for (const { contact, index } of dated) {
    // Only a timed chart dates a contact to the minute; an untimed one says the day alone.
    const when = chart.timeKnown ? ` (exact at ${time(new Date(contact.exactUtc))})` : '';
    const clause = `${contact.transitBody} ${VERB[contact.aspect]} your natal ${contact.natalPoint}`;
    if (readsAs(contact) === 'support') out[index].push({ points: 6, text: `${clause} today${when}, a supportive contact in your own chart.`, clause });
    else out[index].push({ points: -6, text: `${clause} today${when}, a contact tradition reads as pressure in your own chart.`, clause });
  }
  return { days: out, dropped: dropped > 0 };
}

/** Which contacts the finder reads: a benefic's soft contact as support, a malefic's hard one as pressure. */
function readsAs(contact: TransitContact): 'support' | 'pressure' | null {
  const harmonious = contact.aspect === 'sextile' || contact.aspect === 'trine' || contact.aspect === 'conjunction';
  if (BENEFICS.includes(contact.transitBody) && harmonious) return 'support';
  if (MALEFICS.includes(contact.transitBody) && contact.aspect !== 'sextile' && contact.aspect !== 'trine') return 'pressure';
  return null;
}
