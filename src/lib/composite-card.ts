/** Composite-only image: exact midpoint facts, never a fabricated natal Chart. */
import { h, render } from 'preact';
import { CompositeWheel } from '../islands/synastry/CompositeWheel';
import { COMPOSITE_COPY } from '../islands/synastry/compositeCopy';
import type { CompositeTabData } from '../islands/synastry/relationshipData';
import type { CatalogLocale as Locale } from './i18n';
import { planetLabel } from './i18n/astrology';
import { formatLongitude } from './signs';
import { savePreparedChartCard, downloadPreparedChartCard, type PreparedChartCard } from './share-card';
import { drawShareBrandLockup, PORTRAIT_SHARE_CARD_BRAND_LAYOUT, withShareBrandIcon } from './share-card-brand';

export const COMPOSITE_CARD_SIZE = { width: 1080, height: 1350 } as const;
export const shareCompositeCard = savePreparedChartCard;
export const downloadCompositeCard = downloadPreparedChartCard;
const SERIF = '"EB Garamond", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Instrument Sans", sans-serif';
const iconCache = new Map<string, Promise<string>>();

/** One finite preparation window, including native work that cannot be aborted. */
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let stop: () => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    stop = () => {
      controller.abort(parent?.aborted ? parent.reason : new Error('composite_prepare_timeout'));
      reject(controller.signal.reason);
    };
    timer = setTimeout(stop, 15_000);
    parent?.addEventListener('abort', stop, { once: true });
    if (parent?.aborted) stop();
  });
  const pending = Promise.resolve().then(() => {
    controller.signal.throwIfAborted();
    return work(controller.signal);
  });
  try {
    return await Promise.race([pending, deadline]);
  } finally {
    clearTimeout(timer!);
    parent?.removeEventListener('abort', stop!);
    controller.abort();
  }
}

function embeddedIcon(path: string): Promise<string> {
  let pending = iconCache.get(path);
  if (!pending) {
    pending = bounded(async (signal) => {
      const response = await fetch(path, { signal });
      if (!response.ok) throw new Error('composite_icon_unavailable');
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const value of bytes) binary += String.fromCharCode(value);
      return `data:${blob.type || 'image/webp'};base64,${btoa(binary)}`;
    }).catch((error) => {
      if (iconCache.get(path) === pending) iconCache.delete(path);
      throw error;
    });
    iconCache.set(path, pending);
  }
  return pending;
}

async function wheelImage(data: CompositeTabData, label: string, signal: AbortSignal): Promise<HTMLImageElement> {
  const host = document.createElement('div');
  render(h(CompositeWheel, { data, label, size: 780, deferIcons: true }), host);
  const svg = host.querySelector('svg')!;
  try {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', '960'); svg.setAttribute('height', '960');
    // Detached SVG images cannot fetch their own external artwork. Embed the
    // canonical pastel discs, without installing a global DOM override.
    await bounded(() => Promise.all([...svg.querySelectorAll('image')].map(async (image) => {
      const href = image.getAttribute('data-href');
      if (href) {
        image.setAttribute('href', await embeddedIcon(href));
        image.removeAttribute('data-href');
      }
    })), signal);
    signal.throwIfAborted();
    const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
    const image = new Image();
    let decoded = false;
    try {
      await bounded(() => new Promise<void>((resolve, reject) => {
        image.onload = () => { decoded = true; resolve(); };
        image.onerror = () => reject(new Error('composite_wheel_unavailable'));
        image.src = url;
      }), signal);
      signal.throwIfAborted();
      return image;
    } finally {
      image.onload = null; image.onerror = null;
      if (!decoded) image.src = '';
      URL.revokeObjectURL(url);
    }
  } finally { render(null, host); }
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number,
  width: number, size: number, family = SANS): void {
  let fitted = size;
  context.font = `500 ${fitted}px ${family}`;
  while (fitted > 14 && context.measureText(value).width > width) context.font = `500 ${--fitted}px ${family}`;
  if (context.measureText(value).width > width) throw new Error('composite_text_overflow');
  context.fillText(value, x, y);
}

function wrap(context: CanvasRenderingContext2D, value: string, x: number, y: number,
  width: number, lineHeight: number): number {
  let line = '';
  for (const word of value.split(/\s+/u)) {
    if (context.measureText(word).width > width) throw new Error('composite_text_overflow');
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      context.fillText(line, x, y); y += lineHeight; line = word;
    } else line = next;
  }
  if (line) context.fillText(line, x, y);
  return y + lineHeight;
}

/**
 * `data` is the composite the picture draws: CompositePanel's picture data,
 * each person as their link carries them. `noTime` says one of them has no
 * birth time, so the picture notes it is drawn from 12:00 UTC without the Moon.
 */
export function prepareCompositeCard(
  data: CompositeTabData,
  locale: Locale = 'en',
  options: { noTime?: boolean } = {},
): Promise<PreparedChartCard> {
  return bounded((signal) => paintCompositeCard(data, locale, options, signal));
}

async function paintCompositeCard(
  data: CompositeTabData,
  locale: Locale,
  options: { noTime?: boolean },
  signal: AbortSignal,
): Promise<PreparedChartCard> {
  if (!data.points.length || data.points.length > 12) throw new Error('composite_points_unavailable');
  const c = COMPOSITE_COPY[locale];
  const [wheel, ...faces] = await Promise.all([
    wheelImage(data, c.wheelLabel, signal),
    bounded(() => document.fonts.load(`500 48px ${SERIF}`), signal),
    bounded(() => document.fonts.load(`500 23px ${SANS}`), signal),
    bounded(() => document.fonts.load(`500 20px ${MONO}`), signal),
  ]);
  signal.throwIfAborted();
  if (faces.some((loaded) => !loaded.length || loaded.some((face) => face.status !== 'loaded'))) {
    throw new Error('composite_fonts_unavailable');
  }
  const canvas = document.createElement('canvas');
  canvas.width = COMPOSITE_CARD_SIZE.width; canvas.height = COMPOSITE_CARD_SIZE.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('composite_canvas_unavailable');
  context.fillStyle = '#060709'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#EEF1F7';
  text(context, c.imageTitle, 64, 88, 952, 52, SERIF);
  context.fillStyle = '#C6CCDA'; context.font = `500 22px ${SANS}`;
  wrap(context, c.imageReceipt, 64, 125, 952, 27);
  context.drawImage(wheel, 215, 165, 650, 650);
  context.fillStyle = '#8E96AB';
  text(context, data.aspects.length ? `${c.aspects}: ${data.aspects.length}` : c.noAspects, 64, 824, 952, 21, SANS);
  const rows = Math.ceil(data.points.length / 2);
  data.points.forEach((point, index) => {
    const column = Math.floor(index / rows);
    const y = 871 + (index % rows) * 35;
    const x = 64 + column * 488;
    const reference = data.moonProvisional && point.body === 'Moon' ? ' *' : '';
    context.fillStyle = '#C6CCDA';
    text(context, `${planetLabel(locale, point.body)}${reference} · ${formatLongitude(point.lon, locale)}`, x, y, 458, 22, MONO);
  });
  context.fillStyle = '#8E96AB'; context.font = `500 21px ${SANS}`;
  if (options.noTime) wrap(context, c.imageNoTime, 64, 1101, 952, 27);
  else if (data.moonProvisional) wrap(context, `* ${c.moonTimeNotice}`, 64, 1101, 952, 27);
  context.font = `500 18px ${SANS}`;
  wrap(context, c.oppositeConvention, 64, 1210, 952, 24);
  await bounded(() => withShareBrandIcon((icon) => {
    signal.throwIfAborted();
    drawShareBrandLockup(context, icon, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
  }), signal);
  const blob = await bounded(() => new Promise<Blob>((resolve, reject) => canvas.toBlob((value) =>
    value ? resolve(value) : reject(new Error('composite_png_unavailable')), 'image/png')), signal);
  signal.throwIfAborted();
  return { blob, filename: 'zodiacs-composite.png' };
}
