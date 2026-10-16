/** RSS 2.0 calendar of the approved public sky-event window. */
import type { APIRoute } from 'astro';
import { eventsPublication } from '../../lib/events/publication';

const SITE = 'https://zodiacs.org';
const esc = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const items = eventsPublication.timeline.map((event) => {
    const url = `${SITE}${event.path}`;
    return `    <item>
      <title>${esc(event.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${SITE}/feeds/events/${esc(event.id)}</guid>
      <pubDate>${new Date(event.anchor).toUTCString()}</pubDate>
      <description>${esc(event.summary)}</description>
    </item>`;
  }).join('\n');
  const lastBuildDate = new Date(`${eventsPublication.lastModified}T00:00:00.000Z`).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zodiacs.org | sky events</title>
    <link>${SITE}${eventsPublication.hub.path}</link>
    <atom:link href="${SITE}/feeds/events.xml" rel="self" type="application/rss+xml" />
    <description>Full moons, eclipses, retrograde stations, slow-planet sign changes, and rare exact alignments, dated in universal time.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
