/**
 * "The path to today" (Living Chart, no moments yet): a ruled path that
 * winds back to the horizon under a band of stars, a light running along
 * it, five moments rising on stems in sign hues one after another, and
 * today in front as a white light whose rings spread over the ground.
 */
import { SIGNS } from '../../../lib/signs';
import { drawStars, glow, makeStars, rgb, TAU, type Scene } from './scene';

const HORIZON = 74;
const HUES = SIGNS.map((sign) => rgb(sign.hue));
const STARS = makeStars(21, 130);
/** Where each moment stands along the path (0 near, 1 at the horizon) and its sign. */
const MOMENTS = [
  [0.16, 2],
  [0.33, 3],
  [0.49, 4],
  [0.63, 9],
  [0.76, 8],
] as const;
const CYCLE = 13;

/** A point on the path, u from 0 (near) to 1 (the horizon), off units across it. */
function along(u: number, off = 0) {
  const depth = 640 - u * 565;
  const s = 118 / depth;
  const across = 58 * Math.sin(u * 3.4 + 0.5) * (1 - 0.35 * u) + off;
  return { x: 205 + across * s * 3.1 - u * 26, y: HORIZON + 92 * s, s };
}

const scene: Scene = {
  width: 400,
  height: 240,
  still: 9,
  draw(ctx, t, view, { palette }) {
    const { ink, line } = palette;
    const sky = { x0: view.x0, y0: view.y0, w: view.w, h: HORIZON + 22 - view.y0 };
    drawStars(ctx, STARS, t, sky, ink, [HUES[6], HUES[3]], (_x, y) => Math.max(0, 1 - (y - view.y0) / (HORIZON + 36 - view.y0)));

    // The horizon's glow and its line.
    const band = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 26);
    band.addColorStop(0, `rgba(${HUES[7]},0)`);
    band.addColorStop(0.6, `rgba(${HUES[6]},0.1)`);
    band.addColorStop(1, `rgba(${HUES[7]},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(view.x0, HORIZON - 30, view.w, 56);
    ctx.strokeStyle = `rgba(${line},0.35)`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(24, HORIZON + 18);
    ctx.lineTo(376, HORIZON + 18);
    ctx.stroke();

    // The path's two edges, fading towards the horizon, and its rungs.
    for (const off of [-9, 9]) {
      ctx.beginPath();
      for (let step = 0; step <= 100; step += 1) {
        const q = along(step / 100, off);
        if (step === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      const edge = ctx.createLinearGradient(0, HORIZON + 16, 0, 236);
      edge.addColorStop(0, `rgba(${line},0.05)`);
      edge.addColorStop(1, `rgba(${line},0.75)`);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    for (let step = 0; step <= 90; step += 1) {
      const u = step / 90;
      const a = along(u, -9);
      const b = along(u, step % 5 ? -5.5 : 9);
      ctx.strokeStyle = `rgba(${line},${Math.min(0.7, a.s * 0.55) * (step % 5 ? 0.6 : 1)})`;
      ctx.lineWidth = 0.5 + a.s * 0.25;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // A light running along the middle of the path.
    const run = (t * 0.11) % 1;
    for (let k = 0; k < 26; k += 1) {
      const u = run - k * 0.006;
      if (u < 0) continue;
      const q = along(u);
      glow(ctx, q.x, q.y, 2.2 * q.s + 1, ink, (1 - k / 26) * 0.5 * Math.min(1, q.s));
    }

    // The moments rise one after another, stay, and fade before the cycle repeats.
    const cycle = (t % CYCLE) / CYCLE;
    MOMENTS.forEach(([u, hue], index) => {
      const shown = Math.max(0, Math.min(1, (cycle * CYCLE - index * 0.7) / 0.6)) * (cycle > 0.93 ? (1 - cycle) / 0.07 : 1);
      if (shown <= 0) return;
      const q = along(u);
      const height = 46 * q.s + 6;
      const radius = 4.4 * q.s + 1.6;
      const colour = HUES[hue];
      const alpha = Math.min(1, 0.35 + q.s * 0.75) * shown;
      ctx.strokeStyle = `rgba(${colour},${alpha * 0.8})`;
      ctx.lineWidth = 0.7 + q.s * 0.3;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x, q.y - height);
      ctx.stroke();
      glow(ctx, q.x, q.y, 5 * q.s + 2, colour, 0.35 * alpha);
      glow(ctx, q.x, q.y - height, radius * 3.2, colour, 0.45 * alpha);
      ctx.fillStyle = `rgba(${colour},${alpha})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y - height, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.35 * alpha})`;
      ctx.beginPath();
      ctx.arc(q.x - radius * 0.3, q.y - height - radius * 0.3, radius * 0.34, 0, TAU);
      ctx.fill();
    });

    // Today: a white light on a stem, its rings spreading over the ground.
    const today = along(0.9);
    for (let k = 0; k < 2; k += 1) {
      const phase = (t * 0.5 + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(${ink},${(1 - phase) * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(today.x, today.y, 8 + phase * 26, (8 + phase * 26) * 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${ink},0.9)`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(today.x, today.y);
    ctx.lineTo(today.x, today.y - 64);
    ctx.stroke();
    glow(ctx, today.x, today.y - 64, 26, ink, 0.5);
    ctx.fillStyle = `rgb(${ink})`;
    ctx.beginPath();
    ctx.arc(today.x, today.y - 64, 6.5, 0, TAU);
    ctx.fill();
  },
};

export default scene;
