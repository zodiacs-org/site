import type { APIRoute } from 'astro';
import registry from '../../../data/conventions/registry.json';

export const prerender = true;

/** The conventions registry as JSON, each id with its address on the registry page. */
export const GET: APIRoute = () => {
  const document = {
    ...registry,
    namespaces: registry.namespaces.map((space) => ({
      ...space,
      entries: space.entries.map((entry) => ({ ...entry, uri: `${registry.base}#${encodeURI(entry.id)}` })),
    })),
  };
  return new Response(`${JSON.stringify(document, null, 2)}\n`, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
