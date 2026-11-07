import type { APIRoute } from 'astro';
import { siteSkyCalendarResponse } from '../lib/sky-calendar-feed';
export const prerender = true;
export const GET: APIRoute = () => siteSkyCalendarResponse('en');
