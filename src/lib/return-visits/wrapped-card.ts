import type { CatalogLocale } from '../i18n/core';
import { planetLabel } from '../i18n/astrology';
import { returnText as s } from './copy';
import { drawShareBrandLockup, withShareBrandIcon } from '../share-card-brand';
import type { PreparedChartCard } from '../share-card';

/** Counts only: no personal inputs, exact positions, or transit contact dates. */
export async function prepareWrappedCard(year: number, jupiter: number, saturn: number, approximate: boolean, locale: CatalogLocale): Promise<PreparedChartCard> {
  if (![jupiter, saturn].every((value) => Number.isInteger(value) && value >= 0 && value < 1000)) throw new RangeError('Invalid contact counts');
  await document.fonts.ready;
  const serif = locale === 'ru' ? '"EB Garamond Cyrillic", Georgia, serif' : '"EB Garamond", Georgia, serif';
  const sans = locale === 'ru' ? '"Golos Text", sans-serif' : '"Instrument Sans", sans-serif';
  await Promise.all([document.fonts.load(`400 70px ${serif}`), document.fonts.load(`400 28px ${sans}`)]);
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d'); if (!context) throw new Error('canvas unavailable'); const ctx = context;
  ctx.fillStyle = '#060709'; ctx.fillRect(0, 0, 1080, 1920);
  function text(value: string, y: number, size: number, color = '#eef1f7', font = sans) {
    ctx.font = `400 ${size}px ${font}`; while (ctx.measureText(value).width > 900 && size > 20) { size--; ctx.font = `400 ${size}px ${font}`; }
    ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(value, 540, y, 900);
  }
  function paragraph(value: string, top: number) {
    ctx.font = `400 26px ${sans}`; const lines: string[] = []; let line = '';
    for (const word of value.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > 900 && line) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line); lines.forEach((line, i) => text(line, top + i * 39, 26, '#8e96ab'));
    return top + lines.length * 39;
  }
  text(s(locale, 'wrappedTitle'), 165, 74, '#eef1f7', serif);
  text(String(year), 300, 90, '#b6d4e4', serif);
  text(s(locale, 'contactCount', { n: jupiter + saturn }), 398, 32, '#8e96ab');
  text(planetLabel(locale, 'Jupiter'), 650, 43, '#b6d4e4', serif); text(String(jupiter), 820, 160, '#b6d4e4', serif);
  text(planetLabel(locale, 'Saturn'), 1050, 43, '#c0dea8', serif); text(String(saturn), 1220, 160, '#c0dea8', serif);
  const bottom = paragraph(s(locale, 'wrappedScope'), 1420);
  if (approximate) paragraph(s(locale, 'wrappedUnknown'), bottom + 35);
  await withShareBrandIcon((icon) => drawShareBrandLockup(ctx, icon, { wordmarkX: 1014, centerY: 1850, iconSize: 44, fontSize: 22, serif }));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('png encoding failed');
  return { blob, filename: `zodiacs-wrapped-${year}.png` };
}
