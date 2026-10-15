import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCompatibilityShare, parseOccasionShare } from '../lib/share-results';
import {
  handleCompatibilityImageRequest,
  handleCompatibilityLinkRequest,
  handleOccasionImageRequest,
  handleOccasionLinkRequest,
  handleResultShareNodeRequest,
} from './result-preview';
import { compatibilityCardModel, longDate, NEUTRAL_HUE, occasionCardModel } from './result-preview-model';

const COMPAT = 'a=Ana&as=leo&b=Luis&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong';
const OCCASION = 'o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence&sun=gemini&moon=libra&score=84&v=excellent';
const nativeFetch = globalThis.fetch;

afterEach(() => {
  vi.stubGlobal('fetch', nativeFetch);
});

function nodeResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    headers,
    body: Buffer.alloc(0) as Buffer,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    end(body: Buffer) { this.body = body; },
  };
}

describe('share card models', () => {
  it('show names, signs in their hues, the score, the verdict and the three areas', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(COMPAT))!);
    expect(model).toMatchObject({
      first: 'Ana', second: 'Luis', score: 78, verdict: 'A strong match',
      people: [{ slug: 'leo', label: 'Leo Sun', hue: '#E0A9B4' }, { slug: 'libra', label: 'Libra Sun', hue: '#D3A9DE' }],
      ring: ['#E0A9B4', '#D3A9DE'],
      areas: [{ label: 'Attraction', value: 82 }, { label: 'Communication', value: 71 }, { label: 'Stability', value: 80 }],
      title: 'Ana and Luis: 78/100',
    });
  });

  it('call unnamed people Person A and Person B, and draw an unknown sign in the neutral tone', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams('bs=pisces&score=41&attraction=55&communication=38&stability=30&v=challenging'))!);
    expect([model.first, model.second]).toEqual(['Person A', 'Person B']);
    expect(model.people[0]).toEqual({ slug: null, label: 'Sun sign on the cusp', hue: NEUTRAL_HUE });
    expect(model.verdict).toBe('A challenging match');
  });

  it('give a date its headline, the day in words, the place and the Sun and Moon', () => {
    const model = occasionCardModel(parseOccasionShare(new URLSearchParams(OCCASION))!);
    expect(model).toMatchObject({
      names: 'Ana & Luis', headline: 'Our wedding', when: 'Saturday 12 June 2027 · Florence', score: 84, verdict: 'An excellent day for it',
      signs: [{ label: 'Gemini Sun' }, { label: 'Libra Moon' }],
      title: 'Ana & Luis: Wedding, 84/100',
    });
    expect(longDate('1999-08-11')).toBe('Wednesday 11 August 1999');
  });
});

describe('share link pages', () => {
  it('show the card, a line about it and the way to check your own, with the preview image', async () => {
    const response = await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}&ref=chatgpt`));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).not.toContain('<script');
    const image = `https://zodiacs.org/api/og/compatibility-image?${COMPAT.replaceAll('&', '&amp;')}`;
    expect(html).toContain(`<meta property="og:image" content="${image}">`);
    expect(html).toContain(`<meta name="twitter:image" content="${image}">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`<img class="card" src="${image}"`);
    expect(html).toContain('<a class="cta" href="/compatibility/?ref=chatgpt">Check your own compatibility</a>');
    expect(html).toContain('<title>Ana and Luis: 78/100 on Zodiacs</title>');
    expect(html).not.toMatch(/ref=chatgpt[^"]*"[^>]*og:image|image\?[^"]*ref=/u);
  });

  it('offer a date its own way to rate yours', async () => {
    const response = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?${OCCASION}`));
    const html = await response.text();
    expect(html).toContain(`content="https://zodiacs.org/api/og/occasion-image?${OCCASION.replaceAll('&', '&amp;')}"`);
    expect(html).toContain('<a class="cta" href="/occasions/">Rate your own date</a>');
    expect(html).toContain('Ana &amp; Luis: our wedding');
  });

  it('open the plain page, with the site’s own card, for a query that is not a share', async () => {
    const response = await handleCompatibilityLinkRequest(new Request('https://zodiacs.org/share/compatibility/?a=%3Cscript%3E&score=78'));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('content="https://zodiacs.org/assets/og/v2/tool/compatibility.png"');
    expect(html).not.toContain('script%3E');
    expect(html).not.toContain('<script');
    const occasion = await (await handleOccasionLinkRequest(new Request('https://zodiacs.org/share/occasion/?o=wedding&d=2027-06-12&lat=1'))).text();
    expect(occasion).toContain('content="https://zodiacs.org/assets/og/v2/share.png"');
  });

  it('refuse other methods', async () => {
    expect((await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}`, { method: 'POST' }))).status).toBe(405);
    expect((await handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}`, { method: 'POST' }))).status).toBe(405);
  });
});

describe('the deployed entry', () => {
  it('is reached through the existing compatibility function', async () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    for (const [source, route] of [
      ['/share/compatibility/', 'compatibility-link'], ['/api/og/compatibility-image', 'compatibility-image'],
      ['/share/occasion/', 'occasion-link'], ['/api/og/occasion-image', 'occasion-image'],
    ]) expect(vercel.rewrites).toContainEqual({ source, destination: `/api/compatibility?__zodiacs_share=${route}` });
    const source = readFileSync(new URL('../../api/compatibility.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '../src/server/result-preview.js'");
  });


  it('passes on only the route’s own keys, and the image refuses anything else', async () => {
    const res = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-image', ...Object.fromEntries(new URLSearchParams(COMPAT)), lat: '1' } }, res, 'compatibility-image');
    expect(res.statusCode).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');

    const repeated = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-link', ...Object.fromEntries(new URLSearchParams(COMPAT)), a: ['Ana', 'Eve'] } }, repeated, 'compatibility-link');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.body.toString()).toContain('Compare two birth charts');

    const page = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'evil.example' }, query: { __zodiacs_share: 'occasion-link', ...Object.fromEntries(new URLSearchParams(OCCASION)) } }, page, 'occasion-link');
    expect(page.statusCode).toBe(200);
    expect(page.body.toString()).toContain('content="https://zodiacs.org/api/og/occasion-image?');
  });
});

describe('share preview images', () => {
  it.each([
    ['compatibility', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${COMPAT}`))],
    ['date', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}`))],
    ['accented names', () => handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?a=%C5%81ukasz&b=Zo%C3%AB&score=63&attraction=70&communication=59&stability=58&v=good'))],
  ])('render the %s card as a local-asset-only 1200×630 PNG', async (_label, render) => {
    const fetchSpy = vi.fn(() => {
      throw new Error('The share preview renderer must not fetch assets.');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const response = await render();
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
  }, 30_000);

  it('refuses a query that is not a share', async () => {
    const response = await handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?score=78'));
    expect(response.status).toBe(400);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });
});
