import type { APIRoute } from 'astro';
import { accuracyRobots } from '../accuracy/publication.mjs';
import rules from '../robots.txt?raw';

export const GET: APIRoute = () => new Response(accuracyRobots(rules), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
