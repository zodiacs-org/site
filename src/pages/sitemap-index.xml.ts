/**
 * A sitemap index over the section sitemaps under /sitemaps/, which together
 * list exactly the locations of /sitemap.xml. Each section's lastmod is the
 * latest of its entries' dates. /sitemap.xml stays as it is: robots.txt names
 * both, and the build gates and IndexNow read it.
 */
import type { APIRoute } from 'astro';
import { partitionSitemap, sitemapSectionPath } from './sitemaps/_sections';
import { sitemapEntries } from './sitemap.xml';

const SITE = 'https://zodiacs.org';

export const prerender = true;

export const GET: APIRoute = async () => {
  const sections = [...partitionSitemap(await sitemapEntries())].filter(([, entries]) => entries.length > 0);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sections
  .map(([section, entries]) => {
    const lastmod = entries.map((entry) => entry.lastmod).filter((date): date is string => Boolean(date)).sort().at(-1);
    return `  <sitemap>
    <loc>${SITE}${sitemapSectionPath(section)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </sitemap>`;
  })
  .join('\n')}
</sitemapindex>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
