import type { APIRoute } from 'astro';
import feed from '../../data/registry-research/publication.json';
import pause from '../../data/registry-research/pause.json';
import {
  REGISTRY_RESEARCH_FEED_DESCRIPTION,
  registryResearchPauseNotice,
} from '../../../scripts/registry-research-lib.mjs';

type PublishedItem = {
  id: string;
  kind: string;
  publisher: string;
  publishedAt: string;
  visibleAt: string;
  title: string;
  summary: string;
  url: string;
  signs: string[];
  topics: string[];
  status: 'published' | 'scheduled';
  artifactHash: string;
  riskStatement: string;
};

const items = feed.items as unknown as PublishedItem[];
const rollingItemIds = new Set((feed as typeof feed & { rollingItemIds?: string[] }).rollingItemIds ?? []);
// While src/data/registry-research/pause.json says "paused", the feed says so
// and lists only what was published before the pause.
const pauseNotice = registryResearchPauseNotice(pause);

export const GET: APIRoute = () => new Response(JSON.stringify({
  schema: 'zodiacs.registry-research-json-feed.v1',
  title: 'Zodiacs.org Markets Research',
  home_page_url: 'https://zodiacs.org/terminal/research/',
  feed_url: 'https://zodiacs.org/feeds/market-research.json',
  description: pauseNotice ? `${pauseNotice} ${REGISTRY_RESEARCH_FEED_DESCRIPTION}` : REGISTRY_RESEARCH_FEED_DESCRIPTION,
  generatedAt: feed.generatedAt,
  ...(pauseNotice ? { _zodiacs: { publishing: 'paused', pausedAt: pause.pausedAt, note: pauseNotice } } : {}),
  items: items
    .filter((item) => rollingItemIds.has(item.id))
    .filter((item) => item.status === 'published' && item.visibleAt <= feed.generatedAt)
    .map((item) => ({
      id: item.id,
      url: `https://zodiacs.org${item.url}`,
      title: item.title,
      summary: item.summary,
      date_published: item.publishedAt,
      date_modified: item.publishedAt,
      tags: item.topics,
      authors: [{ name: item.publisher }],
      _zodiacs: {
        kind: item.kind,
        signs: item.signs,
        artifactSha256: item.artifactHash,
        riskStatement: item.riskStatement,
      },
    })),
}, null, 2), {
  headers: {
    'Content-Type': 'application/feed+json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
  },
});
