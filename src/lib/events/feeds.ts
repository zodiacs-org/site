/**
 * The sky-event feeds built from the published timeline
 * (src/lib/events/site-publication.ts): one RSS feed per sign
 * (/feeds/events/{sign}.xml), and a JSON Feed 1.1 of every event
 * (/feeds/events.json) and of each sign (/feeds/events/{sign}.json) for AI
 * tools and developers.
 *
 * A sign's feed holds the events that take place in that sign: a new or full
 * Moon or an eclipse in it, a planet stationing in it or entering it, and an
 * exact aspect with a planet in it. Nothing here reads a request; every file
 * is the same for every reader and carries no personal data.
 */
import { eventsPublication, type PublishedEventDescriptor } from './site-publication';
import { SIGNS, type Sign } from '../signs';

export const SITE = 'https://zodiacs.org';

const esc = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function signForSlug(slug: string | undefined): Sign {
  const sign = SIGNS.find((candidate) => candidate.slug === slug);
  if (!sign) throw new Error(`Unknown sign for an events feed: ${slug ?? 'missing'}`);
  return sign;
}

/** The timeline in time order, or the part of it that takes place in one sign. */
export function feedEvents(sign?: string): PublishedEventDescriptor[] {
  return eventsPublication.timeline
    .filter((event) => !sign || event.signs.includes(sign))
    .slice()
    .sort((a, b) => a.anchor.localeCompare(b.anchor) || a.id.localeCompare(b.id));
}

const lastBuild = () => new Date(`${eventsPublication.lastModified}T00:00:00.000Z`);

/** RSS 2.0 for one sign, in the shape of /feeds/events.xml. */
export function signEventsRss(sign: Sign): string {
  const self = `${SITE}/feeds/events/${sign.slug}.xml`;
  const items = feedEvents(sign.slug).map((event) => `    <item>
      <title>${esc(event.title)}</title>
      <link>${SITE}${event.path}</link>
      <guid isPermaLink="false">${SITE}/feeds/events/${esc(event.id)}</guid>
      <pubDate>${new Date(event.anchor).toUTCString()}</pubDate>
      <description>${esc(event.summary)}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`Zodiacs.org | sky events in ${sign.name}`)}</title>
    <link>${SITE}/${sign.slug}/</link>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
    <description>${esc(`New and full Moons, eclipses, stations, sign changes and exact alignments that take place in ${sign.name}, dated in universal time.`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

export function rssResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}

/** One JSON Feed item, with the event's facts under the `_zodiacs` extension. */
function jsonItem(event: PublishedEventDescriptor) {
  return {
    id: `${SITE}/feeds/events/${event.id}`,
    url: `${SITE}${event.path}`,
    title: event.title,
    content_text: event.summary,
    date_published: event.anchor,
    date_modified: `${event.lastModified}T00:00:00.000Z`,
    tags: [event.family, event.subtype, ...event.signs],
    ...(event.card ? { image: `${SITE}${event.card}` } : {}),
    _zodiacs: {
      event_id: event.id,
      at_utc: event.anchor,
      family: event.family,
      subtype: event.subtype,
      bodies: event.bodies,
      signs: event.signs,
    },
  };
}

/** JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/) of every event, or of one sign's. */
export function eventsJsonFeed(sign?: Sign) {
  const path = sign ? `/feeds/events/${sign.slug}.json` : '/feeds/events.json';
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: sign ? `Zodiacs.org | sky events in ${sign.name}` : 'Zodiacs.org | sky events',
    home_page_url: `${SITE}${sign ? `/${sign.slug}/` : '/events/'}`,
    feed_url: `${SITE}${path}`,
    description: sign
      ? `New and full Moons, eclipses, stations, sign changes and exact alignments that take place in ${sign.name}, ${eventsPublication.window.from.slice(0, 4)} to ${Number(eventsPublication.window.to.slice(0, 4)) - 1}.`
      : `Every new and full Moon, eclipse, retrograde and direct station, slow planet sign change and exact alignment between slow planets that Zodiacs.org publishes, ${eventsPublication.window.from.slice(0, 4)} to ${Number(eventsPublication.window.to.slice(0, 4)) - 1}.`,
    language: 'en',
    authors: [{ name: 'Zodiacs.org', url: `${SITE}/` }],
    _zodiacs: {
      about: 'One item per sky event, in time order. date_published and _zodiacs.at_utc are the exact instant of the event in UTC (ISO 8601), not when the item was written; the event page shows it in the reader’s own time zone too. _zodiacs.signs are the signs the event takes place in, as lowercase English slugs. url is the event’s page on zodiacs.org. Astronomy facts only: the pages keep what the event means in astrology separate from the computed facts, and nothing here is a personal forecast.',
      license: 'CC BY 4.0, cite Zodiacs.org and link the event page',
      methodology: `${SITE}/methodology/`,
      calendar: `${SITE}/sky-calendar.ics`,
      rss: `${SITE}${sign ? `/feeds/events/${sign.slug}.xml` : '/feeds/events.xml'}`,
      window: eventsPublication.window,
      last_modified: eventsPublication.lastModified,
      ...(sign ? {} : { per_sign: SIGNS.map((s) => `${SITE}/feeds/events/${s.slug}.json`) }),
    },
    items: feedEvents(sign?.slug).map(jsonItem),
  };
}

export function jsonFeedResponse(feed: unknown): Response {
  return new Response(`${JSON.stringify(feed, null, 2)}\n`, { headers: {
    'Content-Type': 'application/feed+json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  } });
}
