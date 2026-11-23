import type { APIRoute } from 'astro';
import { twinRoute } from '../lib/markdown-twins';

export const prerender = true;

/** The Markdown twin of /full-moon-calendar/: the page's own sentences and data as plain Markdown (src/lib/markdown-twins). */
export const GET: APIRoute = twinRoute('full-moon-calendar');
