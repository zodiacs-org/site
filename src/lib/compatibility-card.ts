/**
 * The compatibility share card.
 *
 * A relationship is two charts touching, so the card draws that: a bi-wheel
 * with one person's planets on the inner ring, the other's on the outer, and
 * their tightest contacts as chords straight across the middle. At the size
 * a social timeline renders this, the picture has to carry it before a word
 * is read — the verdict and the receipts sit under the wheel, not instead
 * of it.
 *
 * Contacts come through rankedContacts, which puts the generational
 * self-conjunctions last. Pluto conjunct Pluto is exact for everyone born in
 * the same handful of years; leading a couple's card with it says nothing
 * about them.
 */
import { rankedContacts, type PairSummary, type MinimalBody } from './engine/synastry';
import type { CatalogLocale as Locale } from './i18n';
import { aspectLabel, planetLabel } from './i18n/astrology';
import { degreeInSign, SIGNS, signForLongitude, signName } from './signs';
import { collisionNudge } from './scene/layout';
import { shareCardText } from './share-card-copy';
import { savePngBlob, type CardOutcome } from './share-card';
import {
  PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  drawShareBrandLockup,
  withShareBrandIcon,
} from './share-card-brand';

export interface CompatibilityCardPerson {
  /** The display label the user chose; no birth input is accepted here. */
  label: string;
  bodies: MinimalBody[];
  asc: number | null;
}

const W = 1080;
const H = 1350;
const BG = '#060709';
const VOID_1 = '#0A0C11';
const INK = '#EEF1F7';
const MUTED = '#8E96AB';
const FAINT = '#6C7488';
const HAIR = 'rgba(198, 204, 218, 0.12)';
const SERIF = '"EB Garamond", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
export const COMPATIBILITY_CARD_BRAND_LAYOUT = Object.freeze({
  ...PORTRAIT_SHARE_CARD_BRAND_LAYOUT,
  centerY: 76,
});

/** Wheel geometry. The band sits outermost; the two rings nest inside it. */
const CX = 540;
const CY = 616;
const R_BAND_OUT = 292;
const R_BAND_IN = 250;
const R_ICON = 271;
const R_THEIRS = 214;
const R_YOURS = 148;

const GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
};

const ASPECT_COLOR: Record<string, string> = {
  conjunction: 'rgba(238,241,247,0.62)',
  sextile: 'rgba(169,212,196,0.72)',
  trine: 'rgba(182,212,228,0.78)',
  square: 'rgba(222,142,121,0.78)',
  opposition: 'rgba(224,169,180,0.78)',
};

const RAD = Math.PI / 180;

function placementRows(person: CompatibilityCardPerson, locale: Locale) {
  const rows = [
    { key: 'sun' as const, lon: person.bodies.find((body) => body.body === 'Sun')?.lon },
    { key: 'moon' as const, lon: person.bodies.find((body) => body.body === 'Moon')?.lon },
    { key: 'rising' as const, lon: person.asc ?? undefined },
  ];
  return rows.map(({ key, lon }) => {
    if (lon === undefined) {
      return { key, label: shareCardText(locale, key), sign: null, slug: null, degree: null };
    }
    const sign = signForLongitude(lon);
    return {
      key,
      label: shareCardText(locale, key),
      sign: signName(sign, locale),
      slug: sign.slug,
      degree: degreeInSign(lon),
    };
  });
}

/**
 * One person's Big Three as the picture prints it. The rising sign's degree
 * is only whole, as the two-chart link keeps it: rounded to the nearest
 * degree, beside the link's whole degree, it would halve the range the link
 * leaves for the ascendant.
 */
export function compatibilityPlacementLine(person: CompatibilityCardPerson, locale: Locale = 'en'): string {
  return placementRows(person, locale)
    .map((row) => (row.sign
      ? `${row.sign} ${row.key === 'rising' ? Math.floor(row.degree!) : row.degree!.toFixed(0)}°`
      : '—'))
    .join('  ·  ');
}

export function compatibilityHeadline(summary: Pick<PairSummary, 'easeful' | 'charged'>, locale: Locale = 'en'): string {
  if (summary.easeful > summary.charged) return shareCardText(locale, 'compatibilityFlow');
  if (summary.charged > summary.easeful) return shareCardText(locale, 'compatibilityCharge');
  return shareCardText(locale, 'compatibilityBalance');
}

async function loadIcon(slug: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(`/assets/zodiac-icons/128/${slug}.webp`);
    if (!response.ok) return null;
    return createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  initial: number,
  minimum: number,
  family = SERIF,
  weight = 500,
): number {
  let size = initial;
  while (size > minimum) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/**
 * Wheel coordinates. 0° Aries sits at the left and longitude runs
 * counterclockwise — the same `180 + lon` mapping Wheel.tsx uses, so a
 * chart shaped one way in the app is not mirrored on the card.
 */
function at(lon: number, radius: number): { x: number; y: number } {
  const angle = (180 + lon) * RAD;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/** The ten aspect bodies, fanned apart where they would otherwise stack. */
function ringPoints(bodies: MinimalBody[]): { body: string; lon: number; drawLon: number }[] {
  const drawable = bodies.filter((body) => GLYPH[body.body]);
  const nudged = collisionNudge(drawable);
  return drawable.map((body) => ({
    body: body.body,
    lon: body.lon,
    drawLon: nudged.get(body.body) ?? body.lon,
  }));
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  point: { body: string; drawLon: number; lon: number },
  radius: number,
  dashed: boolean,
) {
  const { x, y } = at(point.drawLon, radius);
  const hue = SIGNS[Math.floor((((point.lon % 360) + 360) % 360) / 30)].hue;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 23, 0, Math.PI * 2);
  ctx.fillStyle = VOID_1;
  ctx.fill();
  ctx.strokeStyle = hue;
  ctx.lineWidth = 2.4;
  if (dashed) ctx.setLineDash([5, 3.4]);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.font = `400 25px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(GLYPH[point.body] ?? '', x, y + 1);
}

export async function drawCompatibilityCard(
  a: CompatibilityCardPerson,
  b: CompatibilityCardPerson,
  summary: PairSummary,
  locale: Locale = 'en',
): Promise<Blob> {
  const people = [a, b];
  const signIcons = await Promise.all(SIGNS.map((sign) => loadIcon(sign.slug)));
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(`500 54px ${SERIF}`),
    document.fonts.load(`400 24px ${MONO}`),
  ]).catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (typeof ctx.roundRect === 'function') {
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(28.5, 28.5, W - 57, H - 57, 26);
    ctx.stroke();
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  ctx.fillStyle = MUTED;
  ctx.font = `italic 400 32px ${SERIF}`;
  ctx.fillText(shareCardText(locale, 'compatibilityTitle'), W / 2, 96);

  // ── Names, with the marks that identify each ring ──────────────────
  const pairName = `${a.label}  ×  ${b.label}`;
  const pairSize = fitText(ctx, pairName, W - 190, 58, 32);
  ctx.fillStyle = INK;
  ctx.font = `500 ${pairSize}px ${SERIF}`;
  ctx.fillText(pairName, W / 2, 168);

  // ── The bi-wheel ───────────────────────────────────────────────────
  ctx.save();
  SIGNS.forEach((sign, index) => {
    const from = (180 + index * 30) * RAD;
    const to = (180 + (index + 1) * 30) * RAD;
    ctx.beginPath();
    ctx.arc(CX, CY, R_BAND_OUT, -from, -to, true);
    ctx.arc(CX, CY, R_BAND_IN, -to, -from);
    ctx.closePath();
    ctx.fillStyle = sign.hue;
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.restore();

  signIcons.forEach((icon, index) => {
    if (!icon) return;
    const { x, y } = at(index * 30 + 15, R_ICON);
    ctx.globalAlpha = 0.92;
    ctx.drawImage(icon, x - 15, y - 15, 30, 30);
    ctx.globalAlpha = 1;
  });

  [R_THEIRS, R_YOURS].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(CX, CY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  const yours = ringPoints(a.bodies);
  const theirs = ringPoints(b.bodies);
  const yoursAt = new Map(yours.map((point) => [point.body, at(point.drawLon, R_YOURS)]));
  const theirsAt = new Map(theirs.map((point) => [point.body, at(point.drawLon, R_THEIRS)]));

  // Chords first, so the discs sit on top of their own connections.
  const drawn = rankedContacts(summary.aspects).slice(0, 5);
  drawn.forEach((contact, index) => {
    const from = yoursAt.get(contact.a);
    const to = theirsAt.get(contact.b);
    if (!from || !to) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = ASPECT_COLOR[contact.type] ?? 'rgba(198,204,218,0.5)';
    ctx.lineWidth = index === 0 ? 2.6 : 1.6;
    ctx.globalAlpha = index === 0 ? 1 : 0.68;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  theirs.forEach((point) => drawBody(ctx, point, R_THEIRS, true));
  yours.forEach((point) => drawBody(ctx, point, R_YOURS, false));

  // ── Verdict, then the receipts that earned it ──────────────────────
  const headline = compatibilityHeadline(summary, locale);
  const headlineSize = fitText(ctx, headline, W - 150, 56, 36);
  ctx.fillStyle = INK;
  ctx.font = `500 ${headlineSize}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText(headline, W / 2, 950);

  ctx.fillStyle = FAINT;
  ctx.font = `400 21px ${MONO}`;
  ctx.fillText(shareCardText(locale, 'tightestContacts'), W / 2, 1012);
  drawn.slice(0, 3).forEach((aspect, index) => {
    const contact = `${planetLabel(locale, aspect.a)} ${aspectLabel(locale, aspect.type)} ${planetLabel(locale, aspect.b)} · ${aspect.orb.toFixed(1)}°`;
    const size = fitText(ctx, contact, W - 180, index === 0 ? 36 : 30, 22);
    ctx.fillStyle = index === 0 ? INK : MUTED;
    ctx.font = `500 ${size}px ${SERIF}`;
    ctx.fillText(contact, W / 2, 1062 + index * 45);
  });

  // ── Both big threes, one compact line each ─────────────────────────
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 1188);
  ctx.lineTo(W - 120, 1188);
  ctx.stroke();

  people.forEach((person, personIndex) => {
    const y = 1222 + personIndex * 42;
    const placements = compatibilityPlacementLine(person, locale);
    ctx.textAlign = 'left';
    ctx.fillStyle = FAINT;
    ctx.font = `400 20px ${MONO}`;
    const marker = personIndex === 0 ? '—' : '┄';
    ctx.fillText(`${marker}  ${person.label}`, 120, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = MUTED;
    const size = fitText(ctx, placements, 700, 25, 17);
    ctx.font = `500 ${size}px ${SERIF}`;
    ctx.fillText(placements, W - 120, y);
  });

  await withShareBrandIcon((brandIcon) => {
    drawShareBrandLockup(ctx, brandIcon, {
      ...COMPATIBILITY_CARD_BRAND_LAYOUT,
      serif: SERIF,
    });
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('png encode failed');
  return blob;
}

export async function saveCompatibilityCard(
  a: CompatibilityCardPerson,
  b: CompatibilityCardPerson,
  summary: PairSummary,
  locale: Locale = 'en',
): Promise<CardOutcome> {
  const blob = await drawCompatibilityCard(a, b, summary, locale);
  return savePngBlob(blob, 'zodiacs-compatibility.png');
}
