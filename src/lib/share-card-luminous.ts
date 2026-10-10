/**
 * The luminous chart wheel for the 1080×1350 chart card: a night-sky field,
 * the zodiac as a ring of pastel segments carrying the twelve sign discs,
 * glowing planet orbs in the hue of the sign each one occupies, and the
 * chart's aspects as lit chords across the centre. Everything is drawn on a
 * canvas on the visitor's device; the planet glyphs come from the site's own
 * line-art (PLANET_GLYPH) rasterized from an inline SVG, so nothing is fetched.
 *
 * Orientation follows the chart convention: the Ascendant sits at the left
 * and zodiac longitude runs counter-clockwise. Without angles (no birth time)
 * 0° Aries sits at the left instead.
 */
import type { Chart } from './engine/types';
import { PLANET_GLYPH } from './glyphs/paths';
import { SIGNS } from './signs';

export interface LuminousWheelGeometry {
  cx: number;
  cy: number;
  /** Outer radius of the degree ring. */
  r: number;
}

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const HARMONIOUS = new Set(['trine', 'sextile']);
const TENSE = new Set(['square', 'opposition']);
const SOFT_HUE = '#A9D4C4'; // pisces — easeful aspects
const HARD_HUE = '#DE8E79'; // aries — charged aspects
const INK_0 = '#EEF1F7';
const INK_1 = '#C6CCDA';
const VOID = '#060709';

const norm = (deg: number) => ((deg % 360) + 360) % 360;

function hueFor(lon: number): string {
  return SIGNS[Math.floor(norm(lon) / 30)]?.hue ?? INK_1;
}

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A small deterministic generator, so the same chart always gets the same sky. */
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

function loadSvg(xml: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('glyph raster failed')); };
    img.src = url;
  });
}

interface PlacedBody {
  body: string;
  lon: number;
  radius: number;
  retrograde: boolean;
}

/**
 * Spread bodies that sit within a few degrees of each other onto alternating
 * radii, so a stellium reads as a cluster rather than a pile.
 */
export function placeBodies(bodies: { body: string; lon: number; retrograde?: boolean }[], base: number, step: number): PlacedBody[] {
  const sorted = bodies
    .filter((b) => (BODIES as readonly string[]).includes(b.body))
    .map((b) => ({ body: b.body, lon: norm(b.lon), retrograde: Boolean(b.retrograde) }))
    .sort((a, b) => a.lon - b.lon);
  // Start the walk just after the widest gap, so a cluster that straddles
  // 0° Aries (say 359° and 1°) is walked as one run.
  let startIndex = 0;
  let widest = -1;
  sorted.forEach((b, i) => {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length];
    const gap = sorted.length > 1 ? norm(b.lon - prev.lon) : 360;
    if (gap > widest) { widest = gap; startIndex = i; }
  });
  const ordered = [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
  const placed: PlacedBody[] = [];
  let lane = 0;
  ordered.forEach((b, i) => {
    const prev = ordered[i - 1];
    const close = prev && norm(b.lon - prev.lon) < 7.5;
    lane = close ? (lane + 1) % 3 : 0;
    placed.push({ ...b, radius: base - lane * step });
  });
  return placed;
}

export async function drawLuminousWheel(
  ctx: CanvasRenderingContext2D,
  chart: Pick<Chart, 'bodies' | 'angles' | 'aspects'>,
  discs: Map<string, ImageBitmap | null>,
  geometry: LuminousWheelGeometry,
  canvasSize: { width: number; height: number },
): Promise<void> {
  const { cx, cy, r } = geometry;
  const asc = chart.angles?.asc ?? 0;
  // Canvas angle for a longitude: the Ascendant at 180°, longitude counter-clockwise.
  const angle = (lon: number) => Math.PI + (norm(lon - asc) * Math.PI) / 180;
  const at = (lon: number, radius: number) => {
    const a = angle(lon);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const sun = chart.bodies.find((b) => b.body === 'Sun');
  const moon = chart.bodies.find((b) => b.body === 'Moon');

  // 1. Sky: two soft nebulae in the Sun's and Moon's hues, then a seeded starfield.
  ctx.save();
  const nebula = (x: number, y: number, radius: number, hex: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(hex, alpha));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
  };
  if (sun) { const [x, y] = at(sun.lon, r * 0.55); nebula(x, y, r * 1.25, hueFor(sun.lon), 0.2); }
  if (moon) { const [x, y] = at(moon.lon, r * 0.6); nebula(x, y, r * 0.95, hueFor(moon.lon), 0.14); }
  nebula(cx, cy, r * 0.75, INK_1, 0.05);
  const seed = Math.round(chart.bodies.reduce((sum, b) => sum + b.lon * 1000, 0));
  const rand = seededRandom(seed);
  for (let i = 0; i < 260; i += 1) {
    const x = rand() * canvasSize.width;
    const y = rand() * canvasSize.height;
    const size = rand() ** 3 * 1.9 + 0.35;
    ctx.fillStyle = `rgba(238, 241, 247, ${0.18 + rand() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const bandOuter = r - 18;
  const bandInner = r - 92;
  const planetBase = bandInner - 44;
  const chordRadius = r * 0.44;

  // A faint halo just outside the ring, in the Sun's hue.
  if (sun) {
    const halo = ctx.createRadialGradient(cx, cy, r - 10, cx, cy, r + 70);
    halo.addColorStop(0, rgba(hueFor(sun.lon), 0.16));
    halo.addColorStop(1, rgba(hueFor(sun.lon), 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 70, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Degree ring: a tick per degree, longer every fifth and tenth.
  ctx.save();
  ctx.strokeStyle = rgba(INK_1, 0.42);
  ctx.lineCap = 'round';
  for (let d = 0; d < 360; d += 1) {
    const len = d % 10 === 0 ? 13 : d % 5 === 0 ? 9 : 5;
    const [x1, y1] = at(d, r);
    const [x2, y2] = at(d, r - len);
    ctx.lineWidth = d % 10 === 0 ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(INK_1, 0.5);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Zodiac band: twelve segments in their own hues, each with its disc.
  SIGNS.forEach((sign, i) => {
    const start = i * 30;
    const a0 = angle(start);
    const a1 = angle(start + 30);
    const g = ctx.createRadialGradient(cx, cy, bandInner, cx, cy, bandOuter);
    g.addColorStop(0, rgba(sign.hue, 0.1));
    g.addColorStop(0.7, rgba(sign.hue, 0.32));
    g.addColorStop(1, rgba(sign.hue, 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    // Canvas arcs run clockwise in screen space; longitude runs counter-clockwise.
    ctx.arc(cx, cy, bandOuter, -a0, -a1, true);
    ctx.arc(cx, cy, bandInner, -a1, -a0, false);
    ctx.closePath();
    ctx.fill();
    // Divider
    const [dx1, dy1] = at(start, bandOuter);
    const [dx2, dy2] = at(start, bandInner);
    ctx.strokeStyle = VOID;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx1, dy1);
    ctx.lineTo(dx2, dy2);
    ctx.stroke();
    const disc = discs.get(sign.slug);
    const [x, y] = at(start + 15, (bandOuter + bandInner) / 2);
    const size = 50;
    if (disc) {
      ctx.save();
      ctx.shadowColor = rgba(sign.hue, 0.55);
      ctx.shadowBlur = 18;
      ctx.drawImage(disc, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = sign.hue;
      ctx.beginPath();
      ctx.arc(x, y, size / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.strokeStyle = rgba(INK_1, 0.28);
  ctx.lineWidth = 1;
  for (const radius of [bandOuter, bandInner, chordRadius]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Angles: the horizon (Ascendant–Descendant) and the meridian, as fine light.
  if (chart.angles) {
    ctx.save();
    const axis = (lon: number, alpha: number) => {
      const [x1, y1] = at(lon, bandInner);
      const [x2, y2] = at(lon + 180, bandInner);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, rgba(INK_0, alpha));
      g.addColorStop(0.5, rgba(INK_0, alpha * 0.25));
      g.addColorStop(1, rgba(INK_0, alpha));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    axis(chart.angles.asc, 0.75);
    axis(chart.angles.mc, 0.4);
    ctx.fillStyle = INK_0;
    ctx.font = '500 20px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [lx, ly] = at(chart.angles.asc, r + 30);
    ctx.fillText('ASC', lx, ly);
    const [mx, my] = at(chart.angles.mc, r + 28);
    ctx.fillStyle = rgba(INK_1, 0.8);
    ctx.fillText('MC', mx, my);
    ctx.restore();
  }

  // 5. Aspects: lit chords, easeful in sea-green, charged in coral, brighter when tight.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lonOf = new Map(chart.bodies.map((b) => [b.body, b.lon]));
  for (const aspect of chart.aspects) {
    if (!HARMONIOUS.has(aspect.type) && !TENSE.has(aspect.type)) continue;
    if (aspect.orb >= 6) continue;
    const la = lonOf.get(aspect.a);
    const lb = lonOf.get(aspect.b);
    if (la === undefined || lb === undefined) continue;
    if (!(BODIES as readonly string[]).includes(aspect.a) || !(BODIES as readonly string[]).includes(aspect.b)) continue;
    const hue = HARMONIOUS.has(aspect.type) ? SOFT_HUE : HARD_HUE;
    const strength = 1 - aspect.orb / 6;
    const [x1, y1] = at(la, chordRadius);
    const [x2, y2] = at(lb, chordRadius);
    ctx.shadowColor = rgba(hue, 0.9);
    ctx.shadowBlur = 14;
    ctx.strokeStyle = rgba(hue, 0.25 + strength * 0.55);
    ctx.lineWidth = 1 + strength * 1.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Bodies: a fine pointer to the exact degree, a glowing orb, the glyph in ink.
  const placed = placeBodies(chart.bodies, planetBase, 52);
  const orb = 23;
  ctx.save();
  for (const b of placed) {
    const hue = hueFor(b.lon);
    const [px1, py1] = at(b.lon, bandInner);
    const [px2, py2] = at(b.lon, b.radius + orb + 4);
    ctx.strokeStyle = rgba(hue, 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();
    const [cx2, cy2] = at(b.lon, chordRadius);
    ctx.fillStyle = rgba(hue, 0.95);
    ctx.beginPath();
    ctx.arc(cx2, cy2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    const [x, y] = at(b.lon, b.radius);
    const glow = ctx.createRadialGradient(x, y, orb * 0.6, x, y, orb * 2.6);
    glow.addColorStop(0, rgba(hue, 0.45));
    glow.addColorStop(1, rgba(hue, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, orb * 2.6, 0, Math.PI * 2);
    ctx.fill();
    const fill = ctx.createRadialGradient(x - orb * 0.35, y - orb * 0.4, 1, x, y, orb);
    fill.addColorStop(0, '#FFFFFF');
    fill.addColorStop(0.35, hue);
    fill.addColorStop(1, hue);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, orb, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = VOID;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  const glyphSize = 28;
  const glyphs = placed.map((b) => {
    const [x, y] = at(b.lon, b.radius);
    const markup = PLANET_GLYPH[b.body] ?? '';
    const s = glyphSize / 24;
    const rx = b.retrograde
      ? `<text x="${(x + orb * 0.78).toFixed(1)}" y="${(y - orb * 0.62).toFixed(1)}" font-size="13" font-family="ui-monospace, Menlo, monospace" fill="${INK_0}">R</text>`
      : '';
    return `<g transform="translate(${(x - glyphSize / 2).toFixed(1)} ${(y - glyphSize / 2).toFixed(1)}) scale(${s.toFixed(4)})" fill="none" stroke="${VOID}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" color="${VOID}">${markup.replace(/currentColor/g, VOID)}</g>${rx}`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize.width}" height="${canvasSize.height}" viewBox="0 0 ${canvasSize.width} ${canvasSize.height}">${glyphs}</svg>`;
  try {
    const img = await loadSvg(svg);
    ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
  } catch {
    /* the orbs still read without their glyphs */
  }

  // 7. A small star at the centre.
  ctx.save();
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
  core.addColorStop(0, rgba(INK_0, 0.9));
  core.addColorStop(1, rgba(INK_0, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
