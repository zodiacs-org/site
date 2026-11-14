import { readFile } from 'node:fs/promises';
import { h } from 'preact';
import {
  type ChartPreviewModel,
  previewModel,
} from './chart-preview-model.js';
import {
  parsePreviewQuery,
  PREVIEW_QUERY_KEYS,
  type PreviewPlacements,
  previewQuery,
} from '../lib/share-preview.js';
import { lockupImage } from './brand-lockup-image.js';

export const PREVIEW_KICKER = 'Your chart signature';
export const CHART_PREVIEW_ROUTE_KEY = '__zodiacs_og_route';
export type ChartPreviewRoute = 'link' | 'image';

export const PRIVACY_HEADERS = {
  'cache-control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

let previewFonts: Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]> | null = null;

export function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function prepareFonts(): Promise<[ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]> {
  if (previewFonts) return previewFonts;
  const pending = Promise.all([
    readFile(new URL('../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url)),
    readFile(new URL('../../api/og/eb-garamond-latin-500-italic.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url)),
    // The brand lockup's capitals are the regular weight.
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff', import.meta.url)),
  ]).then(([normal, italic, brand, regular]): [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer] => [
    exactArrayBuffer(normal),
    exactArrayBuffer(italic),
    exactArrayBuffer(brand),
    exactArrayBuffer(regular),
  ]);
  previewFonts = pending;
  void pending.catch(() => {
    if (previewFonts === pending) previewFonts = null;
  });
  return pending;
}

export function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

/** The site's default share picture, which a retired link's image request is sent to. */
export const DEFAULT_SHARE_IMAGE_PATH = '/assets/og/v2/share.png';

/**
 * A 303 to a fixed address, for a retired link: the details it carried are
 * read only as far as choosing the answer, and leave the address, the
 * history, the share page's picture links and the device cache.
 */
export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { ...PRIVACY_HEADERS, Location: location } });
}

/**
 * The whole answer to a retired chart link (`/api/og/chart?p=<code>`, made before
 * the code moved to the fragment): a short page that leads to the birth chart
 * page. It holds nothing from the request.
 */
export const RETIRED_CHART_LINK_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark">'
  + '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">'
  + '<title>This chart link no longer opens</title></head><body>'
  + '<h1>This chart link no longer opens</h1>'
  + '<p>Older chart links carried the whole chart in the address, so Zodiacs no longer reads them. '
  + 'Ask the person who sent it for a new link, or <a href="/birth-chart/">make a birth chart</a>.</p>'
  + '</body></html>';

/**
 * A chart link made before the code moved to the fragment carried the full
 * positions code in its query, and the code leads back to the birth date and
 * time. Retired as the transit calendar feed was (api/calendar/transits.ts):
 * 410 Gone, kept by no cache. The code is never decoded, drawn, echoed or
 * passed on.
 */
export function retiredChartLink(): Response {
  return new Response(RETIRED_CHART_LINK_HTML, {
    status: 410,
    headers: {
      ...PRIVACY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    },
  });
}

function errorResponse(status: number): Response {
  return new Response('Chart preview unavailable.', {
    status,
    headers: { ...PRIVACY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** A positions code in the fragment of the receiver, as the chart links write it. */
const FRAGMENT_CODE = '^#p=2\\.[A-Za-z0-9_-]{1,254}$';

/** The whole-degree placements a preview link carries in its query; a positions code (`p`) is never read. */
function previewRequest(request: Request): PreviewPlacements | null {
  const params = new URL(request.url).searchParams;
  if (params.has('p')) return null;
  return parsePreviewQuery(params);
}

function previewCard(model: ChartPreviewModel) {
  return h('div', { style: {
      width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '58px 68px', background: '#060709',
      color: '#EEF1F7', fontFamily: 'sans serif',
    } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: {
          display: 'flex', fontFamily: 'EB Garamond', fontSize: 28,
          fontStyle: 'italic', color: '#8E96AB',
        } }, PREVIEW_KICKER),
      // The brand lockup (DESIGN.md), its ring turned to the chart's Sun sign.
      lockupImage(undefined, undefined, model.ringFront)),
    h('div', { style: { display: 'flex', gap: '30px', width: '100%' } },
      ...model.placements.map((row) => (
        h('div', { key: row.label, style: {
            flex: 1, minHeight: '360px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(198,204,218,.18)',
            borderRadius: '28px', background: 'rgba(198,204,218,.035)',
          } },
          h('div', { style: { display: 'flex', fontSize: 72, color: row.hue } }, row.sign.slice(0, 3)),
          h('div', { style: { display: 'flex', marginTop: '20px', fontSize: 27, color: '#8E96AB' } }, `${row.label} / ${row.degree}`),
          h('div', { style: { display: 'flex', marginTop: '8px', fontSize: 52 } }, row.sign))
      ))),
    h('div', { style: { display: 'flex', fontSize: 24, color: '#8E96AB' } }, `${model.settings} / Positions only`),
  );
}

export async function handleChartLinkRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // A link with the full positions code in its query is retired, whatever else it carries.
  if (url.searchParams.has('p')) return retiredChartLink();
  if (request.method !== 'GET') return errorResponse(405);
  const placements = previewRequest(request);
  if (!placements) return errorResponse(400);
  const model = previewModel(placements);

  // A link with a preview keeps the full code in its fragment, which only the
  // browser sees; the script hands it to the receiver.
  const receiver = `${url.origin}/birth-chart/`;
  const imageUrl = `${url.origin}/api/og/chart-image?${previewQuery(placements)}`;
  const escapedReceiver = htmlEscape(receiver);
  const escapedImage = htmlEscape(imageUrl);
  const redirectScript = `var h=location.hash;location.replace(${JSON.stringify(receiver)}+(new RegExp(${JSON.stringify(FRAGMENT_CODE)}).test(h)?h:''))`;
  const description = model.placements.some((placement) => placement.label === 'Rising')
    ? 'Sun, Moon and Rising positions, to the whole degree.'
    : 'Reference Sun and Moon positions, to the whole degree.';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><meta property="og:title" content="A shared birth chart"><meta property="og:description" content="${description}"><meta property="og:type" content="website"><meta property="og:image" content="${escapedImage}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escapedImage}"><title>A shared birth chart</title></head><body><p><a href="${escapedReceiver}">Open the shared chart</a></p><script nonce="chart-preview">${redirectScript}</script><noscript><meta http-equiv="refresh" content="0;url=${escapedReceiver}"></noscript></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...PRIVACY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; script-src 'nonce-chart-preview'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    },
  });
}

export async function handleChartImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  // An image asked for by an older link's full positions code is not drawn: the code leads back to the birth date
  // and time. The request is sent to the site's default share picture instead.
  const url = new URL(request.url);
  if (url.searchParams.has('p')) return seeOther(`${url.origin}${DEFAULT_SHARE_IMAGE_PATH}`);
  const placements = previewRequest(request);
  if (!placements) return errorResponse(400);
  const model = previewModel(placements);

  try {
    const { ImageResponse } = await import('@vercel/og');
    const [normalFont, italicFont, brandFont, regularFont] = await prepareFonts();
    const rendered = new ImageResponse(previewCard(model), {
      width: 1200,
      height: 630,
      headers: PRIVACY_HEADERS,
      fonts: [
        { name: 'sans serif', data: normalFont, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: italicFont, weight: 500, style: 'italic' },
        { name: 'EB Garamond', data: brandFont, weight: 500, style: 'normal' },
        { name: 'EB Garamond', data: regularFont, weight: 400, style: 'normal' },
      ],
    });
    // Buffer the renderer stream so failures never commit a partial 200 to a crawler.
    const png = await rendered.arrayBuffer();
    return new Response(png, {
      headers: { ...PRIVACY_HEADERS, 'Content-Type': 'image/png' },
    });
  } catch {
    return errorResponse(503);
  }
}

function firstHeader(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

export function requestOrigin(req: any): string {
  const forwarded = firstHeader(req.headers?.['x-forwarded-host']).split(',')[0]?.trim();
  const host = forwarded || firstHeader(req.headers?.host).trim();
  const trusted = /^(?:zodiacs\.org|www\.zodiacs\.org|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app|localhost(?::\d{1,5})?)$/iu.test(host)
    ? host
    : 'zodiacs.org';
  return `${trusted.startsWith('localhost') ? 'http' : 'https'}://${trusted}`;
}

function strictNodeQuery(req: any, route: ChartPreviewRoute): URLSearchParams | null {
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  if (query[CHART_PREVIEW_ROUTE_KEY] !== route) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === CHART_PREVIEW_ROUTE_KEY) continue;
    if ((key !== 'p' && !PREVIEW_QUERY_KEYS.includes(key)) || typeof value !== 'string') return null;
    params.set(key, value);
  }
  return params;
}

export async function writeNodeResponse(res: any, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function handleChartPreviewNodeRequest(
  req: any,
  res: any,
  route: ChartPreviewRoute,
): Promise<void> {
  // An older link's positions code is answered before the query is checked, so a repeated code or a key added by
  // an app gets the same answer rather than a refusal: the link is gone (410), and an image asked for with one goes to
  // the default share picture.
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  const method = typeof req.method === 'string' ? req.method : 'GET';
  if (route === 'link' && Object.hasOwn(query, 'p')) {
    await writeNodeResponse(res, retiredChartLink());
    return;
  }
  if (route === 'image' && method === 'GET' && Object.hasOwn(query, 'p')) {
    await writeNodeResponse(res, seeOther(`${requestOrigin(req)}${DEFAULT_SHARE_IMAGE_PATH}`));
    return;
  }
  const params = strictNodeQuery(req, route);
  if (params === null) {
    await writeNodeResponse(res, errorResponse(400));
    return;
  }
  const path = route === 'link' ? '/api/og/chart' : '/api/og/chart-image';
  const request = new Request(
    `${requestOrigin(req)}${path}?${params.toString()}`,
    { method: typeof req.method === 'string' ? req.method : 'GET' },
  );
  const response = route === 'link'
    ? await handleChartLinkRequest(request)
    : await handleChartImageRequest(request);
  await writeNodeResponse(res, response);
}
