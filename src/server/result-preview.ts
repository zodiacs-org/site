/**
 * Share links for eight assistant cards: a compatibility score, a date's
 * rating, a birthday, the sky calendar's next event, a horoscope, chart
 * twins, a famous chart and a life milestone. Each has
 * a page with the result's picture and a way to try it, the 1200×630
 * preview image link previews show, and a 1080×1920 picture to post as a story. They read only the link's checked query
 * string (src/lib/share-results.ts, src/ai-tools/share-links.ts) and the
 * site's own committed data (the birthday table, the sky calendar's events,
 * the published horoscopes and the famous-people directory); nothing is looked up elsewhere, stored or
 * logged, and every response is uncacheable and kept out of search.
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
  birthdayCardModel,
  type BirthdayCardModel,
  chartTwinsCardModel,
  type ChartTwinsCardModel,
  famousChartCardModel,
  type FamousChartCardModel,
  type IndexedPerson,
  milestoneCardModel,
  type MilestoneCardModel,
  type BirthdayDay,
  type FamousBirthday,
  famousBirthdays,
  compatibilityCardModel,
  type CompatibilityCardModel,
  horoscopeCardModel,
  type HoroscopeCardModel,
  occasionCardModel,
  type OccasionCardModel,
  type PreviewSign,
  skyCalendarCardModel,
  type SkyCalendarCardModel,
  type SkyData,
  type SkyEvent,
  skyEvents,
} from './result-preview-model.js';
import { HUES } from './chart-preview-model.js';
import {
  BIRTHDAY_SHARE_IMAGE_PATH,
  BIRTHDAY_SHARE_KEYS,
  BIRTHDAY_SHARE_PATH,
  type BirthdayShare,
  birthdayQuery,
  CHART_TWINS_SHARE_IMAGE_PATH,
  CHART_TWINS_SHARE_KEYS,
  CHART_TWINS_SHARE_PATH,
  chartTwinsQuery,
  FAMOUS_CHART_SHARE_IMAGE_PATH,
  FAMOUS_CHART_SHARE_KEYS,
  FAMOUS_CHART_SHARE_PATH,
  famousChartQuery,
  MILESTONE_SHARE_IMAGE_PATH,
  MILESTONE_SHARE_KEYS,
  MILESTONE_SHARE_PATH,
  milestoneQuery,
  parseChartTwinsShare,
  parseFamousChartShare,
  parseMilestoneShare,
  HOROSCOPE_SHARE_IMAGE_PATH,
  HOROSCOPE_SHARE_KEYS,
  HOROSCOPE_SHARE_PATH,
  horoscopeQuery,
  parseBirthdayShare,
  parseHoroscopeShare,
  parseSkyCalendarShare,
  SKY_CALENDAR_SHARE_IMAGE_PATH,
  SKY_CALENDAR_SHARE_KEYS,
  SKY_CALENDAR_SHARE_PATH,
  skyCalendarQuery,
} from '../ai-tools/share-links.js';
import { HOROSCOPE_DISCLOSURE } from '../ai-tools/horoscope/reading.js';
import type { HoroscopeWindow } from '../ai-tools/horoscope/window.js';
import { LOCKUP_SIZE, tiltedRingSvg } from '../lib/brand-lockup.mjs';
import { lockupImage } from './brand-lockup-image.js';
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
export const RESULT_SHARE_ROUTES = [
  'compatibility-link', 'compatibility-image', 'occasion-link', 'occasion-image',
  'birthday-link', 'birthday-image', 'sky-calendar-link', 'sky-calendar-image', 'horoscope-link', 'horoscope-image',
  'compatibility-story', 'occasion-story', 'birthday-story', 'sky-calendar-story', 'horoscope-story',
  'chart-twins-link', 'chart-twins-image', 'chart-twins-story', 'famous-chart-link', 'famous-chart-image', 'famous-chart-story',
  'milestone-link', 'milestone-image', 'milestone-story',
] as const;
export type ResultShareRoute = typeof RESULT_SHARE_ROUTES[number];

/** The story pictures: the same share query, at 1080×1920. */
export const COMPATIBILITY_SHARE_STORY_PATH = '/api/og/compatibility-story';
export const OCCASION_SHARE_STORY_PATH = '/api/og/occasion-story';
export const BIRTHDAY_SHARE_STORY_PATH = '/api/og/birthday-story';
export const SKY_CALENDAR_SHARE_STORY_PATH = '/api/og/sky-calendar-story';
export const HOROSCOPE_SHARE_STORY_PATH = '/api/og/horoscope-story';
export const CHART_TWINS_SHARE_STORY_PATH = '/api/og/chart-twins-story';
export const FAMOUS_CHART_SHARE_STORY_PATH = '/api/og/famous-chart-story';
export const MILESTONE_SHARE_STORY_PATH = '/api/og/milestone-story';

/** An image route takes only its own keys, each once; a page skips the ones it does not use. */
const isPictureRoute = (route: ResultShareRoute) => route.endsWith('-image') || route.endsWith('-story');

const VOID = '#060709';
const INK = '#EEF1F7';
const INK_SOFT = '#C6CCDA';
const MUTED = '#8E96AB';
const HAIRLINE = 'rgba(198,204,218,0.16)';
// The dark assistant card's muted ink (DESIGN.md, "Assistant cards").
const CARD_MUTED = '#A0A8BA';

// ── Assets ───────────────────────────────────────────────────────────

type FontSet = [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer];
let fonts: Promise<FontSet> | null = null;

function prepareFonts(): Promise<FontSet> {
  if (fonts) return fonts;
  const pending = Promise.all([
    readFile(new URL('../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', import.meta.url)),
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff', import.meta.url)),
    // The brand lockup's capitals are the regular weight.
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff', import.meta.url)),
    // A share link's names may be Cyrillic (src/lib/share-results.ts); they are set in the display weight.
    readFile(new URL('../../node_modules/@fontsource/eb-garamond/files/eb-garamond-cyrillic-500-normal.woff', import.meta.url)),
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

// The cards' hero art at its largest (scripts/build-card-art.mjs): most pieces
// at 1200px, as JPEG because the renderer cannot decode WebP, with the cards' dimming of the dark art
// (saturate .92, brightness .86) already in the file. Every piece is 3:2.
// One literal address per piece, so the deployment's file tracing packs them all.
export type ShareArt = ShareSign | 'wedding-hero' | 'sky-calendar-hero' | 'twins-hero' | 'milestones-hero';
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
  'sky-calendar-hero': new URL('../../public/assets/card-art/share/sky-calendar-hero-1200.jpg', import.meta.url),
  'twins-hero': new URL('../../public/assets/card-art/share/twins-hero-1200.jpg', import.meta.url),
  'milestones-hero': new URL('../../public/assets/card-art/share/milestones-hero-1200.jpg', import.meta.url),
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

// ── The site's own data, read once per instance ──────────────────────
// One literal address per file, so the deployment's file tracing packs them.

interface ShareData {
  birthdays: Readonly<Record<string, BirthdayDay>>;
  /** The first famous person born on each month and day ("05-04"). */
  famous: ReadonlyMap<string, FamousBirthday>;
  skyEvents: readonly SkyEvent[];
  horoscopes: Pick<HoroscopeWindow, 'editions'>;
  /** The people the site publishes, for chart twins and a famous chart. */
  people: readonly IndexedPerson[];
}
let shareData: Promise<ShareData> | null = null;

function readJson<T>(url: URL): Promise<T> {
  return readFile(url, 'utf8').then((text) => JSON.parse(text) as T);
}

function loadShareData(): Promise<ShareData> {
  if (shareData) return shareData;
  const pending = Promise.all([
    readJson<{ days: Record<string, BirthdayDay> }>(new URL('../data/birthdays.json', import.meta.url)),
    readJson<Pick<SkyData, 'moons' | 'retrogrades'>>(new URL('../data/sky.json', import.meta.url)),
    readJson<{ eclipses: SkyData['eclipses'] }>(new URL('../data/eclipses.json', import.meta.url)),
    readJson<Pick<HoroscopeWindow, 'editions'>>(new URL('../data/horoscope-window.json', import.meta.url)),
    // The people the site publishes, as the AI tools index them (scripts/build-ai-people.mjs).
    readJson<{ people: (Parameters<typeof famousBirthdays>[0][number] & IndexedPerson)[] }>(new URL('../ai-tools/features/people-index.json', import.meta.url)),
  ]).then(([birthdays, sky, eclipses, horoscopes, people]) => ({
    birthdays: birthdays.days,
    famous: famousBirthdays(people.people),
    skyEvents: skyEvents({ moons: sky.moons, retrogrades: sky.retrogrades, eclipses: eclipses.eclipses }),
    horoscopes: { editions: horoscopes.editions },
    people: people.people,
  }));
  shareData = pending;
  void pending.catch(() => { if (shareData === pending) shareData = null; });
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
const SERIF = 'EB Garamond, EB Garamond Ext, EB Garamond Cyrillic';
const TEXT_WIDTH = 620;

/**
 * The brand lockup (DESIGN.md, "Brand Lockup") at 20px, top left, drawn by
 * the site's one image lockup: the tilted twelve-dot mark and ZODIACS · ORG,
 * with the dot in the cards' muted ink so it holds on the art.
 */
function nameplate(front: ShareSign | null) {
  return h('div', { style: { display: 'flex', position: 'absolute', left: '64px', top: '56px' } },
    lockupImage(LOCKUP_SIZE.image, { name: INK, dot: CARD_MUTED, tld: INK_SOFT }, front));
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
function words(parts: { discs: VNode<any>[]; kicker: string; hue: string; title: VNode<any>[]; line: string | VNode<any>[] }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: '64px', bottom: '64px', width: `${TEXT_WIDTH}px` } },
    ...parts.discs,
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 30, lineHeight: 1.25, color: parts.hue } }, parts.kicker),
    ...parts.title,
    h('div', { style: { display: 'flex', fontSize: 28, lineHeight: 1.32, color: INK_SOFT, marginTop: '18px', maxWidth: '600px', textWrap: 'balance' } }, ...(typeof parts.line === 'string' ? [parts.line] : parts.line)));
}

/**
 * A line whose first word ends in a comma, as two runs: the renderer kerns
 * "r," when it draws a word but not when it measures it, which leaves a wide
 * gap after "Painter," or "Composer,"; split at the comma, nothing is kerned.
 */
const commaLine = (text: string) => {
  const at = text.indexOf(', ');
  return at < 0 ? [h('span', null, text)] : [h('span', null, text.slice(0, at)), h('span', null, text.slice(at))];
};

/**
 * A share image. `front` is the Sun sign of the one person it is made for,
 * when the link settles it, and turns the lockup's ring to bring it forward
 * as the site's personal images do; the others keep the brand's own ring.
 */
function frame(art: string[], text: VNode<any>, front: ShareSign | null = null) {
  return h('div', { style: {
      width: `${WIDTH}px`, height: `${HEIGHT}px`, display: 'flex', position: 'relative', background: VOID, color: INK, fontFamily: 'Noto',
    } },
    ...artLayer(art),
    nameplate(front),
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
  }), model.people[0].slug);
}

/** A title that may wrap: as large as fits, balanced over its lines. */
const titleBlock = (title: string) => h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: fit([title], TEXT_WIDTH, 76, 44), lineHeight: 1.03, color: INK, textWrap: 'balance' } }, title);

export function occasionCard(model: OccasionCardModel, images: Map<ShareSign, string>, art: string[]) {
  const title = model.names ?? model.headline;
  return frame(art, words({
    discs: discRow(model.signs, images),
    kicker: model.names ? model.headline : 'The sky on the day',
    hue: model.ring[0],
    title: [titleBlock(title)],
    line: `${model.score} out of 100. ${model.verdict}`,
  }));
}

/** A birthday: its Sun sign's panel, or a cusp date's two signs facing each other. */
export function birthdayCard(model: BirthdayCardModel, images: Map<ShareSign, string>, art: string[]) {
  return frame(art, words({ discs: discRow(model.signs, images), kicker: 'A birthday', hue: model.hue, title: [titleBlock(model.title)], line: model.line }),
    model.signs.length === 1 ? model.signs[0].slug : null);
}

/** The sky calendar: the Sky dial, and the next event in a line. It names no sign, so it has no disc, as on its card. */
export function skyCalendarCard(model: SkyCalendarCardModel, art: string[]) {
  return frame(art, words({ discs: [], kicker: 'Sky calendar', hue: HUES.scorpio, title: [titleBlock('The sky in your calendar')], line: model.line }));
}

/** A horoscope: the sign's panel, the day or week, the sign, and the reading's own line for it. */
export function horoscopeCard(model: HoroscopeCardModel, images: Map<ShareSign, string>, art: string[]) {
  return frame(art, words({ discs: discRow([model.sign], images), kicker: model.kicker, hue: model.hue, title: [titleBlock(model.signName)], line: model.line }), model.sign.slug);
}

/** A quote behind a rule in the card's hue, as the sky calendar's story sets its event. */
const quoteBlock = (text: string, hue: string, size: number) => h('div', { style: { display: 'flex', marginTop: '4px', paddingLeft: '26px', borderLeft: `3px solid ${hue}` } },
  h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: size, lineHeight: 1.12, color: INK, textWrap: 'balance' } }, text));

/** Chart twins (B, the line as a quote): the twin cameos, the signs' discs, the first twin as a quote, and how many share the signs. */
export function chartTwinsCard(model: ChartTwinsCardModel, images: Map<ShareSign, string>, art: string[]) {
  return frame(art, words({
    discs: discRow(model.signs, images),
    kicker: 'Chart twins',
    hue: model.hue,
    title: [quoteBlock(model.quote, model.hue, fit([model.quote], TEXT_WIDTH - 29, 60, 40))],
    line: `${model.count}.`,
  }), model.sun);
}

const italicLine = (text: string, size: number, marginTop: number) =>
  h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: size, lineHeight: 1.25, color: INK_SOFT, marginTop: `${marginTop}px` } }, text);

/** A famous chart (A, the name as a trophy): the Sun sign's panel and disc, the name, the Sun's degree, and who they were. */
export function famousChartCard(model: FamousChartCardModel, images: Map<ShareSign, string>, art: string[]) {
  return frame(art, words({
    discs: discRow([model.sign], images),
    kicker: 'A famous birth chart',
    hue: model.hue,
    title: [titleBlock(model.name), italicLine(model.sunLine, 34, 12)],
    line: commaLine(`${model.born}.`),
  }), model.sign.slug);
}

/** The age in a plain ring in the milestone's hue, as the chat card draws it. */
function ageRing(age: number, hue: string, size: number, stroke: number, numberSize: number, labelSize: number) {
  const radius = (size - stroke) / 2;
  return h('div', { style: { display: 'flex', position: 'relative', width: `${size}px`, height: `${size}px`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
    h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { position: 'absolute', top: 0, left: 0 } },
      h('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'rgba(6,7,9,0.72)', stroke: hue, 'stroke-width': stroke })),
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: numberSize, lineHeight: 1, color: INK } }, String(age)),
      h('div', { style: { display: 'flex', fontSize: labelSize, color: MUTED, marginTop: `${Math.round(numberSize * 0.08)}px` } }, 'age')));
}

/** A life milestone (A, the number as a trophy): the hourglass, the age in its ring beside the milestone, whether it is coming or under way, and its dates. */
export function milestoneCard(model: MilestoneCardModel, art: string[]) {
  return frame(art, h('div', { style: { display: 'flex', flexDirection: 'column', position: 'absolute', left: '64px', bottom: '64px', width: `${TEXT_WIDTH}px` } },
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      ageRing(model.age, model.hue, 172, 3, 74, 20),
      h('div', { style: { display: 'flex', flexDirection: 'column', marginLeft: '30px', flexGrow: 1 } },
        h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 30, lineHeight: 1.25, color: model.hue } }, 'Life milestones'),
        titleLine(model.title, fit([model.title], TEXT_WIDTH - 202, 60, 40)))),
    ...(model.status ? [italicLine(model.status, 34, 30)] : []),
    h('div', { style: { display: 'flex', fontSize: 28, lineHeight: 1.32, color: INK_SOFT, marginTop: model.status ? '6px' : '30px' } }, model.span)));
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

async function renderImage(element: VNode<any>, size: { width: number; height: number } = { width: WIDTH, height: HEIGHT }): Promise<Response> {
  try {
    const { ImageResponse } = await import('@vercel/og');
    const [noto, serif, serifExt, italic, serifRegular, serifCyrillic] = await prepareFonts();
    const rendered = new ImageResponse(element, {
      width: size.width,
      height: size.height,
      headers: PRIVACY_HEADERS,
      fonts: [
        { name: 'Noto', data: noto, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: serif, weight: 500, style: 'normal' },
        { name: 'EB Garamond', data: serifRegular, weight: 400, style: 'normal' },
        { name: 'EB Garamond', data: italic, weight: 400, style: 'italic' },
        { name: 'EB Garamond Ext', data: serifExt, weight: 500, style: 'normal' },
        { name: 'EB Garamond Cyrillic', data: serifCyrillic, weight: 500, style: 'normal' },
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

const pad2 = (value: number) => String(value).padStart(2, '0');
/** The first famous person the site publishes for a birthday's month and day. */
const famousOn = (data: ShareData, share: BirthdayShare) => data.famous.get(`${pad2(share.month)}-${pad2(share.day)}`) ?? null;

const artOfSigns = (signs: readonly PreviewSign[]): ShareArt[] => signs.map((sign) => sign.slug).filter((slug): slug is ShareSign => slug !== null);

async function imageFor(signs: readonly PreviewSign[], art: ShareArt[], draw: (images: Map<ShareSign, string>, art: string[]) => VNode<any>): Promise<Response> {
  const [images, pictures] = await Promise.all([discImages(signs), Promise.all(art.map(artImage))]).catch(() => [null, null] as const);
  if (!images || !pictures) return errorResponse(503);
  return renderImage(draw(images, pictures));
}

export async function handleBirthdayImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseBirthdayShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = birthdayCardModel(share, data.birthdays, famousOn(data, share));
  if (!model) return errorResponse(400);
  return imageFor(model.signs, artOfSigns(model.signs), (images, art) => birthdayCard(model, images, art));
}

export async function handleSkyCalendarImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseSkyCalendarShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = skyCalendarCardModel(share, data.skyEvents);
  if (!model) return errorResponse(400);
  return imageFor([], ['sky-calendar-hero'], (_images, art) => skyCalendarCard(model, art));
}

export async function handleHoroscopeImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseHoroscopeShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = horoscopeCardModel(share, data.horoscopes);
  if (!model) return errorResponse(400);
  return imageFor([model.sign], [share.sign], (images, art) => horoscopeCard(model, images, art));
}

export async function handleChartTwinsImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseChartTwinsShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = chartTwinsCardModel(share, data.people);
  if (!model) return errorResponse(400);
  return imageFor(model.signs, ['twins-hero'], (images, art) => chartTwinsCard(model, images, art));
}

export async function handleFamousChartImageRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseFamousChartShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = famousChartCardModel(share, data.people);
  if (!model) return errorResponse(400);
  return imageFor([model.sign], artOfSigns([model.sign]), (images, art) => famousChartCard(model, images, art));
}

export async function handleMilestoneImageRequest(request: Request, now: () => Date = () => new Date()): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseMilestoneShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = milestoneCardModel(share, now());
  return imageFor([], ['milestones-hero'], (_images, art) => milestoneCard(model, art));
}

// ── Stories (1080×1920) ──────────────────────────────────────────────
//
// The picture to post as a story, in the layouts the owner picked for each
// card on 2026-10-18: Compatibility's score as a trophy (A), the sky
// calendar's event as a quote (B), and the keepsake (C) for a date, a
// birthday and a horoscope. The art runs across the top and fades into the
// void; the lockup sits in a pill under the apps' top bar, and the words end
// above their reply bar, with the way to try it and the site's address.

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_SIZE = { width: STORY_WIDTH, height: STORY_HEIGHT };
/** The art's band: it fades into the void before the words. */
const STORY_ART_HEIGHT = 1200;
/** Where the words end: above Instagram's and TikTok's reply bars. */
const STORY_BOTTOM = 380;
/** The lockup's size on a story, as picked (the 1200×630 images use 20). */
const STORY_LOCKUP = 28;
const STORY_TRACK = 'rgba(198,204,218,0.14)';

/** A 3:2 piece of art drawn `size` wide and centred in its box, its top at `top`, clipped to the art band. */
function storyArtPanel(src: string, box: { left: number; width: number }, size: number, top: number, flip: boolean) {
  const height = Math.round((size * 2) / 3);
  return h('div', { style: { display: 'flex', position: 'absolute', left: `${box.left}px`, top: '0px', width: `${box.width}px`, height: `${STORY_ART_HEIGHT}px`, overflow: 'hidden' } },
    h('img', { src, width: size, height, style: {
      position: 'absolute', left: `${Math.round((box.width - size) / 2)}px`, top: `${top}px`, width: `${size}px`, height: `${height}px`,
      ...(flip ? { transform: 'scaleX(-1)' } : {}),
    } }));
}

const STORY_FADE: readonly (readonly [number, number])[] = [[0, 0.58], [0.2, 0.12], [0.3, 0], [0.56, 0], [0.92, 1]];
const STORY_EDGE: readonly (readonly [number, number])[] = [[0.62, 0], [1, 0.55]];
const storyOverlays = new Map<boolean, string>();

/**
 * The darkening over a story's art, in the void's colour, worked out once
 * per layout like the link previews' (the renderer drops a radial
 * gradient's alpha): a shade under the lockup at the top, the fade into the
 * void from just past halfway down the band, a soft darkening towards the
 * sides, and for a pair the seam where the two panels meet.
 */
function storyOverlay(pair: boolean): string {
  const known = storyOverlays.get(pair);
  if (known) return known;
  const png = new PNG({ width: STORY_WIDTH, height: STORY_ART_HEIGHT });
  const half = STORY_WIDTH / 2;
  const seam = half * 0.16;
  for (let y = 0; y < STORY_ART_HEIGHT; y += 1) {
    const fade = ramp((y + 0.5) / STORY_ART_HEIGHT, STORY_FADE);
    for (let x = 0; x < STORY_WIDTH; x += 1) {
      const px = x + 0.5;
      let clear = (1 - fade) * (1 - ramp(Math.abs(px - half) / half, STORY_EDGE));
      if (pair) clear *= Math.min(1, Math.abs(px - half) / seam);
      const at = (y * STORY_WIDTH + x) * 4;
      png.data[at] = 6;
      png.data[at + 1] = 7;
      png.data[at + 2] = 9;
      png.data[at + 3] = Math.round((1 - clear) * 255);
    }
  }
  const src = `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
  storyOverlays.set(pair, src);
  return src;
}

/** The art across the top: one piece, or two sign panels facing each other. */
function storyArt(images: string[]) {
  const pair = images.length === 2;
  const panels = pair
    ? [storyArtPanel(images[0], { left: 0, width: STORY_WIDTH / 2 }, 1200, 0, true), storyArtPanel(images[1], { left: STORY_WIDTH / 2, width: STORY_WIDTH / 2 }, 1200, 0, false)]
    : [storyArtPanel(images[0], { left: 0, width: STORY_WIDTH }, 1680, 0, false)];
  return [...panels, h('img', { src: storyOverlay(pair), width: STORY_WIDTH, height: STORY_ART_HEIGHT, style: { position: 'absolute', left: '0px', top: '0px', width: `${STORY_WIDTH}px`, height: `${STORY_ART_HEIGHT}px` } })];
}

/** The lockup in its pill, centred under the apps' top bar. */
function storyLockup(front: ShareSign | null) {
  return h('div', { style: { display: 'flex', position: 'absolute', left: '0px', top: '296px', width: `${STORY_WIDTH}px`, justifyContent: 'center' } },
    h('div', { style: { display: 'flex', padding: '18px 30px', borderRadius: '999px', background: 'rgba(15,18,26,0.82)', border: `1px solid ${HAIRLINE}` } },
      lockupImage(STORY_LOCKUP, { name: INK, dot: CARD_MUTED, tld: INK_SOFT }, front)));
}

/** The pastel discs, each once, side by side. */
function storyDiscs(signs: readonly PreviewSign[], images: Map<ShareSign, string>, size = 100) {
  const sources = [...new Set(signs.map((sign) => (sign.slug ? images.get(sign.slug) : undefined)).filter((src): src is string => !!src))];
  return sources.length === 0 ? [] : [h('div', { style: { display: 'flex', marginBottom: '22px' } },
    ...sources.map((src, index) => h('img', { src, width: size, height: size, style: { width: `${size}px`, height: `${size}px`, marginLeft: index === 0 ? '0px' : '14px' } })))];
}

/** The site's text-link arrow, drawn: the renderer's fonts carry no arrow, and it would fetch one. */
const storyArrow = () => h('svg', { width: 30, height: 20, viewBox: '0 0 30 20', style: { marginLeft: '14px' } },
  h('path', { d: 'M1 10H27M19 2L27 10L19 18', fill: 'none', stroke: INK, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

/** The way to try it, and the address a viewer can type. */
function storyAction(label: string, address: string, align: 'center' | 'flex-start' = 'center') {
  return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: align, marginTop: '52px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 36, color: INK, paddingBottom: '8px', borderBottom: `2px solid ${HAIRLINE}` } }, label, storyArrow()),
    h('div', { style: { display: 'flex', fontSize: 30, color: MUTED, marginTop: '12px' } }, address));
}

/** A display size that keeps the longest line inside the story's column. */
const storyFit = (lines: string[], max: number, min: number) => fit(lines, STORY_WIDTH - 144, max, min);

const storyKicker = (text: string, hue: string, size = 46) =>
  h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: size, lineHeight: 1.25, color: hue, textAlign: 'center' } }, text);

const storyTitle = (text: string, size: number, align: 'center' | 'left' = 'center') =>
  h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1.04, color: INK, textAlign: align, textWrap: 'balance', justifyContent: align === 'center' ? 'center' : 'flex-start' } }, text);

const storyLine = (text: string | VNode<any>[], size = 40, align: 'center' | 'left' = 'center') =>
  h('div', { style: { display: 'flex', fontSize: size, lineHeight: 1.38, color: INK_SOFT, marginTop: '24px', maxWidth: '880px', textAlign: align, textWrap: 'balance', justifyContent: align === 'center' ? 'center' : 'flex-start' } }, ...(typeof text === 'string' ? [text] : text));

/** The words' column, ending above the reply bar. */
function storyColumn(children: VNode<any>[], align: 'center' | 'flex-start' = 'center') {
  return h('div', { style: {
      display: 'flex', flexDirection: 'column', position: 'absolute', left: '72px', right: '72px', top: '560px', bottom: `${STORY_BOTTOM}px`,
      justifyContent: 'flex-end', alignItems: align,
    } }, ...children);
}

function storyFrame(art: string[], column: VNode<any>, front: ShareSign | null = null) {
  return h('div', { style: {
      width: `${STORY_WIDTH}px`, height: `${STORY_HEIGHT}px`, display: 'flex', position: 'relative', background: VOID, color: INK, fontFamily: 'Noto',
    } },
    ...storyArt(art),
    storyLockup(front),
    column);
}

/** A score ring: the track, the arc in the two hues, the number and "out of 100". */
function storyRing(score: number, hues: [string, string], size: number, stroke: number, numberSize: number, labelSize: number) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = Math.max(0.001, (score / 100) * circumference);
  const centre = size / 2;
  return h('div', { style: { display: 'flex', position: 'relative', width: `${size}px`, height: `${size}px`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
    h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { position: 'absolute', top: 0, left: 0 } },
      h('defs', null,
        h('linearGradient', { id: 'story-arc', x1: '1', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0', 'stop-color': hues[0] }),
          h('stop', { offset: '1', 'stop-color': hues[1] }))),
      h('circle', { cx: centre, cy: centre, r: radius, fill: 'rgba(6,7,9,0.72)', stroke: STORY_TRACK, 'stroke-width': stroke }),
      h('circle', {
        cx: centre, cy: centre, r: radius, fill: 'none', stroke: 'url(#story-arc)', 'stroke-width': stroke,
        'stroke-linecap': 'round', 'stroke-dasharray': `${arc.toFixed(2)} ${circumference.toFixed(2)}`,
        transform: `rotate(-90 ${centre} ${centre})`,
      })),
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: numberSize, lineHeight: 1, color: INK } }, String(score)),
      h('div', { style: { display: 'flex', fontSize: labelSize, color: MUTED, marginTop: `${Math.round(numberSize * 0.06)}px` } }, 'out of 100')));
}

/** Compatibility (A, the score as a trophy): both panels, the discs, the ring, the verdict and the two names. */
export function compatibilityStory(model: CompatibilityCardModel, images: Map<ShareSign, string>, art: string[]) {
  const nameSize = storyFit([`${model.first} and ${model.second}`], 96, 56);
  const areas = model.areas.map((area, index) => `${index === 0 ? area.label : area.label.toLowerCase()} ${area.value}`).join(', ');
  return storyFrame(art, storyColumn([
    ...storyDiscs(model.people, images),
    storyRing(model.score, model.ring, 400, 22, 168, 34),
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 50, lineHeight: 1.2, color: INK_SOFT, marginTop: '30px', textAlign: 'center' } }, model.verdict),
    h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', fontFamily: SERIF, fontWeight: 500, fontSize: nameSize, lineHeight: 1.05, color: INK, marginTop: '6px' } },
      model.first,
      h('span', { style: { fontStyle: 'italic', fontWeight: 400, color: INK_SOFT, marginLeft: `${Math.round(nameSize * 0.26)}px`, marginRight: `${Math.round(nameSize * 0.26)}px` } }, 'and'),
      model.second),
    storyLine(`${areas}.`, 36),
    storyAction('Check your own compatibility', 'zodiacs.org/compatibility'),
  ]), model.people[0].slug);
}

/** A date (C, the keepsake): the wedding piece or the Sun's panel, the names, and the score kept small. */
export function occasionStory(model: OccasionCardModel, images: Map<ShareSign, string>, art: string[]) {
  const title = model.names ?? model.headline;
  return storyFrame(art, storyColumn([
    ...storyDiscs(model.signs, images),
    storyKicker(model.names ? model.headline : 'The sky on the day', model.ring[0]),
    storyTitle(title, storyFit([title], 110, 64)),
    h('div', { style: { display: 'flex', alignItems: 'center', marginTop: '34px' } },
      storyRing(model.score, model.ring, 150, 10, 56, 17),
      h('div', { style: { display: 'flex', fontSize: 40, lineHeight: 1.25, color: INK, marginLeft: '28px', maxWidth: '560px' } }, model.verdict)),
    storyLine(model.when, 34),
    storyAction('Rate your own date', 'zodiacs.org/occasions'),
  ]));
}

/** A birthday (C, the keepsake): its sign's panel, or a cusp date's two signs facing each other. */
export function birthdayStory(model: BirthdayCardModel, images: Map<ShareSign, string>, art: string[]) {
  return storyFrame(art, storyColumn([
    ...storyDiscs(model.signs, images),
    storyKicker('A birthday', model.hue),
    storyTitle(model.title, storyFit([model.title], 112, 64)),
    storyLine(model.line),
    storyAction('Find your own birthday', 'zodiacs.org/birthday'),
  ]), model.signs.length === 1 ? model.signs[0].slug : null);
}

/** The sky calendar (B, the event as a quote): the Sky dial, the event in large italic, and what the calendar is. */
export function skyCalendarStory(model: SkyCalendarCardModel, art: string[]) {
  return storyFrame(art, storyColumn([
    storyKicker('Sky calendar', HUES.scorpio),
    h('div', { style: { display: 'flex', marginTop: '22px', paddingLeft: '36px', borderLeft: `3px solid ${HUES.scorpio}` } },
      h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 78, lineHeight: 1.12, color: INK, maxWidth: '860px' } }, model.line)),
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: 52, lineHeight: 1.1, color: INK, marginTop: '56px' } }, 'The sky in your calendar'),
    h('div', { style: { display: 'flex', fontSize: 34, color: MUTED, marginTop: '10px' } }, model.span),
    storyAction('Add it to your calendar', 'zodiacs.org/sky-calendar', 'flex-start'),
  ], 'flex-start'));
}

/** A horoscope (C, the keepsake): the sign's panel, the day or week, the sign and the reading's own line. */
export function horoscopeStory(model: HoroscopeCardModel, images: Map<ShareSign, string>, art: string[]) {
  return storyFrame(art, storyColumn([
    ...storyDiscs([model.sign], images),
    storyKicker(model.kicker, model.hue),
    storyTitle(model.signName, storyFit([model.signName], 124, 72)),
    storyLine(model.line),
    storyAction('Read your own horoscope', 'zodiacs.org/horoscopes'),
  ]), model.sign.slug);
}

/** Chart twins (C, the keepsake): the cameos, the discs, the first twin and how many share the signs. */
export function chartTwinsStory(model: ChartTwinsCardModel, images: Map<ShareSign, string>, art: string[]) {
  return storyFrame(art, storyColumn([
    ...storyDiscs(model.signs, images),
    storyKicker('Chart twins', model.hue),
    storyTitle(model.quote, storyFit([model.quote], 100, 60)),
    storyLine(`${model.count}.`),
    storyAction('Find your chart twins', 'zodiacs.org/chart-twins'),
  ]), model.sun);
}

/** A famous chart (A, the name as a trophy): the Sun sign's panel, the disc, the name large, the Sun's degree and who they were. */
export function famousChartStory(model: FamousChartCardModel, images: Map<ShareSign, string>, art: string[]) {
  return storyFrame(art, storyColumn([
    ...storyDiscs([model.sign], images),
    storyTitle(model.name, storyFit([model.name], 132, 72)),
    h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 52, lineHeight: 1.2, color: INK_SOFT, marginTop: '28px' } }, model.sunLine),
    storyLine(commaLine(`${model.born}.`)),
    storyAction(`Open ${model.name}’s chart`, `zodiacs.org/people/${model.slug}`),
  ]), model.sign.slug);
}

/** A life milestone (C, the keepsake): the hourglass, the milestone, and the age kept small beside whether it is coming and its dates. */
export function milestoneStory(model: MilestoneCardModel, art: string[]) {
  return storyFrame(art, storyColumn([
    storyKicker('Life milestones', model.hue),
    storyTitle(model.title, storyFit([model.title], 112, 64)),
    h('div', { style: { display: 'flex', alignItems: 'center', marginTop: '40px', padding: '18px 40px 18px 18px', borderRadius: '999px', background: 'rgba(15,18,26,0.82)', border: `1px solid ${HAIRLINE}` } },
      ageRing(model.age, model.hue, 176, 3, 76, 22),
      h('div', { style: { display: 'flex', flexDirection: 'column', marginLeft: '30px', maxWidth: '560px' } },
        ...(model.status ? [h('div', { style: { display: 'flex', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 44, lineHeight: 1.2, color: INK } }, model.status)] : []),
        h('div', { style: { display: 'flex', fontSize: 34, lineHeight: 1.3, color: INK_SOFT, marginTop: model.status ? '8px' : '0px' } }, model.span))),
    storyAction('When is yours?', 'zodiacs.org/occasions/milestones'),
  ]));
}

const renderStory = (element: VNode<any>) => renderImage(element, STORY_SIZE);

export async function handleCompatibilityStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseCompatibilityShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = compatibilityCardModel(share);
  const [images, art] = await Promise.all([discImages(model.people), Promise.all(compatibilityArt(share).map(artImage))]).catch(() => [null, null] as const);
  if (!images || !art) return errorResponse(503);
  return renderStory(compatibilityStory(model, images, art));
}

export async function handleOccasionStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseOccasionShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = occasionCardModel(share);
  const [images, art] = await Promise.all([discImages(model.signs), Promise.all(occasionArt(share).map(artImage))]).catch(() => [null, null] as const);
  if (!images || !art) return errorResponse(503);
  return renderStory(occasionStory(model, images, art));
}

async function storyFor(signs: readonly PreviewSign[], art: ShareArt[], draw: (images: Map<ShareSign, string>, art: string[]) => VNode<any>): Promise<Response> {
  const [images, pictures] = await Promise.all([discImages(signs), Promise.all(art.map(artImage))]).catch(() => [null, null] as const);
  if (!images || !pictures) return errorResponse(503);
  return renderStory(draw(images, pictures));
}

export async function handleBirthdayStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseBirthdayShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = birthdayCardModel(share, data.birthdays, famousOn(data, share));
  if (!model) return errorResponse(400);
  return storyFor(model.signs, artOfSigns(model.signs), (images, art) => birthdayStory(model, images, art));
}

export async function handleSkyCalendarStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseSkyCalendarShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = skyCalendarCardModel(share, data.skyEvents);
  if (!model) return errorResponse(400);
  return storyFor([], ['sky-calendar-hero'], (_images, art) => skyCalendarStory(model, art));
}

export async function handleHoroscopeStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseHoroscopeShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = horoscopeCardModel(share, data.horoscopes);
  if (!model) return errorResponse(400);
  return storyFor([model.sign], [share.sign], (images, art) => horoscopeStory(model, images, art));
}

export async function handleChartTwinsStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseChartTwinsShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = chartTwinsCardModel(share, data.people);
  if (!model) return errorResponse(400);
  return storyFor(model.signs, ['twins-hero'], (images, art) => chartTwinsStory(model, images, art));
}

export async function handleFamousChartStoryRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseFamousChartShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const data = await loadShareData().catch(() => null);
  if (!data) return errorResponse(503);
  const model = famousChartCardModel(share, data.people);
  if (!model) return errorResponse(400);
  return storyFor([model.sign], artOfSigns([model.sign]), (images, art) => famousChartStory(model, images, art));
}

export async function handleMilestoneStoryRequest(request: Request, now: () => Date = () => new Date()): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const share = parseMilestoneShare(new URL(request.url).searchParams);
  if (!share) return errorResponse(400);
  const model = milestoneCardModel(share, now());
  return storyFor([], ['milestones-hero'], (_images, art) => milestoneStory(model, art));
}

// ── The page a share link opens ──────────────────────────────────────

const PAGE_STYLE = `@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Instrument Sans";src:url(/fonts/instrument-sans-latin-wght-normal.woff2) format("woff2");font-weight:400 700;font-display:swap}
@font-face{font-family:"EB Garamond";src:url(/fonts/eb-garamond-cyrillic-500-normal.woff2) format("woff2");font-weight:500;font-display:swap;unicode-range:U+0400-045F,U+0490-0491}
@font-face{font-family:"Instrument Sans";src:url(/fonts/golos-text-cyr-a.woff2) format("woff2");font-weight:400 600;font-display:swap;unicode-range:U+0400-04FF}
:root{color-scheme:dark;--void:${VOID};--ink:${INK};--ink-2:${INK_SOFT};--muted:${MUTED};--hairline:${HAIRLINE}}
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
.cta:focus-visible,.more:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.more{display:inline-block;margin:26px 0 0 22px;color:var(--ink);text-decoration:underline;text-decoration-color:var(--muted);text-underline-offset:4px}
@media (max-width:480px){.more{display:block;width:fit-content;margin:18px 0 0}}
.story{margin:22px 0 0;font-size:15px}
.story a{color:var(--ink-2);text-decoration:underline;text-decoration-color:var(--muted);text-underline-offset:4px}
.story a:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.note{margin:22px 0 0;color:var(--muted);font-size:15px}`;

const STYLE_NONCE = 'share-preview';

/** The brand lockup's tilted mark at the nav's 13px (34 by 19), drawn inline: the page loads no image for it. */
const LOCKUP_SVG = tiltedRingSvg({ width: 34 });

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
  /** A second, quieter link beside the action, such as a famous birthday's chart. */
  more?: { label: string; href: string };
  /** The 1080×1920 picture of the same result, to save and post as a story. */
  story?: { href: string; filename: string };
  note: string;
}

export function sharePageHtml(page: SharePage): string {
  const e = htmlEscape;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${e(page.title)}</title><meta name="description" content="${e(page.description)}"><meta property="og:site_name" content="Zodiacs"><meta property="og:title" content="${e(page.title)}"><meta property="og:description" content="${e(page.description)}"><meta property="og:type" content="website"><meta property="og:image" content="${e(page.imageUrl)}"><meta property="og:image:type" content="${page.imageType}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(page.imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(page.title)}"><meta name="twitter:description" content="${e(page.description)}"><meta name="twitter:image" content="${e(page.imageUrl)}"><meta name="twitter:image:alt" content="${e(page.imageAlt)}"><link rel="icon" href="/assets/app-icons/v3/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site-footer.css?v=20261006"><style nonce="${STYLE_NONCE}">${PAGE_STYLE}</style></head><body><main><a class="brand" href="/" aria-label="Zodiacs.org">${LOCKUP_SVG}<span class="brand-name" aria-hidden="true">Zodiacs<span class="brand-sep">·</span><span class="brand-tld">org</span></span></a><h1>${e(page.heading)}</h1><img class="card" src="${e(page.imageUrl)}" width="1200" height="630" alt="${e(page.imageAlt)}"><p class="lede">${e(page.explanation)}</p><a class="cta" href="${e(page.action.href)}">${e(page.action.label)}</a>${page.more ? `<a class="more" href="${e(page.more.href)}">${e(page.more.label)}</a>` : ''}${page.story ? `<p class="story"><a href="${e(page.story.href)}" download="${e(page.story.filename)}">Save the picture for your story</a></p>` : ''}<p class="note">${e(page.note)}</p></main><footer class="zfooter zfooter--compact"><span>Zodiacs.org</span><nav aria-label="Zodiacs"><a href="/">Astrology</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav></footer></body></html>`;
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

/** The birthday tool's note (src/ai-tools/features/birthday.ts), which the share page keeps. */
const BIRTHDAY_NOTE = 'Facts about the Sun on this date and their traditional meanings.';
const SKY_CALENDAR_NOTE = 'A public feed of computed sky events; it takes no personal details.';
const SKY_CALENDAR_ABOUT = 'Zodiacs’ sky calendar puts new and full Moons, eclipses and retrograde periods in Google Calendar, Apple Calendar or Outlook, and keeps them up to date.';

function defaultBirthdayPage(origin: string): SharePage {
  return {
    title: 'Birthdays on Zodiacs',
    description: 'The Sun’s sign on every birthday, with its decan and the cusp dates where the sign depends on the year.',
    heading: 'The sky on every birthday',
    imageUrl: `${origin}/assets/og/v2/tool/birthday.png`,
    imageType: 'image/png',
    imageAlt: 'Birthdays on Zodiacs',
    explanation: 'Zodiacs gives the Sun’s sign for every date of the year, its traditional meaning and decan, and says when a date sits on a cusp.',
    action: { label: 'Find your own birthday', href: '/birthday/' },
    note: BIRTHDAY_NOTE,
  };
}

function defaultSkyCalendarPage(origin: string): SharePage {
  return {
    title: 'The sky calendar on Zodiacs',
    description: 'New and full Moons, eclipses and retrograde periods in your calendar app, kept up to date.',
    heading: 'The sky in your calendar',
    imageUrl: `${origin}/assets/og/v2/tool/sky-calendar.png`,
    imageType: 'image/png',
    imageAlt: 'The sky calendar on Zodiacs',
    explanation: SKY_CALENDAR_ABOUT,
    action: { label: 'Add it to your calendar', href: '/sky-calendar/' },
    note: SKY_CALENDAR_NOTE,
  };
}

function defaultHoroscopePage(origin: string): SharePage {
  return {
    title: 'Horoscopes on Zodiacs',
    description: 'A horoscope for each Sun sign every day, written from that day’s sky.',
    heading: 'Today’s horoscopes',
    imageUrl: `${origin}/assets/og/v2/tool/horoscopes.png`,
    imageType: 'image/png',
    imageAlt: 'Horoscopes on Zodiacs',
    explanation: 'Zodiacs writes a horoscope for each Sun sign every day, from that day’s sky.',
    action: { label: 'Read your own horoscope', href: '/horoscopes/' },
    note: HOROSCOPE_DISCLOSURE,
  };
}

export async function handleBirthdayLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseBirthdayShare(url.searchParams);
  const data = share ? await loadShareData().catch(() => null) : null;
  const model = share && data ? birthdayCardModel(share, data.birthdays, famousOn(data, share)) : null;
  if (!share || !model) return htmlResponse(sharePageHtml(defaultBirthdayPage(url.origin)));
  return htmlResponse(sharePageHtml({
    title: `${model.title}: ${model.line} on Zodiacs`,
    description: model.about,
    heading: model.title,
    imageUrl: `${url.origin}${BIRTHDAY_SHARE_IMAGE_PATH}?${birthdayQuery(share)}`,
    story: { href: `${BIRTHDAY_SHARE_STORY_PATH}?${birthdayQuery(share)}`, filename: `zodiacs-${model.slug}-birthday-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `${model.title}: ${model.line}.`,
    explanation: model.about,
    action: { label: 'Find your own birthday', href: withRef('/birthday/', share.ref) },
    ...(model.famous ? { more: { label: `${model.famous.name}’s chart`, href: withRef(`/people/${model.famous.slug}/`, share.ref) } } : {}),
    note: BIRTHDAY_NOTE,
  }));
}

export async function handleSkyCalendarLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseSkyCalendarShare(url.searchParams);
  const model = share ? skyCalendarCardModel(share, (await loadShareData().catch(() => null))?.skyEvents ?? []) : null;
  if (!share || !model) return htmlResponse(sharePageHtml(defaultSkyCalendarPage(url.origin)));
  return htmlResponse(sharePageHtml({
    title: `${model.title}, ${model.span}: the sky calendar on Zodiacs`,
    description: `${model.title}: ${model.spanLong}. New and full Moons, eclipses and retrograde periods in your calendar app.`,
    heading: 'The sky in your calendar',
    imageUrl: `${url.origin}${SKY_CALENDAR_SHARE_IMAGE_PATH}?${skyCalendarQuery(share)}`,
    story: { href: `${SKY_CALENDAR_SHARE_STORY_PATH}?${skyCalendarQuery(share)}`, filename: 'zodiacs-sky-calendar-story.jpg' },
    imageType: 'image/jpeg',
    imageAlt: `The sky in your calendar: ${model.title}, ${model.spanLong}.`,
    explanation: `${model.title}: ${model.spanLong}. ${SKY_CALENDAR_ABOUT}`,
    action: { label: 'Add it to your calendar', href: withRef('/sky-calendar/', share.ref) },
    note: SKY_CALENDAR_NOTE,
  }));
}

export async function handleHoroscopeLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseHoroscopeShare(url.searchParams);
  const data = share ? await loadShareData().catch(() => null) : null;
  const model = share && data ? horoscopeCardModel(share, data.horoscopes) : null;
  if (!share || !model) return htmlResponse(sharePageHtml(defaultHoroscopePage(url.origin)));
  return htmlResponse(sharePageHtml({
    title: `${model.heading} on Zodiacs`,
    // A reading no longer kept here still names its sign and the sign's dates.
    description: model.passage ? model.line : `${model.signName}, ${model.line}. Zodiacs writes a horoscope for each Sun sign every day.`,
    heading: model.heading,
    imageUrl: `${url.origin}${HOROSCOPE_SHARE_IMAGE_PATH}?${horoscopeQuery(share)}`,
    story: { href: `${HOROSCOPE_SHARE_STORY_PATH}?${horoscopeQuery(share)}`, filename: `zodiacs-${share.sign}-horoscope-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `${model.heading}: ${model.line}`,
    explanation: model.passage ?? 'Zodiacs writes a horoscope for each Sun sign every day, from that day’s sky. This one is no longer kept here; today’s are on zodiacs.org.',
    action: { label: 'Read your own horoscope', href: withRef('/horoscopes/', share.ref) },
    note: HOROSCOPE_DISCLOSURE,
  }));
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
    story: { href: `${COMPATIBILITY_SHARE_STORY_PATH}?${compatibilityQuery(share)}`, filename: 'zodiacs-compatibility-story.jpg' },
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
    story: { href: `${OCCASION_SHARE_STORY_PATH}?${occasionQuery(share)}`, filename: `zodiacs-${share.occasion}-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `${model.headline}, ${model.when}: ${model.score} out of 100. ${model.verdict}.`,
    explanation: `Zodiacs rated this date ${model.score} out of 100 from the sky that day: the Moon’s phase and sign, Venus, and any planets in retrograde.`,
    action: { label: 'Rate your own date', href: withRef('/occasions/', share.ref) },
    note: SHARE_NOTE,
  }));
}

/** The chart twins tool's note (src/ai-tools/features/people.ts, TWINS_NOTES.limit), which the share page keeps. */
const TWINS_NOTE = 'Birth times in this directory are unknown, so we compare verified Sun and Moon signs only. Rising signs are not compared.';
const TWINS_ABOUT = 'Zodiacs matches the famous people it publishes by the Sun and Moon signs they were born with.';
/** The milestones tool's note (src/ai-tools/contracts.ts), which the share page keeps. */
const MILESTONE_NOTE = 'Dates of computed crossings and their traditional astrological names. Without a birth time, a pass can move by about a day.';
/** The people page's caption for the noon reference chart (src/ai-tools/features/people.ts, noonChartNote), in plain punctuation. */
const noonNote = (birthplace: string) => `Positions at 12:00 civil time in ${birthplace}, a reference instant, not a birth time. No houses, rising sign, angles, or sect were computed.`;

function defaultChartTwinsPage(origin: string): SharePage {
  return {
    title: 'Chart twins on Zodiacs',
    description: 'Famous people who share your Sun or Moon sign.',
    heading: 'Famous people with your signs',
    imageUrl: `${origin}/assets/og/v2/tool/chart-twins.png`,
    imageType: 'image/png',
    imageAlt: 'Chart twins on Zodiacs',
    explanation: TWINS_ABOUT,
    action: { label: 'Find your chart twins', href: '/chart-twins/' },
    note: TWINS_NOTE,
  };
}

function defaultFamousChartPage(origin: string): SharePage {
  return {
    title: 'Famous birth charts on Zodiacs',
    description: 'The birth charts of famous people, from the dates they were born.',
    heading: 'Famous birth charts',
    imageUrl: `${origin}/assets/og/v2/share.png`,
    imageType: 'image/png',
    imageAlt: 'Zodiacs',
    explanation: 'Zodiacs publishes the birth charts of famous people, from the dates they were born.',
    action: { label: 'See the people Zodiacs publishes', href: '/people/' },
    note: SHARE_NOTE,
  };
}

function defaultMilestonePage(origin: string): SharePage {
  return {
    title: 'Life milestones on Zodiacs',
    description: 'When your Saturn return, Jupiter returns and Uranus opposition come.',
    heading: 'Your sky milestones',
    imageUrl: `${origin}/assets/og/v2/tool/saturn-return.png`,
    imageType: 'image/png',
    imageAlt: 'Life milestones on Zodiacs',
    explanation: 'Zodiacs works out when Saturn and Jupiter come back to where they were at your birth, and when Uranus stands opposite.',
    action: { label: 'Find your own milestones', href: '/occasions/milestones/' },
    note: MILESTONE_NOTE,
  };
}

export async function handleChartTwinsLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseChartTwinsShare(url.searchParams);
  const data = share ? await loadShareData().catch(() => null) : null;
  const model = share && data ? chartTwinsCardModel(share, data.people) : null;
  if (!share || !model) return htmlResponse(sharePageHtml(defaultChartTwinsPage(url.origin)));
  return htmlResponse(sharePageHtml({
    title: `${model.quote}: chart twins on Zodiacs`,
    description: `${model.count}. ${TWINS_ABOUT}`,
    heading: model.quote,
    imageUrl: `${url.origin}${CHART_TWINS_SHARE_IMAGE_PATH}?${chartTwinsQuery(share)}`,
    story: { href: `${CHART_TWINS_SHARE_STORY_PATH}?${chartTwinsQuery(share)}`, filename: `zodiacs-chart-twins-${share.sun}-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `Chart twins: ${model.quote}. ${model.count}.`,
    explanation: `${model.count}. ${TWINS_ABOUT}`,
    action: { label: 'Find your chart twins', href: withRef('/chart-twins/', share.ref) },
    more: { label: `${model.first.name}’s chart`, href: withRef(`/people/${model.first.slug}/`, share.ref) },
    note: TWINS_NOTE,
  }));
}

export async function handleFamousChartLinkRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseFamousChartShare(url.searchParams);
  const data = share ? await loadShareData().catch(() => null) : null;
  const model = share && data ? famousChartCardModel(share, data.people) : null;
  const person = model && data ? data.people.find((candidate) => candidate.slug === model.slug) : null;
  if ((url.searchParams.has('p') && !share) || (share && data && (!model || !person))) return errorResponse(404);
  if (!share || !model || !person) return htmlResponse(sharePageHtml(defaultFamousChartPage(url.origin)));
  return htmlResponse(sharePageHtml({
    title: `${model.name}’s birth chart on Zodiacs`,
    description: `${model.sunLine}. ${model.bornIn}.`,
    heading: model.name,
    imageUrl: `${url.origin}${FAMOUS_CHART_SHARE_IMAGE_PATH}?${famousChartQuery(share)}`,
    story: { href: `${FAMOUS_CHART_SHARE_STORY_PATH}?${famousChartQuery(share)}`, filename: `zodiacs-${model.slug}-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `A famous birth chart: ${model.name}, ${model.sunLine}.`,
    explanation: `${model.sunLine}. ${model.lede}`,
    action: { label: `Open ${model.name}’s chart`, href: withRef(`/people/${model.slug}/`, share.ref) },
    more: { label: 'Find your chart twins', href: withRef('/chart-twins/', share.ref) },
    note: noonNote(person.birthplace),
  }));
}

export async function handleMilestoneLinkRequest(request: Request, now: () => Date = () => new Date()): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405);
  const url = new URL(request.url);
  const share = parseMilestoneShare(url.searchParams);
  if (!share) return htmlResponse(sharePageHtml(defaultMilestonePage(url.origin)));
  const model = milestoneCardModel(share, now());
  const when = model.status ? `${model.status}: ${model.span}` : model.span;
  return htmlResponse(sharePageHtml({
    title: `${model.heading}: life milestones on Zodiacs`,
    description: `${when}. ${model.about}`,
    heading: model.heading,
    imageUrl: `${url.origin}${MILESTONE_SHARE_IMAGE_PATH}?${milestoneQuery(share)}`,
    story: { href: `${MILESTONE_SHARE_STORY_PATH}?${milestoneQuery(share)}`, filename: `zodiacs-${share.kind}-${share.index}-story.jpg` },
    imageType: 'image/jpeg',
    imageAlt: `${model.heading}. ${when}.`,
    explanation: `${when}. ${model.about}`,
    action: { label: 'Find your own milestones', href: withRef('/occasions/milestones/', share.ref) },
    note: MILESTONE_NOTE,
  }));
}

// ── The deployed function's entry ────────────────────────────────────

const ROUTES: Readonly<Record<ResultShareRoute, { path: string; keys: readonly string[]; handle: (request: Request) => Promise<Response> }>> = {
  'compatibility-link': { path: COMPATIBILITY_SHARE_PATH, keys: COMPATIBILITY_SHARE_KEYS, handle: handleCompatibilityLinkRequest },
  'compatibility-image': { path: COMPATIBILITY_SHARE_IMAGE_PATH, keys: COMPATIBILITY_SHARE_KEYS, handle: handleCompatibilityImageRequest },
  'occasion-link': { path: OCCASION_SHARE_PATH, keys: OCCASION_SHARE_KEYS, handle: handleOccasionLinkRequest },
  'occasion-image': { path: OCCASION_SHARE_IMAGE_PATH, keys: OCCASION_SHARE_KEYS, handle: handleOccasionImageRequest },
  'birthday-link': { path: BIRTHDAY_SHARE_PATH, keys: BIRTHDAY_SHARE_KEYS, handle: handleBirthdayLinkRequest },
  'birthday-image': { path: BIRTHDAY_SHARE_IMAGE_PATH, keys: BIRTHDAY_SHARE_KEYS, handle: handleBirthdayImageRequest },
  'sky-calendar-link': { path: SKY_CALENDAR_SHARE_PATH, keys: SKY_CALENDAR_SHARE_KEYS, handle: handleSkyCalendarLinkRequest },
  'sky-calendar-image': { path: SKY_CALENDAR_SHARE_IMAGE_PATH, keys: SKY_CALENDAR_SHARE_KEYS, handle: handleSkyCalendarImageRequest },
  'horoscope-link': { path: HOROSCOPE_SHARE_PATH, keys: HOROSCOPE_SHARE_KEYS, handle: handleHoroscopeLinkRequest },
  'horoscope-image': { path: HOROSCOPE_SHARE_IMAGE_PATH, keys: HOROSCOPE_SHARE_KEYS, handle: handleHoroscopeImageRequest },
  'compatibility-story': { path: COMPATIBILITY_SHARE_STORY_PATH, keys: COMPATIBILITY_SHARE_KEYS, handle: handleCompatibilityStoryRequest },
  'occasion-story': { path: OCCASION_SHARE_STORY_PATH, keys: OCCASION_SHARE_KEYS, handle: handleOccasionStoryRequest },
  'birthday-story': { path: BIRTHDAY_SHARE_STORY_PATH, keys: BIRTHDAY_SHARE_KEYS, handle: handleBirthdayStoryRequest },
  'sky-calendar-story': { path: SKY_CALENDAR_SHARE_STORY_PATH, keys: SKY_CALENDAR_SHARE_KEYS, handle: handleSkyCalendarStoryRequest },
  'horoscope-story': { path: HOROSCOPE_SHARE_STORY_PATH, keys: HOROSCOPE_SHARE_KEYS, handle: handleHoroscopeStoryRequest },
  'chart-twins-link': { path: CHART_TWINS_SHARE_PATH, keys: CHART_TWINS_SHARE_KEYS, handle: handleChartTwinsLinkRequest },
  'chart-twins-image': { path: CHART_TWINS_SHARE_IMAGE_PATH, keys: CHART_TWINS_SHARE_KEYS, handle: handleChartTwinsImageRequest },
  'chart-twins-story': { path: CHART_TWINS_SHARE_STORY_PATH, keys: CHART_TWINS_SHARE_KEYS, handle: handleChartTwinsStoryRequest },
  'famous-chart-link': { path: FAMOUS_CHART_SHARE_PATH, keys: FAMOUS_CHART_SHARE_KEYS, handle: handleFamousChartLinkRequest },
  'famous-chart-image': { path: FAMOUS_CHART_SHARE_IMAGE_PATH, keys: FAMOUS_CHART_SHARE_KEYS, handle: handleFamousChartImageRequest },
  'famous-chart-story': { path: FAMOUS_CHART_SHARE_STORY_PATH, keys: FAMOUS_CHART_SHARE_KEYS, handle: handleFamousChartStoryRequest },
  'milestone-link': { path: MILESTONE_SHARE_PATH, keys: MILESTONE_SHARE_KEYS, handle: (request) => handleMilestoneLinkRequest(request) },
  'milestone-image': { path: MILESTONE_SHARE_IMAGE_PATH, keys: MILESTONE_SHARE_KEYS, handle: (request) => handleMilestoneImageRequest(request) },
  'milestone-story': { path: MILESTONE_SHARE_STORY_PATH, keys: MILESTONE_SHARE_KEYS, handle: (request) => handleMilestoneStoryRequest(request) },
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
    if (!target.keys.includes(key) && !isPictureRoute(route)) continue;
    if (!target.keys.includes(key) || typeof value !== 'string') {
      // A repeated key, or an unknown key on the image: the image refuses, the page opens without a result.
      if (isPictureRoute(route)) {
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
