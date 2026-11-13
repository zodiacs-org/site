import type { APIRoute } from 'astro';
import { headsUpCalendarResponse } from '../lib/sky-heads-up';
export const prerender = true;
// Inputless: the file is the same for every reader and reads nothing from the request.
export const GET: APIRoute = () => headsUpCalendarResponse();
