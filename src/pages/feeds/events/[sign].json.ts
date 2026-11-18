/** JSON Feed 1.1 of the published sky events that take place in one sign. */
import type { APIRoute } from 'astro';
import { SIGNS } from '../../../lib/signs';
import { eventsJsonFeed, jsonFeedResponse, signForSlug } from '../../../lib/events/feeds';

export const prerender = true;

export function getStaticPaths() {
  return SIGNS.map((sign) => ({ params: { sign: sign.slug } }));
}

export const GET: APIRoute = ({ params }) => jsonFeedResponse(eventsJsonFeed(signForSlug(params.sign)));
