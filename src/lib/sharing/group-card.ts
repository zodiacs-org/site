import type { CatalogLocale } from '../i18n/core';
import { sharingText as s } from './copy';
import { validGroupSize, ROLE_KEYS, ROLE_HUES, type GroupRole } from './group';
import { drawShareBrandLockup, withShareBrandIcon } from '../share-card-brand';
import type { PreparedChartCard } from '../share-card';

export interface GroupCardRow { name: string; role: GroupRole; unknown: boolean }

/** Receives display-only rows: the renderer has no birth details to export. */
export async function prepareGroupCard(rows: readonly GroupCardRow[], locale: CatalogLocale): Promise<PreparedChartCard> {
  if (!validGroupSize(rows.length)) throw new RangeError('group size');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  const ctx: CanvasRenderingContext2D = context;
  const serif = locale === 'ru' ? '"EB Garamond Cyrillic", Georgia, serif' : '"EB Garamond", Georgia, serif';
  const body = locale === 'ru' ? '"Golos Text", sans-serif' : '"Instrument Sans", sans-serif';
  ctx.fillStyle = '#060709'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = 'rgba(198,204,218,.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(28, 28, 1024, 1864, 26); ctx.stroke();
  function text(value: string, x: number, y: number, size: number, color: string, font = body, width = 900) {
    ctx.font = `400 ${size}px ${font}`;
    while (ctx.measureText(value).width > width && size > 18) { size -= 1; ctx.font = `400 ${size}px ${font}`; }
    ctx.fillStyle = color; ctx.fillText(value, x, y, width);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  text(s(locale, 'groupTitle'), 540, 165, 70, '#EEF1F7', serif);
  text(s(locale, 'groupMethod'), 540, 240, 28, '#8E96AB');
  const gap = Math.min(310, 1160 / rows.length);
  const start = 375 + (8 - rows.length) * 32;
  rows.forEach((row, index) => {
    const y = start + index * gap;
    const clean = row.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    text(clean || s(locale, 'person', { n: index + 1 }), 540, y, 38, '#8E96AB');
    text(s(locale, ROLE_KEYS[row.role]), 540, y + 51, 61, ROLE_HUES[row.role], serif);
    if (row.unknown) text(s(locale, 'unknownTime'), 540, y + 93, 21, '#8E96AB');
  });
  // Keep the interpretation limitation on the exported card, in its language.
  const words = s(locale, 'groupMethodBody').split(' ');
  const lines: string[] = []; let line = '';
  ctx.font = `400 22px ${body}`;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 900 && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((value, index) => text(value, 540, 1640 + index * 31, 22, '#8E96AB'));
  await withShareBrandIcon((icon) => drawShareBrandLockup(ctx, icon, { wordmarkX: 1014, centerY: 1850, iconSize: 44, fontSize: 22, serif }));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png encode failed');
  return { blob, filename: 'zodiacs-group.png' };
}
