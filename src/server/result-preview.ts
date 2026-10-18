/**
 * Share links for a compatibility score and a date's rating: a page with the
 * result card and a way to try it, and the 1200×630 preview image link
 * previews show. Both read only the link's checked query string
 * (src/lib/share-results.ts); nothing is looked up, stored or logged, and
 * every response is uncacheable and kept out of search.
 */
import { readFile } from 'node:fs/promises';
import { encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
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
import { TILTED_RING_DOTS, TILTED_RING_VIEWBOX } from '../lib/tilted-mark.js';
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
const INK_SOFT = '#C6CCDA';
const MUTED = '#8E96AB';
const HAIRLINE = 'rgba(198,204,218,0.16)';
// The dark assistant card's muted ink (DESIGN.md, "Assistant cards").
const CARD_MUTED = '#A0A8BA';

// ── Assets ───────────────────────────────────────────────────────────

type FontSet = [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer];
let fonts: Promise<FontSet> | null = null;

function prepareFonts(): Promise<FontSet> {
  if (fonts) return fonts;
  const pending = Promise.all([
    readFile(new URL('../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff', import.meta.url)),
  ]).then((files) => files.map((bytes) => exactArrayBuffer(bytes)) as FontSet);
  fonts = pending;
  void pending.catch(() => { if (fonts === pending) fonts = null; });
  return pending;
}

// The site's pastel sign discs at 128px (scripts/build-icons.mjs: centred, one visible size), drawn at 64.
// One literal address per sign, so the deployment's file tracing packs all twelve discs.
const DISC_FILES: Readonly<Record<ShareSign, URL>> = {
  aries: new URL('../../public/assets/zodiac-icons/128/aries.png', import.meta.url),
  taurus: new URL('../../public/assets/zodiac-icons/128/taurus.png', import.meta.url),
  gemini: new URL('../../public/assets/zodiac-icons/128/gemini.png', import.meta.url),
  cancer: new URL('../../public/assets/zodiac-icons/128/cancer.png', import.meta.url),
  leo: new URL('../../public/assets/zodiac-icons/128/leo.png', import.meta.url),
  virgo: new URL('../../public/assets/zodiac-icons/128/virgo.png', import.meta.url),
  libra: new URL('../../public/assets/zodiac-icons/128/libra.png', import.meta.url),
  scorpio: new URL('../../public/assets/zodiac-icons/128/scorpio.png', import.meta.url),
  sagittarius: new URL('../../public/assets/zodiac-icons/128/sagittarius.png', import.meta.url),
  capricorn: new URL('../../public/assets/zodiac-icons/128/capricorn.png', import.meta.url),
  aquarius: new URL('../../public/assets/zodiac-icons/128/aquarius.png', import.meta.url),
  pisces: new URL('../../public/assets/zodiac-icons/128/pisces.png', import.meta.url),
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

// The cards' hero art at its largest (scripts/build-card-art.mjs): the sign panels at 1200px, the pieces
// at 720px, as JPEG because the renderer cannot decode WebP, with the cards' dimming of the dark art
// (saturate .92, brightness .86) already in the file. Every piece is 3:2.
// One literal address per piece, so the deployment's file tracing packs them all.
export type ShareArt = ShareSign | 'wedding-hero' | 'sky-calendar-hero';
const ART_FILES: Readonly<Record<ShareArt, URL>> = {
  aries: new URL('../../public/assets/card-art/share/aries-1200.jpg', import.meta.url),
  taurus: new URL('../../public/assets/card-art/share/taurus-1200.jpg', import.meta.url),
  gemini: new URL('../../public/assets/card-art/share/gemini-1200.jpg', import.meta.url),
  cancer: new URL('../../public/assets/card-art/share/cancer-1200.jpg', import.meta.url),
  leo: new URL('../../public/assets/card-art/share/leo-1200.jpg', import.meta.url),
  virgo: new URL('../../public/assets/card-art/share/virgo-1200.jpg', import.meta.url),
  libra: new URL('../../public/assets/card-art/share/libra-1200.jpg', import.meta.url),
  scorpio: new URL('../../public/assets/card-art/share/scorpio-1200.jpg', import.meta.url),
  sagittarius: new URL('../../public/assets/card-art/share/sagittarius-1200.jpg', import.meta.url),
  capricorn: new URL('../../public/assets/card-art/share/capricorn-1200.jpg', import.meta.url),
  aquarius: new URL('../../public/assets/card-art/share/aquarius-1200.jpg', import.meta.url),
  pisces: new URL('../../public/assets/card-art/share/pisces-1200.jpg', import.meta.url),
  'wedding-hero': new URL('../../public/assets/card-art/share/wedding-hero-720.jpg', import.meta.url),
  'sky-calendar-hero': new URL('../../public/assets/card-art/share/sky-calendar-hero-720.jpg', import.meta.url),
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
//
// The share image is the card's keepsake, as the owner picked on 2026-10-18
// (direction C): the hero art across the whole picture, shaded from the left
// so the words sit on its darkest side; the nameplate top left; the pastel
// sign discs, the kicker, the title and one line with the score bottom left.

const WIDTH = 1200;
const HEIGHT = 630;
const SERIF = 'EB Garamond, EB Garamond Ext';
const TEXT_WIDTH = 620;

/** The assistant cards' nameplate: the tilted twelve-dot mark, "Zodiacs" in the masthead serif and a small ".org". */
function nameplate() {
  const width = 60;
  return h('div', { style: { display: 'flex', alignItems: 'center', position: 'absolute', left: '64px', top: '56px' } },
    h('svg', { width, height: Math.round((width * 4) / 7), viewBox: TILTED_RING_VIEWBOX, style: { marginRight: '15px' } },
      ...TILTED_RING_DOTS.map((dot) => h('circle', { cx: dot.cx, cy: dot.cy, r: dot.r, fill: dot.fill, opacity: dot.opacity }))),
    h('div', { style: { display: 'flex', alignItems: 'baseline' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: 34, color: INK, lineHeight: 1 } }, 'Zodiacs'),
      h('div', { style: { display: 'flex', fontSize: 18, color: CARD_MUTED, marginLeft: '5px', letterSpacing: '0.5px' } }, '.org')));
}

/** One panel of art, filling its box the way the cards' `object-fit: cover` does, held 46% of the way down, mirrored when asked. */
function artPanel(src: string, left: number, width: number, flip: boolean) {
  const fitsWidth = width / HEIGHT > 3 / 2;
  const w = Math.round(fitsWidth ? width : (HEIGHT * 3) / 2);
  const height = Math.round(fitsWidth ? (width * 2) / 3 : HEIGHT);
  return h('div', { style: { display: 'flex', position: 'absolute', left: `${left}px`, top: '0px', width: `${width}px`, height: `${HEIGHT}px`, overflow: 'hidden' } },
    h('img', { src, width: w, height, style: {
      position: 'absolute', left: `${Math.round((width - w) / 2)}px`, top: `${Math.round((HEIGHT - height) * 0.46)}px`, width: `${w}px`, height: `${height}px`,
      ...(flip ? { transform: 'scaleX(-1)' } : {}),
    } }));
}

/** A piecewise-linear ramp through [position, value] stops, held flat beyond the ends. */
function ramp(t: number, stops: readonly (readonly [number, number])[]): number {
  if (t <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index += 1) {
    const [t1, v1] = stops[index];
    if (t <= t1) {
      const [t0, v0] = stops[index - 1];
      return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
    }
  }
  return stops[stops.length - 1][1];
}

const VIGNETTE: readonly (readonly [number, number])[] = [[0.38, 0], [0.7, 0.38], [1, 0.78]];
const SHADE: readonly (readonly [number, number])[] = [[0, 0.94], [0.42, 0.72], [0.75, 0.1]];
const overlays = new Map<boolean, string>();

/**
 * The darkening over the art, in the void's colour: the cards' oval
 * vignette on each panel (clear to 38% of an oval 46% of the panel wide and
 * 52% high, .38 at 70%, .78 at its edge and beyond), for a pair the soft
 * seam where the two panels meet (each fades a seventh of its width into
 * the ground), and over everything the shade from the left that the words
 * sit on (.94 at the edge, .72 at 42% of the width, .1 from three quarters
 * on). Layers of one colour stack into one layer exactly, so it is worked
 * out once per layout and drawn as a single image: the renderer drops the
 * alpha of a CSS radial gradient, and one image draws faster than four
 * layers.
 */
function overlay(pair: boolean): string {
  const known = overlays.get(pair);
  if (known) return known;
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  const half = WIDTH / 2;
  const seam = half * 0.14;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const [left, width, spotX, spotY] = pair ? [px < half ? 0 : half, half, 0.52, 0.5] : [0, WIDTH, 0.5, 0.52];
      const oval = Math.hypot((px - left - spotX * width) / (0.46 * width), (py - spotY * HEIGHT) / (0.52 * HEIGHT));
      let clear = 1 - ramp(oval, VIGNETTE);
      if (pair) clear *= Math.min(1, Math.abs(px - half) / seam);
      clear *= 1 - ramp(px / WIDTH, SHADE);
      const at = (y * WIDTH + x) * 4;
      // The void, #060709.
      png.data[at] = 6;
      png.data[at + 1] = 7;
      png.data[at + 2] = 9;
      png.data[at + 3] = Math.round((1 - clear) * 255);
    }
  }
  const src = `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
  overlays.set(pair, src);
  return src;
}

/** The art across the whole picture: one piece, or two sign panels side by side, the left one mirrored so the two figures face each other. */
function artLayer(images: string[]) {
  const half = WIDTH / 2;
  const pair = images.length === 2;
  return [
    ...(pair ? [artPanel(images[0], 0, half, true), artPanel(images[1], half, half, false)] : [artPanel(images[0], 0, WIDTH, false)]),
    h('img', { src: overlay(pair), width: WIDTH, height: HEIGHT, style: { position: 'absolute', left: '0px', top: '0px', width: `${WIDTH}px`, height: `${HEIGHT}px` } }),
  ];
}

/** The pastel discs of the signs a card is about, each once, with no outline. */
function discRow(signs: readonly PreviewSign[], images: Map<ShareSign, string>) {
  const sources = [...new Set(signs.map((sign) => (sign.slug ? images.get(sign.slug) : undefined)).filter((src): src is string => !!src))];
  return sources.length === 0 ? [] : [h('div', { style: { display: 'flex', marginBottom: '18px' } },
    ...sources.map((src, index) => h('img', { src, width: 64, height: 64, style: { width: '64px', height: '64px', marginLeft: index === 0 ? '0px' : '8px' } })))];
}

/** A display size that keeps the longest line inside the column. */
function fit(lines: string[], width: number, max: number, min: number): number {
  const longest = Math.max(...lines.map((line) => line.length));
  return Math.max(min, Math.min(max, Math.floor(width / (longest * 0.5))));
}

const titleLine = (text: string, size: number) => h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1.03, color: INK } }, text);

/** The words at the bottom left: the discs, the kicker in the card's hue, the title, and the score in a line. */
function words(parts: { discs: VNode<any>[]; kicker: string; hue: string; title: VNode<any>[]; line: string }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: '64px', bottom: '64px', width: `${TEXT_WIDTH}px` } },
    ...parts.discs,
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 30, lineHeight: 1.25, color: parts.hue } }, parts.kicker),
    ...parts.title,
    h('div', { style: { display: 'flex', fontSize: 28, lineHeight: 1.32, color: INK_SOFT, marginTop: '18px', maxWidth: '600px', textWrap: 'balance' } }, parts.line));
}

function frame(art: string[], text: VNode<any>) {
  return h('div', { style: {
      width: `${WIDTH}px`, height: `${HEIGHT}px`, display: 'flex', position: 'relative', background: VOID, color: INK, fontFamily: 'Noto',
    } },
    ...artLayer(art),
    nameplate(),
    text);
}

export function compatibilityCard(model: CompatibilityCardModel, images: Map<ShareSign, string>, art: string[]) {
  const oneLine = `${model.first} and ${model.second}`;
  const lines = fit([oneLine], TEXT_WIDTH, 76, 30) >= 56 ? [oneLine] : [model.first, `and ${model.second}`];
  const size = fit(lines, TEXT_WIDTH, lines.length > 1 ? 64 : 76, 44);
  return frame(art, words({
    discs: discRow(model.people, images),
    kicker: 'Two charts compared',
    hue: model.people[0].hue,
    title: lines.map((line) => titleLine(line, size)),
    line: `${model.score} out of 100. ${model.verdict}`,
  }));
}

export function occasionCard(model: OccasionCardModel, images: Map<ShareSign, string>, art: string[]) {
  const title = model.names ?? model.headline;
  return frame(art, words({
    discs: discRow(model.signs, images),
    kicker: model.names ? model.headline : 'The sky on the day',
    hue: model.ring[0],
    title: [h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: fit([title], TEXT_WIDTH, 76, 44), lineHeight: 1.03, color: INK, textWrap: 'balance' } }, title)],
    line: `${model.score} out of 100. ${model.verdict}`,
  }));
}

// ── Responses ────────────────────────────────────────────────────────

function errorResponse(status: number): Response {
  return new Response('Preview unavailable.', {
    status,
    headers: { ...PRIVACY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * JPEG quality for the share images. The art fills the picture, so as the
 * renderer's PNG an image runs to 650 to 850 KB, over WhatsApp's 600 KB limit
 * for a link preview; as a JPEG at 90 it is about 120 KB and its type reads as
 * it does in the PNG. The site sends its photographic share card as a JPEG
 * for the same reason.
 */
const JPEG_QUALITY = 90;

async function renderImage(element: VNode<any>): Promise<Response> {
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
        { name: 'EB Garamond', data: italic, weight: 400, style: 'italic' },
        { name: 'EB Garamond Ext', data: serifExt, weight: 500, style: 'normal' },
      ],
    });
    // Buffer the renderer stream so a failure never commits a partial 200 to a crawler.
    const { width, height, data } = PNG.sync.read(Buffer.from(await rendered.arrayBuffer()));
    const jpeg = encodeJpeg({ width, height, data }, JPEG_QUALITY).data;
    return new Response(new Uint8Array(jpeg), { headers: { ...PRIVACY_HEADERS, 'Content-Type': 'image/jpeg' } });
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
  return renderImage(compatibilityCard(model, images, art));
}

export async function handleOccasionImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseOccasionShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = occasionCardModel(share);
  const [images, art] = await Promise.all([discImages(model.signs), Promise.all(occasionArt(share).map(artImage))]).catch(() => [null, null] as const);
  if (!images || !art) return errorResponse(503);
  return renderImage(occasionCard(model, images, art));
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
  /** The result images are JPEG; the plain pages show the site's own PNG cards. */
  imageType: 'image/jpeg' | 'image/png';
  imageAlt: string;
  explanation: string;
  action: { label: string; href: string };
  note: string;
}

export function sharePageHtml(page: SharePage): string {
  const e = htmlEscape;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${e(page.title)}</title><meta name="description" content="${e(page.description)}"><meta property="og:site_name" content="Zodiacs"><meta property="og:title" content="${e(page.title)}"><meta property="og:description" content="${e(page.description)}"><meta property="og:type" content="website"><meta property="og:image" content="${e(page.imageUrl)}"><meta property="og:image:type" content="${page.imageType}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(page.imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(page.title)}"><meta name="twitter:description" content="${e(page.description)}"><meta name="twitter:image" content="${e(page.imageUrl)}"><meta name="twitter:image:alt" content="${e(page.imageAlt)}"><link rel="icon" href="/assets/app-icons/v3/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site-footer.css?v=20261006"><style nonce="${STYLE_NONCE}">${PAGE_STYLE}</style></head><body><main><a class="brand" href="/"><img src="/assets/app-icons/v3/favicon.svg" width="28" height="28" alt=""><span>Zodiacs<small>.org</small></span></a><h1>${e(page.heading)}</h1><img class="card" src="${e(page.imageUrl)}" width="1200" height="630" alt="${e(page.imageAlt)}"><p class="lede">${e(page.explanation)}</p><a class="cta" href="${e(page.action.href)}">${e(page.action.label)}</a><p class="note">${e(page.note)}</p></main><footer class="zfooter zfooter--compact"><span>Zodiacs.org</span><nav aria-label="Zodiacs"><a href="/">Astrology</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></footer></body></html>`;
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
    imageType: 'image/png',
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
    imageType: 'image/png',
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
    imageType: 'image/jpeg',
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
    imageType: 'image/jpeg',
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
