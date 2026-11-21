/**
 * Static build-time endpoints for /badges/sky-check.svg and /badges/sky-check.json.
 * Generates no files when the accuracy receipt is withheld (publication.json),
 * when the snapshot is missing, or when the engine is older than 1.1.0,
 * so both URLs return the host's ordinary 404.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import packageDocument from '../../../package.json';
import latest from '../../data/accuracy/latest.json';
import { accuracyPublished } from '../../accuracy/publication.mjs';
import { engineVersionFromDependency, skyCheckBadge } from '../../lib/sky-check-badge.mjs';

const siteEngineVersion = engineVersionFromDependency(packageDocument.dependencies['@zodiacs/engine']);

export const getStaticPaths = (() => {
  if (!accuracyPublished) return [];
  const badge = skyCheckBadge(latest, new Date(), { siteEngineVersion });
  if (!badge) return [];
  return [
    { params: { file: 'sky-check.svg' }, props: { body: badge.svg, contentType: 'image/svg+xml; charset=utf-8' } },
    { params: { file: 'sky-check.json' }, props: { body: `${JSON.stringify(badge.json, null, 2)}\n`, contentType: 'application/json; charset=utf-8' } },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(props.body, {
  headers: { 'Content-Type': props.contentType },
});
