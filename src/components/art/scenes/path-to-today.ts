/**
 * "The path to today" (Living Chart, no moments yet). A ruled path on the
 * ground enters far away at the horizon on the left and sweeps forward to
 * today, a white light in the near foreground on the right whose ripples
 * spread over the ground. Five moments stand beside the path on stems,
 * beads in sign hues, smaller and fainter the further back they are; they
 * rise one after another, oldest first. A light runs along the path towards
 * today. Stars only above the horizon, in the ring's treatment.
 *
 * The design space matches the figure's box (wide and short), so the scene
 * uses all of it; the stylesheet fades only the left and right ends and the
 * top of the sky, where nothing important sits.
 */
import { SIGNS } from '../../../lib/signs';
import { drawStars, glow, makeStars, rgb, TAU, type Scene } from './scene';

const WIDTH = 400;
const HEIGHT = 225;
const HORIZON = 60;
/** The camera's focal length, in design units at unit depth. */
const FOCAL = 400;
const NEAR = 2.95;
const FAR = 44;
const HALF_WIDTH = 0.3;
/** The eye's height over the ground, in world units. */
const CAMERA_HEIGHT = 1.1;
const HUES = SIGNS.map((sign) => rgb(sign.hue));
const STARS = makeStars(21, 150);
const CYCLE = 14;
const TODAY_DEPTH = 3.35;

/** Depth for u from 0 (the horizon end) to 1 (the near end), even on screen. */
function depth(u: number): number {
  return 1 / (1 / FAR + (1 / NEAR - 1 / FAR) * u);
}

function screenDepth(z: number): number {
  return (1 / z - 1 / FAR) / (1 / NEAR - 1 / FAR);
}

/**
 * The centre line, drawn on screen: x for u from the horizon (0) to the near
 * end (1), a Catmull-Rom curve through these points. Rising from the far
 * left, it sweeps forward and to the right to today.
 */
const LINE_U = [0, 0.2, 0.45, 0.7, 0.92, 1];
const LINE_X = [58, 100, 172, 222, 290, 312];

function centreX(u: number): number {
  let i = 0;
  while (i < LINE_U.length - 2 && u > LINE_U[i + 1]) i += 1;
  const u0 = LINE_U[i];
  const u1 = LINE_U[i + 1];
  const local = (u - u0) / (u1 - u0);
  const slope = (k: number) => {
    const a = Math.max(0, k - 1);
    const b = Math.min(LINE_U.length - 1, k + 1);
    return ((LINE_X[b] - LINE_X[a]) / (LINE_U[b] - LINE_U[a])) * (u1 - u0);
  };
  const h = Math.min(1, Math.max(0, local));
  const h2 = h * h;
  const h3 = h2 * h;
  return (2 * h3 - 3 * h2 + 1) * LINE_X[i] + (h3 - 2 * h2 + h) * slope(i) + (-2 * h3 + 3 * h2) * LINE_X[i + 1] + (h3 - h2) * slope(i + 1);
}

/** A point on the ground at depth z, `off` world units across the path. */
function ground(z: number, off = 0) {
  if (off === 0) {
    const s = FOCAL / z;
    return { x: centreX(screenDepth(z)), y: HORIZON + CAMERA_HEIGHT * s, s };
  }
  // Step `off` across the path on the ground, square to its direction there.
  const dz = 0.01 * z;
  const slope = (worldX(z + dz) - worldX(z - dz)) / (2 * dz);
  const norm = Math.hypot(1, slope);
  const wz = z - (off * slope) / norm;
  const wx = worldX(z) + off / norm;
  const s = FOCAL / wz;
  return { x: WIDTH / 2 + wx * s, y: HORIZON + CAMERA_HEIGHT * s, s };
}

/** The centre line's position across the ground, in world units, at depth z. */
function worldX(z: number): number {
  return ((centreX(screenDepth(z)) - WIDTH / 2) * z) / FOCAL;
}

/** How strongly a thing at depth z is drawn: 1 near, fading towards the horizon. */
function nearness(z: number): number {
  return Math.min(1, Math.max(0, (FAR - z) / (FAR - NEAR)) ** 0.8 * 1.15);
}

/** The five moments, evenly spaced on screen on the far side of the path: depth, side and sign hue. */
const MOMENTS = [
  { z: 15, side: 1, hue: 2 },
  { z: 9.3, side: 1, hue: 11 },
  { z: 7, side: 1, hue: 4 },
  { z: 5.45, side: 1, hue: 9 },
  { z: 4.45, side: 1, hue: 6 },
] as const;

function edge(ctx: CanvasRenderingContext2D, off: number, line: string) {
  // Drawn in short pieces so the weight and alpha can grow towards today.
  let previous = ground(FAR, off);
  for (let step = 1; step <= 120; step += 1) {
    const z = depth(step / 120);
    const point = ground(z, off);
    // Past today the path fades out rather than meeting the box's edge.
    const beyond = z < TODAY_DEPTH ? Math.max(0, (z - NEAR) / (TODAY_DEPTH - NEAR)) : 1;
    const near = nearness(z);
    ctx.strokeStyle = `rgba(${line},${(0.12 + 0.78 * near) * beyond})`;
    ctx.lineWidth = 0.45 + 0.75 * near;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    previous = point;
  }
}

const scene: Scene = {
  width: WIDTH,
  height: HEIGHT,
  still: 9.5,
  // Open with four moments standing and the fifth rising.
  start: 3.6,
  draw(ctx, t, view, { palette }) {
    const { ink, line } = palette;

    // Stars above the horizon only, thinning as they reach it.
    const sky = { x0: view.x0, y0: view.y0, w: view.w, h: HORIZON - 2 - view.y0 };
    drawStars(ctx, STARS, t, sky, ink, [HUES[6], HUES[3]], (_x, y) => Math.min(1, (HORIZON - y) / 26));

    // The horizon: a soft band of light and a fine line.
    const band = ctx.createLinearGradient(0, HORIZON - 26, 0, HORIZON + 22);
    band.addColorStop(0, `rgba(${HUES[7]},0)`);
    band.addColorStop(0.55, `rgba(${HUES[6]},0.11)`);
    band.addColorStop(1, `rgba(${HUES[7]},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(view.x0, HORIZON - 26, view.w, 48);
    ctx.strokeStyle = `rgba(${line},0.4)`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(view.x0, HORIZON + 0.5);
    ctx.lineTo(view.x0 + view.w, HORIZON + 0.5);
    ctx.stroke();

    // Rungs across the path, every 0.55 world units, every fifth one full width.
    for (let index = 0; ; index += 1) {
      const z = TODAY_DEPTH + 0.15 + index * 0.55;
      if (z > FAR) break;
      const near = nearness(z);
      const full = index % 5 === 0;
      const a = ground(z, -HALF_WIDTH);
      const b = ground(z, full ? HALF_WIDTH : -HALF_WIDTH * 0.15);
      ctx.strokeStyle = `rgba(${line},${(full ? 0.85 : 0.5) * (0.1 + 0.9 * near)})`;
      ctx.lineWidth = (full ? 0.5 : 0.4) + 0.5 * near;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    edge(ctx, -HALF_WIDTH, line);
    edge(ctx, HALF_WIDTH, line);

    // A light running along the path towards today.
    const run = (t / 7) % 1;
    for (let k = 0; k < 22; k += 1) {
      const u = run - k * 0.012;
      if (u < 0) continue;
      const z = depth(u * 0.985);
      if (z < TODAY_DEPTH + 0.2) continue;
      const point = ground(z);
      const near = nearness(z);
      glow(ctx, point.x, point.y, 1.2 + point.s * 0.03, ink, (1 - k / 22) * 0.55 * (0.25 + 0.75 * near));
    }

    // The moments rise one after another, oldest first, stay, then fade together.
    const cycle = (t % CYCLE) / CYCLE;
    const fadeOut = cycle > 0.94 ? (1 - cycle) / 0.06 : 1;
    MOMENTS.forEach(({ z, side, hue }, index) => {
      const rise = Math.max(0, Math.min(1, (t % CYCLE - 0.4 - index * 0.75) / 0.9));
      const shown = (1 - (1 - rise) ** 3) * fadeOut;
      if (shown <= 0) return;
      const foot = ground(z, side * (HALF_WIDTH + 0.17));
      const near = nearness(z);
      const colour = HUES[hue];
      const height = 0.7 * foot.s * shown;
      // The farthest beads keep a floor size so all five read on a phone.
      const radius = Math.max(3.1, 0.09 * foot.s);
      const alpha = (0.55 + 0.45 * near) * Math.min(1, shown * 1.4);
      const top = foot.y - height;
      // A soft pool of light on the ground where the stem stands.
      ctx.save();
      ctx.translate(foot.x, foot.y);
      ctx.scale(1, 0.3);
      glow(ctx, 0, 0, radius * 2.4, colour, 0.32 * alpha);
      ctx.restore();
      ctx.strokeStyle = `rgba(${colour},${0.75 * alpha})`;
      ctx.lineWidth = 0.6 + 0.6 * near;
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      ctx.lineTo(foot.x, top);
      ctx.stroke();
      glow(ctx, foot.x, top, radius * 3.4, colour, 0.4 * alpha);
      ctx.fillStyle = `rgba(${colour},${alpha})`;
      ctx.beginPath();
      ctx.arc(foot.x, top, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.4 * alpha})`;
      ctx.beginPath();
      ctx.arc(foot.x - radius * 0.32, top - radius * 0.32, radius * 0.36, 0, TAU);
      ctx.fill();
    });

    // Today: the brightest thing, a white light on a stem in the foreground,
    // its ripples spreading over the ground.
    const today = ground(TODAY_DEPTH);
    for (let k = 0; k < 3; k += 1) {
      const phase = (t / 3 + k / 3) % 1;
      const rx = 7 + phase * 40;
      ctx.strokeStyle = `rgba(${ink},${(1 - phase) ** 1.5 * 0.75})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(today.x, today.y, rx, rx * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${ink},0.35)`;
    ctx.beginPath();
    ctx.ellipse(today.x, today.y, 5, 1.6, 0, 0, TAU);
    ctx.fill();
    const top = today.y - 0.72 * today.s;
    const stem = ctx.createLinearGradient(0, today.y, 0, top);
    stem.addColorStop(0, `rgba(${ink},0.5)`);
    stem.addColorStop(1, `rgba(${ink},0.95)`);
    ctx.strokeStyle = stem;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(today.x, today.y);
    ctx.lineTo(today.x, top);
    ctx.stroke();
    glow(ctx, today.x, top, 30, ink, 0.32);
    glow(ctx, today.x, top, 13, ink, 0.7);
    ctx.fillStyle = `rgb(${ink})`;
    ctx.beginPath();
    ctx.arc(today.x, top, 6, 0, TAU);
    ctx.fill();
  },
};

export default scene;
