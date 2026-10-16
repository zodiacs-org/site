/** RSS 2.0 feed of published Almanac articles, newest first. */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://zodiacs.org';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** First ~220 chars of the MDX body, with Markdown links flattened. */
function lede(body: string): string {
  const text = body
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

export const GET: APIRoute = async () => {
  const entries = (await getCollection('almanac', ({ data }) => !data.draft))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
  const latest = entries[0]?.data.updated ?? new Date(0);

  const items = entries.map((entry) => {
    const url = `${SITE}/almanac/${entry.id}/`;
    return `    <item>
      <title>${esc(entry.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${entry.data.published.toUTCString()}</pubDate>
      <description>${esc(lede(entry.body ?? ''))}</description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Zodiacs.org Almanac</title>
    <link>${SITE}/almanac/</link>
    <atom:link href="${SITE}/feeds/almanac.xml" rel="self" type="application/rss+xml" />
    <description>The sky, written down: what is happening up there and what the astrological tradition makes of it.</description>
    <language>en</language>
    <lastBuildDate>${latest.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
