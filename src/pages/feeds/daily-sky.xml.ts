/**
 * RSS 2.0 feed of the daily sky — one item per build day, regenerated
 * by the Daily Sky cron's commit. Single-item feeds are valid RSS;
 * readers accumulate history on their side.
 */
import type { APIRoute } from 'astro';
import daily from '../../data/daily.json';
import { editionDateLabel } from '../../lib/edition-freshness';
import { signBySlug } from '../../lib/signs';

const SITE = 'https://zodiacs.org';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const GET: APIRoute = () => {
  const positions = daily.bodies
    .map((b) => `${b.body} ${b.degree.toFixed(1)}° ${signBySlug(b.sign)?.name ?? cap(b.sign)}${b.retrograde ? ' Rx' : ''}`)
    .join(' · ');
  const retro = daily.bodies.filter((b) => b.retrograde).map((b) => b.body);
  type Ev = { kind: string; planet?: string; sign?: string; type?: string; a?: string; b?: string; retrograde?: boolean };
  const eventBits = ((daily.events ?? []) as Ev[])
    .slice(0, 3)
    .map((e) => {
      if (e.kind === 'ingress') return `${e.planet} enters ${cap(e.sign ?? '')}`;
      if (e.kind === 'station') return `${e.planet} stations ${e.type === 'retrograde' ? 'retrograde' : 'direct'}`;
      if (e.kind === 'lunation') return `${e.type} in ${cap(e.sign ?? '')}`;
      if (e.kind === 'aspect') return `${e.a} ${e.type} ${e.b}`;
      return null;
    })
    .filter(Boolean);

  const description = [
    `${editionDateLabel(daily.date)} edition.`,
    `Moon phase: ${daily.moon.phase}.`,
    daily.eventsCoverage === 'unavailable'
      ? 'Exact-event coverage is unavailable for this date; positions remain available.'
      : '',
    eventBits.length ? `${editionDateLabel(daily.date)}: ${eventBits.join('; ')}.` : '',
    retro.length ? `Retrograde: ${retro.join(', ')}.` : '',
    `Positions at 12:00 UTC: ${positions}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const pub = new Date(`${daily.date}T00:00:00Z`).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zodiacs.org | the sky, daily</title>
    <link>${SITE}/transits/</link>
    <atom:link href="${SITE}/feeds/daily-sky.xml" rel="self" type="application/rss+xml" />
    <description>Each day's planetary positions, moon phase, and events, computed at 12:00 UTC.</description>
    <language>en</language>
    <lastBuildDate>${pub}</lastBuildDate>
    <item>
      <title>${esc(`The sky, ${daily.date}, ${daily.moon.phase}`)}</title>
      <link>${SITE}/transits/</link>
      <guid isPermaLink="false">${SITE}/feeds/daily-sky/${daily.date}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(description)}</description>
    </item>
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
