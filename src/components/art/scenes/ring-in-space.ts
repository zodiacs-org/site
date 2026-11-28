/**
 * "The ring in space" (saved charts, no chart yet): the zodiac as a ring
 * tilted in space, the twelve sign icons as beads joined by arcs in their
 * own hues, engraved ticks, two inner orbits with three dashed places
 * waiting for planets and one body, a soft light at the centre and a field
 * of stars behind. The ring turns once in about 140 s. Depth is drawn by
 * scale and alpha: the back half first and faint, the front half last.
 */
import { SIGNS } from '../../../lib/signs';
import { drawStars, glow, makeStars, rgb, softGlow, TAU, type Scene } from './scene';

const CX = 200;
const CY = 120;
const KY = 0.44;
const R = 112;
const HUES = SIGNS.map((sign) => rgb(sign.hue));
const STARS = makeStars(7, 210);
const TURN = TAU / 140;

interface Projected { x: number; y: number; p: number; z: number }

/** A point on a circle of radius r, tilted by ky, seen in perspective, then rotated in the picture plane by rot. */
function project(angle: number, radius: number, ky: number, rot = 0): Projected {
  const x = radius * Math.cos(angle);
  const z = radius * Math.sin(angle);
  const p = 1 / (1 - z / 760);
  let sx = x * p;
  let sy = z * ky * p;
  if (rot) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    [sx, sy] = [sx * c - sy * s, sx * s + sy * c];
  }
  return { x: CX + sx, y: CY + sy, p, z };
}

function orbit(ctx: CanvasRenderingContext2D, radius: number, ky: number, rot: number, front: boolean, alpha: number, width: number, colour: string) {
  ctx.strokeStyle = `rgba(${colour},${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  let pen = false;
  for (let degree = 0; degree <= 360; degree += 2) {
    const q = project((degree * Math.PI) / 180, radius, ky, rot);
    if ((q.z >= 0) === front) {
      if (pen) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      pen = true;
    } else pen = false;
  }
  ctx.stroke();
}

function ticks(ctx: CanvasRenderingContext2D, turn: number, front: boolean, line: string) {
  for (let step = 0; step < 144; step += 1) {
    const angle = (step * 2.5 * Math.PI) / 180 + turn;
    const inner = project(angle, R - 9, KY);
    if ((inner.z >= 0) !== front) continue;
    const big = step % 12 === 0;
    const mid = step % 4 === 0;
    const outer = project(angle, R - 9 + (big ? 7 : mid ? 5 : 3), KY);
    ctx.strokeStyle = `rgba(${line},${front ? (big ? 0.8 : 0.5) : big ? 0.3 : 0.16})`;
    ctx.lineWidth = 0.6 * inner.p;
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  }
}

function beads(ctx: CanvasRenderingContext2D, turn: number, front: boolean, icons: HTMLImageElement[]) {
  for (let index = 0; index < 12; index += 1) {
    const angle = turn + ((index * 30 + 15) * Math.PI) / 180;
    const q = project(angle, R, KY);
    if ((q.z >= 0) !== front) continue;
    const size = (front ? 21 : 17) * q.p;
    // The arc in this sign's hue, on to the next bead.
    ctx.strokeStyle = `rgba(${HUES[index]},${front ? 0.9 : 0.36})`;
    ctx.lineWidth = (front ? 2.2 : 1.2) * q.p;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 5; k <= 25; k += 2) {
      const point = project(turn + ((index * 30 + 15 + k) * Math.PI) / 180, R, KY);
      if (k === 5) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (front) glow(ctx, q.x, q.y, size * 1.25, HUES[index], 0.32);
    const icon = icons[index];
    if (icon?.complete && icon.naturalWidth) {
      ctx.globalAlpha = front ? 1 : 0.62;
      ctx.drawImage(icon, q.x - size / 2, q.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
  }
}

/** Inner orbits: radius, tilt, rotation in the picture plane, angular speed, and the hues of what rides them. */
const ORBITS = [
  { radius: 74, ky: 0.36, rot: -0.42, speed: -0.11, hues: [1, 5, 9], places: true },
  { radius: 48, ky: 0.5, rot: 0.5, speed: 0.19, hues: [3], places: false },
] as const;

const scene: Scene = {
  width: 400,
  height: 240,
  still: 9,
  images: SIGNS.map((sign) => `/assets/zodiac-icons/128/${sign.slug}.webp`),
  draw(ctx, t, view, { images, palette }) {
    const { ink, line } = palette;
    // Stars thin out towards the box's edges, so the field dissolves into
    // the panel under the stylesheet's mask with no edge of its own.
    const edge = (x: number, y: number) => {
      const dx = (x - (view.x0 + view.w / 2)) / (view.w / 2);
      const dy = (y - (view.y0 + view.h / 2)) / (view.h / 2);
      const reach = Math.hypot(dx, dy);
      return reach < 0.55 ? 1 : Math.max(0, 1 - (reach - 0.55) / 0.4);
    };
    drawStars(ctx, STARS, t, view, ink, [HUES[6], HUES[3]], edge);
    const turn = t * TURN;
    glow(ctx, CX, CY, 120, HUES[7], 0.08);

    // The back half of the ring.
    orbit(ctx, R + 10, KY, 0, false, 0.22, 0.6, line);
    orbit(ctx, R - 10, KY, 0, false, 0.22, 0.6, line);
    ticks(ctx, turn, false, line);
    beads(ctx, turn, false, images);

    for (const { radius, ky, rot } of ORBITS) orbit(ctx, radius, ky, rot, false, 0.2, 0.6, line);
    // The centre: a wide, faint halo and a small, tight core.
    softGlow(ctx, CX, CY, 46, HUES[3], 0.2);
    softGlow(ctx, CX, CY, 11, ink, 0.75);
    ctx.fillStyle = `rgb(${ink})`;
    ctx.beginPath();
    ctx.arc(CX, CY, 2.6, 0, TAU);
    ctx.fill();

    for (const { radius, ky, rot, speed, hues, places } of ORBITS) {
      orbit(ctx, radius, ky, rot, true, 0.5, 0.7, line);
      hues.forEach((hue, k) => {
        const q = project(t * speed + (k * TAU) / 3, radius, ky, rot);
        const front = q.z >= 0;
        const size = (places ? 5.2 : 4.2) * q.p;
        if (places) {
          ctx.setLineDash([1.6, 2.2]);
          ctx.strokeStyle = `rgba(${HUES[hue]},${front ? 0.95 : 0.4})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(q.x, q.y, size, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          glow(ctx, q.x, q.y, size * 3, HUES[hue], 0.5);
          ctx.fillStyle = `rgb(${HUES[hue]})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, size, 0, TAU);
          ctx.fill();
        }
      });
    }

    // The front half, drawn last.
    orbit(ctx, R + 10, KY, 0, true, 0.7, 0.8, line);
    orbit(ctx, R - 10, KY, 0, true, 0.7, 0.8, line);
    ticks(ctx, turn, true, line);
    beads(ctx, turn, true, images);
  },
};

export default scene;
