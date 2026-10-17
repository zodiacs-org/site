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
import { HUES } from './chart-preview-model.js';
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
// The share image is the dark assistant card (DESIGN.md, "Assistant cards"): its surface, tiles and ring track.
const CARD = '#16191F';
const TILE = '#1C2029';
const CARD_MUTED = '#A0A8BA';
const TRACK = '#2A303D';
// The twelve-dot ring in zodiac order, as the site's BrandMark draws it.
const RING_ORDER: readonly ShareSign[] = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// ── Assets ───────────────────────────────────────────────────────────

type FontSet = [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer];
let fonts: Promise<FontSet> | null = null;

function prepareFonts(): Promise<FontSet> {
  if (fonts) return fonts;
  const pending = Promise.all([
    readFile(new URL('../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-italic.woff', import.meta.url)),
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

// The cards' hero art at 640px (scripts/build-card-art.mjs), as JPEG because the renderer cannot decode WebP.
// One literal address per piece, so the deployment's file tracing packs them all.
export type ShareArt = ShareSign | 'wedding-hero' | 'sky-calendar-hero';
const ART_FILES: Readonly<Record<ShareArt, URL>> = {
  aries: new URL('../../public/assets/card-art/share/aries-640.jpg', import.meta.url),
  taurus: new URL('../../public/assets/card-art/share/taurus-640.jpg', import.meta.url),
  gemini: new URL('../../public/assets/card-art/share/gemini-640.jpg', import.meta.url),
  cancer: new URL('../../public/assets/card-art/share/cancer-640.jpg', import.meta.url),
  leo: new URL('../../public/assets/card-art/share/leo-640.jpg', import.meta.url),
  virgo: new URL('../../public/assets/card-art/share/virgo-640.jpg', import.meta.url),
  libra: new URL('../../public/assets/card-art/share/libra-640.jpg', import.meta.url),
  scorpio: new URL('../../public/assets/card-art/share/scorpio-640.jpg', import.meta.url),
  sagittarius: new URL('../../public/assets/card-art/share/sagittarius-640.jpg', import.meta.url),
  capricorn: new URL('../../public/assets/card-art/share/capricorn-640.jpg', import.meta.url),
  aquarius: new URL('../../public/assets/card-art/share/aquarius-640.jpg', import.meta.url),
  pisces: new URL('../../public/assets/card-art/share/pisces-640.jpg', import.meta.url),
  'wedding-hero': new URL('../../public/assets/card-art/share/wedding-hero-640.jpg', import.meta.url),
  'sky-calendar-hero': new URL('../../public/assets/card-art/share/sky-calendar-hero-640.jpg', import.meta.url),
};
const arts = new Map<ShareArt, Promise<string>>();

function artImage(key: ShareArt): Promise<string> {
  const known = arts.get(key);
  if (known) return known;
  const pending = readFile(ART_FILES[key]).then((bytes) => `data:image/jpeg;base64,${bytes.toString('base64')}`);
  arts.set(key, pending);
  void pending.catch(() => { if (arts.get(key) === pending) arts.delete(key); });
  return pending;
}

/** A compatibility image shows both Sun signs' panels; a date's shows the wedding piece or the Sun sign's panel. */
export function compatibilityArt(share: { aSun: ShareSign | null; bSun: ShareSign | null }): ShareArt[] {
  const signs = [share.aSun, share.bSun].filter((slug): slug is ShareSign => slug !== null);
  return signs.length > 0 ? signs : ['sky-calendar-hero'];
}
export function occasionArt(share: { occasion: string; sun: ShareSign | null }): ShareArt[] {
  return [share.occasion === 'wedding' || share.occasion === 'anniversary' ? 'wedding-hero' : share.sun ?? 'sky-calendar-hero'];
}

// ── Cards ────────────────────────────────────────────────────────────

const SERIF = 'EB Garamond, EB Garamond Ext';

/** The site's nameplate: the twelve-dot ring, "Zodiacs" in the masthead serif and a small ".org". */
function nameplate() {
  const dots = RING_ORDER.map((slug, index) => {
    const angle = (index / 12) * 2 * Math.PI - Math.PI / 2;
    return h('circle', { cx: (12 + 9 * Math.cos(angle)).toFixed(3), cy: (12 + 9 * Math.sin(angle)).toFixed(3), r: '1.9', fill: HUES[slug] });
  });
  return h('div', { style: { display: 'flex', alignItems: 'center' } },
    h('svg', { width: 40, height: 40, viewBox: '0 0 24 24', style: { marginRight: '14px' } }, ...dots),
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 36, color: INK, lineHeight: 1 } }, 'Zodiacs'),
    h('div', { style: { display: 'flex', fontSize: 19, color: CARD_MUTED, marginLeft: '6px', marginTop: '12px', letterSpacing: '1px' } }, '.org'));
}

function kicker(text: string, hue: string) {
  return h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontSize: 36, color: hue, lineHeight: 1.2 } }, text);
}

const RING = 236;

/** The score inside a ring drawn from one sign's hue to the other's, as on the card. */
function ring(score: number, hues: [string, string]) {
  const stroke = 16;
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
        'stroke-dasharray': `${arc.toFixed(2)} ${circumference.toFixed(2)}`,
        transform: `rotate(-90 ${centre} ${centre})`,
      })),
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-4px' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 104, lineHeight: 1, color: INK, letterSpacing: '-2px' } }, String(score)),
      h('div', { style: { display: 'flex', fontFamily: 'Noto', fontSize: 21, color: CARD_MUTED, marginTop: '4px' } }, 'out of 100')));
}

function signChip(sign: PreviewSign, images: Map<ShareSign, string>, size: number) {
  const src = sign.slug ? images.get(sign.slug) : undefined;
  return h('div', { style: { display: 'flex', alignItems: 'center', marginRight: '34px' } },
    src
      ? h('img', { src, width: size, height: size, style: { width: `${size}px`, height: `${size}px` } })
      : h('div', { style: { display: 'flex', width: `${size}px`, height: `${size}px`, borderRadius: `${size}px`, border: `2px solid ${HAIRLINE}` } }),
    h('div', { style: { display: 'flex', fontFamily: 'Noto', fontSize: 27, color: INK, marginLeft: '14px' } }, sign.label));
}

/** One area of a compatibility score as a tile: its number over its name, no bar. */
function areaTile(area: { label: string; value: number }, index: number) {
  return h('div', { style: {
      display: 'flex', flexDirection: 'column', width: '172px', marginLeft: index === 0 ? '0px' : '12px',
      padding: '14px 16px 16px', borderRadius: '16px', background: TILE,
    } },
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: 50, lineHeight: 1, color: INK } }, String(area.value)),
    h('div', { style: { display: 'flex', fontSize: 19, color: CARD_MUTED, marginTop: '6px' } }, area.label));
}

/** A display size that keeps the longest line inside the column. */
function fit(lines: string[], width: number, max: number, min: number): number {
  const longest = Math.max(...lines.map((line) => line.length));
  return Math.max(min, Math.min(max, Math.floor(width / (longest * 0.5))));
}

const LEFT_WIDTH = 560;
const ART_WIDTH = 560;

/**
 * The art panel on the right: the hero art (one panel, or two stacked) dimmed
 * like the card's frame and faded into the card on every side, so no edge of
 * a picture shows, with the score ring in its lower corner on a dark disc, so
 * the number never sits on busy art and the figures stay in view.
 */
function artPanel(images: string[], score: number, hues: [string, string]) {
  const height = 630 / images.length;
  const clear = 'rgba(22,25,31,0)';
  const fade = (style: Record<string, string>, direction: string, size: number) => h('div', { style: {
    display: 'flex', position: 'absolute', ...style, backgroundImage: `linear-gradient(${direction}, ${CARD} 0%, rgba(22,25,31,0.6) ${Math.round(size * 0.35)}px, ${clear} ${size}px)`,
  } });
  return h('div', { style: { display: 'flex', position: 'relative', width: `${ART_WIDTH}px`, height: '630px', background: CARD } },
    ...images.flatMap((src, index) => {
      const top = index * height;
      const edge = Math.round(height * 0.24);
      return [
        h('img', { src, width: ART_WIDTH, height, style: {
          position: 'absolute', left: 0, top: `${top}px`, width: `${ART_WIDTH}px`, height: `${height}px`, objectFit: 'cover', opacity: 0.94,
        } }),
        h('div', { style: { display: 'flex', position: 'absolute', left: 0, top: `${top}px`, width: `${ART_WIDTH}px`, height: `${height}px`,
          backgroundImage: `radial-gradient(circle at 55% 45%, ${clear} 0%, rgba(22,25,31,0.14) 50%, rgba(22,25,31,0.5) 100%)` } }),
        fade({ left: '0px', top: `${top}px`, width: `${ART_WIDTH}px`, height: `${edge}px` }, '180deg', edge),
        fade({ left: '0px', top: `${top + height - edge}px`, width: `${ART_WIDTH}px`, height: `${edge}px` }, '0deg', edge),
      ];
    }),
    fade({ left: '0px', top: '0px', width: '170px', height: '630px' }, '90deg', 170),
    fade({ left: `${ART_WIDTH - 120}px`, top: '0px', width: '120px', height: '630px' }, '270deg', 120),
    h('div', { style: { display: 'flex', position: 'absolute', left: `${ART_WIDTH - RING - 24 - 30}px`, top: `${630 - RING - 24 - 30}px`,
      width: `${RING + 24}px`, height: `${RING + 24}px`, borderRadius: `${RING}px`, background: 'rgba(13,15,19,0.78)', alignItems: 'center', justifyContent: 'center' } },
      ring(score, hues)));
}

function frame(left: VNode<any>, score: number, hues: [string, string], art: string[]) {
  return h('div', { style: {
      width: '1200px', height: '630px', display: 'flex', background: CARD, color: INK, fontFamily: 'Noto',
    } },
    h('div', { style: { display: 'flex', padding: '52px 20px 54px 64px', width: `${1200 - ART_WIDTH}px`, height: '630px' } }, left),
    artPanel(art, score, hues));
}

const column = (...children: VNode<any>[]) => h('div', { style: {
  display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: `${LEFT_WIDTH}px`, height: '100%',
} }, ...children);

const verdictLine = (verdict: string) => h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontSize: fit([verdict], LEFT_WIDTH, 44, 34), color: INK, marginTop: '18px', lineHeight: 1.15 } }, verdict);

export function compatibilityCard(model: CompatibilityCardModel, images: Map<ShareSign, string>, art: string[]) {
  const oneLine = `${model.first} and ${model.second}`;
  const lines = fit([oneLine], LEFT_WIDTH, 84, 40) >= 64 ? [oneLine] : [model.first, `and ${model.second}`];
  const nameSize = fit(lines, LEFT_WIDTH, lines.length > 1 ? 68 : 84, 48);
  return frame(column(
    nameplate(),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      kicker('Two charts compared', model.people[0].hue),
      ...lines.map((line) => h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: nameSize, lineHeight: 1.04, color: INK, marginTop: '4px' } }, line)),
      verdictLine(model.verdict),
      h('div', { style: { display: 'flex', marginTop: '20px' } }, ...model.people.map((person) => signChip(person, images, 48)))),
    h('div', { style: { display: 'flex' } }, ...model.areas.map((area, index) => areaTile(area, index))),
  ), model.score, model.ring, art);
}

export function occasionCard(model: OccasionCardModel, images: Map<ShareSign, string>, art: string[]) {
  const title = model.names ?? model.headline;
  const headSize = fit([title], LEFT_WIDTH, 92, 56);
  return frame(column(
    nameplate(),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      kicker(model.names ? model.headline : 'The sky on the day', model.ring[0]),
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontSize: headSize, lineHeight: 1.04, color: INK, marginTop: '6px' } }, title),
      h('div', { style: { display: 'flex', fontSize: 27, lineHeight: 1.3, color: CARD_MUTED, marginTop: '14px' } }, model.when),
      verdictLine(model.verdict)),
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      ...(model.signs.length > 0
        ? model.signs.map((sign) => signChip(sign, images, 52))
        : [h('div', { style: { display: 'flex', fontSize: 26, color: CARD_MUTED } }, 'Rated from the sky that day')])),
  ), model.score, model.ring, art);
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
    const [noto, serif, serifExt, italic] = await prepareFonts();
    const rendered = new ImageResponse(element, {
      width: 1200,
      height: 630,
      headers: PRIVACY_HEADERS,
      fonts: [
        { name: 'Noto', data: noto, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: serif, weight: 500, style: 'normal' },
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
  const [images, art] = await Promise.all([discImages(model.people), Promise.all(compatibilityArt(share).map(artImage))]).catch(() => [null, null] as const);
  if (!images || !art) return errorResponse(503);
  return renderPng(compatibilityCard(model, images, art));
}

export async function handleOccasionImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseOccasionShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = occasionCardModel(share);
  const [images, art] = await Promise.all([discImages(model.signs), Promise.all(occasionArt(share).map(artImage))]).catch(() => [null, null] as const);
  if (!images || !art) return errorResponse(503);
  return renderPng(occasionCard(model, images, art));
}

// ── The page a share link opens ──────────────────────────────────────

const PAGE_STYLE = `@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Instrument Sans";src:url(/fonts/instrument-sans-latin-wght-normal.woff2) format("woff2");font-weight:400 700;font-display:swap}
:root{color-scheme:dark;--void:${VOID};--ink:${INK};--muted:${MUTED};--hairline:${HAIRLINE}}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--ink);font:400 17px/1.55 "Instrument Sans",system-ui,sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 16px 56px}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font:500 22px/1 "EB Garamond",Georgia,serif}
.brand img{width:28px;height:28px}
.brand small{margin-left:3px;font:400 11px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--muted)}
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${e(page.title)}</title><meta name="description" content="${e(page.description)}"><meta property="og:site_name" content="Zodiacs"><meta property="og:title" content="${e(page.title)}"><meta property="og:description" content="${e(page.description)}"><meta property="og:type" content="website"><meta property="og:image" content="${e(page.imageUrl)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(page.imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(page.title)}"><meta name="twitter:description" content="${e(page.description)}"><meta name="twitter:image" content="${e(page.imageUrl)}"><meta name="twitter:image:alt" content="${e(page.imageAlt)}"><link rel="icon" href="/assets/app-icons/v3/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site-footer.css?v=20261006"><style nonce="${STYLE_NONCE}">${PAGE_STYLE}</style></head><body><main><a class="brand" href="/"><img src="/assets/app-icons/v3/favicon.svg" width="28" height="28" alt=""><span>Zodiacs<small>.org</small></span></a><h1>${e(page.heading)}</h1><img class="card" src="${e(page.imageUrl)}" width="1200" height="630" alt="${e(page.imageAlt)}"><p class="lede">${e(page.explanation)}</p><a class="cta" href="${e(page.action.href)}">${e(page.action.label)}</a><p class="note">${e(page.note)}</p></main><footer class="zfooter zfooter--compact"><span>Zodiacs.org</span><nav aria-label="Zodiacs"><a href="/">Astrology</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></footer></body></html>`;
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
