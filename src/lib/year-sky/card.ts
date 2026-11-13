/**
 * The share cards of "Your 2027 sky", painted on a canvas in the browser and
 * never on a server: a 1080 × 1080 square and a 1080 × 1920 story.
 *
 * A card shows signs and planets only. Its input type has no field for a name,
 * a birth date, a birth time, a birthplace, a degree or a date from the chart,
 * so none can reach the image; the file names are the same for everyone. The
 * lockup ring brings the person's Sun sign to the front when, and only when,
 * their chart settles it (ring-front.ts), as every card made for one person
 * does (DESIGN.md, "Brand Lockup").
 */
import type { CatalogLocale } from '../i18n/core';
import { drawShareBrandLockup, withShareBrandIcon } from '../share-card-brand';
import { SIGNS } from '../signs';
import { yearSkyWords } from './copy';

export interface YearCardInput {
  year: number;
  /** Sign slugs the chart settles; null leaves the sign off the card. */
  signs: { sun: string | null; moon: string | null; rising: string | null };
  /** The year's largest moments in the card's own words (copy.ts card*), at most four. */
  lines: string[];
  /** How many personal moments the year holds. */
  count: number;
  /** The sign the lockup ring brings to the front (ringFront), or null. */
  front: string | null;
}

export interface PreparedYearCard {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

export type YearCardFormat = 'square' | 'story';

export function yearCardFilename(year: number, format: YearCardFormat): string {
  return format === 'square' ? `zodiacs-${year}-sky.png` : `zodiacs-${year}-sky-story.png`;
}

const BG = '#060709';
const INK_0 = '#EEF1F7';
const INK_1 = '#C6CCDA';
const INK_2 = '#8E96AB';
const HAIR = 'rgba(198, 204, 218, 0.14)';
const SERIF = '"EB Garamond", Georgia, serif';
const SANS = '"Instrument Sans", system-ui, sans-serif';

const hueOf = (slug: string | null) => SIGNS.find((sign) => sign.slug === slug)?.hue ?? INK_1;

interface Layout {
  width: number;
  height: number;
  pad: number;
  headlineY: number;
  headlinePx: number;
  yearY: number;
  yearPx: number;
  signsY: number;
  signsPx: number;
  linesY: number;
  linePx: number;
  lineGap: number;
  countY: number;
  brandY: number;
}

const LAYOUTS: Record<YearCardFormat, Layout> = {
  square: { width: 1080, height: 1080, pad: 84, headlineY: 150, headlinePx: 50, yearY: 300, yearPx: 168, signsY: 392, signsPx: 30, linesY: 500, linePx: 36, lineGap: 82, countY: 880, brandY: 990 },
  story: { width: 1080, height: 1920, pad: 96, headlineY: 360, headlinePx: 64, yearY: 590, yearPx: 240, signsY: 720, signsPx: 36, linesY: 900, linePx: 44, lineGap: 128, countY: 1560, brandY: 1800 },
};

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number, font: (px: number) => string): number {
  for (let px = startPx; px > minPx; px -= 1) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) return px;
  }
  ctx.font = font(minPx);
  return minPx;
}

async function paint(input: YearCardInput, format: YearCardFormat, locale: CatalogLocale): Promise<PreparedYearCard> {
  const w = yearSkyWords(locale);
  const nameOf = (slug: string) => (SIGNS.some((sign) => sign.slug === slug) ? w.signName(slug) : slug);
  const L = LAYOUTS[format];
  const canvas = document.createElement('canvas');
  canvas.width = L.width;
  canvas.height = L.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  const ctx = context;
  const inner = L.width - L.pad * 2;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, L.width, L.height);
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, L.width - 80, L.height - 80);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_1;
  ctx.font = `italic 400 ${L.headlinePx}px ${SERIF}`;
  ctx.fillText(w.cardHeadline, L.pad, L.headlineY);

  ctx.fillStyle = hueOf(input.signs.sun);
  ctx.font = `400 ${L.yearPx}px ${SERIF}`;
  ctx.fillText(String(input.year), L.pad - 6, L.yearY);

  // Signs the chart settles, each with its hue.
  const signs = ([['sun', w.cardSun], ['moon', w.cardMoon], ['rising', w.cardRising]] as const)
    .flatMap(([key, label]) => (input.signs[key] ? [{ label, slug: input.signs[key]! }] : []));
  const rowWidth = (px: number) => {
    ctx.font = `400 ${px}px ${SANS}`;
    return signs.reduce((sum, sign) => sum + px * 0.64 + 14 + ctx.measureText(sign.label).width + 10 + ctx.measureText(nameOf(sign.slug)).width + 40, -40);
  };
  let signsPx = L.signsPx;
  while (signsPx > 18 && rowWidth(signsPx) > inner) signsPx -= 1;
  let x = L.pad;
  ctx.font = `400 ${signsPx}px ${SANS}`;
  for (const sign of signs) {
    const dot = signsPx * 0.32;
    ctx.fillStyle = hueOf(sign.slug);
    ctx.beginPath();
    ctx.arc(x + dot, L.signsY - signsPx * 0.34, dot, 0, Math.PI * 2);
    ctx.fill();
    x += dot * 2 + 14;
    ctx.fillStyle = INK_2;
    ctx.fillText(sign.label, x, L.signsY);
    x += ctx.measureText(sign.label).width + 10;
    ctx.fillStyle = INK_0;
    const name = nameOf(sign.slug);
    ctx.fillText(name, x, L.signsY);
    x += ctx.measureText(name).width + 40;
  }

  ctx.strokeStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(L.pad, L.signsY + L.signsPx);
  ctx.lineTo(L.width - L.pad, L.signsY + L.signsPx);
  ctx.stroke();

  const lines = input.lines.slice(0, 4);
  if (!lines.length) {
    ctx.fillStyle = INK_0;
    fit(ctx, w.cardQuiet, inner, L.linePx, 20, (px) => `400 ${px}px ${SERIF}`);
    ctx.fillText(w.cardQuiet, L.pad, L.linesY + L.linePx);
  }
  lines.forEach((line, i) => {
    const y = L.linesY + L.linePx + i * L.lineGap;
    ctx.fillStyle = hueOf(input.signs.sun);
    ctx.beginPath();
    ctx.arc(L.pad + 6, y - L.linePx * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK_0;
    fit(ctx, line, inner - 36, L.linePx, 22, (px) => `400 ${px}px ${SERIF}`);
    ctx.fillText(line, L.pad + 36, y);
  });

  ctx.fillStyle = INK_2;
  const count = input.count > 0 ? w.cardCount(input.count) : w.cardQuiet;
  fit(ctx, count, inner, L.signsPx, 18, (px) => `400 ${px}px ${SANS}`);
  ctx.fillText(count, L.pad, L.countY);

  await withShareBrandIcon((icon) => drawShareBrandLockup(ctx, icon, {
    wordmarkX: L.width - L.pad,
    centerY: L.brandY,
    iconSize: 44,
    fontSize: format === 'story' ? 26 : 22,
    serif: SERIF,
    front: input.front,
  }));

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png encoding failed');
  return { blob, filename: yearCardFilename(input.year, format), width: L.width, height: L.height };
}

/** Both cards, painted once the card faces are ready. */
export async function prepareYearCards(input: YearCardInput, locale: CatalogLocale = 'en'): Promise<Record<YearCardFormat, PreparedYearCard>> {
  if (!Number.isInteger(input.year) || !Number.isInteger(input.count) || input.count < 0) throw new RangeError('Invalid card input');
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(`400 64px ${SERIF}`),
    document.fonts.load(`italic 400 64px ${SERIF}`),
    document.fonts.load(`400 30px ${SANS}`),
  ]).catch(() => undefined);
  return { square: await paint(input, 'square', locale), story: await paint(input, 'story', locale) };
}
