import { localizePath, t } from '../i18n';
import type { CatalogLocale } from '../i18n/core';
import { SIGNS, signBySlug, signName } from '../signs';
import { sharingText as s } from './copy';
import { drawShareBrandLockup, withShareBrandIcon } from '../share-card-brand';
import type { PreparedChartCard } from '../share-card-save';

/**
 * What the chart twin story card may show: one public figure's name and the
 * signs the visitor shares with them. It has no field for a birth date, time
 * or place, so the exported image cannot carry one.
 */
export interface TwinCardContent { name: string; sun: string | null; moon: string | null }

/** The card's words, kept apart from the canvas so tests can check them. */
export function twinCardLines(content: TwinCardContent, locale: CatalogLocale) {
  const name = content.name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) throw new RangeError('twin name');
  const sun = content.sun ? signBySlug(content.sun) : null;
  const moon = content.moon ? signBySlug(content.moon) : null;
  if (!sun && !moon) throw new RangeError('twin card needs a shared sign');
  const lead = s(locale, sun && moon ? 'twinsCardBoth' : sun ? 'twinsCardSun' : 'twinsCardMoon');
  const signs = [
    ...(sun ? [{ slug: sun.slug, hue: sun.hue, label: s(locale, 'twinsCardSign', { body: t(locale, 'sun'), sign: signName(sun, locale) }) }] : []),
    ...(moon ? [{ slug: moon.slug, hue: moon.hue, label: s(locale, 'twinsCardSign', { body: t(locale, 'moon'), sign: signName(moon, locale) }) }] : []),
  ];
  return {
    kicker: s(locale, 'twinsCardKicker'),
    lead,
    name,
    signs,
    caveat: s(locale, 'twinsCardCaveat'),
    find: s(locale, 'twinsCardFind', { path: `zodiacs.org${localizePath(locale, '/chart-twins/')}` }),
    privacy: s(locale, 'twinsCardPrivacy'),
  };
}

/**
 * All twelve 400px discs in zodiac order: fetching only the ones a card shows
 * would tell our host the visitor's signs. A disc that fails is drawn as a glyph.
 */
async function allDiscs(): Promise<Map<string, Blob | null>> {
  const entries = await Promise.all(SIGNS.map(async ({ slug }) => {
    try {
      const res = await fetch(`/assets/zodiac-icons/400/${slug}.webp`);
      return [slug, res.ok ? await res.blob() : null] as const;
    } catch { return [slug, null] as const; }
  }));
  return new Map(entries);
}

export async function prepareTwinCard(content: TwinCardContent, locale: CatalogLocale): Promise<PreparedChartCard> {
  const lines = twinCardLines(content, locale);
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  const ctx: CanvasRenderingContext2D = context;
  const serif = locale === 'ru' ? '"EB Garamond Cyrillic", Georgia, serif' : '"EB Garamond", Georgia, serif';
  const body = locale === 'ru' ? '"Golos Text", sans-serif' : '"Instrument Sans", sans-serif';
  ctx.fillStyle = '#060709'; ctx.fillRect(0, 0, 1080, 1920);
  // A soft wash in the first shared sign's hue, so each twin card has its own colour.
  const glow = ctx.createRadialGradient(540, 860, 40, 540, 860, 620);
  glow.addColorStop(0, `${lines.signs[0].hue}33`); glow.addColorStop(1, 'rgba(6,7,9,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = 'rgba(198,204,218,.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(28, 28, 1024, 1864, 26); ctx.stroke();
  function text(value: string, x: number, y: number, size: number, color: string, font = body, width = 940, weight = 400) {
    ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(value).width > width && size > 18) { size -= 1; ctx.font = `${weight} ${size}px ${font}`; }
    ctx.fillStyle = color; ctx.fillText(value, x, y, width);
  }
  function wrapped(value: string, y: number, size: number, color: string, lineHeight: number) {
    ctx.font = `400 ${size}px ${body}`;
    const out: string[] = []; let line = '';
    for (const word of value.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 880 && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    out.forEach((row, index) => text(row, 540, y + index * lineHeight, size, color));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  text(lines.kicker.toUpperCase(), 540, 190, 30, '#8E96AB', body, 900, 500);
  text(lines.lead, 540, 320, 44, '#C6CCDA');
  text(lines.name, 540, 450, 104, '#EEF1F7', serif);
  const blobs = await allDiscs();
  const discs = await Promise.all(lines.signs.map(async (sign) => {
    const blob = blobs.get(sign.slug);
    try { return blob ? await createImageBitmap(blob) : null; } catch { return null; }
  }));
  const size = lines.signs.length === 2 ? 300 : 380;
  const centres = lines.signs.length === 2 ? [300, 780] : [540];
  lines.signs.forEach((sign, index) => {
    const x = centres[index], top = 640;
    const disc = discs[index];
    ctx.save();
    ctx.beginPath(); ctx.arc(x, top + size / 2, size / 2 + 14, 0, Math.PI * 2);
    ctx.strokeStyle = sign.hue; ctx.globalAlpha = .55; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    if (disc) { ctx.drawImage(disc, x - size / 2, top, size, size); disc.close(); }
    else text(signBySlug(sign.slug).glyph, x, top + size / 2, size * .6, sign.hue, serif);
    text(sign.label, x, top + size + 90, lines.signs.length === 2 ? 50 : 62, sign.hue, serif, lines.signs.length === 2 ? 440 : 900);
  });
  wrapped(lines.caveat, 1330, 30, '#8E96AB', 42);
  text(lines.find, 540, 1560, 34, '#C6CCDA');
  wrapped(lines.privacy, 1660, 24, '#8E96AB', 34);
  await withShareBrandIcon((icon) => drawShareBrandLockup(ctx, icon, { wordmarkX: 1014, centerY: 1850, iconSize: 44, fontSize: 22, serif }));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png encode failed');
  return { blob, filename: 'zodiacs-chart-twin.png' };
}
