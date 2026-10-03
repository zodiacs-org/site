import type { APIRoute } from 'astro';
import { skyCalendarResponse } from '../lib/return-visits/sky-calendar';
export const prerender = true;
export const GET: APIRoute = () => skyCalendarResponse('en');
