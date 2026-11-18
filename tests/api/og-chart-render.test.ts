import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePositionsLink, POSITION_BODY_ORDER } from '../../src/lib/share-positions';

const nativeFetch = globalThis.fetch;

afterEach(() => {
  vi.stubGlobal('fetch', nativeFetch);
});

describe('chart preview renderer', () => {
  it('renders the full card as a local-asset-only 1200×630 PNG', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('The chart preview renderer must not fetch assets.');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { handleChartImageRequest } = await import('../../src/server/chart-preview');
    const token = encodePositionsLink({
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 29.999 })),
      angles: { asc: 359.999, mc: 270 },
      houseSystem: 'whole',
      engineVersion: '1.2.3',
    })!;

    const { previewQuery } = await import('../../src/lib/share-preview');
    const { previewPlacementsFromToken } = await import('../../src/server/chart-preview-model');
    // The whole-degree preview query a link carries; an older link's full code is no longer drawn.
    const response = await handleChartImageRequest(new Request(
      `https://zodiacs.org/api/og/chart-image?${previewQuery(previewPlacementsFromToken(token)!)}`,
    ));
    const png = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.byteLength).toBeGreaterThan(20_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
