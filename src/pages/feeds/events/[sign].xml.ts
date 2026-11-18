/** RSS 2.0 of the published sky events that take place in one sign. */
import type { APIRoute } from 'astro';
import { SIGNS } from '../../../lib/signs';
import { rssResponse, signEventsRss, signForSlug } from '../../../lib/events/feeds';

export const prerender = true;

export function getStaticPaths() {
  return SIGNS.map((sign) => ({ params: { sign: sign.slug } }));
}

export const GET: APIRoute = ({ params }) => rssResponse(signEventsRss(signForSlug(params.sign)));
