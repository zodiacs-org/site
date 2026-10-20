import { afterEach, describe, expect, it, vi } from 'vitest';

const reviewedPublication = {
  released: true,
  updated: '2026-10-20',
  reviewer: 'Editorial review fixture',
  reviewedAt: '2026-10-20',
  indexingEvidence: 'fixtures/reviewed-indexing.json',
};

async function policy(publication, preview = '') {
  vi.resetModules();
  vi.stubEnv('PUBLIC_SYNASTRY_REFERENCE_PREVIEW', preview);
  vi.doMock('../src/data/synastry-publication.json', () => ({ default: publication }));
  return import('./synastry-reference-policy.mjs');
}

afterEach(() => {
  vi.doUnmock('../src/data/synastry-publication.json');
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('synastry publication policy', () => {
  it('publishes a complete released record and registers only the hub and pair routes', async () => {
    const { synastryPublished, synastryEnabled, synastryReferenceRoutes } = await policy(reviewedPublication);
    expect(synastryPublished).toBe(true);
    expect(synastryEnabled).toBe(true);
    const injectRoute = vi.fn();
    synastryReferenceRoutes().hooks['astro:config:setup']({ injectRoute });
    expect(injectRoute.mock.calls).toEqual([
      [{ pattern: '/compatibility/aspects/', entrypoint: './src/reference-pages/aspects/index.astro' }],
      [{ pattern: '/compatibility/aspects/[slug]/', entrypoint: './src/reference-pages/aspects/[slug].astro' }],
    ]);
    const { referencePublished, referenceEnabled, aspectReference } = await import('../src/lib/aspect-reference');
    expect(referencePublished).toBe(true);
    expect(referenceEnabled).toBe(true);
    expect(aspectReference('synastry', 'Sun', 'Moon', 'trine')?.href).toBe('/compatibility/aspects/sun-moon/#trine');
  });
  it.each(['released', 'reviewer', 'reviewedAt', 'indexingEvidence'])('withholds publication when %s is missing', async (field) => {
    const incomplete = { ...reviewedPublication, [field]: null };
    const { synastryPublished, synastryEnabled, synastryReferenceRoutes } = await policy(incomplete);
    expect(synastryPublished).toBe(false);
    expect(synastryEnabled).toBe(false);
    const injectRoute = vi.fn();
    synastryReferenceRoutes().hooks['astro:config:setup']({ injectRoute });
    expect(injectRoute).not.toHaveBeenCalled();
    const { referencePublished, referenceEnabled } = await import('../src/lib/aspect-reference');
    expect(referencePublished).toBe(false);
    expect(referenceEnabled).toBe(false);
  });
  it('allows preview routes without publishing an incomplete record', async () => {
    const { synastryPublished, synastryEnabled } = await policy({ ...reviewedPublication, released: false }, '1');
    expect(synastryPublished).toBe(false);
    expect(synastryEnabled).toBe(true);
    const { referencePublished, referenceEnabled } = await import('../src/lib/aspect-reference');
    expect(referencePublished).toBe(false);
    expect(referenceEnabled).toBe(true);
  });
});
