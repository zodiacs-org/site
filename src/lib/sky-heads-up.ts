/**
 * The heads-up calendar: the major sky events the site publishes, each with
 * two advance entries, for /sky-calendar-heads-up.ics and the same list as
 * /sky-calendar-heads-up.json.
 *
 * Events are the publication timeline (src/lib/events/site-publication.ts):
 * full and new moons, eclipses, retrograde and direct stations, slow planet
 * ingresses and exact aspects between slow planets. Each keeps its canonical
 * id, title, summary and page. Its time is the one its page prints: NASA JPL
 * Horizons' instant for ingresses and aspects (refinePublishedAnchors) and
 * stations (exactInstant), the committed anchor for lunations and eclipses.
 *
 * The calendar file gives every event three timed entries: the event, "In 3
 * days" 72 hours before it and "Tomorrow" 24 hours before it. It carries no
 * alarms: the extra entries are what a subscriber sees ahead of time, and
 * whether anything alerts is up to their calendar app. A UID depends only on
 * the event's id and the entry's role, so it survives a corrected time, a
 * rebuild on another day and, later, another language.
 *
 * Lunations carry the Moon's distance (src/data/moon-distances.json), and a
 * full Moon that src/lib/supermoon.ts marks as a supermoon says so in its
 * title, its description and a `supermoon` field.
 *
 * Everything here is the same for every reader. The builder takes only a
 * build instant; no request, parameter or environment value reaches it.
 *
 * Build-side module (it reads the NASA table): routes import it, islands must not.
 */
import { serializePersonalEvents, type PersonalCalendarEvent } from './ical';
import { eventsPublication, type PublishedEventDescriptor } from './events/site-publication';
import { exactInstant, refinePublishedAnchors } from './nasa-instants';
import { headsUpText, returnText } from './return-visits/copy';
import { headsUpCopyProblems } from './sky-heads-up-safety';
import { moonDistanceLunation, supermoon, type Supermoon } from './supermoon';

export { EVENT_COPY_BANNED, FORBIDDEN_DASHES, headsUpCopyProblems } from './sky-heads-up-safety';

export const HEADS_UP_ORIGIN = 'https://zodiacs.org';
export const HEADS_UP_ICS_PATH = '/sky-calendar-heads-up.ics';
export const HEADS_UP_JSON_PATH = '/sky-calendar-heads-up.json';

/** The publication families the feed carries; the timeline holds nothing else. */
export const HEADS_UP_FAMILIES = ['lunation', 'eclipse', 'station', 'ingress', 'aspect'] as const;

/** Events from this long before the build onward. */
export const HEADS_UP_LOOKBACK_MS = 7 * 86_400_000;
const HOUR_MS = 3_600_000;
export const HEADS_UP_OFFSETS = [
  { role: 'minus-72h', ms: 72 * HOUR_MS, key: 'headsUpInThreeDays' },
  { role: 'minus-24h', ms: 24 * HOUR_MS, key: 'headsUpTomorrow' },
] as const;

export interface HeadsUpEvent {
  id: string;
  family: string;
  subtype: string;
  title: string;
  summary: string;
  /** The instant the event's page prints, ISO UTC. */
  at: string;
  path: string;
  /** The page, absolute. */
  url: string;
  /** The two advance entries: 72 hours and 24 hours before `at`. */
  headsUp: [string, string];
  /** Lunations only: the Moon's geocentric distance at `at`, whole km (src/data/moon-distances.json). */
  moonDistanceKm?: number;
  /** Full Moons the site's rule marks only (src/lib/supermoon.ts): the distance, the rule and the apsides it used. */
  supermoon?: Supermoon;
}

export interface HeadsUpFeed {
  generatedAt: string;
  coverageEnd: string;
  events: HeadsUpEvent[];
}

const iso = (value: string | number) => new Date(value).toISOString();

/** The instant an event's page prints. */
export function pageInstant(row: PublishedEventDescriptor, refined: PublishedEventDescriptor): string {
  if (row.family === 'station') {
    const [body] = row.bodies;
    if (!body) throw new Error(`sky-heads-up: station ${row.id} names no body`);
    return iso(exactInstant({ kind: 'station', body, at: row.anchor }));
  }
  return iso(refined.anchor);
}

function headsUpEvent(row: PublishedEventDescriptor, refined: PublishedEventDescriptor): HeadsUpEvent {
  const at = pageInstant(row, refined);
  const ms = Date.parse(at);
  const event: HeadsUpEvent = {
    id: row.id,
    family: row.family,
    subtype: row.subtype,
    title: row.title,
    summary: row.summary,
    at,
    path: row.path,
    url: `${HEADS_UP_ORIGIN}${row.path}`,
    headsUp: [iso(ms - HEADS_UP_OFFSETS[0].ms), iso(ms - HEADS_UP_OFFSETS[1].ms)],
  };
  if (row.family === 'lunation') {
    const lunation = moonDistanceLunation(row.subtype, row.anchor);
    if (!lunation) throw new Error(`sky-heads-up: no Moon distance for ${row.id}; rerun node scripts/build-moon-distances.mjs`);
    event.moonDistanceKm = lunation.distanceKm;
    const marked = supermoon(lunation);
    if (marked) {
      event.title = headsUpText('headsUpSupermoonTitle', { title: row.title });
      event.supermoon = marked;
    }
  }
  return event;
}

/** The feed as of `now`: events from a week before it to the end of the publication. */
export function headsUpFeed(now: Date = new Date()): HeadsUpFeed {
  if (!Number.isFinite(now.getTime())) throw new RangeError('sky-heads-up: invalid build instant');
  const timeline = eventsPublication.timeline;
  const refined = refinePublishedAnchors(timeline);
  const from = now.getTime() - HEADS_UP_LOOKBACK_MS;
  const coverageEnd = iso(eventsPublication.window.to);
  const end = Date.parse(coverageEnd);
  const events = timeline
    .map((row, index) => {
      if (!(HEADS_UP_FAMILIES as readonly string[]).includes(row.family)) {
        throw new Error(`sky-heads-up: unexpected family ${row.family} on ${row.id}`);
      }
      return headsUpEvent(row, refined[index]!);
    })
    .filter((event) => {
      const ms = Date.parse(event.at);
      return ms >= from && ms < end;
    })
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const feed = { generatedAt: new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString(), coverageEnd, events };
  assertHeadsUpCopy(headsUpStrings(feed));
  return feed;
}

const utcMinute = (value: string) => `${value.slice(0, 10)} ${value.slice(11, 16)}`;
const kilometres = (km: number) => km.toLocaleString('en-US');

/** The calendar description of the event entry. */
function eventDescription(event: HeadsUpEvent): string {
  return [
    event.summary,
    event.moonDistanceKm === undefined ? '' : headsUpText('headsUpMoonDistance', { km: kilometres(event.moonDistanceKm) }),
    event.supermoon ? headsUpText('headsUpSupermoon') : '',
    headsUpText('headsUpWhen', { time: utcMinute(event.at) }),
    returnText('en', 'calendarEventNote'),
    event.family === 'eclipse' ? returnText('en', 'eclipseNote') : '',
  ].filter(Boolean).join(' ');
}

/** The three calendar entries of one event. */
export function headsUpCalendarEntries(event: HeadsUpEvent): PersonalCalendarEvent[] {
  const uid = (role: string) => `sky-heads-up-${event.id}-${role}@zodiacs.org`;
  // The advance entries say when; the event entry carries the summary and notes.
  const ahead = headsUpText('headsUpWhen', { time: utcMinute(event.at) });
  return [
    { uid: uid('event'), start: event.at, summary: event.title, description: eventDescription(event), url: event.url },
    ...HEADS_UP_OFFSETS.map((offset, index) => ({
      uid: uid(offset.role),
      start: event.headsUp[index]!,
      summary: headsUpText(offset.key, { title: event.title }),
      description: ahead,
      url: event.url,
    })),
  ];
}

/** Every human-readable string the two files carry, for the copy checks. */
export function headsUpStrings(feed: HeadsUpFeed): string[] {
  const strings = [headsUpText('headsUpCalendarName')];
  for (const event of feed.events) {
    strings.push(event.title, event.summary);
    for (const entry of headsUpCalendarEntries(event)) strings.push(entry.summary, entry.description);
  }
  return strings;
}

/** Refuse to publish a string with a banned word or a forbidden dash. */
export function assertHeadsUpCopy(strings: readonly string[]): void {
  const problems = strings.flatMap((text) => headsUpCopyProblems(text).map((problem) => `${problem} in "${text}"`));
  if (problems.length) throw new Error(`sky-heads-up: copy check failed:\n  ${problems.join('\n  ')}`);
}

/** The calendar file. */
export function headsUpCalendar(feed: HeadsUpFeed): string {
  return serializePersonalEvents(feed.events.flatMap(headsUpCalendarEntries), {
    generatedAt: feed.generatedAt,
    calendarName: headsUpText('headsUpCalendarName'),
  })
    .replace('PRODID:-//Zodiacs.org//Personal Sky 1.0//EN\r\n', 'PRODID:-//Zodiacs.org//Sky Heads-up 1.0//EN\r\n')
    .replace('CALSCALE:GREGORIAN\r\n', 'CALSCALE:GREGORIAN\r\nREFRESH-INTERVAL;VALUE=DURATION:P1D\r\nX-PUBLISHED-TTL:P1D\r\n');
}

/** The JSON file. */
export function headsUpJson(feed: HeadsUpFeed): string {
  return `${JSON.stringify(feed, null, 2)}\n`;
}

const CACHE = 'public, max-age=3600, s-maxage=86400';

export function headsUpCalendarResponse(now: Date = new Date()): Response {
  return new Response(headsUpCalendar(headsUpFeed(now)), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="zodiacs-sky-heads-up.ics"',
    'Cache-Control': CACHE,
    'X-Content-Type-Options': 'nosniff',
  } });
}

export function headsUpJsonResponse(now: Date = new Date()): Response {
  return new Response(headsUpJson(headsUpFeed(now)), { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': CACHE,
    'X-Content-Type-Options': 'nosniff',
  } });
}
