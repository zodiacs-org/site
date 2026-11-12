import type { APIRoute } from 'astro';
import publication from '../../data/registry-research/publication.json';
import pause from '../../data/registry-research/pause.json';
import {
  REGISTRY_RESEARCH_FEED_SCHEMA,
  compactRegistryResearchItem,
  registryResearchRss,
} from '../../../scripts/registry-research-lib.mjs';

export const GET: APIRoute = () => new Response(registryResearchRss({
  schema: REGISTRY_RESEARCH_FEED_SCHEMA,
  generatedAt: publication.generatedAt,
  publisher: publication.publisher,
  window: publication.window,
  items: (publication.items as unknown as Parameters<typeof compactRegistryResearchItem>[0][])
    .filter((item) => (publication as typeof publication & { rollingItemIds?: string[] }).rollingItemIds?.includes(item.id))
    .map(compactRegistryResearchItem),
}, { pause }), {
  headers: {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
  },
});
