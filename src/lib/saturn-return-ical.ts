/**
 * Saturn return passes as all-day calendar markers, serialized through the
 * shared personal-calendar RFC 5545 builder. No chart inputs enter the file:
 * no birth date, time or place, no natal Saturn degree and no clock time,
 * only the UTC date of each crossing, as the page prints it.
 */
import type { SaturnReturnResult } from './engine/returns';
import { localizePath, type CatalogLocale } from './i18n';
import { icalHash, serializePersonalEvents, type PersonalCalendarEvent } from './ical';
import { PERSONAL_WORDS, fill } from './personal-calendar/words';

const DAY = 86_400_000;
const ORIGIN = 'https://zodiacs.org';
/** A heads-up at 09:00 three days before each pass: 2 days and 15 hours before its midnight. */
export const SATURN_RETURN_ALARM = '-P2DT15H';

/** Calendar-specific noon caveat when birth time and place are not both known. */
export const SATURN_RETURN_APPROXIMATE_NOTE: Readonly<Record<CatalogLocale, string>> = Object.freeze({
  en: 'Dates computed from a noon reading. With an exact birth time and place, these dates can shift and retrograde passes can be added or removed.',
  es: 'Fechas calculadas con una lectura de mediodía. Con una hora y un lugar de nacimiento exactos, estas fechas pueden cambiar y pueden añadirse o quitarse pasadas retrógradas.',
  pt: 'Datas calculadas com uma leitura ao meio-dia. Com uma hora e um local de nascimento exatos, essas datas podem mudar e passagens retrógradas podem ser adicionadas ou removidas.',
  fr: 'Dates calculées à partir d’une lecture à midi. Avec une heure et un lieu de naissance exacts, ces dates peuvent se décaler et des passages rétrogrades peuvent apparaître ou disparaître.',
  it: 'Date calcolate da una lettura di mezzogiorno. Con un’ora e un luogo di nascita esatti, queste date possono spostarsi e i passaggi retrogradi possono aggiungersi o scomparire.',
  ru: 'Даты рассчитаны для полудня. При точном времени и месте рождения эти даты могут сдвинуться, а число ретроградных проходов может измениться.',
});

/** The page's own words, in its language. */
export interface SaturnReturnCalendarWords {
  /** Each return's heading by its number, from 1: "First return". */
  seasons: readonly string[];
  /** The mark on a crossing made in retrograde: "retrograde pass". */
  retrograde: string;
  /** Optional override for the noon-reading note shown when no birth time and place were given. */
  approximate?: string;
}

export interface SaturnReturnCalendarOptions {
  /** True when the dates come from a noon reading, without a birth time and place. */
  approximate: boolean;
  /** Receipt time for DTSTAMP. */
  generatedAt: Date | string;
  locale: CatalogLocale;
  words: SaturnReturnCalendarWords;
}

type Seasons = Pick<SaturnReturnResult, 'seasons'>;

function utcDay(value: unknown): number {
  const time = value instanceof Date ? value.getTime() : Number.NaN;
  if (!Number.isFinite(time)) throw new RangeError('Invalid Saturn return crossing.');
  const day = Math.floor(time / DAY) * DAY;
  // The date and the day after it (DTEND) must both be four-digit years.
  if (![day, day + DAY].every((at) => /^\d{4}-\d{2}-\d{2}T/.test(new Date(at).toISOString()))) {
    throw new RangeError('Invalid Saturn return crossing.');
  }
  return day;
}

const isoDate = (day: number) => new Date(day).toISOString().slice(0, 10);
const compactDate = (day: number) => isoDate(day).replace(/-/g, '');

function checkedSeasons(result: Seasons): Seasons['seasons'] {
  const { seasons } = result;
  if (!Array.isArray(seasons) || seasons.length === 0) throw new RangeError('A Saturn return calendar requires at least one crossing.');
  // An event's UID carries its return's number and its pass's, so no return's number may repeat.
  const indexes = new Set<number>();
  for (const season of seasons) {
    if (!Number.isInteger(season.index) || season.index < 1 || indexes.has(season.index)
      || !Array.isArray(season.crossings) || season.crossings.length === 0) {
      throw new RangeError('Invalid Saturn return season.');
    }
    indexes.add(season.index);
    for (const crossing of season.crossings) {
      utcDay(crossing.at);
      if (typeof crossing.retrograde !== 'boolean') throw new RangeError('Invalid Saturn return crossing.');
    }
  }
  return seasons;
}

/**
 * The file's whole schedule as 16 hex digits: every crossing's return, pass,
 * UTC date and direction, which the events already show, so the tag carries
 * nothing the file does not. The same schedule always gives the same tag, so
 * importing the file again updates its events rather than copying them.
 */
function scheduleTag(seasons: Seasons['seasons']): string {
  return icalHash(seasons.flatMap((season) => season.crossings.map((crossing, position) => (
    `${season.index}:${position + 1}:${compactDate(utcDay(crossing.at))}:${crossing.retrograde ? 'r' : 'd'}`
  ))));
}

export function saturnReturnCalendarFilename(result: Seasons): string {
  checkedSeasons(result);
  // No year: the first return's year would give the birth year to anyone who sees the name.
  return 'zodiacs-saturn-return.ics';
}

/** One transparent all-day event per crossing, each with a display alarm. */
export function buildSaturnReturnCalendar(result: Seasons, options: SaturnReturnCalendarOptions): string {
  const seasons = checkedSeasons(result);
  const personal = PERSONAL_WORDS[options.locale];
  if (!personal) throw new RangeError('Unsupported calendar language.');
  const { name, about } = personal.milestones['saturn-return'];
  // Deliberately only the season's number, each crossing's pass number, UTC
  // date and direction, and the page's words: never the natal longitude, the
  // birth instant or the place, which the result also carries.
  const schedule = scheduleTag(seasons);
  const url = `${ORIGIN}${localizePath(options.locale, '/saturn-return/')}`;
  const events: PersonalCalendarEvent[] = seasons.flatMap((season) => season.crossings.map((crossing, position) => {
    const day = utcDay(crossing.at);
    // The pass number keeps every crossing the page lists: a direct pass and
    // the retrograde one after it can fall on the same UTC date. The schedule
    // tag keeps two people's files apart when a pass of theirs shares its
    // return, its number and its date.
    const uid = `saturn-return-${schedule}-${season.index}-pass-${position + 1}-${compactDate(day)}@zodiacs.org`;
    const heading = options.words.seasons[season.index - 1];
    if (!heading) throw new RangeError('Missing Saturn return heading.');
    const count = season.crossings.length;
    const summary = [name, heading, ...(count > 1 ? [`${position + 1}/${count}`] : []),
      ...(crossing.retrograde ? [options.words.retrograde] : [])].join(' · ');
    const approximateNote = options.words.approximate ?? SATURN_RETURN_APPROXIMATE_NOTE[options.locale];
    const description = [
      about,
      ...(count > 1 ? [fill(personal.pass, { pass: position + 1, count })] : []),
      ...(options.approximate ? [approximateNote] : []),
    ].join('\n\n');
    return {
      uid,
      date: isoDate(day),
      summary,
      description,
      url,
      alarms: [{ trigger: SATURN_RETURN_ALARM, description: summary }],
    };
  }));

  return serializePersonalEvents(events, {
    generatedAt: options.generatedAt,
    calendarName: name,
    method: null,
    prodId: '-//Zodiacs.org//Saturn Return 1.0//EN',
  });
}
