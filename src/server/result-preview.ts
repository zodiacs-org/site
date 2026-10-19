/**
 * Share links for a compatibility score and a date's rating: a page with the
 * result card and a way to try it, and the 1200×630 preview image link
 * previews show. Both read only the link's checked query string
 * (src/lib/share-results.ts); nothing is looked up, stored or logged, and
 * every response is uncacheable and kept out of search.
 */
import { readFile } from 'node:fs/promises';
import { h, type VNode } from 'preact';
import {
  exactArrayBuffer,
  htmlEscape,
  PRIVACY_HEADERS,
  requestOrigin,
  writeNodeResponse,
} from './chart-preview.js';
import {
  compatibilityCardModel,
  type CompatibilityCardModel,
  occasionCardModel,
  type OccasionCardModel,
  type PreviewSign,
} from './result-preview-model.js';
import { lockupImage } from './brand-lockup-image.js';
import { tiltedRingSvg } from '../lib/brand-lockup.mjs';
import {
  COMPATIBILITY_SHARE_IMAGE_PATH,
  COMPATIBILITY_SHARE_KEYS,
  COMPATIBILITY_SHARE_PATH,
  compatibilityQuery,
  OCCASION_SHARE_IMAGE_PATH,
  OCCASION_SHARE_KEYS,
  OCCASION_SHARE_PATH,
  occasionQuery,
  parseCompatibilityShare,
  parseOccasionShare,
  type ShareRef,
  type ShareSign,
} from '../lib/share-results.js';

export const RESULT_SHARE_ROUTE_KEY = '__zodiacs_share';
export const RESULT_SHARE_ROUTES = ['compatibility-link', 'compatibility-image', 'occasion-link', 'occasion-image'] as const;
export type ResultShareRoute = typeof RESULT_SHARE_ROUTES[number];

const VOID = '#060709';
const INK = '#EEF1F7';
const MUTED = '#8E96AB';
const HAIRLINE = 'rgba(198,204,218,0.16)';
const TRACK = 'rgba(198,204,218,0.12)';

// ── Assets ───────────────────────────────────────────────────────────

type FontSet = [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer];
let fonts: Promise<FontSet> | null = null;

function prepareFonts(): Promise<FontSet> {
  if (fonts) return fonts;
  const pending = Promise.all([
    readFile(new URL('../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-italic.woff', import.meta.url)),
    // The brand lockup's capitals are the regular weight.
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff', import.meta.url)),
  ]).then((files) => files.map((bytes) => exactArrayBuffer(bytes)) as FontSet);
  fonts = pending;
  void pending.catch(() => { if (fonts === pending) fonts = null; });
  return pending;
}

// One literal address per sign, so the deployment's file tracing packs all twelve discs.
const DISC_FILES: Readonly<Record<ShareSign, URL>> = {
  aries: new URL('../../public/assets/sdk/zodiac-icons/circle/aries.png', import.meta.url),
  taurus: new URL('../../public/assets/sdk/zodiac-icons/circle/taurus.png', import.meta.url),
  gemini: new URL('../../public/assets/sdk/zodiac-icons/circle/gemini.png', import.meta.url),
  cancer: new URL('../../public/assets/sdk/zodiac-icons/circle/cancer.png', import.meta.url),
  leo: new URL('../../public/assets/sdk/zodiac-icons/circle/leo.png', import.meta.url),
  virgo: new URL('../../public/assets/sdk/zodiac-icons/circle/virgo.png', import.meta.url),
  libra: new URL('../../public/assets/sdk/zodiac-icons/circle/libra.png', import.meta.url),
  scorpio: new URL('../../public/assets/sdk/zodiac-icons/circle/scorpio.png', import.meta.url),
  sagittarius: new URL('../../public/assets/sdk/zodiac-icons/circle/sagittarius.png', import.meta.url),
  capricorn: new URL('../../public/assets/sdk/zodiac-icons/circle/capricorn.png', import.meta.url),
  aquarius: new URL('../../public/assets/sdk/zodiac-icons/circle/aquarius.png', import.meta.url),
  pisces: new URL('../../public/assets/sdk/zodiac-icons/circle/pisces.png', import.meta.url),
};
const discs = new Map<ShareSign, Promise<string>>();

function disc(slug: ShareSign): Promise<string> {
  const known = discs.get(slug);
  if (known) return known;
  const pending = readFile(DISC_FILES[slug]).then((bytes) => `data:image/png;base64,${bytes.toString('base64')}`);
  discs.set(slug, pending);
  void pending.catch(() => { if (discs.get(slug) === pending) discs.delete(slug); });
  return pending;
}

async function discImages(signs: readonly PreviewSign[]): Promise<Map<ShareSign, string>> {
  const slugs = [...new Set(signs.map((sign) => sign.slug).filter((slug): slug is ShareSign => slug !== null))];
  return new Map(await Promise.all(slugs.map(async (slug) => [slug, await disc(slug)] as const)));
}

// ── Cards ────────────────────────────────────────────────────────────

const SERIF = 'EB Garamond, EB Garamond Ext';

function kicker(text: string) {
  return h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontSize: 34, color: MUTED } }, text);
}

/**
 * The brand lockup (DESIGN.md, "Brand Lockup"): the tilted ring and ZODIACS ·
 * ORG, top right, the ring turned to `front` on a card made for one person.
 */
function brand(front: ShareSign | null = null) {
  return h('div', { style: { display: 'flex', alignSelf: 'flex-end' } }, lockupImage(undefined, undefined, front));
}

const RING = 384;

/** The score inside a ring drawn from one sign's hue to the other's. */
function ring(score: number, hues: [string, string]) {
  const stroke = 20;
  const radius = (RING - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = Math.max(0.001, (score / 100) * circumference);
  const centre = RING / 2;
  return h('div', { style: { display: 'flex', position: 'relative', width: `${RING}px`, height: `${RING}px`, alignItems: 'center', justifyContent: 'center' } },
    h('svg', { width: RING, height: RING, viewBox: `0 0 ${RING} ${RING}`, style: { position: 'absolute', top: 0, left: 0 } },
      h('defs', null,
        h('linearGradient', { id: 'arc', x1: '1', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0', 'stop-color': hues[0] }),
          h('stop', { offset: '1', 'stop-color': hues[1] }))),
      h('circle', { cx: centre, cy: centre, r: radius, fill: 'none', stroke: TRACK, 'stroke-width': stroke }),
      h('circle', {
        cx: centre, cy: centre, r: radius, fill: 'none', stroke: 'url(#arc)', 'stroke-width': stroke,
        'stroke-linecap': 'round', 'stroke-dasharray': `${arc.toFixed(2)} ${circumference.toFixed(2)}`,
        transform: `rotate(-90 ${centre} ${centre})`,
      })),
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-6px' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 168, lineHeight: 1, color: INK, letterSpacing: '-3px' } }, String(score)),
      h('div', { style: { display: 'flex', fontFamily: 'Noto', fontSize: 28, color: MUTED, marginTop: '4px', letterSpacing: '1px' } }, 'out of 100')));
}

function signChip(sign: PreviewSign, images: Map<ShareSign, string>, size: number) {
  const src = sign.slug ? images.get(sign.slug) : undefined;
  return h('div', { style: { display: 'flex', alignItems: 'center', marginRight: '34px' } },
    src
      ? h('img', { src, width: size, height: size, style: { width: `${size}px`, height: `${size}px` } })
      : h('div', { style: { display: 'flex', width: `${size}px`, height: `${size}px`, borderRadius: `${size}px`, border: `2px solid ${HAIRLINE}` } }),
    h('div', { style: { display: 'flex', fontFamily: 'Noto', fontSize: 30, color: INK, marginLeft: '14px' } }, sign.label));
}

/** One area of a compatibility score: its name, its number and a bar. */
function areaMeter(area: { label: string; value: number }, index: number) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '196px', marginLeft: index === 0 ? '0px' : '28px' } },
    h('div', { style: { display: 'flex', fontSize: 23, color: MUTED } }, area.label),
    h('div', { style: { display: 'flex', alignItems: 'center', marginTop: '2px' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 44, lineHeight: 1.1, color: INK, width: '58px', flexShrink: 0 } }, String(area.value)),
      h('div', { style: { display: 'flex', width: '132px', height: '5px', borderRadius: '5px', background: TRACK, marginLeft: '6px' } },
        h('div', { style: { display: 'flex', width: `${Math.round(1.32 * area.value)}px`, height: '5px', borderRadius: '5px', background: 'rgba(238,241,247,0.82)' } }))));
}

/** A display size that keeps the longest line inside the column. */
function fit(lines: string[], width: number, max: number, min: number): number {
  const longest = Math.max(...lines.map((line) => line.length));
  return Math.max(min, Math.min(max, Math.floor(width / (longest * 0.52))));
}

const LEFT_WIDTH = 660;

function frame(left: VNode<any>, score: number, hues: [string, string], front: ShareSign | null = null) {
  return h('div', { style: {
      width: '1200px', height: '630px', display: 'flex', justifyContent: 'space-between',
      padding: '54px 64px 56px', background: VOID, color: INK, fontFamily: 'Noto',
    } },
    left,
    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', height: '100%' } },
      brand(front),
      ring(score, hues)));
}

const column = (...children: VNode<any>[]) => h('div', { style: {
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: `${LEFT_WIDTH}px`, height: '100%',
} }, ...children);

export function compatibilityCard(model: CompatibilityCardModel, images: Map<ShareSign, string>) {
  const lines = [model.first, `& ${model.second}`];
  const nameSize = fit(lines, LEFT_WIDTH, 92, 48);
  return frame(column(
    kicker('Compatibility'),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      ...lines.map((line) => h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: nameSize, lineHeight: 1.02, color: INK } }, line)),
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: fit([model.verdict], LEFT_WIDTH, 46, 34), color: INK, marginTop: '18px' } }, model.verdict),
      h('div', { style: { display: 'flex', marginTop: '22px' } }, ...model.people.map((person) => signChip(person, images, 54)))),
    h('div', { style: { display: 'flex' } }, ...model.areas.map((area, index) => areaMeter(area, index))),
  // The ring brings the first person's Sun sign forward, when the link settles it.
  ), model.score, model.ring, model.people[0].slug);
}

export function occasionCard(model: OccasionCardModel, images: Map<ShareSign, string>) {
  const headSize = fit([model.headline], LEFT_WIDTH, 100, 64);
  return frame(column(
    kicker(model.names ?? 'The sky on the day'),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: headSize, lineHeight: 1.02, color: INK } }, model.headline),
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 34, lineHeight: 1.25, color: MUTED, marginTop: '16px' } }, model.when),
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: fit([model.verdict], LEFT_WIDTH, 46, 34), color: INK, marginTop: '26px' } }, model.verdict)),
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      ...(model.signs.length > 0
        ? model.signs.map((sign) => signChip(sign, images, 54))
        : [h('div', { style: { display: 'flex', fontSize: 28, color: MUTED } }, 'Rated from the sky that day')])),
  ), model.score, model.ring);
}

// ── Responses ────────────────────────────────────────────────────────

function errorResponse(status: number): Response {
  return new Response('Preview unavailable.', {
    status,
    headers: { ...PRIVACY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function renderPng(element: VNode<any>): Promise<Response> {
  try {
    const { ImageResponse } = await import('@vercel/og');
    const [noto, serif, serifExt, italic, serifRegular] = await prepareFonts();
    const rendered = new ImageResponse(element, {
      width: 1200,
      height: 630,
      headers: PRIVACY_HEADERS,
      fonts: [
        { name: 'Noto', data: noto, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: serif, weight: 500, style: 'normal' },
        { name: 'EB Garamond', data: serifRegular, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: italic, weight: 500, style: 'italic' },
        { name: 'EB Garamond Ext', data: serifExt, weight: 500, style: 'normal' },
      ],
    });
    // Buffer the renderer stream so a failure never commits a partial 200 to a crawler.
    const png = await rendered.arrayBuffer();
    return new Response(png, { headers: { ...PRIVACY_HEADERS, 'Content-Type': 'image/png' } });
  } catch {
    return errorResponse(503);
  }
}

export async function handleCompatibilityImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseCompatibilityShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = compatibilityCardModel(share);
  const images = await discImages(model.people).catch(() => null);
  if (!images) return errorResponse(503);
  return renderPng(compatibilityCard(model, images));
}

export async function handleOccasionImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseOccasionShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = occasionCardModel(share);
  const images = await discImages(model.signs).catch(() => null);
  if (!images) return errorResponse(503);
  return renderPng(occasionCard(model, images));
}

// ── The page a share link opens ──────────────────────────────────────

const PAGE_STYLE = `@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Instrument Sans";src:url(/fonts/instrument-sans-latin-wght-normal.woff2) format("woff2");font-weight:400 700;font-display:swap}
:root{color-scheme:dark;--void:${VOID};--ink:${INK};--ink-2:#C6CCDA;--muted:${MUTED};--hairline:${HAIRLINE}}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--ink);font:400 17px/1.55 "Instrument Sans",system-ui,sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 16px 56px}
.brand{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--ink);text-decoration:none;white-space:nowrap;direction:ltr}
.brand svg{flex:none;overflow:visible}
.brand-name{font:400 13px/1 "EB Garamond",Georgia,serif;letter-spacing:.2em;text-transform:uppercase}
.brand-sep{margin:0 .2em;color:var(--muted)}
.brand-tld{font-weight:500;color:var(--ink-2)}
h1{font:500 clamp(30px,6vw,46px)/1.1 "EB Garamond",Georgia,serif;margin:28px 0 18px;letter-spacing:-.01em}
.card{display:block;width:100%;height:auto;aspect-ratio:1200/630;border:1px solid var(--hairline);border-radius:18px;background:var(--void)}
.lede{margin:22px 0 0;color:var(--ink);max-width:62ch}
.cta{display:inline-block;margin:26px 0 0;padding:14px 26px;border-radius:999px;background:var(--ink);color:var(--void);font-weight:600;text-decoration:none}
.cta:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.note{margin:22px 0 0;color:var(--muted);font-size:15px}`;

const STYLE_NONCE = 'share-preview';

export interface SharePage {
  title: string;
  description: string;
  heading: string;
  imageUrl: string;
  imageAlt: string;
  explanation: string;
  action: { label: string; href: string };
  note: string;
}

export function sharePageHtml(page: SharePage): string {
  const e = htmlEscape;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${e(page.title)}</title><meta name="description" content="${e(page.description)}"><meta property="og:site_name" content="Zodiacs"><meta property="og:title" content="${e(page.title)}"><meta property="og:description" content="${e(page.description)}"><meta property="og:type" content="website"><meta property="og:image" content="${e(page.imageUrl)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(page.imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(page.title)}"><meta name="twitter:description" content="${e(page.description)}"><meta name="twitter:image" content="${e(page.imageUrl)}"><meta name="twitter:image:alt" content="${e(page.imageAlt)}"><link rel="icon" href="/assets/app-icons/v3/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site-footer.css?v=20261006"><style nonce="${STYLE_NONCE}">${PAGE_STYLE}</style></head><body><main><a class="brand" href="/" aria-label="Zodiacs.org">${tiltedRingSvg({ width: 34 })}<span class="brand-name" aria-hidden="true">Zodiacs<span class="brand-sep">·</span><span class="brand-tld">org</span></span></a><h1>${e(page.heading)}</h1><img class="card" src="${e(page.imageUrl)}" width="1200" height="630" alt="${e(page.imageAlt)}"><p class="lede">${e(page.explanation)}</p><a class="cta" href="${e(page.action.href)}">${e(page.action.label)}</a><p class="note">${e(page.note)}</p></main><footer class="zfooter zfooter--compact"><span>Zodiacs.org</span><nav aria-label="Zodiacs"><a href="/">Astrology</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></footer></body></html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      ...PRIVACY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; img-src 'self'; style-src 'self' 'nonce-${STYLE_NONCE}'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    },
  });
}

const withRef = (path: string, ref: ShareRef | null) => (ref ? `${path}?ref=${ref}` : path);

export const SHARE_NOTE = 'Astrology’s reading, for insight and fun, not a guarantee of how things will turn out.';

/** A link whose query is not a share query opens the plain page, with the site's own card. */
function defaultCompatibilityPage(origin: string): SharePage {
  return {
    title: 'Compatibility on Zodiacs',
    description: 'Compare two birth charts: the contacts between them and how the signs get along.',
    heading: 'Compare two birth charts',
    imageUrl: `${origin}/assets/og/v2/tool/compatibility.png`,
    imageAlt: 'Compatibility on Zodiacs',
    explanation: 'Zodiacs compares two birth charts: the closest contacts between them and how the two Sun signs get along.',
    action: { label: 'Check your own compatibility', href: '/compatibility/' },
    note: SHARE_NOTE,
  };
}

function defaultOccasionPage(origin: string): SharePage {
  return {
    title: 'Occasion cards on Zodiacs',
    description: 'The sky on a day that matters: the Sun and Moon signs, the Moon’s phase and the evening sky.',
    heading: 'The sky on a day that matters',
    imageUrl: `${origin}/assets/og/v2/share.png`,
    imageAlt: 'Zodiacs',
    explanation: 'Zodiacs works out the sky on a wedding, a birthday or another day that matters: the Sun and Moon signs, the Moon’s phase and the evening sky.',
    action: { label: 'Rate your own date', href: '/occasions/' },
    note: SHARE_NOTE,
  };
}

export async function handleCompatibilityLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseCompatibilityShare(url.searchParams);
  if (!share) return htmlResponse(sharePageHtml(defaultCompatibilityPage(url.origin)));
  const model = compatibilityCardModel(share);
  return htmlResponse(sharePageHtml({
    title: `${model.title} on Zodiacs`,
    description: model.summary,
    heading: `${model.first} and ${model.second}`,
    imageUrl: `${url.origin}${COMPATIBILITY_SHARE_IMAGE_PATH}?${compatibilityQuery(share)}`,
    imageAlt: `${model.first} and ${model.second}, ${model.score} out of 100. ${model.summary}`,
    explanation: `${model.first} and ${model.second} compared their birth charts on Zodiacs: ${model.score} out of 100, ${model.verdict.charAt(0).toLowerCase()}${model.verdict.slice(1)}. The score reads the contacts between the two charts and their Sun signs’ elements.`,
    action: { label: 'Check your own compatibility', href: withRef('/compatibility/', share.ref) },
    note: SHARE_NOTE,
  }));
}

export async function handleOccasionLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseOccasionShare(url.searchParams);
  if (!share) return htmlResponse(sharePageHtml(defaultOccasionPage(url.origin)));
  const model = occasionCardModel(share);
  return htmlResponse(sharePageHtml({
    title: `${model.title} on Zodiacs`,
    description: model.summary,
    heading: model.names ? `${model.names}: ${model.headline.charAt(0).toLowerCase()}${model.headline.slice(1)}` : model.headline,
    imageUrl: `${url.origin}${OCCASION_SHARE_IMAGE_PATH}?${occasionQuery(share)}`,
    imageAlt: `${model.headline}, ${model.when}: ${model.score} out of 100. ${model.verdict}.`,
    explanation: `Zodiacs rated this date ${model.score} out of 100 from the sky that day: the Moon’s phase and sign, Venus, and any planets in retrograde.`,
    action: { label: 'Rate your own date', href: withRef('/occasions/', share.ref) },
    note: SHARE_NOTE,
  }));
}

// ── The deployed function's entry ────────────────────────────────────

const ROUTES: Readonly<Record<ResultShareRoute, { path: string; keys: readonly string[]; handle: (request: Request) => Promise<Response> }>> = {
  'compatibility-link': { path: COMPATIBILITY_SHARE_PATH, keys: COMPATIBILITY_SHARE_KEYS, handle: handleCompatibilityLinkRequest },
  'compatibility-image': { path: COMPATIBILITY_SHARE_IMAGE_PATH, keys: COMPATIBILITY_SHARE_KEYS, handle: handleCompatibilityImageRequest },
  'occasion-link': { path: OCCASION_SHARE_PATH, keys: OCCASION_SHARE_KEYS, handle: handleOccasionLinkRequest },
  'occasion-image': { path: OCCASION_SHARE_IMAGE_PATH, keys: OCCASION_SHARE_KEYS, handle: handleOccasionImageRequest },
};

export const isResultShareRoute = (value: unknown): value is ResultShareRoute => typeof value === 'string' && (RESULT_SHARE_ROUTES as readonly string[]).includes(value);

/** The Node entry: only the route key and the route's own keys, each a single string. */
export async function handleResultShareNodeRequest(req: any, res: any, route: ResultShareRoute): Promise<void> {
  const target = ROUTES[route];
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  let params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === RESULT_SHARE_ROUTE_KEY) continue;
    // The page skips a key it does not use, such as the fbclid or utm_source an app adds to a
    // link as it is opened, so the result still shows; the image takes only its own keys.
    if (!target.keys.includes(key) && !route.endsWith('-image')) continue;
    if (!target.keys.includes(key) || typeof value !== 'string') {
      // A repeated key, or an unknown key on the image: the image refuses, the page opens without a result.
      if (route.endsWith('-image')) {
        await writeNodeResponse(res, errorResponse(400));
        return;
      }
      params = new URLSearchParams();
      break;
    }
    params.set(key, value);
  }
  const request = new Request(`${requestOrigin(req)}${target.path}?${params.toString()}`, {
    method: typeof req.method === 'string' ? req.method : 'GET',
  });
  await writeNodeResponse(res, await target.handle(request));
}
