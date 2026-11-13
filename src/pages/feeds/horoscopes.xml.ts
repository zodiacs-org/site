/**
 * RSS 2.0 feed of today's horoscopes — one item per sign. The committed
 * horoscope program makes the feed deterministic and gives every item the
 * same verified UTC edition date as its canonical page.
 */
import type { APIRoute } from 'astro';
import horoscopeProgramData from '../../data/horoscope-program.json';
import { datedEditionText } from '../../lib/edition-freshness';
import type { HoroscopeProgram } from '../../lib/horoscope-program';
import { SIGNS } from '../../lib/signs';

const SITE = 'https://zodiacs.org';
const horoscopeProgram = horoscopeProgramData as HoroscopeProgram;

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const pub = new Date(`${horoscopeProgram.anchorDate}T00:00:00Z`).toUTCString();
  const bySign = new Map(horoscopeProgram.signs.map((entry) => [entry.sign, entry] as const));
  const items = SIGNS.map((sign) => {
    const reading = bySign.get(sign.slug)?.readings.today;
    if (!reading || reading.status !== 'publishable') {
      throw new Error(`Missing publishable daily horoscope for ${sign.slug}`);
    }
    const url = `${SITE}/horoscopes/${sign.slug}/`;
    return `    <item>
      <title>${esc(`${sign.name} daily horoscope, ${horoscopeProgram.anchorDate}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="false">${url}#${horoscopeProgram.anchorDate}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(datedEditionText(reading.text, horoscopeProgram.anchorDate))}</description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zodiacs.org daily horoscopes</title>
    <link>${SITE}/horoscopes/</link>
    <atom:link href="${SITE}/feeds/horoscopes.xml" rel="self" type="application/rss+xml" />
    <description>A clear daily focus and one useful move for all twelve signs.</description>
    <language>en</language>
    <lastBuildDate>${pub}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
