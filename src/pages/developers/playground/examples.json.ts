import type { APIRoute } from 'astro';
import { playgroundExamples } from '../../../lib/developer-playground-examples';

export const prerender = true;

/** The playground's documented requests and the API's documented answers (src/lib/developer-playground-examples.ts). */
export const GET: APIRoute = () => new Response(`${JSON.stringify(playgroundExamples(), null, 1)}\n`, {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
