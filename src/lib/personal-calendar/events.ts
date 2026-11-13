/**
 * Turns the personal dates the worker found into calendar events in the
 * reader's language, and into one RFC 5545 file. Engine-free; built in the
 * browser and handed to the browser as a download, never sent anywhere.
 */
import type { CatalogLocale } from '../i18n/core';
import { serializePersonalEvents, stableIcalUid, type PersonalCalendarEvent } from '../ical';
import { signForLongitude, signName } from '../signs';
import { transitLine } from '../transits';
import type { PersonalSky } from './compute';
import { PERSONAL_WORDS, fill, type PersonalAspect, type PersonalPlanet, type PersonalPoint } from './words';

/** Absolute zodiacs.org pages each kind of event links back to. */
export interface PersonalLinks {
  solarReturn: string;
  milestones: string;
  saturnReturn: string;
  transits: string;
}

export interface PersonalEventOptions {
  locale: CatalogLocale;
  links: PersonalLinks;
  /** IANA zone that sets the local date of all-day events (the reader's own). */
  timeZone: string;
}

/** Remind at 09:00 the day before an all-day event (15 hours before its midnight). */
export const ALL_DAY_ALARM = '-PT15H';
/** Remind a day ahead of a timed event. */
export const TIMED_ALARM = '-P1D';

function utcMinute(iso: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) throw new RangeError(`Invalid instant: ${iso}`);
  const text = at.toISOString();
  return `${text.slice(0, 10)} ${text.slice(11, 16)}`;
}

/** The calendar date of an instant in a time zone, YYYY-MM-DD. */
export function localDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A longitude as degrees and minutes within its sign, e.g. 14°22′ Leo. */
export function signPosition(lon: number, locale: CatalogLocale): string {
  const normalized = ((lon % 360) + 360) % 360;
  const totalMinutes = Math.floor((normalized % 30) * 60);
  return `${Math.floor(totalMinutes / 60)}°${String(totalMinutes % 60).padStart(2, '0')}′ ${signName(signForLongitude(normalized), locale)}`;
}

function paragraphs(...parts: (string | false | undefined)[]): string {
  return parts.filter((part): part is string => !!part).join('\n\n');
}

export function personalEvents(sky: PersonalSky, options: PersonalEventOptions): PersonalCalendarEvent[] {
  const words = PERSONAL_WORDS[options.locale];
  const { links } = options;
  const unknown = !sky.timeKnown && words.unknownTime;
  const passLine = (pass: number, count: number) => count > 1 && fill(words.pass, { pass, count });
  const passTag = (pass: number, count: number) => (count > 1 ? ` · ${pass}/${count}` : '');
  const allDayAlarm = (summary: string) => [{ trigger: ALL_DAY_ALARM, description: summary }];

  const solar = sky.solarReturns.map((at): PersonalCalendarEvent => ({
    uid: stableIcalUid('solar-return', [utcMinute(at)]),
    start: at,
    summary: words.solarTitle,
    description: paragraphs(
      fill(words.solarAbout, { position: signPosition(sky.sunLon, options.locale) }),
      fill(words.exactAt, { time: utcMinute(at) }),
      unknown,
      words.note,
      fill(words.more, { url: links.solarReturn }),
    ),
    url: links.solarReturn,
    alarms: [{ trigger: TIMED_ALARM, description: words.solarTitle }],
  }));

  const milestones = sky.milestones.map((pass): PersonalCalendarEvent => {
    const name = words.milestones[pass.kind];
    const url = pass.kind === 'saturn-return' ? links.saturnReturn : links.milestones;
    const summary = `${name.name}${passTag(pass.pass, pass.passCount)}`;
    return {
      uid: stableIcalUid(pass.kind, [String(pass.index), utcMinute(pass.at)]),
      date: localDate(pass.at, options.timeZone),
      summary,
      description: paragraphs(
        name.about,
        fill(words.exactAt, { time: utcMinute(pass.at) }),
        passLine(pass.pass, pass.passCount),
        unknown,
        words.note,
        fill(words.more, { url }),
      ),
      url,
      alarms: allDayAlarm(summary),
    };
  });

  const transits = sky.contacts.map((contact): PersonalCalendarEvent => {
    const planet = contact.transitBody as PersonalPlanet;
    const aspect = contact.aspect as PersonalAspect;
    const point = contact.natalPoint as PersonalPoint;
    const title = words.titles[aspect]?.[point];
    if (!title || !words.planets[planet]) throw new RangeError(`No words for ${planet} ${aspect} ${point}.`);
    const summary = `${fill(title, { planet: words.planets[planet] })}${passTag(contact.pass, contact.passCount)}`;
    const meaning = options.locale === 'en'
      ? transitLine(planet, aspect, point)
      : [words.movers[planet], words.aspects[aspect], words.points[point]].join(' ');
    return {
      uid: stableIcalUid('transit', [planet, aspect, point, utcMinute(contact.exactUtc)]),
      date: localDate(contact.exactUtc, options.timeZone),
      summary,
      description: paragraphs(
        meaning,
        fill(words.exactAt, { time: utcMinute(contact.exactUtc) }),
        words.slowNote,
        passLine(contact.pass, contact.passCount),
        unknown,
        words.note,
        fill(words.more, { url: links.transits }),
      ),
      url: links.transits,
      alarms: allDayAlarm(summary),
    };
  });

  return [...solar, ...milestones, ...transits];
}

/** The whole file, or null when the window holds no event. */
export function personalCalendar(
  sky: PersonalSky,
  options: PersonalEventOptions & { generatedAt: Date | string },
): string | null {
  const events = personalEvents(sky, options);
  if (!events.length) return null;
  return serializePersonalEvents(events, {
    generatedAt: options.generatedAt,
    calendarName: PERSONAL_WORDS[options.locale].calendarName,
  });
}
