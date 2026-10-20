import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { h } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { encodePositionsLink, POSITION_BODY_ORDER } from '../../src/lib/share-positions';

const imageResponseMock = vi.hoisted(() => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer);
  view.setUint32(16, 1200);
  view.setUint32(20, 630);
  return {
    element: vi.fn(),
    options: vi.fn(),
    renderFailure: null as Error | null,
    png,
  };
});

vi.mock('@vercel/og', () => ({
  ImageResponse: class extends Response {
    constructor(element: unknown, options: {
      width: number;
      height: number;
      headers?: HeadersInit;
      fonts?: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>;
    }) {
      imageResponseMock.element(element);
      imageResponseMock.options(options);
      super(imageResponseMock.png, {
        headers: { ...options.headers, 'Content-Type': 'image/png' },
      });
    }

    override async arrayBuffer(): Promise<ArrayBuffer> {
      if (imageResponseMock.renderFailure) {
        const failure = imageResponseMock.renderFailure;
        imageResponseMock.renderFailure = null;
        throw failure;
      }
      return super.arrayBuffer();
    }
  },
}));

const {
  CHART_PREVIEW_ROUTE_KEY,
  handleChartLinkRequest: linkHandler,
  handleChartImageRequest: imageHandler,
  handleChartPreviewNodeRequest,
  PREVIEW_KICKER,
} = await import('../../src/server/chart-preview');
const { previewModel, previewPlacementsFromToken } = await import('../../src/server/chart-preview-model');
const { default: compatibilityHandler } = await import('../../api/compatibility');

const token = encodePositionsLink({
  bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 29.999 })),
  angles: { asc: 359.999, mc: 270 },
  houseSystem: 'whole',
  engineVersion: '1.2.3',
})!;
const noAnglesToken = encodePositionsLink({
  bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 29.999 })),
  angles: null,
  houseSystem: 'whole',
  engineVersion: '1.2.3',
})!;
// The same chart as `token`, as the query of a link with a preview carries it.
const PREVIEW_QUERY = 'sun=0&moon=29&rising=359&houses=whole';
const PREVIEW_IMAGE = '/api/og/chart-image?sun=0&amp;moon=29&amp;rising=359&amp;houses=whole';

function redirectTarget(html: string, hash: string): string {
  const script = /<script nonce="chart-preview">([^<]*)<\/script>/u.exec(html)?.[1] ?? '';
  let target = '';
  new Function('location', script)({ hash, replace: (url: string) => { target = url; } });
  return target;
}

describe('chart preview functions', () => {
  it('builds a bounded whole-degree model that keeps the sign at its edge', () => {
    const placements = previewPlacementsFromToken(token);
    expect(placements).toEqual({ sun: 0, moon: 29, rising: 359, houses: 'whole' });
    const model = previewModel(placements!);
    expect(model.placements.map(({ label }) => label)).toEqual(['Sun', 'Moon', 'Rising']);
    // ASC 359.999° is Pisces 29, not a rounded-up Aries 0.
    expect(model.placements[2]).toMatchObject({ sign: 'Pisces', degree: '29 deg' });
    expect(model.placements[1]).toMatchObject({ sign: 'Aries', degree: '29 deg' });
    expect(model.settings).toBe('Whole sign / Tropical');
    expect(JSON.stringify(model)).not.toMatch(/[^\x20-\x7e]/);
    expect(JSON.stringify(model)).not.toMatch(/\b(?:birth|date|time|place|coordinates?|min)\b/i);
  });

  it('turns the lockup ring to the Sun sign, and only states one a link without a birth time settles', () => {
    expect(previewModel({ sun: 0, moon: 29, rising: 359, houses: 'whole' }).ringFront).toBe('aries');
    expect(previewModel({ sun: 135, moon: 29, rising: null, houses: null }).ringFront).toBe('leo');
    expect(previewModel({ sun: 120, moon: 29, rising: null, houses: null }).ringFront).toBeNull();
    expect(previewModel({ sun: 148, moon: 29, rising: null, houses: null }).ringFront).toBeNull();
  });

  it('labels an angle-free token as reference positions without a clock claim without claiming Rising or houses', async () => {
    const model = previewModel(previewPlacementsFromToken(noAnglesToken)!);
    expect(model?.placements.map(({ label }) => label)).toEqual(['Sun', 'Moon']);
    expect(model?.settings).toBe('Reference positions / No houses / Tropical');

    const response = await linkHandler(new Request(
      `https://zodiacs.org/api/og/chart?p=${encodeURIComponent(noAnglesToken)}`,
    ));
    const html = await response.text();
    expect(html).toContain('Reference Sun and Moon positions');
    expect(html).not.toMatch(/12:00|noon|midday/i);
    expect(html).not.toContain('Sun, Moon and Rising positions');
  });

  it('returns a no-store noindex HTML wrapper that redirects to the fragment receiver', async () => {
    const response = await linkHandler(new Request(`https://zodiacs.org/api/og/chart?${PREVIEW_QUERY}`));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).toContain('property="og:image"');
    expect(html).toContain(PREVIEW_IMAGE);
    expect(html).toContain('Sun, Moon and Rising positions, to the whole degree.');
    expect(html).not.toMatch(/registry|astrofolio|terminal|wallet|birth date:\s*\d/i);
  });

  it('keeps the full code in the fragment and sends the preview only whole-degree Sun, Moon and Rising', async () => {
    const html = await (await linkHandler(new Request(`https://zodiacs.org/api/og/chart?${PREVIEW_QUERY}`))).text();
    expect(html).not.toContain(token);
    expect(html).not.toMatch(/#p=2\.[A-Za-z0-9_-]/u);
    // The page script reads the code from the fragment, which only the browser sees.
    expect(redirectTarget(html, `#p=${token}`)).toBe(`https://zodiacs.org/birth-chart/#p=${token}`);
    for (const hash of ['', '#p=', '#p=2.', '#p=javascript:alert(1)', `#p=${token}&c=1.x`, `#c=${token}`]) {
      expect(redirectTarget(html, hash)).toBe('https://zodiacs.org/birth-chart/');
    }
  });

  it('still opens a link made when the code was in the query, without echoing it any further', async () => {
    const response = await linkHandler(new Request(`https://zodiacs.org/api/og/chart?p=${encodeURIComponent(token)}`));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(PREVIEW_IMAGE);
    expect(html).not.toContain('chart-image?p=');
    expect(html.split(token).length - 1).toBe(3);
    expect(redirectTarget(html, '')).toBe(`https://zodiacs.org/birth-chart/#p=${token}`);
  });

  it('rejects non-GET, missing, duplicate, invalid, and extra parameters generically', async () => {
    const urls = [
      'https://zodiacs.org/api/og/chart',
      `https://zodiacs.org/api/og/chart?p=${token}&p=${token}`,
      'https://zodiacs.org/api/og/chart?p=bad',
      `https://zodiacs.org/api/og/chart?p=${token}&free=text`,
      `https://zodiacs.org/api/og/chart?p=${token}&image=1`,
      `https://zodiacs.org/api/og/chart?${PREVIEW_QUERY}&p=${token}`,
      'https://zodiacs.org/api/og/chart?sun=0',
      'https://zodiacs.org/api/og/chart?sun=0&moon=29&rising=359',
      'https://zodiacs.org/api/og/chart?sun=0&moon=29&houses=whole',
      'https://zodiacs.org/api/og/chart?sun=0&moon=29&sun=1',
      'https://zodiacs.org/api/og/chart?sun=360&moon=29',
      'https://zodiacs.org/api/og/chart?sun=01&moon=29',
      'https://zodiacs.org/api/og/chart?sun=1.5&moon=29',
      'https://zodiacs.org/api/og/chart?sun=0&moon=29&rising=359&houses=equal',
      `https://zodiacs.org/api/og/chart?${PREVIEW_QUERY}&free=text`,
    ];
    for (const url of urls) {
      const response = await linkHandler(new Request(url));
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Chart preview unavailable.');
    }
    expect((await linkHandler(new Request(
      `https://zodiacs.org/api/og/chart?p=${token}`,
      { method: 'POST' },
    ))).status).toBe(405);
  });

  it('keeps the image renderer on a narrow positions-only request surface', async () => {
    for (const request of [
      new Request('https://zodiacs.org/api/og/chart-image'),
      new Request(`https://zodiacs.org/api/og/chart-image?p=${token}&p=${token}`),
      new Request(`https://zodiacs.org/api/og/chart-image?p=${token}&free=text`),
      new Request(`https://zodiacs.org/api/og/chart-image?p=${token}`, { method: 'POST' }),
      new Request(`https://zodiacs.org/api/og/chart-image?${PREVIEW_QUERY}&free=text`),
      new Request('https://zodiacs.org/api/og/chart-image?sun=0&moon=29&rising=359'),
      new Request(`https://zodiacs.org/api/og/chart-image?${PREVIEW_QUERY}`, { method: 'POST' }),
    ]) {
      const response = await imageHandler(request);
      expect([400, 405]).toContain(response.status);
      expect(await response.text()).toBe('Chart preview unavailable.');
    }
  });

  it('emits a 1200×630 PNG response without cache or indexing', async () => {
    imageResponseMock.element.mockClear();
    imageResponseMock.options.mockClear();
    const response = await imageHandler(new Request(`https://zodiacs.org/api/og/chart-image?p=${token}`));
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(new DataView(bytes.buffer).getUint32(16)).toBe(1200);
    expect(new DataView(bytes.buffer).getUint32(20)).toBe(630);
    expect(imageResponseMock.options).toHaveBeenCalledOnce();
    expect(imageResponseMock.options).toHaveBeenCalledWith(expect.objectContaining({
      width: 1200,
      height: 630,
      fonts: [
        expect.objectContaining({ name: 'sans serif', weight: 400, style: 'normal' }),
        expect.objectContaining({ name: 'EB Garamond', weight: 500, style: 'italic' }),
        expect.objectContaining({ name: 'EB Garamond', weight: 500, style: 'normal' }),
        // The brand lockup's capitals.
        expect.objectContaining({ name: 'EB Garamond', weight: 400, style: 'normal' }),
      ],
    }));
    const serializedCard = JSON.stringify(imageResponseMock.element.mock.calls[0]?.[0]);
    expect(serializedCard).toContain('Rising / 29 deg');
    expect(serializedCard).not.toContain(' min');
    expect(serializedCard).toContain('Your chart signature');
    expect(serializedCard).toContain('"fontFamily":"EB Garamond"');
    expect(serializedCard).toContain('"fontStyle":"italic"');
    // The brand lockup (DESIGN.md): the tilted ring's twelve dots and ZODIACS · ORG, with no profile image.
    expect(serializedCard).toContain('"viewBox":"-2 4 28 16"');
    expect(serializedCard.match(/"type":"circle"/gu)).toHaveLength(12);
    for (const word of ['"ZODIACS"', '"·"', '"ORG"']) expect(serializedCard).toContain(word);
    expect(serializedCard).not.toContain('data:image/png;base64,');
    expect(serializedCard).not.toContain('"zodiacs.org"');
  });

  it('draws the same whole-degree image from the preview query', async () => {
    imageResponseMock.element.mockClear();
    const response = await imageHandler(new Request(`https://zodiacs.org/api/og/chart-image?${PREVIEW_QUERY}`));
    expect(response.status).toBe(200);
    const serializedCard = JSON.stringify(imageResponseMock.element.mock.calls[0]?.[0]);
    for (const text of ['Sun / 0 deg', 'Moon / 29 deg', 'Rising / 29 deg', 'Pisces', 'Whole sign / Tropical']) {
      expect(serializedCard).toContain(text);
    }
  });

  it('writes the buffered image through the Vercel Node response contract', async () => {
    const headers = new Map<string, string>();
    const end = vi.fn();
    const response = {
      statusCode: 0,
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
      end,
    };
    await handleChartPreviewNodeRequest({
      method: 'GET',
      url: `/api/og/chart-image?p=${encodeURIComponent(token)}`,
      headers: { host: 'zodiacs.org' },
      query: { [CHART_PREVIEW_ROUTE_KEY]: 'image', p: token },
    }, response, 'image');

    expect(response.statusCode).toBe(200);
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(end).toHaveBeenCalledOnce();
    expect(Array.from((end.mock.calls[0]?.[0] as Buffer).subarray(0, 8))).toEqual(
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
  });

  it('writes the metadata wrapper through the consolidated Node route', async () => {
    const headers = new Map<string, string>();
    const end = vi.fn();
    const response = {
      statusCode: 0,
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
      end,
    };
    await compatibilityHandler({
      method: 'GET',
      headers: { 'x-forwarded-host': 'zodiacs-preview.vercel.app' },
      query: { [CHART_PREVIEW_ROUTE_KEY]: 'link', p: token },
    }, response);

    expect(response.statusCode).toBe(200);
    expect(headers.get('content-type')).toContain('text/html');
    expect(headers.get('cache-control')).toBe('no-store, max-age=0');
    const html = Buffer.from(end.mock.calls[0]?.[0] as Buffer).toString('utf8');
    expect(html).toContain(`https://zodiacs-preview.vercel.app${PREVIEW_IMAGE}`);
    expect(html).toContain('https://zodiacs-preview.vercel.app/birth-chart/#p=');

    const current = vi.fn();
    await compatibilityHandler({
      method: 'GET',
      headers: { 'x-forwarded-host': 'zodiacs-preview.vercel.app' },
      query: { [CHART_PREVIEW_ROUTE_KEY]: 'link', sun: '0', moon: '29', rising: '359', houses: 'whole' },
    }, { statusCode: 0, setHeader: vi.fn(), end: current });
    const currentHtml = Buffer.from(current.mock.calls[0]?.[0] as Buffer).toString('utf8');
    expect(currentHtml).toContain(`https://zodiacs-preview.vercel.app${PREVIEW_IMAGE}`);
    expect(redirectTarget(currentHtml, `#p=${token}`))
      .toBe(`https://zodiacs-preview.vercel.app/birth-chart/#p=${token}`);
  });

  it('rejects extra or duplicate values before the consolidated route renders', async () => {
    for (const query of [
      { [CHART_PREVIEW_ROUTE_KEY]: 'link', p: token, extra: 'value' },
      { [CHART_PREVIEW_ROUTE_KEY]: ['link', 'link'], p: token },
      { [CHART_PREVIEW_ROUTE_KEY]: 'link', p: [token, token] },
      { [CHART_PREVIEW_ROUTE_KEY]: 'link', sun: ['0', '1'], moon: '29' },
      { [CHART_PREVIEW_ROUTE_KEY]: 'link', sun: '0', moon: '29', extra: 'value' },
      { [CHART_PREVIEW_ROUTE_KEY]: 'link', sun: '0', moon: '29', p: token },
      { [CHART_PREVIEW_ROUTE_KEY]: 'image', sun: '0', moon: '29' },
    ]) {
      const end = vi.fn();
      const response = { statusCode: 0, setHeader: vi.fn(), end };
      await handleChartPreviewNodeRequest(
        { method: 'GET', headers: { host: 'zodiacs.org' }, query },
        response,
        'link',
      );
      expect(response.statusCode).toBe(400);
      expect(Buffer.from(end.mock.calls[0]?.[0] as Buffer).toString('utf8')).toBe(
        'Chart preview unavailable.',
      );
    }
  });

  it('returns a generic 503 before committing a streaming renderer failure', async () => {
    imageResponseMock.renderFailure = new Error('render failed');
    const response = await imageHandler(new Request(`https://zodiacs.org/api/og/chart-image?p=${token}`));

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(await response.text()).toBe('Chart preview unavailable.');
  });

  it('renders the bounded EB Garamond kicker subset as a real PNG', async () => {
    const font = readFileSync(new URL('../../api/og/eb-garamond-latin-500-italic.woff', import.meta.url));
    expect(font.subarray(0, 4).toString('ascii')).toBe('wOFF');
    expect(font.byteLength).toBeLessThan(8_000);
    expect(createHash('sha256').update(font).digest('hex')).toBe(
      'ed04e3bc22e73224bf11cafb26c73fbc20207179a2ed6529f12aa67b2955d0e0',
    );
    expect(PREVIEW_KICKER).toBe('Your chart signature');

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('The renderer must not fetch assets.');
    }));
    try {
      const { ImageResponse: RealImageResponse } = await vi.importActual<typeof import('@vercel/og')>('@vercel/og');
      const response = new RealImageResponse(
        h('div', {
          style: {
            display: 'flex',
            width: '320px',
            height: '180px',
            fontFamily: 'EB Garamond',
            fontStyle: 'italic',
          },
        }, PREVIEW_KICKER),
        {
          width: 320,
          height: 180,
          fonts: [{ name: 'EB Garamond', data: font, weight: 500, style: 'italic' }],
        },
      );
      const png = Buffer.from(await response.arrayBuffer());
      expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.readUInt32BE(16)).toBe(320);
      expect(png.readUInt32BE(20)).toBe(180);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });
});
