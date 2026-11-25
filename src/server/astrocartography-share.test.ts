import { decode as decodeJpeg } from 'jpeg-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACG_ANGLES, ACG_BODIES } from '../lib/astrocartography/lines';
import { ASTROCARTOGRAPHY_SHARE_KEYS, astrocartographyCleanQuery, astrocartographyShareUrl, parseAstrocartographyShare } from '../lib/astrocartography/share';
import { forbiddenClaim } from '../ai-tools/personal/shared';
import { requestOrigin } from './chart-preview';
import { astrocartographyCardModel, astrocartographyStory, astrocartographyStoryAddress, handleAstrocartographyImageRequest, handleAstrocartographyLinkRequest, handleAstrocartographyStoryRequest, handleResultShareNodeRequest, type ResultShareRoute } from './result-preview';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function nodeResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    headers,
    body: Buffer.alloc(0) as Buffer,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    end(body?: Buffer) { this.body = body ?? Buffer.alloc(0); },
  };
}

/** The deployed entry, as vercel.json's rewrite calls it: the route key joins the query as it arrived. */
async function deployed(route: ResultShareRoute, query: Record<string, string | string[]>) {
  vi.stubEnv('PUBLIC_ASTROCARTOGRAPHY_ENABLED', '1');
  const res = nodeResponse();
  await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: route, ...query } }, res, route);
  return res;
}

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
    expect(html).toMatch(/<img class="card"[^>]+alt="[^"]*Reading confidence 70%\."/u);
    expect(html).toMatch(/<p class="lede">[^<]*Reading confidence 70%\./u);
    expect(html).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/astrocartography-image?p=venus&amp;a=dsc"');
    expect(html).toContain('href="/astrocartography/"');
    expect(html).toContain('/api/og/astrocartography-story?p=venus&amp;a=dsc');
    expect(html).not.toMatch(/[\u2013\u2014]/u);
    // A link with a key the share does not use is sent to the line's own address, which keeps the card.
    const extra = await handleAstrocartographyLinkRequest(new Request('https://zodiacs.org/share/astrocartography/?p=venus&a=dsc&city=Paris'));
    expect(extra.status).toBe(303);
    expect(extra.headers.get('location')).toBe('https://zodiacs.org/share/astrocartography/?p=venus&a=dsc');
    expect(await extra.text()).toBe('');
    // A link that is not a share opens the plain page, which still leads to the map.
    const plain = await (await handleAstrocartographyLinkRequest(new Request('https://zodiacs.org/share/astrocartography/'))).text();
    expect(plain).toContain('Your astrocartography map');
    expect(plain).toContain('href="/astrocartography/"');
  });

  describe('clears every key the share does not use from the address, on the deployed entry', () => {
    const SECRETS = ['1990-05-03', '08:30', 'Lisbon', 'Ada', '38.72'];
    const holdsNone = (text: string) => { for (const value of SECRETS) expect(text).not.toContain(value); };

    it.each([
      [{ p: 'venus', a: 'dsc', birthDate: '1990-05-03' }, '/share/astrocartography/?p=venus&a=dsc'],
      [{ p: 'venus', a: 'dsc', t: '08:30', city: 'Lisbon', n: 'Ada', lat: '38.72' }, '/share/astrocartography/?p=venus&a=dsc'],
      [{ birthDate: '1990-05-03', a: 'dsc', p: 'venus', ref: 'chatgpt' }, '/share/astrocartography/?p=venus&a=dsc&ref=chatgpt'],
      [{ p: 'venus', a: 'dsc', fbclid: 'IwAR0' }, '/share/astrocartography/?p=venus&a=dsc'],
      // A repeated key, or a query that is no share, leaves nothing of the query: the plain page.
      [{ p: ['venus', '1990-05-03'], a: 'dsc' }, '/share/astrocartography/'],
      [{ p: 'chiron', a: 'mc', d: '1990-05-03' }, '/share/astrocartography/'],
      [{ birthDate: '1990-05-03' }, '/share/astrocartography/'],
    ] as const)('sends %j to %s', async (query, location) => {
      const res = await deployed('astrocartography-link', query as Record<string, string | string[]>);
      expect(res.statusCode).toBe(303);
      expect(res.headers.get('location')).toBe(`https://zodiacs.org${location}`);
      holdsNone(res.headers.get('location')!);
      holdsNone(res.body.toString('utf8'));
    });

    it('opens the card at the clean address, and the plain page with no query', async () => {
      const card = await deployed('astrocartography-link', { p: 'venus', a: 'dsc' });
      expect(card.statusCode).toBe(200);
      expect(card.body.toString('utf8')).toContain('My Venus Descendant line');
      const withRef = await deployed('astrocartography-link', { p: 'venus', a: 'dsc', ref: 'assistant' });
      expect(withRef.statusCode).toBe(200);
      const plain = await deployed('astrocartography-link', {});
      expect(plain.statusCode).toBe(200);
      expect(plain.body.toString('utf8')).toContain('Your astrocartography map');
    });

    it('leaves the pictures as they were: only their own keys, else refused', async () => {
      expect((await deployed('astrocartography-image', { p: 'venus', a: 'dsc', birthDate: '1990-05-03' })).statusCode).toBe(400);
      expect((await deployed('astrocartography-story', { p: 'venus', a: 'dsc', fbclid: 'IwAR0' })).statusCode).toBe(400);
    });

    it('builds the clean query from the share keys alone', () => {
      expect(astrocartographyCleanQuery(new URLSearchParams('a=mc&x=1&p=jupiter'))).toBe('p=jupiter&a=mc');
      expect(astrocartographyCleanQuery(new URLSearchParams('p=jupiter&a=mc&ref=other'))).toBe('');
      expect(astrocartographyCleanQuery(new URLSearchParams(''))).toBe('');
    });
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

  it('prints the map page on the site the share was opened from, so a staging story never sends people to production', () => {
    const staging = 'https://site-git-acg-zodiacsofficial.vercel.app/api/og/astrocartography-story?p=moon&a=ic';
    expect(astrocartographyStoryAddress(staging)).toBe('site-git-acg-zodiacsofficial.vercel.app/astrocartography');
    expect(astrocartographyStoryAddress('https://zodiacs.org/api/og/astrocartography-story?p=moon&a=ic')).toBe('zodiacs.org/astrocartography');
    expect(astrocartographyStoryAddress('https://www.zodiacs.org/api/og/astrocartography-story?p=moon&a=ic')).toBe('zodiacs.org/astrocartography');
    // The deployed entry builds the request from the validated origin (requestOrigin): an unknown host is production's.
    expect(astrocartographyStoryAddress(`${requestOrigin({ headers: { host: 'evil.example' } })}/api/og/astrocartography-story`)).toBe('zodiacs.org/astrocartography');
    expect(astrocartographyStoryAddress(`${requestOrigin({ headers: { host: 'site-git-acg-zodiacsofficial.vercel.app' } })}/api/og/astrocartography-story`)).toBe('site-git-acg-zodiacsofficial.vercel.app/astrocartography');
    const model = astrocartographyCardModel({ planet: 'Moon', angle: 'IC', ref: null });
    const drawn = JSON.stringify(astrocartographyStory(model, new Map(), [], astrocartographyStoryAddress(staging)));
    expect(drawn).toContain('site-git-acg-zodiacsofficial.vercel.app/astrocartography');
    expect(drawn).not.toContain('"zodiacs.org/astrocartography"');
  });

  it('refuses a picture for anything but a share', async () => {
    for (const url of ['https://zodiacs.org/api/og/astrocartography-image?p=jupiter&a=mc&d=1990-05-03', 'https://zodiacs.org/api/og/astrocartography-image?p=jupiter'])
      expect((await handleAstrocartographyImageRequest(new Request(url))).status, url).toBe(400);
  });
});
