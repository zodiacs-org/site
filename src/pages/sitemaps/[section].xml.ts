/**
 * One section of /sitemap.xml (./_sections.ts names the sections), with the
 * same entries, alternates and dates. Only sections that list at least one
 * location are built; /sitemap-index.xml lists the same set.
 */
import type { APIRoute } from 'astro';
import { partitionSitemap } from './_sections';
import { renderUrlset, sitemapEntries, type SitemapEntry } from '../sitemap.xml';

export const prerender = true;

export async function getStaticPaths() {
  const sections = partitionSitemap(await sitemapEntries());
  return [...sections]
    .filter(([, entries]) => entries.length > 0)
    .map(([section, entries]) => ({ params: { section }, props: { entries } }));
}

export const GET: APIRoute = ({ props }) => new Response(renderUrlset((props as { entries: SitemapEntry[] }).entries), {
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});
