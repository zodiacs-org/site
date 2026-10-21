import publication from '../src/data/synastry-publication.json' with { type: 'json' };

export const synastryPublished = publication.released === true
  && Boolean(publication.reviewer && publication.reviewedAt && publication.indexingEvidence);
export const synastryPreview = process.env.PUBLIC_SYNASTRY_REFERENCE_PREVIEW === '1';
export const synastryEnabled = synastryPublished || synastryPreview;

export function synastryReferenceRoutes() {
  return {
    name: 'synastry-reference-publication',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!synastryEnabled) return;
        injectRoute({ pattern: '/compatibility/aspects/', entrypoint: './src/reference-pages/aspects/index.astro' });
        injectRoute({ pattern: '/compatibility/aspects/[slug]/', entrypoint: './src/reference-pages/aspects/[slug].astro' });
      },
    },
  };
}

export function assertSynastryEntriesPublishable(entries, published = synastryPublished) {
  const drafts = entries.filter((entry) => entry.data.draft).map((entry) => entry.id).sort();
  if (published && drafts.length) {
    throw new Error(`publication record complete but ${drafts.length} entries still draft: ${drafts.join(', ')}`);
  }
}
