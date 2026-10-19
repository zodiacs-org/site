import { readFile } from 'node:fs/promises';
import { h } from 'preact';
import {
  type ChartPreviewModel,
  previewModel,
  previewPlacementsFromToken,
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

function errorResponse(status: number): Response {
  return new Response('Chart preview unavailable.', {
    status,
    headers: { ...PRIVACY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** A positions code in the fragment of the receiver, as the chart links write it. */
const FRAGMENT_CODE = '^#p=2\\.[A-Za-z0-9_-]{1,254}$';

interface PreviewRequest {
  placements: PreviewPlacements;
  /** The code of a link made before the code moved to the fragment. */
  legacyCode: string | null;
}

function previewRequest(request: Request): PreviewRequest | null {
  const params = new URL(request.url).searchParams;
  const keys = [...params.keys()];
  if (keys.length === 1 && keys[0] === 'p') {
    const legacyCode = params.get('p') ?? '';
    const placements = previewPlacementsFromToken(legacyCode);
    return placements ? { placements, legacyCode } : null;
  }
  const placements = parsePreviewQuery(params);
  return placements ? { placements, legacyCode: null } : null;
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
  if (request.method !== 'GET') return errorResponse(405);
  const parsed = previewRequest(request);
  if (!parsed) return errorResponse(400);
  const model = previewModel(parsed.placements);

  const url = new URL(request.url);
  const receiverBase = `${url.origin}/birth-chart/`;
  // A link with a preview keeps the full code in its fragment, which only the
  // browser sees; the script hands it to the receiver. An older link carried
  // the code in the query, and it is handed on the way it always was.
  const receiver = parsed.legacyCode === null
    ? receiverBase
    : `${receiverBase}#p=${encodeURIComponent(parsed.legacyCode)}`;
  const imageUrl = `${url.origin}/api/og/chart-image?${previewQuery(parsed.placements)}`;
  const escapedReceiver = htmlEscape(receiver);
  const escapedImage = htmlEscape(imageUrl);
  const redirectScript = parsed.legacyCode === null
    ? `var h=location.hash;location.replace(${JSON.stringify(receiverBase)}+(new RegExp(${JSON.stringify(FRAGMENT_CODE)}).test(h)?h:''))`
    : `location.replace(${JSON.stringify(receiver)})`;
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
  const parsed = previewRequest(request);
  if (!parsed) return errorResponse(400);
  const model = previewModel(parsed.placements);

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
