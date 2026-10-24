import publication from '../data/synastry-publication.json';

export const SYNASTRY_PAIRS = ['sun-moon', 'moon-venus', 'moon-mars'] as const;
export const REFERENCE_GEOMETRIES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;
export const referencePublished = publication.released === true
  && Boolean(publication.reviewer && publication.reviewedAt && publication.indexingEvidence);
export const referenceEnabled = referencePublished || import.meta.env.PUBLIC_SYNASTRY_REFERENCE_PREVIEW === '1';

export function aspectReference(
  context: string,
  a: string,
  b: string,
  geometry: string,
  enabled = referenceEnabled,
): { href: string; label: string; chartA: string; chartB: string } | null {
  if (!enabled || context !== 'synastry'
    || !(REFERENCE_GEOMETRIES as readonly string[]).includes(geometry)) return null;
  const pair = SYNASTRY_PAIRS.find((slug) => {
    const [first, second] = slug.split('-');
    return (a.toLowerCase() === first && b.toLowerCase() === second)
      || (a.toLowerCase() === second && b.toLowerCase() === first);
  });
  if (!pair) return null;
  return {
    href: `/compatibility/aspects/${pair}/#${geometry}`,
    label: `Read ${pair.split('-').map((body) => body[0].toUpperCase() + body.slice(1)).join('-')} ${geometry} in synastry`,
    chartA: a,
    chartB: b,
  };
}
