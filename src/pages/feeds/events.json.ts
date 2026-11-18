/** JSON Feed 1.1 of every published sky event, for AI tools and developers. */
import type { APIRoute } from 'astro';
import { eventsJsonFeed, jsonFeedResponse } from '../../lib/events/feeds';

export const prerender = true;

export const GET: APIRoute = () => jsonFeedResponse(eventsJsonFeed());
