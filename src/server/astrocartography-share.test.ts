import { decode as decodeJpeg } from 'jpeg-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACG_ANGLES, ACG_BODIES } from '../lib/astrocartography/lines';
import { ASTROCARTOGRAPHY_SHARE_KEYS, astrocartographyShareUrl, parseAstrocartographyShare } from '../lib/astrocartography/share';
import { forbiddenClaim } from '../ai-tools/personal/shared';
import { astrocartographyCardModel, handleAstrocartographyImageRequest, handleAstrocartographyLinkRequest, handleAstrocartographyStoryRequest } from './result-preview';

afterEach(() => { vi.unstubAllGlobals(); });

describe('the astrocartography share link', () => {
  it('carries the planet and the angle alone, and reads back', () => {
    const url = astrocartographyShareUrl('https://zodiacs.org', { planet: 'Jupiter', angle: 'MC' });
    expect(url).toBe('https://zodiacs.org/share/astrocartography/?p=jupiter&a=mc');
    expect(parseAstrocartographyShare(new URL(url).searchParams)).toEqual({ planet: 'Jupiter', angle: 'MC', ref: null });
    expect(ASTROCARTOGRAPHY_SHARE_KEYS).toEqual(['p', 'a', 'ref']);
    // Every planet on every angle makes a share, and its card stays inside the copy rule.
    for (const planet of ACG_BODIES) for (const angle of ACG_ANGLES) {
      const share = parseAstrocartographyShare(new URL(astrocartographyShareUrl('https://zodiacs.org', { planet, angle })).searchParams);
      expect(share).toEqual({ planet, angle, ref: null });
      const model = astrocartographyCardModel(share!);
      expect(forbiddenClaim(`${model.title} ${model.detail} ${model.line}`)).toBeNull();
    }
  });

  it('is not a share with a birth detail, a place, a name, an unknown value or a repeated key', () => {
    for (const query of ['p=jupiter&a=mc&d=1990-05-03', 'p=jupiter&a=mc&t=08:30', 'p=jupiter&a=mc&city=Lisbon', 'p=jupiter&a=mc&n=Ada', 'p=jupiter&a=mc&lat=38.7',
      'p=chiron&a=mc', 'p=jupiter&a=vertex', 'p=jupiter', 'a=mc', 'p=jupiter&a=mc&a=ic', 'p=Jupiter&a=MC', 'p=jupiter&a=mc&ref=other'])
      expect(parseAstrocartographyShare(new URLSearchParams(query)), query).toBeNull();
    expect(parseAstrocartographyShare(new URLSearchParams('p=venus&a=dsc&ref=chatgpt'))).toEqual({ planet: 'Venus', angle: 'DSC', ref: 'chatgpt' });
  });
});

describe('the astrocartography share page and pictures', () => {
  it('opens a page that names the line, shows its card and links back to the map', async () => {
    const html = await (await handleAstrocartographyLinkRequest(new Request('https://zodiacs.org/share/astrocartography/?p=venus&a=dsc&ref=chatgpt'))).text();
    expect(html).toContain('My Venus Descendant line');
    expect(html).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/astrocartography-image?p=venus&amp;a=dsc"');
    expect(html).toContain('href="/astrocartography/?ref=chatgpt"');
    expect(html).toContain('/api/og/astrocartography-story?p=venus&amp;a=dsc');
    expect(html).not.toMatch(/[–—]/u);
    // A link that is not a share opens the plain page, which still leads to the map.
    const plain = await (await handleAstrocartographyLinkRequest(new Request('https://zodiacs.org/share/astrocartography/?p=venus&a=dsc&city=Paris'))).text();
    expect(plain).toContain('Your astrocartography map');
    expect(plain).not.toContain('Paris');
    expect(plain).toContain('href="/astrocartography/"');
  });

  it.each([
    ['image', () => handleAstrocartographyImageRequest(new Request('https://zodiacs.org/api/og/astrocartography-image?p=jupiter&a=mc')), [1200, 630]],
    ['story', () => handleAstrocartographyStoryRequest(new Request('https://zodiacs.org/api/og/astrocartography-story?p=moon&a=ic')), [1080, 1920]],
  ] as const)('draws the %s from local assets only', async (_label, render, size) => {
    const fetchSpy = vi.fn(() => { throw new Error('The share renderer must not fetch assets.'); });
    vi.stubGlobal('fetch', fetchSpy);
    const response = await render();
    const jpeg = Buffer.from(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    const { width, height } = decodeJpeg(jpeg);
    expect([width, height]).toEqual(size);
    expect(jpeg.byteLength).toBeLessThan(size[0] === 1200 ? 300_000 : 900_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30_000);

  it('refuses a picture for anything but a share', async () => {
    for (const url of ['https://zodiacs.org/api/og/astrocartography-image?p=jupiter&a=mc&d=1990-05-03', 'https://zodiacs.org/api/og/astrocartography-image?p=jupiter'])
      expect((await handleAstrocartographyImageRequest(new Request(url))).status, url).toBe(400);
  });
});
