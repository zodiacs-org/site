/** A completed lunar return chart. Birth input never enters this renderer. */
import { h, render } from 'preact';
import TechnicalWheel from './wheel/TechnicalWheel';
import type { LunarReturnExportModel } from '../islands/lunar-return/export-model';
import { BRAND_ICON_PATHS } from './brand-icons.mjs';
import { drawShareBrandLockup, PORTRAIT_SHARE_CARD_BRAND_LAYOUT, type LoadedShareBrandIcon } from './share-card-brand';
import { downloadPreparedChartCard, type PreparedChartCard, type CardOutcome } from './share-card';
import { lunarReturnShownInstant, lunarReturnTimestamp } from './lunar-return-ical';
import { wholeSignCusps } from './engine/houses';
import { SIGNS } from './signs';

export const LUNAR_RETURN_CARD_SIZE = Object.freeze({ width: 1080, height: 1350 });
export const downloadLunarReturnCard = downloadPreparedChartCard;
const SERIF = '"EB Garamond", Georgia, serif';
const SANS = '"Instrument Sans", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Keep native activation synchronous, and refuse a stale download fallback. */
export async function shareLunarReturnCard(prepared: PreparedChartCard, isCurrent: () => boolean = () => true): Promise<CardOutcome> {
  if (!isCurrent()) return 'cancelled';
  const file = new File([prepared.blob], prepared.filename, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return isCurrent() ? 'shared' : 'cancelled';
    }
  } catch (cause) {
    if ((cause as DOMException)?.name === 'AbortError') return 'cancelled';
  }
  return isCurrent() ? downloadPreparedChartCard(prepared) : 'cancelled';
}

/** A single finite window includes fonts, fetches, image decoding and encoding. */
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let rejectStop!: (cause: unknown) => void;
  const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const stop = () => {
    const reason = parent?.aborted ? parent.reason : new Error('lunar_prepare_timeout');
    controller.abort(reason); rejectStop(reason);
  };
  const timer = setTimeout(stop, 15_000);
  parent?.addEventListener('abort', stop, { once: true });
  if (parent?.aborted) stop();
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted(); return work(controller.signal);
    }), stopped]);
  } finally {
    clearTimeout(timer); parent?.removeEventListener('abort', stop); controller.abort();
  }
}

async function decodeImage(blob: Blob, signal: AbortSignal): Promise<HTMLImageElement> {
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const image = new Image();
  let decoded = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      const finish = (cause?: unknown) => {
        signal.removeEventListener('abort', abort);
        if (cause) reject(cause); else resolve();
      };
      image.onload = () => { decoded = true; finish(); };
      image.onerror = () => finish(new Error('lunar_image_unavailable'));
      signal.addEventListener('abort', abort, { once: true });
      image.src = url;
    });
    signal.throwIfAborted();
    return image;
  } finally {
    image.onload = null; image.onerror = null;
    if (signal.aborted || !decoded) image.src = '';
    URL.revokeObjectURL(url);
  }
}

async function fetchBlob(path: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(path, { signal });
  signal.throwIfAborted();
  if (!response.ok) throw new Error('lunar_artwork_unavailable');
  const blob = await response.blob();
  signal.throwIfAborted();
  return blob;
}

async function brandIcon(signal: AbortSignal): Promise<LoadedShareBrandIcon> {
  const blob = await fetchBlob(BRAND_ICON_PATHS.icon512, signal);
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      if (signal.aborted) { bitmap.close(); signal.throwIfAborted(); }
      return bitmap;
    } catch (cause) { if (signal.aborted) throw cause; }
  }
  return decodeImage(blob, signal);
}

async function wheelImage(model: LunarReturnExportModel, signal: AbortSignal): Promise<HTMLImageElement> {
  // Embed before render: Preact creates elements in the active document before
  // adopting them into template content, so even an inert host is insufficient
  // to prevent native requests when external hrefs are assigned initially.
  const host = document.createElement('template').content;
  const release = () => render(null, host);
  signal.addEventListener('abort', release, { once: true });
  try {
    const signImageHrefs = Object.fromEntries(await Promise.all(SIGNS.map(async (sign) => {
      const blob = await fetchBlob(`/assets/zodiac-icons/128/${sign.slug}.webp`, signal);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      signal.throwIfAborted();
      let binary = '';
      for (const value of bytes) binary += String.fromCharCode(value);
      return [sign.slug, `data:${blob.type || 'image/webp'};base64,${btoa(binary)}`];
    })));
    signal.throwIfAborted();
    const chart = model.wheel;
    render(h(TechnicalWheel, {
      bodies: chart.bodies, ...chart.angles, cusps: chart.houses?.cusps,
      aspects: chart.aspects, size: 780, signImageHrefs,
    }), host);
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('lunar_wheel_unavailable');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '1080'); svg.setAttribute('height', '1080');
    // SVG-as-image has no page CSS variables or inherited text face. Match
    // the established technical export's concrete monospace fallback.
    svg.querySelectorAll('text').forEach((text) => {
      text.setAttribute('font-family', 'ui-monospace, Menlo, Consolas, monospace');
    });
    signal.throwIfAborted();
    return await decodeImage(new Blob([svg.outerHTML], { type: 'image/svg+xml' }), signal);
  } finally {
    signal.removeEventListener('abort', release); release();
  }
}

function lines(context: CanvasRenderingContext2D, value: string, width: number): string[] {
  const result: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/u)) {
    if (context.measureText(word).width > width) throw new Error('lunar_text_overflow');
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) { result.push(line); line = word; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
}

/** Fit complete text inside its reserved area; never clip a qualification. */
function paragraphs(context: CanvasRenderingContext2D, values: string[], y: number, height: number,
  maximum: number, minimum: number, color: string, family = SANS): void {
  if (!values.length) return;
  for (let size = maximum; size >= minimum; size--) {
    context.font = `500 ${size}px ${family}`;
    const groups = values.map((value) => lines(context, value, 952));
    const lineHeight = size + 7;
    const needed = groups.reduce((sum, group) => sum + group.length * lineHeight, 0) + (groups.length - 1) * 10;
    if (needed > height) continue;
    context.fillStyle = color;
    let cursor = y;
    for (const group of groups) {
      for (const line of group) { context.fillText(line, 64, cursor); cursor += lineHeight; }
      cursor += 10;
    }
    return;
  }
  throw new Error('lunar_text_overflow');
}

const middleOfDegree = (longitude: number) => Math.floor(longitude) + 0.5;

/**
 * What a lunar return image shows of the return: no more of the birth than a
 * chart's link. The Moon returns to its natal longitude, so the instant to
 * the millisecond gave the birth instant to about a millisecond, and before
 * standard time the birthplace's longitude; the image prints it to the whole
 * minute (lunarReturnShownInstant). Cast at the birthplace by default, the
 * return is drawn as a natal image is: its angles at the middle of their
 * whole degree, with whole-sign houses, which follow from the ascendant's
 * sign; Placidus houses, and the house they put the Moon in, are left out,
 * and a note says so.
 */
export function lunarReturnImageModel(model: LunarReturnExportModel): LunarReturnExportModel {
  const instantUtc = lunarReturnShownInstant(model);
  const { angles, houses } = model.wheel;
  if (!angles) return { ...model, instantUtc };
  const asc = middleOfDegree(angles.asc);
  const mc = middleOfDegree(angles.mc);
  const wholeSign = houses?.system === 'whole' ? { system: 'whole' as const, cusps: wholeSignCusps(asc) } : null;
  const placidusLeftOut = Boolean(houses) && !wholeSign;
  return {
    ...model,
    instantUtc,
    wheel: { ...model.wheel, angles: { asc, mc, dsc: (asc + 180) % 360, ic: (mc + 180) % 360 }, houses: wholeSign },
    reading: placidusLeftOut ? model.reading.filter((entry) => entry.kind !== 'moon-house') : model.reading,
    // A whole-sign house follows from the signs; a Placidus house does not.
    readingBasis: placidusLeftOut
      ? model.readingBasis.map((line) => (line.startsWith('Moon ') ? line.replace(/ · house \d+$/u, '') : line))
      : model.readingBasis,
    notes: placidusLeftOut ? [...model.notes, 'Placidus houses are left out of this image.'] : model.notes,
  };
}

export function prepareLunarReturnCard(source: LunarReturnExportModel, parent?: AbortSignal): Promise<PreparedChartCard> {
  return bounded(async (signal) => {
    const { bodies, angles, houses } = source.wheel;
    const longitude = (value: number) => Number.isFinite(value) && value >= 0 && value < 360;
    if (lunarReturnTimestamp(source.instantUtc) <= lunarReturnTimestamp(source.referenceUtc)
      || source.title !== 'Lunar return' || !bodies.length || bodies.length > 12
      || !bodies.some((point) => point.body === 'Moon') || bodies.some((point) => !longitude(point.lon))
      || !angles || (['asc', 'mc', 'dsc', 'ic'] as const).some((key) => !longitude(angles[key]))
      || !houses || houses.cusps.length !== 12 || houses.cusps.some((value) => !longitude(value))) {
      throw new Error('lunar_card_unavailable');
    }
    // Validated as computed; drawn as lunarReturnImageModel shows it.
    const model = lunarReturnImageModel(source);
    const instant = lunarReturnTimestamp(model.instantUtc);
    const reference = lunarReturnTimestamp(model.referenceUtc);
    let icon: LoadedShareBrandIcon | undefined;
    let wheel: HTMLImageElement | undefined;
    let canvas: HTMLCanvasElement | undefined;
    const release = () => {
      icon?.close?.();
      if (icon && 'src' in icon) icon.src = '';
      icon = undefined;
      if (wheel) wheel.src = '';
      wheel = undefined;
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };
    signal.addEventListener('abort', release, { once: true });
    try {
      const faces = await Promise.all([
        document.fonts.load(`500 52px ${SERIF}`), document.fonts.load(`500 24px ${SANS}`),
        document.fonts.load(`500 20px ${MONO}`),
      ]);
      signal.throwIfAborted();
      if (faces.some((loaded) => !loaded.length || loaded.some((face) => face.status !== 'loaded'))) throw new Error('lunar_fonts_unavailable');
      wheel = await wheelImage(model, signal); signal.throwIfAborted();
      icon = await brandIcon(signal); signal.throwIfAborted();
      canvas = document.createElement('canvas');
      canvas.width = LUNAR_RETURN_CARD_SIZE.width; canvas.height = LUNAR_RETURN_CARD_SIZE.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('lunar_canvas_unavailable');
      context.fillStyle = '#060709'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.textBaseline = 'top'; context.textAlign = 'left';
      paragraphs(context, ['Lunar return'], 49, 64, 52, 52, '#EEF1F7', SERIF);
      paragraphs(context, [`Return: ${instant.slice(0, 16).replace('T', ' ')} UTC`], 121, 28, 20, 20, '#C6CCDA', MONO);
      paragraphs(context, [`Next after: ${reference.slice(0, 16).replace('T', ' ')} UTC`], 155, 27, 18, 18, '#8E96AB', MONO);
      context.drawImage(wheel, 240, 193, 600, 600);
      paragraphs(context, model.readingBasis, 810, 68, 19, 18, '#8E96AB');
      paragraphs(context, model.reading.map((reading) => reading.text), 899, 222, 26, 23, '#EEF1F7');
      paragraphs(context, model.notes, 1145, 96, 20, 18, '#8E96AB');
      // A bounded engine label shares the footer without colliding with the lockup.
      context.font = `500 16px ${MONO}`;
      const engine = `Engine ${model.engineVersion}`;
      if (context.measureText(engine).width > 590) throw new Error('lunar_text_overflow');
      context.fillStyle = '#8E96AB'; context.fillText(engine, 64, 1281);
      drawShareBrandLockup(context, icon, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
      const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob((value) =>
        value ? resolve(value) : reject(new Error('lunar_png_unavailable')), 'image/png'));
      signal.throwIfAborted();
      return { blob, filename: `zodiacs-lunar-return-${instant.slice(0, 16).replace(/[-:]/g, '')}Z.png` };
    } finally {
      signal.removeEventListener('abort', release); release();
    }
  }, parent);
}
