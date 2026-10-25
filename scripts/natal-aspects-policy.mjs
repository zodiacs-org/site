import publication from '../src/data/natal-aspects-publication.json' with { type: 'json' };

// One rule for the Astro pages, the bundle gate and the drive tests. The
// pages pass import.meta.env; plain Node callers use process.env.
export const NATAL_ASPECT_PAIRS = ['sun-moon', 'moon-venus', 'venus-mars'];
export const NATAL_PREVIEW_FLAG = 'PUBLIC_NATAL_ASPECTS_PREVIEW';

export function natalAspectsState(record = publication, env = process.env) {
  const published = record.released === true
    && Boolean(record.reviewer && record.reviewedAt && record.indexingEvidence);
  const preview = env?.[NATAL_PREVIEW_FLAG] === '1';
  return { published, preview, enabled: published || preview };
}

const state = natalAspectsState();
export const natalAspectsPublished = state.published;
export const natalAspectsEnabled = state.enabled;

export const NATAL_PAIR_ENTRYPOINT = './src/reference-pages/natal-aspects/pair.astro';

// The pages live outside src/pages (the Phase 1 freeze covers the existing
// Learn routes), so normal builds emit none of them. Three static patterns
// beside the five-geometry [slug] route: no second dynamic route there.
export function natalAspectRoutes(enabled = natalAspectsEnabled) {
  return {
    name: 'natal-aspect-pairs-publication',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!enabled) return;
        for (const pair of NATAL_ASPECT_PAIRS) {
          injectRoute({ pattern: `/learn/aspects/${pair}/`, entrypoint: NATAL_PAIR_ENTRYPOINT });
        }
      },
    },
  };
}

// The pair records are a closed allowlist beside the five geometry guides,
// never a growing directory. A complete publication record with an entry
// still marked draft fails the build instead of shipping a draft.
export function assertNatalPairEntries(entries, published = natalAspectsPublished) {
  const ids = entries.map((entry) => entry.id).sort();
  if (ids.join(',') !== [...NATAL_ASPECT_PAIRS].sort().join(',')
    || entries.some((entry) => entry.id !== entry.data.pair)) {
    throw new Error(`Natal aspect pairs must be exactly ${NATAL_ASPECT_PAIRS.join(', ')}; found ${ids.join(', ') || 'none'}`);
  }
  const drafts = entries.filter((entry) => entry.data.draft).map((entry) => entry.id).sort();
  if (published && drafts.length) {
    throw new Error(`natal publication record complete but ${drafts.length} entries still draft: ${drafts.join(', ')}`);
  }
}
