/** One deterministic daily RSS feed for each sun sign. */
import type { APIRoute } from 'astro';
import horoscopeProgramData from '../../../data/horoscope-program.json';
import { datedEditionText } from '../../../lib/edition-freshness';
import type { HoroscopeProgram } from '../../../lib/horoscope-program';
import { SIGNS } from '../../../lib/signs';

const SITE = 'https://zodiacs.org';
const horoscopeProgram = horoscopeProgramData as HoroscopeProgram;

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function getStaticPaths() {
  return SIGNS.map((sign) => ({ params: { sign: sign.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const sign = SIGNS.find((candidate) => candidate.slug === params.sign);
  if (!sign) throw new Error(`Unknown horoscope feed sign: ${params.sign ?? 'missing'}`);
  const reading = horoscopeProgram.signs.find((entry) => entry.sign === sign.slug)?.readings.today;
  if (!reading || reading.status !== 'publishable') {
    throw new Error(`Missing publishable daily horoscope for ${sign.slug}`);
  }

  const canonical = `${SITE}/horoscopes/${sign.slug}/`;
  const self = `${SITE}/feeds/horoscopes/${sign.slug}.xml`;
  const pub = new Date(`${horoscopeProgram.anchorDate}T00:00:00Z`).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`Zodiacs.org | ${sign.name} daily horoscope`)}</title>
    <link>${canonical}</link>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
    <description>${esc(`${sign.name}’s daily focus and one useful move, delivered in a single-item feed.`)}</description>
    <language>en</language>
    <lastBuildDate>${pub}</lastBuildDate>
    <item>
      <title>${esc(`${sign.name} daily horoscope, ${horoscopeProgram.anchorDate}`)}</title>
      <link>${canonical}</link>
      <guid isPermaLink="false">${canonical}#${horoscopeProgram.anchorDate}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(datedEditionText(reading.text, horoscopeProgram.anchorDate))}</description>
    </item>
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
