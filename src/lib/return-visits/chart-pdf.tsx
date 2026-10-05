import { h, render } from 'preact';
import TechnicalWheel from '../wheel/TechnicalWheel';
import { SIGNS, formatLongitude } from '../signs';
import { planetLabel, aspectLabel } from '../i18n/astrology';
import { localizePath, t, type CatalogLocale } from '../i18n';
import type { Chart } from '../engine/types';
import type { ChartEntry } from '../sharing/chart-entry';
import { returnText as s } from './copy';
import { assembleChartPdf, type PdfImagePage } from './pdf';

const WIDTH = 1800; const HEIGHT = 2546;
export async function prepareClientPdf(chart: Chart, entry: ChartEntry, date: string, locale: CatalogLocale): Promise<Blob> {
  await document.fonts.ready;
  const serif = locale === 'ru' ? '"EB Garamond Cyrillic", Georgia, serif' : '"EB Garamond", Georgia, serif';
  const sans = locale === 'ru' ? '"Golos Text", sans-serif' : '"Instrument Sans", sans-serif';
  await Promise.all([document.fonts.load(`400 54px ${serif}`), document.fonts.load(`400 26px ${sans}`)]);
  const pages: PdfImagePage[] = [];
  const aspects = chart.input.timeKnown ? chart.aspects : chart.aspects.filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon');
  let canvas!: HTMLCanvasElement; let ctx!: CanvasRenderingContext2D; let y = 0;
  function text(value: string, x: number, baseline: number, size = 28, font = sans, width = 1550) {
    ctx.font = `400 ${size}px ${font}`; ctx.fillStyle = '#1b202b';
    // Never clip a long client name or a translated heading.
    while (ctx.measureText(value).width > width && size > 19) { size--; ctx.font = `400 ${size}px ${font}`; }
    ctx.fillText(value, x, baseline, width);
  }
  function paragraph(value: string, top: number, size = 27): number {
    ctx.font = `400 ${size}px ${sans}`;
    const lines: string[] = []; let line = '';
    for (const word of value.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > 1550 && line) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line);
    lines.forEach((line, i) => text(line, 125, top + i * (size * 1.45), size));
    return top + lines.length * (size * 1.45);
  }
  function begin() {
    canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext('2d'); if (!context) throw new Error('canvas unavailable'); ctx = context;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    text(s(locale, 'pdfTitle'), 125, 140, 66, serif);
    text(entry.name.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 60) || 'Zodiacs.org', 125, 205, 34, sans);
    text(s(locale, 'conventions'), 125, 265, 24);
    y = 330;
  }
  async function finish() {
    ctx.strokeStyle = '#d4d8df'; ctx.beginPath(); ctx.moveTo(125, 2380); ctx.lineTo(1675, 2380); ctx.stroke();
    text(`${s(locale, 'accuracy')} · ${chart.input.timeKnown ? s(locale, 'computedInstant') : s(locale, 'referenceInstant')}`, 125, 2420, 23);
    text(`${chart.input.utc.toISOString()} · ${s(locale, 'engine')} ${chart.engineVersion}`, 125, 2460, 22);
    text(`zodiacs.org${localizePath(locale, '/methodology/')} · ${pages.length + 1}`, 125, 2496, 21);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .94));
    if (!jpeg) throw new Error('JPEG encoding failed');
    pages.push({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), width: WIDTH, height: HEIGHT });
  }
  begin();
  y = paragraph(s(locale, 'opening'), y) + 24;
  text(s(locale, 'birthDetails'), 125, y, 34, serif); y += 52;
  text(`${date} · ${entry.timeKnown ? entry.time : s(locale, 'dayTimeUnknown')}`, 125, y, 26); y += 42;
  y = paragraph(entry.city ? `${entry.city.name} · ${entry.city.tz} · ${entry.city.lat.toFixed(4)}, ${entry.city.lon.toFixed(4)}` : '', y, 24) + 22;
  if (!chart.input.timeKnown) y = paragraph(s(locale, 'unknownNote'), y, 24) + 24;
  const signImageHrefs = Object.fromEntries(await Promise.all(SIGNS.map(async (sign) => {
    const response = await fetch(`/assets/zodiac-icons/128/${sign.slug}.webp`);
    if (!response.ok) throw new Error('Sign artwork unavailable');
    return [sign.slug, `data:image/webp;base64,${btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())))}`];
  })));
  const detached = document.createElement('div');
  render(h(TechnicalWheel, { bodies: chart.bodies, asc: chart.angles?.asc, mc: chart.angles?.mc, dsc: chart.angles?.dsc, ic: chart.angles?.ic, cusps: chart.houses?.cusps, aspects, size: 960, signImageHrefs }), detached);
  const svg = detached.querySelector('svg');
  if (!svg) throw new Error('Wheel rendering failed');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.querySelectorAll('text').forEach((node) => node.setAttribute('font-family', 'monospace'));
  const source = new XMLSerializer().serializeToString(svg); render(null, detached);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  const image = new Image();
  try { await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Wheel rendering failed')); image.src = url; });
    ctx.fillStyle = '#060709'; ctx.beginPath(); ctx.roundRect(380, y, 1040, 1040, 28); ctx.fill(); ctx.drawImage(image, 420, y + 40, 960, 960);
  } finally { URL.revokeObjectURL(url); }
  y += 1100;
  text(s(locale, 'positions'), 125, y, 42, serif); y += 65;
  chart.bodies.forEach((body, index) => {
    const column = index >= 6 ? 1 : 0; const row = index % 6; const x = 125 + column * 800;
    text(planetLabel(locale, body.body), x, y + row * 65, 27, sans, 230);
    text(`${formatLongitude(body.lon, locale)}${body.retrograde ? ' · Rx' : ''}`, x + 245, y + row * 65, 26, sans, 500);
  });
  await finish(); begin();
  y = paragraph(s(locale, 'interpretationNote'), y) + 34;
  if (chart.houses) {
    text(s(locale, 'houses'), 125, y, 42, serif); y += 60;
    chart.houses.cusps.forEach((lon, index) => text(`${index + 1} · ${formatLongitude(lon, locale)}`, 125 + (index >= 6 ? 800 : 0), y + (index % 6) * 48, 27));
    y += 350;
  } else y = paragraph(s(locale, 'unknownNote'), y) + 34;
  text(s(locale, 'aspects'), 125, y, 42, serif); y += 70;
  for (const aspect of aspects) {
    if (y > 2250) { await finish(); begin(); text(s(locale, 'aspects'), 125, y, 42, serif); y += 70; }
    const label = `${planetLabel(locale, aspect.a)} · ${aspectLabel(locale, aspect.type)} · ${planetLabel(locale, aspect.b)}`;
    text(label.charAt(0).toLocaleUpperCase() + label.slice(1), 125, y, 28, sans, 1200);
    text(`${aspect.orb.toFixed(2)}°`, 1420, y, 26, sans, 245); y += 52;
  }
  if (y > 2000) { await finish(); begin(); }
  y += 42; text(s(locale, 'details'), 125, y, 38, serif); y += 56;
  y = paragraph(`${s(locale, 'engine')}: ${chart.engineVersion}`, y, 24) + 12;
  if (chart.flags.length) y = paragraph(chart.flags.filter((flag) => flag !== 'outside-reference-span').map((flag) => t(locale, ({ 'dst-gap': 'dstGapNotice', 'dst-fold': 'dstFoldNotice', lmt: 'lmtNotice', 'no-time': 'noTimeNotice', 'polar-fallback': 'polarNotice', 'outside-reference-span': 'trustAccuracyAnswer' } as const)[flag])).join(' · '), y, 24);
  await finish();
  return assembleChartPdf(pages, `https://zodiacs.org${localizePath(locale, '/methodology/')}`);
}
