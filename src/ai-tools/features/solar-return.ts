/**
 * get_solar_return: the chart for the person's next birthday (their next solar
 * return, the instant the Sun comes back to its birth degree) with the year's
 * main themes, from the same reading as the site's solar return page
 * (src/lib/solar-return/themes.ts). The current return can be asked for too.
 *
 * Birth details are used for this answer only: never stored, logged or put in
 * a link. The share link carries the Sun sign, the return's year and, when the
 * chart settles them, the rising sign and Jupiter's sign. Pure: no network,
 * storage or logging.
 */
import { z } from 'zod';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { computeChart } from '../../lib/engine/full.js';
import { mostRecentSolarReturnInstant, solarReturnInstant } from '../../lib/engine/solar-return';
import { houseOf } from '../../lib/engine/houses';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { birthDayEnvelope, settledSunSign } from '../../lib/sun-settled';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { solarReturnThemes } from '../../lib/solar-return/themes';
import { solarReturnShareUrl } from '../../lib/solar-return/share';
import { readingConfidence, readingConfidenceLabel, readingDetail } from '../reading-confidence';
import { roundCoordinate } from '../plain-text';
import { MINOR_NOTE, isUnder18, softenMinor } from './reading-guards';

const DAY = 86_400_000;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);

export const solarReturnInput = z.strictObject({
  birthDate: z.string().regex(DATE).describe('The person’s birth date, such as 1990-05-03. Used for this answer only; never stored, logged or put in a link.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional().describe('The birth time on the local clock, only if known. Never guess it. Needs zone. With latitude and longitude it adds the return’s rising sign and houses.'),
  zone: zone.optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time or a place."),
  latitude: z.number().min(-90).max(90).optional().describe("Optional. The birthplace's latitude, with longitude; the return is cast there. Nothing is stored."),
  longitude: z.number().min(-180).max(180).optional().describe("Optional. The birthplace's longitude, with latitude. Nothing is stored."),
  which: z.enum(['next', 'current']).optional().describe('next (the default): the return at the coming birthday. current: the one that opened the birthday year now running.'),
  currentZone: zone.optional().describe('Where the person lives now, such as Asia/Bangkok, so the return’s time is on their own clock.'),
}).superRefine((args, context) => {
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
});
export type SolarReturnInput = z.infer<typeof solarReturnInput>;

const sign = z.enum(SIGNS.map((entry) => entry.slug) as [string, ...string[]]);
export const solarReturnData = z.object({
  which: z.enum(['next', 'current']),
  returnYear: z.number().int(),
  /** The return instant in UTC and on the person's clock. */
  instantUtc: z.string(),
  local: z.string(),
  zone: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  /** The natal Sun sign. Null when an untimed birth day straddles a sign change. */
  sun: sign.nullable(),
  /** With a birth time and place: the return chart's rising sign. */
  rising: sign.nullable(),
  placements: z.array(z.object({ body: z.enum(BODIES), sign, degree: z.number(), house: z.number().int().min(1).max(12).nullable() })),
  themes: z.array(z.object({ kind: z.enum(['rising', 'sun-house', 'moon', 'jupiter', 'saturn', 'aspect']), title: z.string(), line: z.string(), basis: z.string() })),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  limits: z.array(z.string()),
  under18: z.boolean(),
  pageUrl: z.url(),
  /** The share page with its picture: Sun sign, return year, rising and Jupiter signs only. */
  shareUrl: z.url().nullable(),
});
export type SolarReturnData = z.infer<typeof solarReturnData>;

export type SolarReturnClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

function clockLabel(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/** `birthdayReportPage`: the site's /birthday-report/ is switched on (PUBLIC_BIRTHDAY_REPORT_ENABLED=1); only then does the answer link to it. */
export async function getSolarReturn(args: SolarReturnInput, now: Date, clock: SolarReturnClock, origin: string, birthdayReportPage = false): Promise<{ data: SolarReturnData; links: { title: string; url: string }[] }> {
  const birth = parseCivilDate(args.birthDate);
  if (!birth || birth.year < 1800 || birth.year > 2199) throw new RangeError('birthDate must be a real date from 1800 to 2199.');
  if (args.time !== undefined && !parseCivilTime(args.time)) throw new RangeError('time must be HH:MM, such as 08:30.');
  const latitude = args.latitude === undefined ? undefined : roundCoordinate(args.latitude);
  const longitude = args.longitude === undefined ? undefined : roundCoordinate(args.longitude);
  const timeKnown = args.time !== undefined;
  const placed = latitude !== undefined && longitude !== undefined;
  // Without a birth time the chart is cast from 12:00 UTC on the birth date whatever the zone, as /solar-return/ and the birthday report are.
  let birthUtc = new Date(`${args.birthDate}T12:00:00Z`);
  const onBirthplaceClock = (time: string) => (longitude !== undefined ? clock.resolveLocalToUtc(args.birthDate, time, args.zone!, { longitude }) : clock.resolveLocalToUtc(args.birthDate, time, args.zone!)).utc;
  if (args.zone) await clock.prepareLocalTime(args.birthDate, args.zone);
  if (args.time !== undefined) birthUtc = onBirthplaceClock(args.time);
  if (birthUtc.getTime() > now.getTime()) throw new RangeError('The birth date is still to come.');
  const natalSun = computeChart({ utc: birthUtc, houseSystem: 'whole', timeKnown }).bodies.find((row) => row.body === 'Sun')!.lon;
  const which = args.which ?? 'next';
  const latest = mostRecentSolarReturnInstant(natalSun, now);
  const instant = which === 'current' ? latest : solarReturnInstant(natalSun, new Date(latest.getTime() + 365.25 * DAY));
  // The return is cast at the birthplace when one is given with a birth time; without a time its houses would be guesses.
  const location = timeKnown && placed ? { latitude: latitude!, longitude: longitude! } : null;
  const chart = computeChart({ utc: instant, ...(location ?? {}), houseSystem: 'whole', timeKnown: true });
  const cusps = location && chart.houses ? chart.houses.cusps : null;
  const asc = location && chart.angles ? chart.angles.asc : null;
  const shownZone = args.currentZone ?? args.zone ?? 'UTC';
  const today = now.toISOString().slice(0, 10);
  const under18 = isUnder18(args.birthDate, today);
  const guard = (text: string) => (under18 ? softenMinor(text) : text);
  const themes = solarReturnThemes({ bodies: chart.bodies, aspects: chart.aspects, asc, cusps, timeKnown }).map((theme) => ({ ...theme, line: guard(theme.line) }));
  const placements = chart.bodies.filter((row) => (BODIES as readonly string[]).includes(row.body)).map((row) => ({
    body: row.body as typeof BODIES[number],
    sign: SIGNS[signIndexForLongitude(row.lon)].slug,
    degree: Math.floor((row.lon % 30) * 10) / 10,
    house: cusps ? houseOf(row.lon, [...cusps]) : null,
  })).filter((row) => timeKnown || row.body !== 'Moon');
  // Without a birth time the natal Sun can be up to a degree out, and the return about a day; its sign is the birth date's only if the Sun
  // kept to one sign all that day: on the birthplace clock when the zone is known, else on every clock (src/lib/sun-settled.ts).
  const ends: [Date, Date] = timeKnown ? [birthUtc, birthUtc] : args.zone ? [onBirthplaceClock('00:00'), onBirthplaceClock('23:59')] : birthDayEnvelope(args.birthDate);
  const settledIndex = settledSunSign(ends, (at) => computeChart({ utc: at, houseSystem: 'whole', timeKnown: false }).bodies.find((row) => row.body === 'Sun')!.lon).sign;
  const sunSign = settledIndex === null ? null : SIGNS[settledIndex].slug;
  const rising = asc !== null ? SIGNS[signIndexForLongitude(asc)].slug : null;
  const jupiter = placements.find((row) => row.body === 'Jupiter')!.sign;
  const limits: string[] = [];
  if (under18) limits.push(MINOR_NOTE);
  if (!timeKnown) limits.push('No birth time was given, so the return instant can shift by up to about a day; the Moon, the rising sign and the houses are left out.');
  else if (!placed) limits.push('No birthplace coordinates were given, so the rising sign and the houses are left out.');
  else limits.push('The return is cast for the birthplace. Astrologers who cast it where the person spends the birthday get a different rising sign and houses, with the same planets.');
  if (!args.currentZone && args.zone) limits.push(`The time is on the birthplace clock (${shownZone}) because no current time zone was given.`);
  if (!args.zone) limits.push('The time is in UTC because no time zone was given.');
  const detail = readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: placed });
  const pageUrl = `${origin}/solar-return/`;
  return {
    data: {
      which, returnYear: Number(new Intl.DateTimeFormat('en-CA', { timeZone: shownZone, year: 'numeric' }).format(instant)),
      instantUtc: instant.toISOString(), local: clockLabel(instant, shownZone), zone: shownZone, timeKnown, placed,
      sun: sunSign, rising, placements, themes,
      confidence: readingConfidence(detail), confidenceLabel: readingConfidenceLabel(detail),
      limits, under18, pageUrl,
      shareUrl: solarReturnShareUrl(origin, { sun: sunSign, year: instant.getUTCFullYear(), rising, jupiter }),
    },
    links: [
      { title: 'Solar return chart on Zodiacs', url: pageUrl },
      ...(birthdayReportPage ? [{ title: 'Your birthday report on Zodiacs', url: `${origin}/birthday-report/` }] : []),
    ],
  };
}
