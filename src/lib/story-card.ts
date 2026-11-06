/**
 * Story cards: 1080 x 1920 vertical images for Instagram and TikTok stories,
 * drawn on the visitor's device in the Cosmic Void style (void ground, the
 * pastel sign hues as the only colour, EB Garamond names, the brand lockup).
 *
 * This module holds what every story card shares, and the sign-season card.
 * It loads no chart renderer, so a season page can make its card without
 * the birth-chart code; the big three story card lives in
 * big-three-story-card.ts and draws through the same pieces.
 *
 * Instagram and TikTok lay their own controls over the top and bottom of a
 * story, so everything that must be read sits between STORY_SAFE.top and
 * STORY_SAFE.bottom.
 */
import { SIGNS, signBySlug } from './signs';
import {
  drawShareBrandLockup,
  shareBrandLockupWidth,
  withShareBrandIcon,
} from './share-card-brand';
import type { PreparedChartCard } from './share-card-save';

export const STORY_W = 1080;
export const STORY_H = 1920;
export const STORY_SAFE = Object.freeze({ top: 250, bottom: 1700 });

export const STORY_INK_0 = '#EEF1F7';
export const STORY_INK_1 = '#C6CCDA';
export const STORY_INK_2 = '#8E96AB';
export const STORY_HAIR = 'rgba(198, 204, 218, 0.14)';
const STORY_VOID = '#060709';
export const STORY_SERIF = '"EB Garamond", Georgia, serif';
export const STORY_MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

/** The lockup's type size on a story card and the line it centres on. */
export const STORY_LOCKUP = Object.freeze({ fontSize: 34, centerY: 1640 });

/** The file name a big three story card is saved under: it names nothing about the person. */
export const BIG_THREE_STORY_FILENAME = 'zodiacs-big-three-story.png';

/** A season card's file name: the season's sign, which the page already names, and nothing else. */
export function seasonStoryFilename(slug: string): string {
  if (!SIGNS.some((sign) => sign.slug === slug)) throw new Error(`unknown sign ${slug}`);
  return `zodiacs-${slug}-season.png`;
}

/** A small deterministic generator, so a card always gets the same sky. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A fresh story canvas with its 2D context. */
export function storyCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  return { canvas, ctx };
}

/**
 * The void ground: a sparse field of faint stars (the same field for the
 * same seed) and a hairline frame. No gradients and no glow.
 */
export function drawStoryGround(ctx: CanvasRenderingContext2D, seed: number): void {
  ctx.fillStyle = STORY_VOID;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  const random = seededRandom(seed);
  for (let i = 0; i < 150; i += 1) {
    const x = 50 + random() * (STORY_W - 100);
    const y = 50 + random() * (STORY_H - 100);
    const r = 0.7 + random() * random() * 2.1;
    const alpha = 0.12 + random() * 0.38;
    // Behind the words the field all but fades, so no star sits on a letter.
    const behindWords = x > 100 && x < STORY_W - 100 && y > STORY_SAFE.top && y < STORY_SAFE.bottom;
    ctx.globalAlpha = behindWords ? Math.min(alpha, 0.1) : alpha;
    ctx.fillStyle = STORY_INK_1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = STORY_HAIR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(36.5, 36.5, STORY_W - 73, STORY_H - 73, 32);
  else ctx.rect(36.5, 36.5, STORY_W - 73, STORY_H - 73);
  ctx.stroke();
}

/** The lockup, centred, with the ring turned to `front` when the card is made for one person. */
export async function drawStoryLockup(ctx: CanvasRenderingContext2D, front: string | null): Promise<void> {
  await withShareBrandIcon((icon) => {
    const width = shareBrandLockupWidth(ctx, STORY_LOCKUP.fontSize);
    drawShareBrandLockup(ctx, icon, {
      wordmarkX: STORY_W / 2 + width / 2,
      centerY: STORY_LOCKUP.centerY,
      iconSize: 0,
      fontSize: STORY_LOCKUP.fontSize,
      serif: STORY_SERIF,
      front,
    });
  });
}

/** Waits for the faces a story card sets its words in. */
export async function loadStoryFonts(sizes: { serif: number[]; mono?: number[] }): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await document.fonts.ready;
  await Promise.all([
    ...sizes.serif.flatMap((px) => [
      document.fonts.load(`500 ${px}px ${STORY_SERIF}`),
      document.fonts.load(`italic 400 ${px}px ${STORY_SERIF}`),
      document.fonts.load(`400 ${px}px ${STORY_SERIF}`),
    ]),
    ...(sizes.mono ?? []).map((px) => document.fonts.load(`400 ${px}px ${STORY_MONO}`)),
  ]).catch(() => undefined);
}

let discBatch: Promise<Map<string, Blob | null>> | null = null;

/**
 * All twelve 400px sign discs, fetched together: fetching only the discs a
 * card shows would tell our host which signs are on it. A disc that fails
 * to arrive is left off the card alone.
 */
function allStoryDiscs(): Promise<Map<string, Blob | null>> {
  if (!discBatch) {
    const batch = Promise.all(SIGNS.map(async ({ slug }) => {
      try {
        const res = await fetch(`/assets/zodiac-icons/400/${slug}.webp`);
        return [slug, res.ok ? await res.blob() : null] as const;
      } catch {
        return [slug, null] as const;
      }
    })).then((entries) => new Map(entries));
    discBatch = batch;
    const settle = () => { if (discBatch === batch) discBatch = null; };
    batch.then(settle, settle);
  }
  return discBatch;
}

/** One 400px disc for a story card ('' or an unknown slug gives null). */
export async function loadStoryDisc(slug: string): Promise<ImageBitmap | null> {
  if (!slug) return null;
  try {
    const blob = (await allStoryDiscs()).get(slug);
    return blob ? await createImageBitmap(blob) : null;
  } catch {
    return null;
  }
}

/**
 * Splits `text` into lines no wider than `maxWidth` at the context's current
 * font. Returns null when it needs more than `maxLines`, so the caller can
 * try a smaller size rather than cut a sentence short.
 */
export function wrapStoryText(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

/**
 * Draws `text` centred and wrapped, starting at `startPx` and shrinking to
 * `minPx` until it fits in `maxLines`. Returns the y below the last line.
 */
export function drawStoryParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    y: number;
    maxWidth: number;
    maxLines: number;
    startPx: number;
    minPx: number;
    font: (px: number) => string;
    color: string;
    leading?: number;
    x?: number;
    align?: CanvasTextAlign;
  },
): number {
  const leading = options.leading ?? 1.28;
  let px = options.startPx;
  let lines: string[] | null = null;
  for (; px >= options.minPx; px -= 2) {
    ctx.font = options.font(px);
    lines = wrapStoryText(ctx, text, options.maxWidth, options.maxLines);
    if (lines) break;
  }
  if (!lines) {
    px = options.minPx;
    ctx.font = options.font(px);
    lines = wrapStoryText(ctx, text, options.maxWidth, 99) ?? [text];
  }
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'alphabetic';
  const x = options.x ?? STORY_W / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, options.y + px + index * px * leading));
  return options.y + px + (lines.length - 1) * px * leading + px * 0.4;
}

/** Shrinks a one-line size until `text` fits `maxWidth`. */
export function fitStoryLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  font: (px: number) => string,
): number {
  let px = startPx;
  for (; px > minPx; px -= 2) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) return px;
  }
  ctx.font = font(minPx);
  return minPx;
}

export async function storyPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png encode failed');
  return blob;
}

/** A light dashed ring where a disc would sit, for a placement the chart does not settle. */
export function drawEmptyDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(198, 204, 218, 0.32)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export interface SeasonStoryInput {
  /** The season's sign. */
  slug: string;
  /** When the Sun enters the sign and when it leaves, as instants. */
  start: Date | string;
  end: Date | string;
  /** One sentence on what the season is about. */
  theme: string;
  /** Optional: one sign's line for the season, with its reading confidence. */
  reader?: { slug: string; line: string; confidence: number } | null;
  /** The zone the dates are written in; the visitor's own by default. */
  timeZone?: string;
  /** The card's words in another language; English when left out. */
  words?: SeasonStoryWords;
}

/**
 * A translated season page's words for its card, as plain strings so the
 * page can hand them to its script: the sign names are already in them.
 */
export interface SeasonStoryWords {
  /** BCP 47 tag the dates are written in. */
  dateLocale: string;
  /** "Temporada de Sagitario". */
  title: string;
  /** "El Sol en Sagitario", above the disc. */
  kicker: string;
  /** The date range, with {from} and {to}. */
  range: string;
  /** The heading over each sign's line, by sign slug: "Para Aries". */
  forSign: Record<string, string>;
  /** The reading-confidence label, with {value}. */
  confidence: string;
}

/**
 * The words a season card prints, worked out apart from the drawing so a
 * test can read them: the dates are the days the Sun enters and leaves in
 * the visitor's zone.
 */
export function seasonStoryContent(input: SeasonStoryInput): {
  title: string;
  dates: string;
  theme: string;
  reader: { heading: string; line: string; confidence: string; hue: string } | null;
  hue: string;
  filename: string;
  kicker: string;
} {
  const sign = signBySlug(input.slug);
  const words = input.words;
  const start = new Date(input.start);
  const end = new Date(input.end);
  const day = (date: Date, withYear: boolean) => new Intl.DateTimeFormat(words?.dateLocale ?? 'en-US', {
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  }).format(date);
  const year = (date: Date) => new Intl.DateTimeFormat(words?.dateLocale ?? 'en-US', {
    year: 'numeric',
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  }).format(date);
  const sameYear = year(start) === year(end);
  const reader = input.reader ? signBySlug(input.reader.slug) : null;
  const from = day(start, !sameYear);
  const to = day(end, true);
  return {
    title: words?.title ?? `${sign.name} season`,
    dates: words ? words.range.replace('{from}', from).replace('{to}', to) : `${from} to ${to}`,
    theme: input.theme,
    reader: reader && input.reader ? {
      heading: words?.forSign[reader.slug] ?? `For ${reader.name}`,
      line: input.reader.line,
      confidence: words ? words.confidence.replace('{value}', String(input.reader.confidence)) : `Reading confidence ${input.reader.confidence}%`,
      hue: reader.hue,
    } : null,
    hue: sign.hue,
    filename: seasonStoryFilename(sign.slug),
    kicker: words?.kicker ?? `The Sun in ${sign.name}`,
  };
}

/**
 * The season story card. It is not made for one person, so the lockup keeps
 * the brand's own ring (Libra in front), even when a sign's line is added.
 */
export async function prepareSeasonStoryCard(input: SeasonStoryInput): Promise<PreparedChartCard> {
  const content = seasonStoryContent(input);
  const sign = signBySlug(input.slug);
  await loadStoryFonts({ serif: [40, 108], mono: [24] });
  const disc = await loadStoryDisc(sign.slug);
  const { canvas, ctx } = storyCanvas();
  drawStoryGround(ctx, SIGNS.indexOf(sign) * 7919 + 17);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 40px ${STORY_SERIF}`;
  ctx.fillText(content.kicker, STORY_W / 2, content.reader ? 318 : 420);

  const discSize = content.reader ? 340 : 420;
  const discTop = content.reader ? 368 : 470;
  if (disc) ctx.drawImage(disc, (STORY_W - discSize) / 2, discTop, discSize, discSize);
  else drawEmptyDisc(ctx, STORY_W / 2, discTop + discSize / 2, discSize / 2 - 10);

  let y = discTop + discSize + 120;
  const titlePx = fitStoryLine(ctx, content.title, 900, 112, 72, (px) => `500 ${px}px ${STORY_SERIF}`);
  ctx.fillStyle = STORY_INK_0;
  ctx.fillText(content.title, STORY_W / 2, y);
  y += Math.round(titlePx * 0.62);

  ctx.fillStyle = sign.hue;
  ctx.font = `400 40px ${STORY_SERIF}`;
  ctx.fillText(content.dates, STORY_W / 2, y + 30);
  y += 70;

  ctx.strokeStyle = hexAlpha(sign.hue, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(STORY_W / 2 - 60, y);
  ctx.lineTo(STORY_W / 2 + 60, y);
  ctx.stroke();
  y += 34;

  y = drawStoryParagraph(ctx, content.theme, {
    y,
    maxWidth: 860,
    maxLines: content.reader ? 3 : 4,
    startPx: 46,
    minPx: 36,
    font: (px) => `400 ${px}px ${STORY_SERIF}`,
    color: STORY_INK_1,
  });

  if (content.reader) {
    y += 44;
    ctx.fillStyle = content.reader.hue;
    ctx.font = `italic 400 38px ${STORY_SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(content.reader.heading, STORY_W / 2, y + 30);
    y += 58;
    y = drawStoryParagraph(ctx, content.reader.line, {
      y,
      maxWidth: 860,
      maxLines: 4,
      startPx: 36,
      minPx: 28,
      font: (px) => `400 ${px}px ${STORY_SERIF}`,
      color: STORY_INK_2,
    });
    ctx.fillStyle = STORY_INK_2;
    ctx.font = `400 22px ${STORY_MONO}`;
    ctx.fillText(content.reader.confidence, STORY_W / 2, Math.min(y + 40, STORY_LOCKUP.centerY - 80));
  }

  await drawStoryLockup(ctx, null);
  return { blob: await storyPng(canvas), filename: content.filename };
}
