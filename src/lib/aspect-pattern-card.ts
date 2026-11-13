/** A selected figure only: no names, birth details, locations or source keys. */
import type { SelectedPatternCard } from './aspect-pattern-model';
import { patternDiagramGeometry, PATTERN_EDGE_COLORS } from '../islands/aspect-patterns/AspectPatternDiagram';
import { patternDegrees } from './aspect-pattern-model';
import { signForLongitude } from './signs';
import { drawShareBrandLockup, PORTRAIT_SHARE_CARD_BRAND_LAYOUT } from './share-card-brand';
import { downloadPreparedChartCard, type CardOutcome, type PreparedChartCard } from './share-card';

export const ASPECT_PATTERN_CARD_SIZE = Object.freeze({ width: 1080, height: 1350 });
export const downloadAspectPatternCard = downloadPreparedChartCard;
const SERIF = '"EB Garamond", Georgia, serif';
const SANS = '"Instrument Sans", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = '#EEF1F7';

/** Keep activation synchronous, but never fall back to a revoked source file. */
export async function shareAspectPatternCard(prepared: PreparedChartCard, isCurrent: () => boolean): Promise<CardOutcome> {
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

export async function aspectPatternCardFilename(card: SelectedPatternCard): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(card.identity));
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return `zodiacs-${card.context}-${card.pattern.kind}-${hash}.png`;
}

async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let rejectStop!: (cause: unknown) => void;
  const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const stop = () => {
    const reason = parent?.aborted ? parent.reason : new Error('pattern_prepare_timeout');
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

function lines(context: CanvasRenderingContext2D, value: string, width: number): string[] {
  const result: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/u)) {
    if (context.measureText(word).width > width) throw new Error('pattern_text_overflow');
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width) { result.push(line); line = word; } else line = next;
  }
  if (line) result.push(line);
  return result;
}

function paragraph(context: CanvasRenderingContext2D, value: string, y: number, size: number, lineHeight: number,
  family = SANS, x = 64, width = 952): number {
  context.font = `500 ${size}px ${family}`;
  const rows = lines(context, value, width);
  if (y + (rows.length - 1) * lineHeight > 1224) throw new Error('pattern_text_overflow');
  rows.forEach((row, index) => context.fillText(row, x, y + index * lineHeight));
  return y + rows.length * lineHeight;
}

function paintDiagram(context: CanvasRenderingContext2D, card: SelectedPatternCard): void {
  const marks = patternDiagramGeometry(card.points);
  context.save();
  context.translate(312, 134); context.scale(1.14, 1.14);
  context.strokeStyle = '#333B4D'; context.lineWidth = 1;
  context.beginPath(); context.arc(200, 200, 140, 0, Math.PI * 2); context.stroke();
  for (const edge of card.pattern.edges) {
    const a = marks.find((point) => point.body === edge.a)!;
    const b = marks.find((point) => point.body === edge.b)!;
    context.strokeStyle = PATTERN_EDGE_COLORS[edge.type]; context.lineWidth = 2;
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
  }
  for (const point of marks) {
    context.strokeStyle = signForLongitude(point.lon).hue; context.lineWidth = 1;
    context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(point.labelX, point.labelY); context.stroke();
    context.fillStyle = signForLongitude(point.lon).hue;
    context.beginPath(); context.arc(point.x, point.y, 4, 0, Math.PI * 2); context.fill();
    context.fillStyle = INK; context.font = `500 15px ${SANS}`; context.textAlign = 'center';
    context.strokeStyle = '#060709'; context.lineWidth = 5; context.lineJoin = 'round';
    context.strokeText(point.body, point.labelX, point.labelY + 5);
    context.fillText(point.body, point.labelX, point.labelY + 5);
  }
  context.restore();
}

export function prepareAspectPatternCard(card: SelectedPatternCard, parent?: AbortSignal): Promise<PreparedChartCard> {
  return bounded(async (signal) => {
    if (card.locale !== 'en' || !['natal', 'composite'].includes(card.context)
      || ![3, 4].includes(card.points.length) || new Set(card.points.map((point) => point.body)).size !== card.points.length
      || card.points.some((point) => !Number.isFinite(point.lon) || !card.pattern.members.includes(point.body))
      || card.pattern.members.length !== card.points.length
      || card.pattern.edges.some((edge) => !Number.isFinite(edge.orb) || !Number.isFinite(edge.limit)
        || edge.orb < 0 || edge.orb > edge.limit || !card.pattern.members.includes(edge.a) || !card.pattern.members.includes(edge.b))) {
      throw new Error('pattern_card_unavailable');
    }
    let canvas: HTMLCanvasElement | undefined;
    const release = () => {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };
    signal.addEventListener('abort', release, { once: true });
    try {
      const filename = await aspectPatternCardFilename(card);
      const faces = await Promise.all([
        document.fonts.load(`500 52px ${SERIF}`), document.fonts.load(`500 22px ${SANS}`), document.fonts.load(`500 18px ${MONO}`),
      ]);
      signal.throwIfAborted();
      if (faces.some((loaded) => !loaded.length || loaded.some((face) => face.status !== 'loaded'))) throw new Error('pattern_fonts_unavailable');
      canvas = document.createElement('canvas');
      canvas.width = ASPECT_PATTERN_CARD_SIZE.width; canvas.height = ASPECT_PATTERN_CARD_SIZE.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('pattern_canvas_unavailable');
      context.fillStyle = '#060709'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = INK; paragraph(context, card.title, 82, 52, 56, SERIF);
      context.fillStyle = '#C6CCDA'; paragraph(context, card.context === 'natal' ? 'Natal aspect pattern' : 'Midpoint composite aspect pattern', 120, 21, 26);
      paintDiagram(context, card);
      context.fillStyle = '#C6CCDA';
      card.points.forEach((point, index) => paragraph(context, `${point.body} · ${patternDegrees(point.lon)}`, 614 + Math.floor(index / 2) * 28, 18, 24, MONO, 64 + (index % 2) * 488, 464));
      let y = 666;
      context.fillStyle = '#8E96AB'; y = paragraph(context, 'Required contacts · exact orbs and inclusive limits', y, 18, 27);
      context.fillStyle = '#C6CCDA';
      for (const receipt of card.receipt) y = paragraph(context, receipt, y, 17, 23, MONO);
      context.fillStyle = INK; y = paragraph(context, card.reading, y + 20, 22, 28);
      context.fillStyle = '#8E96AB'; paragraph(context, card.scope, y + 16, 18, 24);
      // The brand lockup draws its own ring, so the card loads no image for it.
      drawShareBrandLockup(context, null, PORTRAIT_SHARE_CARD_BRAND_LAYOUT);
      const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob((value) =>
        value ? resolve(value) : reject(new Error('pattern_png_unavailable')), 'image/png'));
      signal.throwIfAborted();
      return { blob, filename };
    } finally {
      signal.removeEventListener('abort', release); release();
    }
  }, parent);
}
