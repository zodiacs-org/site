/**
 * The words of the sky event short videos (scripts/build-event-shorts.ts):
 * which published event pages get a video, the name, date and lines each
 * video shows, and the caption the owner pastes when posting by hand.
 *
 * Every event is one of the site's published event pages
 * (src/lib/events/site-publication.ts: 2026 to 2030), and the first line is that page's own
 * summary, copied as published. The time is the one the page prints: NASA
 * JPL Horizons' for a planet's station, sign change or aspect
 * (src/lib/nasa-instants.ts), and the committed instant for a new or full
 * Moon or an eclipse, which agree with NASA within a minute. A lunar eclipse
 * too slight to see says so in the words the calendar feed uses
 * (src/lib/sky-calendar-feed.ts). Nothing here writes a forecast, and no line
 * carries an em or en dash.
 */
import { publishedEventPages } from '../src/lib/events/site-publication';
import eclipsesData from '../src/data/eclipses.json';
import { eventClock, eventDay } from '../src/lib/events/format';
import { refinePublishedAnchors } from '../src/lib/nasa-instants';
import { isInvisiblePenumbral } from '../src/lib/nasa-lunar-eclipses';
import { SHORTS_SIGNS, SHORTS_TEXT, balanceLines, hasDash } from './daily-shorts-lib.mjs';

export interface EventPage {
  id: string;
  path: string;
  title: string;
  anchor: string;
  family: string;
  subtype?: string;
  bodies?: string[];
  signs: string[];
  summary: string;
}

export interface EventShort {
  id: string;
  stem: string;
  path: string;
  at: string;
  art: string;
  name: string;
  hue: string;
  kicker: string;
  address: string;
  footer: string;
  sentences: { text: string; lines: string[] }[];
  caption: string;
}

/** The footer every event video prints under the address. */
export const EVENT_SHORTS_FOOTER = 'Times in UTC, checked against NASA';

/** The note the calendar feed gives a lunar eclipse no one will see. */
export const INVISIBLE_NOTE = 'So slight that no eye or camera will see it.';

const PAGES = publishedEventPages as EventPage[];

const signOf = (slug: string) => {
  const sign = SHORTS_SIGNS.find((entry) => entry.slug === slug);
  if (!sign) throw new Error(`Unknown sign: ${slug}`);
  return sign;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function eclipseOf(page: EventPage) {
  const day = page.anchor.slice(0, 10);
  const row = (eclipsesData.eclipses as { type: string; kind: string; peak: string }[])
    .find((eclipse) => eclipse.peak.slice(0, 10) === day);
  if (!row) throw new Error(`${page.id}: no eclipse in eclipses.json on ${day}`);
  return row;
}

/** The big name on the video. */
export function eventName(page: EventPage): string {
  const [a, b] = page.bodies ?? [];
  switch (page.family) {
    case 'lunation': return page.subtype === 'full' ? 'Full Moon' : 'New Moon';
    case 'eclipse': {
      const eclipse = eclipseOf(page);
      return `${capitalize(eclipse.kind)} ${eclipse.type} eclipse`;
    }
    case 'retrograde': return `${a} retrograde`;
    case 'ingress': return `${a} enters ${signOf(page.signs[0]).name}`;
    case 'aspect': return `${a} ${page.subtype} ${b}`;
    default: throw new Error(`${page.id}: no video for the ${page.family} family`);
  }
}

/** The line above the name: the UTC day, and the sign where the name does not say it. */
export function eventKicker(page: EventPage): string {
  const day = eventDay(page.anchor);
  if (page.family === 'ingress' || page.family === 'aspect') return day;
  return `${day}, in ${signOf(page.signs[0]).name}`;
}

/** The sentence that gives the time the page prints. */
export function eventTimeSentence(page: EventPage): string {
  const clock = eventClock(page.anchor);
  switch (page.family) {
    case 'eclipse': return `Peak at ${clock}.`;
    case 'retrograde': return `${page.bodies?.[0]} stations retrograde at ${clock}.`;
    default: return `Exact at ${clock}.`;
  }
}

function hashtags(page: EventPage): string {
  const sign = signOf(page.signs[0]).name.toLowerCase();
  const tags = (() => {
    switch (page.family) {
      case 'lunation': return [page.subtype === 'full' ? '#fullmoon' : '#newmoon', `#${page.subtype}moonin${sign}`];
      case 'eclipse': return ['#eclipse', `#${eclipseOf(page).type}eclipse`];
      case 'retrograde': return [`#${page.bodies?.[0].toLowerCase()}retrograde`, '#retrograde'];
      default: return ['#transits'];
    }
  })();
  return [...tags, `#${sign}`, '#astrology', '#zodiac'].join(' ');
}

/** One event's video: its name, lines and caption, at the time its page prints. */
export function eventShort(published: EventPage): EventShort {
  const [page] = refinePublishedAnchors([published]);
  const texts = [page.summary];
  if (page.family === 'eclipse' && isInvisiblePenumbral(page.anchor, eclipseOf(page).kind)) texts.push(INVISIBLE_NOTE);
  texts.push(eventTimeSentence(page));
  const sentences = texts.map((text) => ({ text, lines: balanceLines(text, SHORTS_TEXT.maxChars) }));
  const lines = sentences.reduce((sum, sentence) => sum + sentence.lines.length, 0);
  if (lines > SHORTS_TEXT.maxLines) throw new Error(`${page.id}: ${lines} lines, over the budget of ${SHORTS_TEXT.maxLines}`);
  const address = `zodiacs.org${page.path}`;
  const caption = [
    page.title,
    '',
    ...texts,
    '',
    `More: ${address}`,
    '',
    hashtags(page),
    '',
  ].join('\n');
  const short: EventShort = {
    id: page.id,
    stem: page.id,
    path: page.path,
    at: page.anchor,
    art: page.signs[0],
    name: eventName(page),
    hue: signOf(page.signs[0]).hue,
    kicker: eventKicker(page),
    address,
    footer: EVENT_SHORTS_FOOTER,
    sentences,
    caption,
  };
  for (const text of [short.name, short.kicker, short.footer, caption]) {
    if (hasDash(text)) throw new Error(`${page.id}: a dash in ${JSON.stringify(text)}`);
  }
  return short;
}

/**
 * The events to make videos of: the ones given by id, or every published
 * event from `from` for `days` days, in time order.
 */
export function eventShorts({ from = new Date().toISOString(), days = 31, only }: {
  from?: string; days?: number; only?: readonly string[];
} = {}): EventShort[] {
  let pages: EventPage[];
  if (only?.length) {
    pages = only.map((id) => {
      const page = PAGES.find((entry) => entry.id === id);
      if (!page) throw new Error(`No published event page with id ${id}`);
      return page;
    });
  } else {
    const start = Date.parse(from);
    if (Number.isNaN(start)) throw new Error(`Not a date: ${from}`);
    const end = start + days * 86_400_000;
    // Filter on the printed (NASA) time, and hand eventShort the page as published.
    const printed = refinePublishedAnchors(PAGES);
    pages = PAGES.filter((_, index) => {
      const at = Date.parse(printed[index].anchor);
      return at >= start && at < end;
    });
  }
  return pages.map(eventShort).sort((a, b) => a.at.localeCompare(b.at));
}
